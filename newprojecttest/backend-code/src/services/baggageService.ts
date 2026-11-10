import { v4 as uuidv4 } from 'uuid';
import { query, getClient } from '../db/pool';

export interface CreateBaggageClaimInput {
  passengerId: string;
  pnr: string;
  incidentType: string;
  description: string;
  evidenceUrls: string[];
}

export interface BaggageClaimEntity {
  id: string;
  trackingId: string;
  passengerId: string;
  pnr: string;
  bookingId: string;
  incidentType: string;
  description: string;
  evidenceUrls: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  timeline: AuditEvent[];
}

export interface AuditEvent {
  id: string;
  claimId: string;
  eventType: string;
  description: string;
  operatorId: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export async function validatePNRAgainstBookings(
  pnr: string,
  passengerId: string
): Promise<{ bookingId: string } | null> {
  const result = await query(
    `SELECT id FROM bookings WHERE pnr = $1 AND passenger_id = $2 AND status NOT IN ('cancelled') LIMIT 1`,
    [pnr, passengerId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return { bookingId: result.rows[0].id as string };
}

export async function createBaggageClaim(
  input: CreateBaggageClaimInput
): Promise<BaggageClaimEntity> {
  const { passengerId, pnr, incidentType, description, evidenceUrls } = input;

  const booking = await validatePNRAgainstBookings(pnr, passengerId);
  if (!booking) {
    throw new Error(
      `PNR ${pnr} is not associated with an active booking for this passenger.`
    );
  }

  const trackingId = `BGC-${uuidv4().toUpperCase().replace(/-/g, '').slice(0, 10)}`;
  const claimId = uuidv4();

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const claimResult = await client.query(
      `INSERT INTO baggage_claims
         (id, tracking_id, passenger_id, booking_id, pnr, incident_type, description, evidence_urls, status, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, 'submitted', NOW(), NOW())
       RETURNING *`,
      [
        claimId,
        trackingId,
        passengerId,
        booking.bookingId,
        pnr,
        incidentType,
        description,
        JSON.stringify(evidenceUrls),
      ]
    );

    const auditId = uuidv4();
    await client.query(
      `INSERT INTO baggage_claim_audit_events
         (id, claim_id, event_type, description, operator_id, metadata, created_at)
       VALUES
         ($1, $2, 'claim_submitted', 'Baggage claim submitted by passenger.', NULL, $3, NOW())`,
      [auditId, claimId, JSON.stringify({ incidentType, pnr, trackingId })]
    );

    await client.query('COMMIT');

    const row = claimResult.rows[0];
    return mapClaimRow(row, []);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getBaggageClaimById(
  claimId: string,
  passengerId: string
): Promise<BaggageClaimEntity | null> {
  const claimResult = await query(
    `SELECT * FROM baggage_claims WHERE id = $1 AND passenger_id = $2`,
    [claimId, passengerId]
  );

  if (claimResult.rows.length === 0) {
    return null;
  }

  const auditResult = await query(
    `SELECT * FROM baggage_claim_audit_events WHERE claim_id = $1 ORDER BY created_at ASC`,
    [claimId]
  );

  const timeline: AuditEvent[] = auditResult.rows.map((r) => ({
    id: r.id as string,
    claimId: r.claim_id as string,
    eventType: r.event_type as string,
    description: r.description as string,
    operatorId: (r.operator_id as string | null) ?? null,
    createdAt: (r.created_at as Date).toISOString(),
    metadata:
      r.metadata != null
        ? (r.metadata as Record<string, unknown>)
        : null,
  }));

  return mapClaimRow(claimResult.rows[0], timeline);
}

export async function addOperationalUpdate(
  claimId: string,
  operatorId: string,
  eventType: string,
  description: string,
  newStatus?: string,
  metadata?: Record<string, unknown>
): Promise<AuditEvent> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    if (newStatus) {
      await client.query(
        `UPDATE baggage_claims SET status = $1, updated_at = NOW() WHERE id = $2`,
        [newStatus, claimId]
      );
    }

    const auditId = uuidv4();
    const auditResult = await client.query(
      `INSERT INTO baggage_claim_audit_events
         (id, claim_id, event_type, description, operator_id, metadata, created_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        auditId,
        claimId,
        eventType,
        description,
        operatorId,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    await client.query('COMMIT');

    const r = auditResult.rows[0];
    return {
      id: r.id as string,
      claimId: r.claim_id as string,
      eventType: r.event_type as string,
      description: r.description as string,
      operatorId: (r.operator_id as string | null) ?? null,
      createdAt: (r.created_at as Date).toISOString(),
      metadata:
        r.metadata != null ? (r.metadata as Record<string, unknown>) : null,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function mapClaimRow(
  row: Record<string, unknown>,
  timeline: AuditEvent[]
): BaggageClaimEntity {
  let evidenceUrls: string[] = [];
  if (Array.isArray(row['evidence_urls'])) {
    evidenceUrls = row['evidence_urls'] as string[];
  } else if (typeof row['evidence_urls'] === 'string') {
    try {
      evidenceUrls = JSON.parse(row['evidence_urls']) as string[];
    } catch {
      evidenceUrls = [];
    }
  }

  return {
    id: row['id'] as string,
    trackingId: row['tracking_id'] as string,
    passengerId: row['passenger_id'] as string,
    pnr: row['pnr'] as string,
    bookingId: row['booking_id'] as string,
    incidentType: row['incident_type'] as string,
    description: row['description'] as string,
    evidenceUrls,
    status: row['status'] as string,
    createdAt: (row['created_at'] as Date).toISOString(),
    updatedAt: (row['updated_at'] as Date).toISOString(),
    timeline,
  };
}