import { query, getClient } from '../db/pool';

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

export interface UpdatePassengerProfileInput {
  phone?: string;
  document_url?: string;
}

export interface ExportJob {
  export_job_id: string;
  passenger_id: string;
  status: string;
  created_at: Date;
}

export interface DpoValidationRecord {
  validation_id: string;
  passenger_id: string;
  change_summary: Record<string, unknown>;
  status: string;
  created_at: Date;
}

async function getPassengerProfile(passengerId: string): Promise<PassengerProfile | null> {
  const result = await query<PassengerProfile>(
    `SELECT
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
     WHERE passenger_id = $1`,
    [passengerId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

async function updatePassengerProfile(
  passengerId: string,
  updates: UpdatePassengerProfileInput
): Promise<PassengerProfile | null> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      values.push(updates.phone);
    }

    if (updates.document_url !== undefined) {
      setClauses.push(`document_url = $${paramIndex++}`);
      values.push(updates.document_url);
    }

    if (setClauses.length === 0) {
      await client.query('ROLLBACK');
      return getPassengerProfile(passengerId);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(passengerId);

    const updateResult = await client.query<PassengerProfile>(
      `UPDATE passengers
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
         updated_at`,
      values
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const updatedProfile = updateResult.rows[0];

    // DPO validation workflow stub
    const changeSummary: Record<string, unknown> = {};
    if (updates.phone !== undefined) {
      changeSummary['phone'] = { updated: true };
    }
    if (updates.document_url !== undefined) {
      changeSummary['document_url'] = { updated: true };
    }

    await client.query<DpoValidationRecord>(
      `INSERT INTO dpo_validation_queue (
         passenger_id,
         change_summary,
         status,
         created_at
       ) VALUES ($1, $2, $3, NOW())`,
      [passengerId, JSON.stringify(changeSummary), 'pending']
    );

    await client.query('COMMIT');

    return updatedProfile;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function createDataExportJob(passengerId: string): Promise<ExportJob> {
  const exportJobId = `exp_${generateJobId()}`;

  const result = await query<ExportJob>(
    `INSERT INTO data_export_jobs (
       export_job_id,
       passenger_id,
       status,
       created_at
     ) VALUES ($1, $2, $3, NOW())
     RETURNING
       export_job_id,
       passenger_id,
       status,
       created_at`,
    [exportJobId, passengerId, 'processing']
  );

  return result.rows[0];
}

function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${randomPart}`;
}

export { getPassengerProfile, updatePassengerProfile, createDataExportJob };