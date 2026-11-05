import pool, { query, getClient } from '../db/pool';
import {
  getLoyaltyBalance,
  postMilesDebit,
  postMilesCredit,
} from '../adapters/loyaltyAdapter';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CreateBookingInput {
  passengerId: string;
  flightId: string;
  seatPreference: 'window' | 'aisle' | 'middle';
  paymentMethod: 'miles' | 'card';
  cabinClass?: string;
}

export interface RebookInput {
  bookingId: string;
  passengerId: string;
  newFlightId: string;
  paymentMethod: 'miles' | 'card';
}

export interface BookingEntity {
  bookingId: string;
  passengerId: string;
  flightId: string;
  seatNumber: string | null;
  seatPreference: string;
  cabinClass: string;
  status: 'confirmed' | 'cancelled' | 'rebooked';
  fareAmount: number;
  currency: string;
  paymentMethod: string;
  boardingPassUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CheckInResult {
  eligible: boolean;
  reason?: string;
  boardingPassUrl?: string;
}

export interface FareDifference {
  originalFare: number;
  newFare: number;
  difference: number;
  currency: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function generateBoardingPassUrl(bookingId: string): string {
  return `/docs/bp_${bookingId}.pdf`;
}

/**
 * Derives a stable integer key from a string (for pg_advisory_lock).
 * Uses a simple djb2-style hash reduced to a 32-bit signed integer.
 */
function advisoryLockKey(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    hash = hash & hash; // keep it 32-bit signed
  }
  return hash;
}

async function getFlightById(flightId: string): Promise<{
  flightId: string;
  departureTime: Date;
  arrivalTime: Date;
  origin: string;
  destination: string;
  fareAmount: number;
  currency: string;
  cabinClass: string;
  availableSeats: number;
} | null> {
  const result = await query(
    `SELECT
       flight_id       AS "flightId",
       departure_time  AS "departureTime",
       arrival_time    AS "arrivalTime",
       origin,
       destination,
       fare_amount     AS "fareAmount",
       currency,
       cabin_class     AS "cabinClass",
       available_seats AS "availableSeats"
     FROM flights
     WHERE flight_id = $1`,
    [flightId]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

async function getBookingById(bookingId: string): Promise<{
  bookingId: string;
  passengerId: string;
  flightId: string;
  seatPreference: string;
  cabinClass: string;
  status: string;
  fareAmount: number;
  currency: string;
  paymentMethod: string;
  seatNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
} | null> {
  const result = await query(
    `SELECT
       booking_id      AS "bookingId",
       passenger_id    AS "passengerId",
       flight_id       AS "flightId",
       seat_preference AS "seatPreference",
       cabin_class     AS "cabinClass",
       status,
       fare_amount     AS "fareAmount",
       currency,
       payment_method  AS "paymentMethod",
       seat_number     AS "seatNumber",
       created_at      AS "createdAt",
       updated_at      AS "updatedAt"
     FROM bookings
     WHERE booking_id = $1`,
    [bookingId]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

function assertWithinRebookWindow(departureTime: Date): void {
  const now = Date.now();
  const departure = departureTime.getTime();
  const timeUntilDeparture = departure - now;

  if (timeUntilDeparture < TWO_HOURS_MS) {
    const err = new Error(
      'Rebooking window closed. Policy applies per BR-003.'
    );
    (err as any).statusCode = 409;
    (err as any).code = 'REBOOK_WINDOW_CLOSED';
    (err as any).details = {
      field: 'departure_time',
      constraint: '< T-2h',
    };
    throw err;
  }
}

function assertWithinCheckInWindow(departureTime: Date): boolean {
  const now = Date.now();
  const departure = departureTime.getTime();
  const timeUntilDeparture = departure - now;

  return timeUntilDeparture <= TWENTY_FOUR_HOURS_MS && timeUntilDeparture > 0;
}

// ─────────────────────────────────────────────────────────────
// Loyalty tier helpers
// ─────────────────────────────────────────────────────────────

const MILES_PER_DOLLAR: Record<string, number> = {
  silver: 5,
  gold: 8,
  platinum: 12,
};

const MILES_COST_PER_DOLLAR: Record<string, number> = {
  silver: 100,
  gold: 90,
  platinum: 80,
};

async function applyLoyaltyCredits(
  passengerId: string,
  fareAmount: number,
  currency: string,
  bookingId: string
): Promise<void> {
  try {
    const balanceResult = await getLoyaltyBalance(passengerId);
    // getLoyaltyBalance returns ReconciliationResult shape per the adapter contract;
    // we treat it as opaque and proceed with credit posting.
    const tierStatus = (balanceResult as any).tierStatus ?? 'silver';
    const rateKey = String(tierStatus).toLowerCase();
    const milesRate = MILES_PER_DOLLAR[rateKey] ?? MILES_PER_DOLLAR['silver'];
    const milesEarned = Math.floor(fareAmount * milesRate);

    if (milesEarned > 0) {
      await postMilesCredit(passengerId, milesEarned, 'booking', bookingId);
    }
  } catch (loyaltyErr) {
    // Loyalty credit failure must not roll back the booking
    console.error(
      '[bookingService] loyalty credit failed (non-fatal):',
      loyaltyErr
    );
  }
}

async function applyLoyaltyDebit(
  passengerId: string,
  fareAmount: number,
  bookingId: string
): Promise<void> {
  const balanceResult = await getLoyaltyBalance(passengerId);
  const tierStatus = (balanceResult as any).tierStatus ?? 'silver';
  const rateKey = String(tierStatus).toLowerCase();
  const costRate =
    MILES_COST_PER_DOLLAR[rateKey] ?? MILES_COST_PER_DOLLAR['silver'];
  const milesRequired = Math.ceil(fareAmount * costRate);

  const currentMiles = (balanceResult as any).milesBalance ?? 0;

  if (currentMiles < milesRequired) {
    const err = new Error(
      `Insufficient miles balance. Required: ${milesRequired}, Available: ${currentMiles}.`
    );
    (err as any).statusCode = 422;
    (err as any).code = 'INSUFFICIENT_MILES';
    throw err;
  }

  await postMilesDebit(passengerId, milesRequired, 'booking', bookingId);
}

// ─────────────────────────────────────────────────────────────
// Core service functions
// ─────────────────────────────────────────────────────────────

/**
 * Creates a new booking with PostgreSQL advisory locks to prevent seat conflicts.
 */
export async function createBooking(
  input: CreateBookingInput
): Promise<BookingEntity> {
  const { passengerId, flightId, seatPreference, paymentMethod, cabinClass } =
    input;

  const client = await getClient();
  const lockKey = advisoryLockKey(`seat:${flightId}`);

  try {
    await client.query('BEGIN');

    // Acquire advisory lock scoped to this flight to prevent concurrent seat conflicts
    await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

    // Fetch flight details
    const flightResult = await client.query(
      `SELECT
         flight_id       AS "flightId",
         departure_time  AS "departureTime",
         arrival_time    AS "arrivalTime",
         fare_amount     AS "fareAmount",
         currency,
         cabin_class     AS "cabinClass",
         available_seats AS "availableSeats"
       FROM flights
       WHERE flight_id = $1
       FOR UPDATE`,
      [flightId]
    );

    if (flightResult.rows.length === 0) {
      const err = new Error(`Flight not found: ${flightId}`);
      (err as any).statusCode = 404;
      throw err;
    }

    const flight = flightResult.rows[0];

    if (flight.availableSeats <= 0) {
      const err = new Error('No available seats on this flight.');
      (err as any).statusCode = 409;
      (err as any).code = 'NO_SEATS_AVAILABLE';
      throw err;
    }

    const resolvedCabin = cabinClass ?? flight.cabinClass ?? 'economy';
    const fareAmount: number = Number(flight.fareAmount);
    const currency: string = flight.currency;

    // Handle miles payment: validate & debit before persisting the booking
    if (paymentMethod === 'miles') {
      await applyLoyaltyDebit(passengerId, fareAmount, 'pending');
    }

    // Decrement available seats
    await client.query(
      `UPDATE flights SET available_seats = available_seats - 1 WHERE flight_id = $1`,
      [flightId]
    );

    // Insert booking record
    const bookingResult = await client.query(
      `INSERT INTO bookings
         (passenger_id, flight_id, seat_preference, cabin_class, status,
          fare_amount, currency, payment_method, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'confirmed', $5, $6, $7, NOW(), NOW())
       RETURNING
         booking_id      AS "bookingId",
         passenger_id    AS "passengerId",
         flight_id       AS "flightId",
         seat_number     AS "seatNumber",
         seat_preference AS "seatPreference",
         cabin_class     AS "cabinClass",
         status,
         fare_amount     AS "fareAmount",
         currency,
         payment_method  AS "paymentMethod",
         created_at      AS "createdAt",
         updated_at      AS "updatedAt"`,
      [
        passengerId,
        flightId,
        seatPreference,
        resolvedCabin,
        fareAmount,
        currency,
        paymentMethod,
      ]
    );

    const booking = bookingResult.rows[0];
    const boardingPassUrl = generateBoardingPassUrl(booking.bookingId);

    await client.query(
      `UPDATE bookings SET boarding_pass_url = $1 WHERE booking_id = $2`,
      [boardingPassUrl, booking.bookingId]
    );

    await client.query('COMMIT');

    // Post loyalty miles credit asynchronously (non-fatal)
    if (paymentMethod === 'card') {
      setImmediate(() =>
        applyLoyaltyCredits(
          passengerId,
          fareAmount,
          currency,
          booking.bookingId
        )
      );
    }

    return {
      bookingId: booking.bookingId,
      passengerId: booking.passengerId,
      flightId: booking.flightId,
      seatNumber: booking.seatNumber ?? null,
      seatPreference: booking.seatPreference,
      cabinClass: booking.cabinClass,
      status: 'confirmed',
      fareAmount: Number(booking.fareAmount),
      currency: booking.currency,
      paymentMethod: booking.paymentMethod,
      boardingPassUrl,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Rebooking: validates T-2h window, calculates fare difference,
 * processes payment/miles, and updates the booking.
 */
export async function rebookFlight(input: RebookInput): Promise<BookingEntity> {
  const { bookingId, passengerId, newFlightId, paymentMethod } = input;

  const client = await getClient();
  const flightLockKey = advisoryLockKey(`seat:${newFlightId}`);

  try {
    await client.query('BEGIN');

    // Fetch existing booking
    const existingResult = await client.query(
      `SELECT
         booking_id      AS "bookingId",
         passenger_id    AS "passengerId",
         flight_id       AS "flightId",
         fare_amount     AS "fareAmount",
         currency,
         status,
         payment_method  AS "paymentMethod",
         seat_preference AS "seatPreference",
         cabin_class     AS "cabinClass"
       FROM bookings
       WHERE booking_id = $1
       FOR UPDATE`,
      [bookingId]
    );

    if (existingResult.rows.length === 0) {
      const err = new Error(`Booking not found: ${bookingId}`);
      (err as any).statusCode = 404;
      throw err;
    }

    const existing = existingResult.rows[0];

    if (existing.passengerId !== passengerId) {
      const err = new Error('Forbidden: booking does not belong to passenger.');
      (err as any).statusCode = 403;
      throw err;
    }

    if (existing.status === 'cancelled') {
      const err = new Error('Cannot rebook a cancelled booking.');
      (err as any).statusCode = 409;
      (err as any).code = 'BOOKING_CANCELLED';
      throw err;
    }

    // Fetch original flight to validate rebooking window
    const originalFlightResult = await client.query(
      `SELECT departure_time AS "departureTime" FROM flights WHERE flight_id = $1`,
      [existing.flightId]
    );

    if (originalFlightResult.rows.length === 0) {
      const err = new Error('Original flight not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    const originalDeparture: Date = originalFlightResult.rows[0].departureTime;

    // Throws 409 if outside T-2h window
    assertWithinRebookWindow(originalDeparture);

    // Acquire advisory lock on new flight
    await client.query('SELECT pg_advisory_xact_lock($1)', [flightLockKey]);

    // Fetch new flight details
    const newFlightResult = await client.query(
      `SELECT
         flight_id       AS "flightId",
         departure_time  AS "departureTime",
         fare_amount     AS "fareAmount",
         currency,
         cabin_class     AS "cabinClass",
         available_seats AS "availableSeats"
       FROM flights
       WHERE flight_id = $1
       FOR UPDATE`,
      [newFlightId]
    );

    if (newFlightResult.rows.length === 0) {
      const err = new Error(`New flight not found: ${newFlightId}`);
      (err as any).statusCode = 404;
      throw err;
    }

    const newFlight = newFlightResult.rows[0];

    if (newFlight.availableSeats <= 0) {
      const err = new Error('No available seats on the requested flight.');
      (err as any).statusCode = 409;
      (err as any).code = 'NO_SEATS_AVAILABLE';
      throw err;
    }

    const originalFare = Number(existing.fareAmount);
    const newFare = Number(newFlight.fareAmount);
    const fareDifference = newFare - originalFare;
    const currency: string = newFlight.currency;

    // If new fare is higher, charge the difference
    if (fareDifference > 0) {
      if (paymentMethod === 'miles') {
        await applyLoyaltyDebit(passengerId, fareDifference, bookingId);
      }
      // For card payments the charge is handled by the payment gateway (outside this service)
    }

    // Release seat on original flight
    await client.query(
      `UPDATE flights SET available_seats = available_seats + 1 WHERE flight_id = $1`,
      [existing.flightId]
    );

    // Reserve seat on new flight
    await client.query(
      `UPDATE flights SET available_seats = available_seats - 1 WHERE flight_id = $1`,
      [newFlightId]
    );

    const boardingPassUrl = generateBoardingPassUrl(bookingId);

    // Update booking record
    const updatedResult = await client.query(
      `UPDATE bookings
       SET
         flight_id        = $1,
         status           = 'rebooked',
         fare_amount      = $2,
         currency         = $3,
         payment_method   = $4,
         boarding_pass_url = $5,
         updated_at       = NOW()
       WHERE booking_id = $6
       RETURNING
         booking_id      AS "bookingId",
         passenger_id    AS "passengerId",
         flight_id       AS "flightId",
         seat_number     AS "seatNumber",
         seat_preference AS "seatPreference",
         cabin_class     AS "cabinClass",
         status,
         fare_amount     AS "fareAmount",
         currency,
         payment_method  AS "paymentMethod",
         boarding_pass_url AS "boardingPassUrl",
         created_at      AS "createdAt",
         updated_at      AS "updatedAt"`,
      [newFlightId, newFare, currency, paymentMethod, boardingPassUrl, bookingId]
    );

    await client.query('COMMIT');

    const updated = updatedResult.rows[0];

    // Credit miles for fare difference refund if original was more expensive
    if (fareDifference < 0 && paymentMethod === 'card') {
      setImmediate(() =>
        applyLoyaltyCredits(
          passengerId,
          Math.abs(fareDifference),
          currency,
          bookingId
        )
      );
    }

    return {
      bookingId: updated.bookingId,
      passengerId: updated.passengerId,
      flightId: updated.flightId,
      seatNumber: updated.seatNumber ?? null,
      seatPreference: updated.seatPreference,
      cabinClass: updated.cabinClass,
      status: 'rebooked',
      fareAmount: Number(updated.fareAmount),
      currency: updated.currency,
      paymentMethod: updated.paymentMethod,
      boardingPassUrl: updated.boardingPassUrl,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Validates the 24-hour check-in window and returns eligibility + boarding pass URL stub.
 */
export async function validateCheckIn(
  bookingId: string,
  passengerId: string
): Promise<CheckInResult> {
  const booking = await getBookingById(bookingId);

  if (!booking) {
    const err = new Error(`Booking not found: ${bookingId}`);
    (err as any).statusCode = 404;
    throw err;
  }

  if (booking.passengerId !== passengerId) {
    const err = new Error('Forbidden: booking does not belong to passenger.');
    (err as any).statusCode = 403;
    throw err;
  }

  if (booking.status === 'cancelled') {
    return {
      eligible: false,
      reason: 'Booking is cancelled.',
    };
  }

  const flight = await getFlightById(booking.flightId);

  if (!flight) {
    const err = new Error('Associated flight not found.');
    (err as any).statusCode = 404;
    throw err;
  }

  const eligible = assertWithinCheckInWindow(flight.departureTime);

  if (!eligible) {
    const now = Date.now();
    const departure = flight.departureTime.getTime();
    const timeUntilDeparture = departure - now;

    if (timeUntilDeparture > TWENTY_FOUR_HOURS_MS) {
      return {
        eligible: false,
        reason: 'Check-in window has not opened yet. Opens 24h before departure.',
      };
    } else {
      return {
        eligible: false,
        reason: 'Flight has already departed.',
      };
    }
  }

  const boardingPassUrl = generateBoardingPassUrl(bookingId);

  return {
    eligible: true,
    boardingPassUrl,
  };
}

/**
 * Calculates the fare difference between current booking and a potential new flight.
 */
export async function calculateFareDifference(
  bookingId: string,
  newFlightId: string
): Promise<FareDifference> {
  const booking = await getBookingById(bookingId);

  if (!booking) {
    const err = new Error(`Booking not found: ${bookingId}`);
    (err as any).statusCode = 404;
    throw err;
  }

  const newFlight = await getFlightById(newFlightId);

  if (!newFlight) {
    const err = new Error(`Flight not found: ${newFlightId}`);
    (err as any).statusCode = 404;
    throw err;
  }

  const originalFare = Number(booking.fareAmount);
  const newFare = Number(newFlight.fareAmount);

  return {
    originalFare,
    newFare,
    difference: newFare - originalFare,
    currency: newFlight.currency,
  };
}

/**
 * Generates a boarding pass PDF URL stub for a confirmed booking.
 */
export async function getBoardingPassUrl(
  bookingId: string,
  passengerId: string
): Promise<string> {
  const booking = await getBookingById(bookingId);

  if (!booking) {
    const err = new Error(`Booking not found: ${bookingId}`);
    (err as any).statusCode = 404;
    throw err;
  }

  if (booking.passengerId !== passengerId) {
    const err = new Error('Forbidden: booking does not belong to passenger.');
    (err as any).statusCode = 403;
    throw err;
  }

  if (booking.status === 'cancelled') {
    const err = new Error('Cannot generate boarding pass for a cancelled booking.');
    (err as any).statusCode = 409;
    throw err;
  }

  return generateBoardingPassUrl(bookingId);
}