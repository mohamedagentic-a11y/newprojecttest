import { pool } from '../db/pool';

export interface AuditLogEntry {
  action: string;
  ip_address: string;
  outcome: string;
  passenger_id?: string | null;
}

export class AuditRepository {
  async insertAuditLog(entry: AuditLogEntry): Promise<void> {
    const { action, ip_address, outcome, passenger_id } = entry;

    await pool.query(
      `INSERT INTO audit_logs (action, ip_address, outcome, passenger_id)
       VALUES ($1, $2, $3, $4)`,
      [action, ip_address, outcome, passenger_id ?? null]
    );
  }
}