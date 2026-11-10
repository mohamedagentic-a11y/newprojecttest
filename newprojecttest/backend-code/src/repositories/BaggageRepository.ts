import { pool } from '../db/pool';

export interface BaggageClaim {
  id: string;
  passenger_id: string;
  pnr: string;
  incident_type: string;
  description: string;
  files: string[];
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateClaimInput {
  passenger_id: string;
  pnr: string;
  incident_type: string;
  description: string;
  files: string[];
}

export const BaggageRepository = {
  async createClaim(input: CreateClaimInput): Promise<BaggageClaim> {
    const { passenger_id, pnr, incident_type, description, files } = input;

    const result = await pool.query<BaggageClaim>(
      `INSERT INTO baggage_claims
        (passenger_id, pnr, incident_type, description, files, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'submitted', NOW(), NOW())
       RETURNING *`,
      [passenger_id, pnr, incident_type, description, JSON.stringify(files)]
    );

    return result.rows[0];
  },

  async findById(id: string): Promise<BaggageClaim | null> {
    const result = await pool.query<BaggageClaim>(
      `SELECT * FROM baggage_claims WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  },

  async updateStatus(id: string, status: string): Promise<BaggageClaim | null> {
    const result = await pool.query<BaggageClaim>(
      `UPDATE baggage_claims
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  },
};