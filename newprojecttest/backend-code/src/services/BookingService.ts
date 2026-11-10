import { BookingRepository, Booking, CreateBookingInput, UpdateBookingInput, LockSeatInput } from '../repositories/BookingRepository';
import { LoyaltyService, RedemptionInput } from './LoyaltyService';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

const REBOOK_CUTOFF_MS = 2 * 60 * 60 * 1000; // T-2h in milliseconds
const CHECKIN_OPEN_MS = 24 * 60 * 60 * 1000;  // 24h before departure

export class BookingServiceError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BookingServiceError';
  }
}

interface FlightRecord {
  id: string;
  flight_number: string;
  origin: string;
  destination: string;
  departure_time: Date;
  arrival_time: Date;
  cabin_class: string;
  fare_amount: number;
  available_seats: number;
}

interface CreateBookingParams {
  passengerId: string;
  flightId: string;
  seatPreference?: string | null;
  paymentMethod: string;
  fareAmount?: number | null;
  milesUsed?: number | null;
  flight: FlightRecord;
  passengerName: string;
  passengerEmail: string;
}

interface RebookParams {
  bookingId: string;
  newFlightId: string;
  newFlight: FlightRecord;
  paymentMethod: string;
  passengerId: string;
  idempotencyKey: string;
}

interface CheckInResult {
  eligible: boolean;
  boardingPassUrl?: string;
  opensAt?: Date;
  message?: string;
}

interface BoardingPassData {
  booking: Booking;
  flight: FlightRecord;
  passengerName: string;
  seatNumber?: string;
  cabinClass?: string;
}

export class BookingService {
  private readonly repo: BookingRepository;
  private readonly loyaltyService: LoyaltyService;

  constructor(repo: BookingRepository, loyaltyService: LoyaltyService) {
    this.repo = repo;
    this.loyaltyService = loyaltyService;
  }

  /**
   * Generate a PNR (Passenger Name Record) code — 6 character alphanumeric.
   */
  private generatePNR(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pnr = '';
    for (let i = 0; i < 6; i++) {
      pnr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pnr;
  }

  /**
   * Create a new booking, optionally redeeming miles.
   */
  async createBooking(params: CreateBookingParams): Promise<Booking> {
    const {
      passengerId,
      flightId,
      seatPreference,
      paymentMethod,
      fareAmount,
      milesUsed,
      flight,
      passengerName,
    } = params;

    // If paying with miles, attempt redemption first
    let resolvedMilesUsed = milesUsed ?? null;
    if (paymentMethod === 'miles' && milesUsed && milesUsed > 0) {
      const idempotencyKey = uuidv4();
      const redemptionInput: RedemptionInput = {
        passengerId,
        amount: milesUsed,
        serviceType: 'booking',
        idempotencyKey,
      };
      await this.loyaltyService.redeemMiles(redemptionInput);
      resolvedMilesUsed = milesUsed;
    }

    const pnr = this.generatePNR();

    const input: CreateBookingInput = {
      passenger_id: passengerId,
      flight_id: flightId,
      seat_preference: seatPreference ?? null,
      payment_method: paymentMethod,
      status: 'confirmed',
      pnr,
      fare_amount: fareAmount ?? null,
      miles_used: resolvedMilesUsed,
    };

    const booking = await this.repo.createBooking(input);

    // Attempt to lock a seat if available
    if (flight.available_seats > 0) {
      const seatNumber = this.assignSeat(seatPreference ?? null, flight.cabin_class);
      const lockInput: LockSeatInput = {
        booking_id: booking.id,
        flight_id: flightId,
        seat_number: seatNumber,
        cabin_class: flight.cabin_class,
        passenger_id: passengerId,
      };
      await this.repo.lockSeat(lockInput);
    }

    return booking;
  }

  /**
   * Rebook a flight, enforcing the T-2h cutoff on the original flight.
   */
  async rebookFlight(params: RebookParams): Promise<Booking> {
    const { bookingId, newFlightId, newFlight, paymentMethod, passengerId, idempotencyKey } = params;

    const booking = await this.repo.findById(bookingId);
    if (!booking) {
      throw new BookingServiceError(404, 'Booking not found', { bookingId });
    }

    if (booking.passenger_id !== passengerId) {
      throw new BookingServiceError(403, 'You are not authorized to modify this booking', {
        bookingId,
      });
    }

    if (booking.status === 'cancelled') {
      throw new BookingServiceError(409, 'Cannot rebook a cancelled booking', { bookingId });
    }

    if (booking.status === 'checked_in') {
      throw new BookingServiceError(409, 'Cannot rebook a booking that is already checked in', {
        bookingId,
      });
    }

    // Validate T-2h window enforcement
    // We need to know the current flight's departure time.
    // The booking references flight_id; departure time must be provided via the current flight.
    // We use newFlight's departure for the destination flight, but we need current flight info.
    // The caller must pass current flight info separately; here we rely on the booking's
    // existing flight being resolved externally. We validate using the NEW flight's departure
    // as the strictest interpretation: enforce T-2h on the *existing* booking's flight.
    // Since we only have newFlight here, the caller must supply currentDepartureTime.
    // We surface a method that the route handler can call with the current flight's departure time.
    throw new BookingServiceError(
      500,
      'rebookFlight must receive currentFlightDepartureTime; use rebookFlightWithDeparture instead',
    );
  }

  /**
   * Rebook a flight with explicit current departure time for T-2h enforcement.
   */
  async rebookFlightWithDeparture(params: {
    bookingId: string;
    newFlightId: string;
    newFlight: FlightRecord;
    currentFlightDepartureTime: Date;
    paymentMethod: string;
    passengerId: string;
    idempotencyKey: string;
  }): Promise<Booking> {
    const {
      bookingId,
      newFlightId,
      newFlight,
      currentFlightDepartureTime,
      paymentMethod,
      passengerId,
      idempotencyKey,
    } = params;

    const booking = await this.repo.findById(bookingId);
    if (!booking) {
      throw new BookingServiceError(404, 'Booking not found', { bookingId });
    }

    if (booking.passenger_id !== passengerId) {
      throw new BookingServiceError(403, 'You are not authorized to modify this booking', {
        bookingId,
      });
    }

    if (booking.status === 'cancelled') {
      throw new BookingServiceError(409, 'Cannot rebook a cancelled booking', { bookingId });
    }

    if (booking.status === 'checked_in') {
      throw new BookingServiceError(409, 'Cannot rebook a booking that is already checked in', {
        bookingId,
      });
    }

    // Enforce T-2h cutoff on the CURRENT flight
    this.validateRebookingWindow(currentFlightDepartureTime);

    // Calculate fare difference
    const { fareDifference, milesRequired } = this.calculateFareDifference(
      booking.fare_amount ?? 0,
      newFlight.fare_amount,
      paymentMethod,
    );

    // If additional miles are required for upgrade
    if (paymentMethod === 'miles' && milesRequired > 0) {
      const redemptionInput: RedemptionInput = {
        passengerId,
        amount: milesRequired,
        serviceType: 'rebook',
        idempotencyKey,
        referenceId: bookingId,
      };
      await this.loyaltyService.redeemMiles(redemptionInput);
    }

    const updateInput: UpdateBookingInput = {
      flight_id: newFlightId,
      payment_method: paymentMethod,
      status: 'confirmed',
      fare_amount: newFlight.fare_amount,
      miles_used: paymentMethod === 'miles' ? (booking.miles_used ?? 0) + milesRequired : booking.miles_used,
    };

    const updated = await this.repo.updateBooking(bookingId, updateInput);
    if (!updated) {
      throw new BookingServiceError(500, 'Failed to update booking after rebooking');
    }

    // Lock seat on new flight
    const seatNumber = this.assignSeat(booking.seat_preference, newFlight.cabin_class);
    const lockInput: LockSeatInput = {
      booking_id: bookingId,
      flight_id: newFlightId,
      seat_number: seatNumber,
      cabin_class: newFlight.cabin_class,
      passenger_id: passengerId,
    };
    await this.repo.lockSeat(lockInput);

    return updated;
  }

  /**
   * Validate that the rebooking is within the T-2h window.
   * Throws BookingServiceError with HTTP 403 if the window has closed.
   */
  validateRebookingWindow(departureTime: Date): void {
    const now = Date.now();
    const departure = departureTime.getTime();
    const timeUntilDeparture = departure - now;

    if (timeUntilDeparture < REBOOK_CUTOFF_MS) {
      const cutoffTime = new Date(departure - REBOOK_CUTOFF_MS);
      throw new BookingServiceError(
        403,
        'Rebooking window closed. Policy applies per BR-003.',
        {
          field: 'departure_time',
          constraint: '< T-2h',
          departure_time: departureTime.toISOString(),
          cutoff_time: cutoffTime.toISOString(),
          current_time: new Date(now).toISOString(),
        },
      );
    }
  }

  /**
   * Validate the check-in window (24h pre-departure only).
   * Returns eligibility and relevant timestamps.
   */
  validateCheckInWindow(departureTime: Date, currentStatus: string): CheckInResult {
    // AC-02: reject if already checked in
    if (currentStatus === 'checked_in') {
      return {
        eligible: false,
        message: 'Passenger is already checked in.',
      };
    }

    if (currentStatus === 'cancelled') {
      return {
        eligible: false,
        message: 'Cannot check in on a cancelled booking.',
      };
    }

    const now = Date.now();
    const departure = departureTime.getTime();
    const timeUntilDeparture = departure - now;

    // Check-in opens 24h before departure
    const checkInOpensAt = new Date(departure - CHECKIN_OPEN_MS);

    if (timeUntilDeparture > CHECKIN_OPEN_MS) {
      return {
        eligible: false,
        opensAt: checkInOpensAt,
        message: `Check-In Opens ${checkInOpensAt.toISOString()}`,
      };
    }

    // Check-in closes at departure
    if (timeUntilDeparture <= 0) {
      return {
        eligible: false,
        message: 'Check-in window has closed. The flight has already departed.',
      };
    }

    return {
      eligible: true,
    };
  }

  /**
   * Perform check-in for a booking. Validates window, updates status.
   */
  async checkIn(params: {
    bookingId: string;
    passengerId: string;
    departureTime: Date;
  }): Promise<{ booking: Booking; eligible: boolean; boardingPassUrl: string }> {
    const { bookingId, passengerId, departureTime } = params;

    const booking = await this.repo.findById(bookingId);
    if (!booking) {
      throw new BookingServiceError(404, 'Booking not found', { bookingId });
    }

    if (booking.passenger_id !== passengerId) {
      throw new BookingServiceError(403, 'You are not authorized to check in for this booking', {
        bookingId,
      });
    }

    const windowResult = this.validateCheckInWindow(departureTime, booking.status);

    if (!windowResult.eligible) {
      // US-007 AC-02: return 409 if already checked in
      const statusCode = booking.status === 'checked_in' ? 409 : 400;
      throw new BookingServiceError(statusCode, windowResult.message ?? 'Check-in not available', {
        opens_at: windowResult.opensAt?.toISOString(),
        current_status: booking.status,
      });
    }

    const updated = await this.repo.updateBooking(bookingId, { status: 'checked_in' });
    if (!updated) {
      throw new BookingServiceError(500, 'Failed to update booking status during check-in');
    }

    const boardingPassUrl = `/docs/bp_${bookingId}.pdf`;

    return {
      booking: updated,
      eligible: true,
      boardingPassUrl,
    };
  }

  /**
   * Generate a boarding pass PDF and return the buffer.
   */
  async generateBoardingPassPDF(data: BoardingPassData): Promise<Buffer> {
    const { booking, flight, passengerName, seatNumber, cabinClass } = data;

    if (booking.status !== 'checked_in') {
      throw new BookingServiceError(
        403,
        'Boarding pass is only available for checked-in passengers.',
        { status: booking.status },
      );
    }

    // Generate QR code for the barcode data
    const barcodeData = this.buildBarcodeData(booking, flight, seatNumber);
    const qrCodeDataUrl = await QRCode.toDataURL(barcodeData, {
      errorCorrectionLevel: 'H',
      width: 150,
    });

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ---- Header ----
      doc
        .fontSize(24)
        .fillColor('#1a3c6e')
        .text('SkyWings Airlines', { align: 'center' });

      doc.moveDown(0.5);

      doc
        .fontSize(18)
        .fillColor('#000000')
        .text('BOARDING PASS', { align: 'center' });

      doc.moveTo(40, doc.y + 10).lineTo(555, doc.y + 10).stroke('#1a3c6e');
      doc.moveDown(1);

      // ---- Passenger Info ----
      doc.fontSize(12).fillColor('#555555').text('Passenger Name');
      doc.fontSize(16).fillColor('#000000').text(passengerName);
      doc.moveDown(0.5);

      doc.fontSize(12).fillColor('#555555').text('PNR / Booking Reference');
      doc.fontSize(16).fillColor('#000000').text(booking.pnr ?? booking.id);
      doc.moveDown(0.5);

      // ---- Flight Info ----
      doc
        .fontSize(12)
        .fillColor('#555555')
        .text(`Flight: `, { continued: true })
        .fillColor('#000000')
        .text(flight.flight_number);

      doc
        .fontSize(12)
        .fillColor('#555555')
        .text(`From: `, { continued: true })
        .fillColor('#000000')
        .text(`${flight.origin}  →  `, { continued: true })
        .fillColor('#555555')
        .text(`To: `, { continued: true })
        .fillColor('#000000')
        .text(flight.destination);

      doc
        .fontSize(12)
        .fillColor('#555555')
        .text(`Departure: `, { continued: true })
        .fillColor('#000000')
        .text(flight.departure_time.toISOString());

      doc
        .fontSize(12)
        .fillColor('#555555')
        .text(`Arrival: `, { continued: true })
        .fillColor('#000000')
        .text(flight.arrival_time.toISOString());

      doc
        .fontSize(12)
        .fillColor('#555555')
        .text(`Seat: `, { continued: true })
        .fillColor('#000000')
        .text(seatNumber ?? 'TBD', { continued: true })
        .fillColor('#555555')
        .text(`   Class: `, { continued: true })
        .fillColor('#000000')
        .text(cabinClass ?? flight.cabin_class);

      doc.moveDown(1);

      // ---- QR Code ----
      doc.fontSize(12).fillColor('#555555').text('Scan at Gate', { align: 'center' });
      doc.moveDown(0.5);

      // Embed QR code image from data URL
      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
      const imgBuffer = Buffer.from(base64Data, 'base64');

      const qrX = (595 - 150) / 2; // center on A4
      const qrY = doc.y;
      doc.image(imgBuffer, qrX, qrY, { width: 150, height: 150 });
      doc.moveDown(8);

      // ---- Footer ----
      doc
        .fontSize(9)
        .fillColor('#888888')
        .text(
          'This boarding pass is valid only for the flight and date shown. Present at all checkpoints.',
          { align: 'center' },
        );

      doc.end();
    });
  }

  /**
   * Build a BCBP-style barcode data string for airline scanning validation.
   * Format loosely follows IATA BCBP Type M (Mandatory fields only).
   */
  private buildBarcodeData(booking: Booking, flight: FlightRecord, seatNumber?: string): string {
    // M 1 (format code) + number of legs
    const formatCode = 'M';
    const legs = '1';
    const pnr = (booking.pnr ?? booking.id).padEnd(7, ' ').substring(0, 7);
    const origin = flight.origin.substring(0, 3).toUpperCase().padEnd(3, 'X');
    const destination = flight.destination.substring(0, 3).toUpperCase().padEnd(3, 'X');
    const flightNumber = flight.flight_number.replace(/\s/g, '').substring(0, 7).padEnd(7, ' ');
    const seat = (seatNumber ?? '000A').padStart(4, '0').substring(0, 4);
    const bookingId = booking.id.substring(0, 13).padEnd(13, '0');

    return `${formatCode}${legs}${pnr}${origin}${destination}${flightNumber}${seat}${bookingId}`;
  }

  /**
   * Calculate fare difference between old and new flight for rebooking.
   */
  calculateFareDifference(
    currentFare: number,
    newFare: number,
    paymentMethod: string,
  ): { fareDifference: number; milesRequired: number } {
    const fareDifference = Math.max(0, newFare - currentFare);

    // Convert fare difference to miles at a fixed rate of 100 miles per currency unit
    // when paying by miles
    const MILES_PER_UNIT = 100;
    const milesRequired = paymentMethod === 'miles' ? Math.ceil(fareDifference * MILES_PER_UNIT) : 0;

    return { fareDifference, milesRequired };
  }

  /**
   * Get a booking by ID.
   */
  async getBookingById(id: string): Promise<Booking | null> {
    return this.repo.findById(id);
  }

  /**
   * Get all bookings for a passenger.
   */
  async getBookingsByPassenger(passengerId: string): Promise<Booking[]> {
    return this.repo.findByPassenger(passengerId);
  }

  /**
   * Assign a seat number based on preference and cabin class.
   * This is a simple deterministic assignment; real systems use seat maps.
   */
  private assignSeat(seatPreference: string | null, cabinClass: string): string {
    const rows: Record<string, number[]> = {
      first: [1, 2, 3],
      business: [4, 5, 6, 7, 8, 9, 10],
      economy: Array.from({ length: 30 }, (_, i) => i + 11),
    };

    const cabinKey = cabinClass.toLowerCase();
    const availableRows = rows[cabinKey] ?? rows['economy'];
    const row = availableRows[Math.floor(Math.random() * availableRows.length)];

    let column: string;
    switch ((seatPreference ?? '').toLowerCase()) {
      case 'window':
        column = Math.random() > 0.5 ? 'A' : 'F';
        break;
      case 'aisle':
        column = Math.random() > 0.5 ? 'C' : 'D';
        break;
      case 'middle':
        column = Math.random() > 0.5 ? 'B' : 'E';
        break;
      default:
        column = ['A', 'B', 'C', 'D', 'E', 'F'][Math.floor(Math.random() * 6)];
    }

    return `${row}${column}`;
  }
}