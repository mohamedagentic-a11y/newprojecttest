import { Request, Response } from 'express';
import {
  validatePNRAgainstBookings,
  createBaggageClaim,
  getBaggageClaimById,
} from '../services/baggageService';

function generateRequestId(): string {
  return 'req_' + Math.random().toString(36).substring(2, 11);
}

function successEnvelope(data: unknown) {
  return {
    status: 'success',
    data,
    meta: {
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
    },
  };
}

function errorEnvelope(code: number, message: string, details?: unknown) {
  return {
    status: 'error',
    code,
    message,
    ...(details !== undefined ? { details } : {}),
    meta: {
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
    },
  };
}

function sendAcknowledgmentEmailStub(
  passengerId: string,
  trackingId: string,
  pnr: string
): void {
  // Email stub — in production this would call an email service
  console.info(
    `[EMAIL STUB] Acknowledgment sent to passenger ${passengerId} for claim ${trackingId} (PNR: ${pnr})`
  );
}

export async function submitBaggageClaim(req: Request, res: Response): Promise<void> {
  try {
    const passengerId: string | undefined =
      (req as Request & { user?: { passenger_id?: string } }).user?.passenger_id;

    if (!passengerId) {
      res.status(401).json(errorEnvelope(401, 'Unauthorized: missing passenger identity.'));
      return;
    }

    const { pnr, incidentType, description, files } = req.body as {
      pnr?: string;
      incidentType?: string;
      description?: string;
      files?: string[];
    };

    if (!pnr || typeof pnr !== 'string') {
      res.status(400).json(errorEnvelope(400, 'Missing or invalid field: pnr.'));
      return;
    }
    if (!incidentType || typeof incidentType !== 'string') {
      res.status(400).json(errorEnvelope(400, 'Missing or invalid field: incidentType.'));
      return;
    }
    if (!description || typeof description !== 'string') {
      res.status(400).json(errorEnvelope(400, 'Missing or invalid field: description.'));
      return;
    }

    const evidenceUrls: string[] = Array.isArray(files) ? files : [];

    // Validate PNR against existing bookings
    let bookingValidation: Awaited<ReturnType<typeof validatePNRAgainstBookings>>;
    try {
      bookingValidation = await validatePNRAgainstBookings(pnr, passengerId);
    } catch (validationError: unknown) {
      const msg =
        validationError instanceof Error ? validationError.message : 'PNR validation failed.';
      res.status(422).json(errorEnvelope(422, msg));
      return;
    }

    if (!bookingValidation) {
      res.status(422).json(errorEnvelope(422, 'PNR could not be validated against any booking.'));
      return;
    }

    const claim = await createBaggageClaim({
      passengerId,
      pnr,
      incidentType,
      description,
      evidenceUrls,
    });

    // Trigger acknowledgment email stub
    sendAcknowledgmentEmailStub(claim.passengerId, claim.trackingId, claim.pnr);

    res.status(201).json(successEnvelope(claim));
  } catch (error: unknown) {
    console.error('[baggageController] submitBaggageClaim error:', error);
    res.status(500).json(errorEnvelope(500, 'Internal server error while submitting baggage claim.'));
  }
}

export async function getClaimStatusTimeline(req: Request, res: Response): Promise<void> {
  try {
    const passengerId: string | undefined =
      (req as Request & { user?: { passenger_id?: string } }).user?.passenger_id;

    if (!passengerId) {
      res.status(401).json(errorEnvelope(401, 'Unauthorized: missing passenger identity.'));
      return;
    }

    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      res.status(400).json(errorEnvelope(400, 'Missing or invalid claim id.'));
      return;
    }

    const claim = await getBaggageClaimById(id);

    if (!claim) {
      res.status(404).json(errorEnvelope(404, `Baggage claim not found: ${id}`));
      return;
    }

    // Ensure the claim belongs to the requesting passenger
    if (claim.passengerId !== passengerId) {
      res.status(403).json(errorEnvelope(403, 'Forbidden: claim does not belong to this passenger.'));
      return;
    }

    res.status(200).json(successEnvelope(claim));
  } catch (error: unknown) {
    console.error('[baggageController] getClaimStatusTimeline error:', error);
    res.status(500).json(errorEnvelope(500, 'Internal server error while retrieving baggage claim.'));
  }
}