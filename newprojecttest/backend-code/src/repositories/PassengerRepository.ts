import { pool } from '../db/pool';

export interface PassengerProfile {
  passenger_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  document_url: string | null;
  tier_status: string;
  preferred_language: string;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateProfilePayload {
  phone?: string;
  document_url?: string;
  preferred_language?: string;
}

export interface ExportJob {
  export_job_id: string;
  passenger_id: string;
  status: string;
  created_at: Date;
}

export class PassengerRepository {
  async findByEmail(email: string): Promise<PassengerProfile | null> {
    const query = `
      SELECT
        passenger_id,
        email,
        first_name,
        last_name,
        phone,
        document_url,
        tier_status,
        preferred_language,
        created_at,
        updated_at
      FROM passengers
      WHERE email = $1
      LIMIT 1
    `;

    const result = await pool.query<PassengerProfile>(query, [email]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  async findById(passengerId: string): Promise<PassengerProfile | null> {
    const query = `
      SELECT
        passenger_id,
        email,
        first_name,
        last_name,
        phone,
        document_url,
        tier_status,
        preferred_language,
        created_at,
        updated_at
      FROM passengers
      WHERE passenger_id = $1
      LIMIT 1
    `;

    const result = await pool.query<PassengerProfile>(query, [passengerId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  async updateProfile(
    passengerId: string,
    payload: UpdateProfilePayload
  ): Promise<PassengerProfile | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (payload.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      values.push(payload.phone);
    }

    if (payload.document_url !== undefined) {
      setClauses.push(`document_url = $${paramIndex++}`);
      values.push(payload.document_url);
    }

    if (payload.preferred_language !== undefined) {
      setClauses.push(`preferred_language = $${paramIndex++}`);
      values.push(payload.preferred_language);
    }

    if (setClauses.length === 0) {
      return this.findById(passengerId);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(passengerId);

    const query = `
      UPDATE passengers
      SET ${setClauses.join(', ')}
      WHERE passenger_id = $${paramIndex}
      RETURNING
        passenger_id,
        email,
        first_name,
        last_name,
        phone,
        document_url,
        tier_status,
        preferred_language,
        created_at,
        updated_at
    `;

    const result = await pool.query<PassengerProfile>(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  async createExportJob(passengerId: string): Promise<ExportJob> {
    const query = `
      INSERT INTO passenger_export_jobs (passenger_id, status, created_at)
      VALUES ($1, 'processing', NOW())
      RETURNING
        export_job_id,
        passenger_id,
        status,
        created_at
    `;

    const result = await pool.query<ExportJob>(query, [passengerId]);

    if (result.rows.length === 0) {
      throw new Error(
        `Failed to create export job for passenger ${passengerId}`
      );
    }

    return result.rows[0];
  }
}