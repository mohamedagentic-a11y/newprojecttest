import { pool } from '../db/pool';
import { QueryResult } from 'pg';

export interface Booking {
  id: string;
  passenger_id: string;
  flight_id: string;
  seat_preference: string | null;
  payment_method: string;
  status: string;
  pnr: string | null;
  fare_amount: number | null;
  miles_used: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface SeatAssignment {
  id: string;
  booking_id: string;
  flight_id: string;
  seat_number: string;
  cabin_class: string;
  passenger_id: string;
  assigned_at: Date;
}

export interface CreateBookingInput {
  passenger_id: string;
  flight_id: string;
  seat_preference?: string | null;
  payment_method: string;
  status?: string;
  pnr?: string | null;
  fare_amount?: number | null;
  miles_used?: number | null;
}

export interface UpdateBookingInput {
  flight_id?: string;
  seat_preference?: string | null;
  payment_method?: string;
  status?: string;
  pnr?: string | null;
  fare_amount?: number | null;
  miles_used?: number | null;
}

export interface LockSeatInput {
  booking_id: string;
  flight_id: string;
  seat_number: string;
  cabin_class: string;
  passenger_id: string;
}

export class BookingRepository {
  async createBooking(input: CreateBookingInput): Promise<Booking> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result: QueryResult<Booking> = await client.query(
        `INSERT INTO bookings (
          passenger_id,
          flight_id,
          seat_preference,
          payment_method,
          status,
          pnr,
          fare_amount,
          miles_used,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *`,
        [
          input.passenger_id,
          input.flight_id,
          input.seat_preference ?? null,
          input.payment_method,
          input.status ?? 'pending',
          input.pnr ?? null,
          input.fare_amount ?? null,
          input.miles_used ?? null,
        ]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<Booking | null> {
    const result: QueryResult<Booking> = await pool.query(
      `SELECT * FROM bookings WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async updateBooking(id: string, input: UpdateBookingInput): Promise<Booking | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.flight_id !== undefined) {
      fields.push(`flight_id = $${paramIndex++}`);
      values.push(input.flight_id);
    }
    if (input.seat_preference !== undefined) {
      fields.push(`seat_preference = $${paramIndex++}`);
      values.push(input.seat_preference);
    }
    if (input.payment_method !== undefined) {
      fields.push(`payment_method = $${paramIndex++}`);
      values.push(input.payment_method);
    }
    if (input.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.pnr !== undefined) {
      fields.push(`pnr = $${paramIndex++}`);
      values.push(input.pnr);
    }
    if (input.fare_amount !== undefined) {
      fields.push(`fare_amount = $${paramIndex++}`);
      values.push(input.fare_amount);
    }
    if (input.miles_used !== undefined) {
      fields.push(`miles_used = $${paramIndex++}`);
      values.push(input.miles_used);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result: QueryResult<Booking> = await pool.query(
      `UPDATE bookings SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] ?? null;
  }

  async lockSeat(input: LockSeatInput): Promise<SeatAssignment> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Derive a stable advisory lock key from flight_id + seat_number using hashtext
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtext($1 || '_' || $2))`,
        [input.flight_id, input.seat_number]
      );

      // Check if seat is already assigned for this flight
      const existingResult: QueryResult<SeatAssignment> = await client.query(
        `SELECT * FROM seat_assignments WHERE flight_id = $1 AND seat_number = $2`,
        [input.flight_id, input.seat_number]
      );

      if (existingResult.rows.length > 0) {
        throw new Error(
          `Seat ${input.seat_number} on flight ${input.flight_id} is already assigned`
        );
      }

      const insertResult: QueryResult<SeatAssignment> = await client.query(
        `INSERT INTO seat_assignments (
          booking_id,
          flight_id,
          seat_number,
          cabin_class,
          passenger_id,
          assigned_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *`,
        [
          input.booking_id,
          input.flight_id,
          input.seat_number,
          input.cabin_class,
          input.passenger_id,
        ]
      );

      await client.query('COMMIT');
      return insertResult.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findByPassenger(passenger_id: string): Promise<Booking[]> {
    const result: QueryResult<Booking> = await pool.query(
      `SELECT * FROM bookings WHERE passenger_id = $1 ORDER BY created_at DESC`,
      [passenger_id]
    );
    return result.rows;
  }
}