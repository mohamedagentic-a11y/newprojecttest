import { pool } from '../db/pool';

export interface Flight {
  id: string;
  flight_number: string;
  origin: string;
  destination: string;
  departure_time: Date;
  arrival_time: Date;
  cabin_class: string;
  fare_amount: number;
  currency: string;
  available_seats: number;
  airline_code: string;
  gds_source: string;
  gds_synced_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface SearchFlightsParams {
  origin: string;
  destination: string;
  departureDate: string;
  cabinClass?: string;
  cursor?: string;
  limit?: number;
}

export interface SearchFlightsResult {
  data: Flight[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

export interface UpsertFlightPayload {
  flight_number: string;
  origin: string;
  destination: string;
  departure_time: Date;
  arrival_time: Date;
  cabin_class: string;
  fare_amount: number;
  currency: string;
  available_seats: number;
  airline_code: string;
  gds_source: string;
  gds_synced_at: Date;
}

export class FlightRepository {
  async searchFlights(params: SearchFlightsParams): Promise<SearchFlightsResult> {
    const limit = Math.min(params.limit ?? 20, 50);
    const values: unknown[] = [];
    let idx = 1;

    let baseQuery = `
      SELECT *
      FROM flights
      WHERE 1=1
    `;

    if (params.origin) {
      baseQuery += ` AND origin = $${idx++}`;
      values.push(params.origin.toUpperCase());
    }

    if (params.destination) {
      baseQuery += ` AND destination = $${idx++}`;
      values.push(params.destination.toUpperCase());
    }

    if (params.departureDate) {
      baseQuery += ` AND DATE(departure_time) = $${idx++}`;
      values.push(params.departureDate);
    }

    if (params.cabinClass) {
      baseQuery += ` AND cabin_class = $${idx++}`;
      values.push(params.cabinClass);
    }

    if (params.cursor) {
      let cursorData: { id: string; departure_time: string };
      try {
        const decoded = Buffer.from(params.cursor, 'base64').toString('utf8');
        cursorData = JSON.parse(decoded);
      } catch {
        throw new Error('Invalid cursor value');
      }
      baseQuery += ` AND (departure_time, id) > ($${idx++}, $${idx++})`;
      values.push(cursorData.departure_time);
      values.push(cursorData.id);
    }

    baseQuery += ` ORDER BY departure_time ASC, id ASC LIMIT $${idx++}`;
    values.push(limit + 1);

    const result = await pool.query<Flight>(baseQuery, values);
    const rows = result.rows;

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const lastRow = data[data.length - 1];
      const cursorPayload = JSON.stringify({
        id: lastRow.id,
        departure_time: lastRow.departure_time.toISOString(),
      });
      nextCursor = Buffer.from(cursorPayload, 'utf8').toString('base64');
    }

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    };
  }

  async findById(id: string): Promise<Flight | null> {
    const result = await pool.query<Flight>(
      'SELECT * FROM flights WHERE id = $1',
      [id]
    );
    return result.rows[0] ?? null;
  }

  async upsertFromGDS(payload: UpsertFlightPayload): Promise<Flight> {
    const result = await pool.query<Flight>(
      `INSERT INTO flights (
        flight_number,
        origin,
        destination,
        departure_time,
        arrival_time,
        cabin_class,
        fare_amount,
        currency,
        available_seats,
        airline_code,
        gds_source,
        gds_synced_at,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      ON CONFLICT (flight_number, cabin_class, departure_time)
      DO UPDATE SET
        origin          = EXCLUDED.origin,
        destination     = EXCLUDED.destination,
        arrival_time    = EXCLUDED.arrival_time,
        fare_amount     = EXCLUDED.fare_amount,
        currency        = EXCLUDED.currency,
        available_seats = EXCLUDED.available_seats,
        airline_code    = EXCLUDED.airline_code,
        gds_source      = EXCLUDED.gds_source,
        gds_synced_at   = EXCLUDED.gds_synced_at,
        updated_at      = NOW()
      RETURNING *`,
      [
        payload.flight_number,
        payload.origin,
        payload.destination,
        payload.departure_time,
        payload.arrival_time,
        payload.cabin_class,
        payload.fare_amount,
        payload.currency,
        payload.available_seats,
        payload.airline_code,
        payload.gds_source,
        payload.gds_synced_at,
      ]
    );

    if (!result.rows[0]) {
      throw new Error('Upsert did not return a row');
    }

    return result.rows[0];
  }
}