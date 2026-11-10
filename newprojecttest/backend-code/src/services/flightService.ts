import { query } from '../db/pool';
import {
  searchFlights,
  getFlightFare,
  getCircuitBreakerStatus,
  clearCache,
  FlightSearchParams,
  FlightEntity,
  GDSSearchResponse,
} from '../adapters/gdsAdapter';

export interface PaginatedFlightResult {
  flights: FlightEntity[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  syncedFrom: 'GDS' | 'CACHE';
  cachedTTL: number;
  cachedAt?: number;
}

export interface FlightServiceSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  cabinClass: string;
  cursor?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function clampLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

function encodeCursor(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): string {
  try {
    return Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    return cursor;
  }
}

async function persistFlightsToCache(
  flights: FlightEntity[],
  ttl: number,
  syncedAt: number
): Promise<void> {
  if (flights.length === 0) return;

  const expiresAt = new Date(syncedAt + ttl * 1000).toISOString();

  for (const flight of flights) {
    try {
      await query(
        `INSERT INTO flight_cache (
          flight_id, flight_number, origin, destination,
          departure_time, arrival_time, cabin_class,
          available_seats, amount, currency, fare_class,
          duration, stops, aircraft, expires_at, synced_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16
        )
        ON CONFLICT (flight_id) DO UPDATE SET
          flight_number    = EXCLUDED.flight_number,
          origin           = EXCLUDED.origin,
          destination      = EXCLUDED.destination,
          departure_time   = EXCLUDED.departure_time,
          arrival_time     = EXCLUDED.arrival_time,
          cabin_class      = EXCLUDED.cabin_class,
          available_seats  = EXCLUDED.available_seats,
          amount           = EXCLUDED.amount,
          currency         = EXCLUDED.currency,
          fare_class       = EXCLUDED.fare_class,
          duration         = EXCLUDED.duration,
          stops            = EXCLUDED.stops,
          aircraft         = EXCLUDED.aircraft,
          expires_at       = EXCLUDED.expires_at,
          synced_at        = EXCLUDED.synced_at`,
        [
          flight.flightId,
          flight.flightNumber,
          flight.origin,
          flight.destination,
          flight.departureTime,
          flight.arrivalTime,
          flight.cabinClass,
          flight.availableSeats,
          flight.amount,
          flight.currency,
          flight.fareClass,
          flight.duration,
          flight.stops,
          flight.aircraft,
          expiresAt,
          new Date(syncedAt).toISOString(),
        ]
      );
    } catch (err) {
      // Non-fatal: cache persistence failure should not break the response
      console.error(
        `[flightService] Failed to persist flight ${flight.flightId} to cache:`,
        err
      );
    }
  }
}

async function fetchFromDatabaseCache(
  origin: string,
  destination: string,
  departureDate: string,
  cabinClass: string,
  cursor: string | undefined,
  limit: number
): Promise<PaginatedFlightResult | null> {
  const now = new Date().toISOString();

  let cursorCondition = '';
  const params: unknown[] = [origin, destination, cabinClass, now, limit + 1];

  // Filter by departure date prefix (ISO date string comparison)
  // departure_time is stored as ISO string, so we filter on its date component
  const dateStart = `${departureDate}T00:00:00.000Z`;
  const dateEnd = `${departureDate}T23:59:59.999Z`;
  params.push(dateStart, dateEnd);

  if (cursor) {
    const decodedCursor = decodeCursor(cursor);
    cursorCondition = `AND flight_id > $${params.length + 1}`;
    params.push(decodedCursor);
  }

  const sql = `
    SELECT
      flight_id, flight_number, origin, destination,
      departure_time, arrival_time, cabin_class,
      available_seats, amount, currency, fare_class,
      duration, stops, aircraft,
      EXTRACT(EPOCH FROM (expires_at - NOW()))::int AS remaining_ttl,
      EXTRACT(EPOCH FROM synced_at)::bigint * 1000 AS cached_at_ms
    FROM flight_cache
    WHERE
      origin           = $1
      AND destination  = $2
      AND cabin_class  = $3
      AND expires_at   > $4
      AND departure_time BETWEEN $6 AND $7
      ${cursorCondition}
    ORDER BY flight_id ASC
    LIMIT $5
  `;

  try {
    const result = await query(sql, params);

    if (!result || result.rows.length === 0) {
      return null;
    }

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    const flights: FlightEntity[] = rows.map((row: Record<string, unknown>) => ({
      flightId: row.flight_id as string,
      flightNumber: row.flight_number as string,
      origin: row.origin as string,
      destination: row.destination as string,
      departureTime: row.departure_time as string,
      arrivalTime: row.arrival_time as string,
      cabinClass: row.cabin_class as string,
      availableSeats: row.available_seats as number,
      amount: parseFloat(row.amount as string),
      currency: row.currency as string,
      fareClass: row.fare_class as string,
      duration: row.duration as number,
      stops: row.stops as number,
      aircraft: row.aircraft as string,
    }));

    const lastFlight = rows[rows.length - 1];
    const nextCursor =
      hasMore && lastFlight
        ? encodeCursor(lastFlight.flight_id as string)
        : null;

    const remainingTTL =
      rows[0] && rows[0].remaining_ttl != null
        ? Math.max(0, Number(rows[0].remaining_ttl))
        : 0;

    const cachedAt =
      rows[0] && rows[0].cached_at_ms != null
        ? Number(rows[0].cached_at_ms)
        : undefined;

    return {
      flights,
      nextCursor,
      hasMore,
      limit,
      syncedFrom: 'CACHE',
      cachedTTL: remainingTTL,
      cachedAt,
    };
  } catch (err) {
    console.error('[flightService] Database cache query failed:', err);
    return null;
  }
}

export async function searchAvailableFlights(
  params: FlightServiceSearchParams
): Promise<PaginatedFlightResult> {
  const limit = clampLimit(params.limit);

  const gdsParams: FlightSearchParams = {
    origin: params.origin,
    destination: params.destination,
    departureDate: params.departureDate,
    cabinClass: params.cabinClass,
    cursor: params.cursor,
    limit,
  };

  // Attempt GDS adapter first (it handles its own caching / circuit breaking)
  try {
    const gdsResponse: GDSSearchResponse = await searchFlights(gdsParams);

    const syncedAt = gdsResponse.cachedAt ?? Date.now();

    // Persist fresh GDS results into our PostgreSQL cache layer
    if (gdsResponse.syncedFrom === 'GDS' && gdsResponse.flights.length > 0) {
      void persistFlightsToCache(
        gdsResponse.flights,
        gdsResponse.cachedTTL,
        syncedAt
      );
    }

    const nextCursor =
      gdsResponse.nextCursor
        ? encodeCursor(gdsResponse.nextCursor)
        : null;

    return {
      flights: gdsResponse.flights,
      nextCursor,
      hasMore: gdsResponse.hasMore,
      limit: gdsResponse.limit,
      syncedFrom: gdsResponse.syncedFrom,
      cachedTTL: gdsResponse.cachedTTL,
      cachedAt: gdsResponse.cachedAt,
    };
  } catch (gdsError) {
    console.warn(
      '[flightService] GDS adapter unavailable, falling back to PostgreSQL cache:',
      gdsError
    );
  }

  // Fallback: query PostgreSQL cache
  const dbResult = await fetchFromDatabaseCache(
    params.origin,
    params.destination,
    params.departureDate,
    params.cabinClass,
    params.cursor,
    limit
  );

  if (dbResult) {
    return dbResult;
  }

  // Both GDS and cache are unavailable — return empty result with metadata
  return {
    flights: [],
    nextCursor: null,
    hasMore: false,
    limit,
    syncedFrom: 'CACHE',
    cachedTTL: 0,
    cachedAt: undefined,
  };
}

export async function getFlightDetails(
  flightId: string,
  cabinClass: string
): Promise<{ flight: FlightEntity; syncedFrom: 'GDS' | 'CACHE'; cachedTTL: number; cachedAt?: number } | null> {
  try {
    const fareResponse = await getFlightFare({ flightId, cabinClass } as unknown as FlightSearchParams);

    // getFlightFare returns circuit breaker status shape; actual fare data
    // is expected to be part of the resolved value or its data property.
    // Per the adapter contract the return shape is { syncedFrom, cachedTTL, cachedAt, state, failureCount, lastFailureTime }
    // We surface what we have and attempt a DB cache lookup for the entity itself.
    const dbRow = await query(
      `SELECT
         flight_id, flight_number, origin, destination,
         departure_time, arrival_time, cabin_class,
         available_seats, amount, currency, fare_class,
         duration, stops, aircraft,
         EXTRACT(EPOCH FROM (expires_at - NOW()))::int AS remaining_ttl,
         EXTRACT(EPOCH FROM synced_at)::bigint * 1000 AS cached_at_ms
       FROM flight_cache
       WHERE flight_id = $1 AND expires_at > NOW()
       LIMIT 1`,
      [flightId]
    );

    if (dbRow && dbRow.rows.length > 0) {
      const row = dbRow.rows[0] as Record<string, unknown>;
      const flight: FlightEntity = {
        flightId: row.flight_id as string,
        flightNumber: row.flight_number as string,
        origin: row.origin as string,
        destination: row.destination as string,
        departureTime: row.departure_time as string,
        arrivalTime: row.arrival_time as string,
        cabinClass: row.cabin_class as string,
        availableSeats: row.available_seats as number,
        amount: parseFloat(row.amount as string),
        currency: row.currency as string,
        fareClass: row.fare_class as string,
        duration: row.duration as number,
        stops: row.stops as number,
        aircraft: row.aircraft as string,
      };

      return {
        flight,
        syncedFrom: (fareResponse as unknown as { syncedFrom: 'GDS' | 'CACHE' }).syncedFrom ?? 'CACHE',
        cachedTTL: Math.max(0, Number(row.remaining_ttl ?? 0)),
        cachedAt:
          row.cached_at_ms != null ? Number(row.cached_at_ms) : undefined,
      };
    }

    return null;
  } catch (err) {
    console.error('[flightService] getFlightDetails failed:', err);
    return null;
  }
}

export async function getAdapterCircuitBreakerStatus(): Promise<{
  state: string;
  failureCount: number;
  lastFailureTime?: number;
  syncedFrom: 'GDS' | 'CACHE';
  cachedTTL: number;
  cachedAt?: number;
}> {
  return getCircuitBreakerStatus() as unknown as {
    state: string;
    failureCount: number;
    lastFailureTime?: number;
    syncedFrom: 'GDS' | 'CACHE';
    cachedTTL: number;
    cachedAt?: number;
  };
}

export async function invalidateFlightCache(
  origin?: string,
  destination?: string,
  departureDate?: string
): Promise<void> {
  // Clear adapter-level cache
  try {
    await (clearCache as unknown as () => Promise<void>)();
  } catch (err) {
    console.warn('[flightService] clearCache adapter call failed:', err);
  }

  // Clear PostgreSQL cache entries
  try {
    if (origin && destination && departureDate) {
      const dateStart = `${departureDate}T00:00:00.000Z`;
      const dateEnd = `${departureDate}T23:59:59.999Z`;

      await query(
        `DELETE FROM flight_cache
         WHERE origin = $1
           AND destination = $2
           AND departure_time BETWEEN $3 AND $4`,
        [origin, destination, dateStart, dateEnd]
      );
    } else {
      await query(`DELETE FROM flight_cache WHERE expires_at <= NOW()`, []);
    }
  } catch (err) {
    console.error('[flightService] PostgreSQL cache invalidation failed:', err);
  }
}