import { AuditRepository, AuditLogEntry } from '../repositories/AuditRepository';

export interface AuditEventInput {
  action: string;
  ip_address: string;
  outcome: string;
  passenger_id?: string | null;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  private auditRepository: AuditRepository;

  constructor(auditRepository: AuditRepository) {
    this.auditRepository = auditRepository;
  }

  async logEvent(input: AuditEventInput): Promise<void> {
    const entry: AuditLogEntry = {
      action: input.action,
      ip_address: input.ip_address,
      outcome: input.outcome,
      passenger_id: input.passenger_id ?? null,
    };

    await this.auditRepository.insertAuditLog(entry);
  }

  async logLoginEvent(params: {
    passenger_id: string | null;
    ip_address: string;
    outcome: 'success' | 'failure';
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.logEvent({
      action: 'LOGIN',
      ip_address: params.ip_address,
      outcome: params.outcome,
      passenger_id: params.passenger_id,
      metadata: params.metadata,
    });
  }

  async logBookingModification(params: {
    passenger_id: string;
    ip_address: string;
    outcome: 'success' | 'failure';
    bookingId: string;
    modificationType: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.logEvent({
      action: `BOOKING_MODIFICATION:${params.modificationType}`,
      ip_address: params.ip_address,
      outcome: params.outcome,
      passenger_id: params.passenger_id,
      metadata: {
        bookingId: params.bookingId,
        modificationType: params.modificationType,
        ...params.metadata,
      },
    });
  }
}