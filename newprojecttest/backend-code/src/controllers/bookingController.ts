import { Request, Response, NextFunction } from 'express';
import { createBooking, rebookFlight, validateCheckIn, getBoardingPassUrl } from '../services/bookingService';
import auditMiddleware, { AuditableRequest } from '../middleware/auditMiddleware';
import https from 'https';
import http from 'http';

type AuthRequest = Request & AuditableRequest & {
  user?: {
    passenger_id?: string;
    tier_status?: string;
    preferred_language?: string;
  };
};

function requestId(): string {
  return 'req_' + Math.random().toString(36).substring(2, 10);
}

function successEnvelope(data: unknown) {
  return {
    status: 'success',
    data,
    meta: {
      requestId: requestId(),
      timestamp: new Date().toISOString(),
    },
  };
}

function errorEnvelope(code: number, message: string, details?: object) {
  return {
    status: 'error',
    code,
    message,
    ...(details ? { details } : {}),
    meta: {
      requestId: requestId(),
      timestamp: new Date().toISOString(),
    },
  };
}

// POST /bookings
export async function createBookingHandler(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
  const passengerId = req.user?.passenger_id;

  if (!passengerId) {
    res.status(401).json(errorEnvelope(401, 'Unauthorized: passenger identity missing'));
    return;
  }

  const { flightId, seatPreference, paymentMethod, cabinClass } = req.body as {
    flightId?: string;
    seatPreference?: 'window' | 'aisle' | 'middle';
    paymentMethod?: 'miles' | 'card';
    cabinClass?: string;
  };

  if (!flightId || !seatPreference || !paymentMethod) {
    res.status(400).json(
      errorEnvelope(400, 'Missing required fields: flightId, seatPreference, paymentMethod')
    );
    return;
  }

  if (!['window', 'aisle', 'middle'].includes(seatPreference)) {
    res.status(400).json(
      errorEnvelope(400, 'Invalid seatPreference. Must be window, aisle, or middle')
    );
    return;
  }

  if (!['miles', 'card'].includes(paymentMethod)) {
    res.status(400).json(
      errorEnvelope(400, 'Invalid paymentMethod. Must be miles or card')
    );
    return;
  }

  try {
    const result = await createBooking({
      passengerId,
      flightId,
      seatPreference,
      paymentMethod,
      ...(cabinClass ? { cabinClass } : {}),
    });

    req.auditPassengerId = passengerId;
    req.auditOutcome = 'success';

    res.status(201).json(successEnvelope(result));
  } catch (err: unknown) {
    req.auditPassengerId = passengerId;
    req.auditOutcome = 'failure';

    const message = err instanceof Error ? err.message : 'Failed to create booking';
    res.status(422).json(errorEnvelope(422, message));
  }
}

// PUT /bookings/:id/rebook
export async function rebookFlightHandler(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
  const passengerId = req.user?.passenger_id;

  if (!passengerId) {
    res.status(401).json(errorEnvelope(401, 'Unauthorized: passenger identity missing'));
    return;
  }

  const bookingId = req.params['id'];
  const { newFlightId, paymentMethod } = req.body as {
    newFlightId?: string;
    paymentMethod?: 'miles' | 'card';
  };

  if (!bookingId) {
    res.status(400).json(errorEnvelope(400, 'Missing booking id'));
    return;
  }

  if (!newFlightId || !paymentMethod) {
    res.status(400).json(
      errorEnvelope(400, 'Missing required fields: newFlightId, paymentMethod')
    );
    return;
  }

  if (!['miles', 'card'].includes(paymentMethod)) {
    res.status(400).json(
      errorEnvelope(400, 'Invalid paymentMethod. Must be miles or card')
    );
    return;
  }

  try {
    const result = await rebookFlight({
      bookingId,
      passengerId,
      newFlightId,
      paymentMethod,
    });

    // Check T-2h cutoff per BR-003
    if (result.eligible === false) {
      req.auditPassengerId = passengerId;
      req.auditOutcome = 'failure';

      res.status(422).json(
        errorEnvelope(422, result.reason ?? 'Rebooking window closed. Policy applies per BR-003.', {
          field: 'departure_time',
          constraint: '< T-2h',
        })
      );
      return;
    }

    req.auditPassengerId = passengerId;
    req.auditOutcome = 'success';

    res.status(200).json(successEnvelope(result));
  } catch (err: unknown) {
    req.auditPassengerId = passengerId;
    req.auditOutcome = 'failure';

    const message = err instanceof Error ? err.message : 'Failed to rebook flight';
    res.status(422).json(errorEnvelope(422, message));
  }
}

// GET /bookings/:id/checkin
export async function checkInHandler(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
  const passengerId = req.user?.passenger_id;

  if (!passengerId) {
    res.status(401).json(errorEnvelope(401, 'Unauthorized: passenger identity missing'));
    return;
  }

  const bookingId = req.params['id'];

  if (!bookingId) {
    res.status(400).json(errorEnvelope(400, 'Missing booking id'));
    return;
  }

  try {
    const result = await validateCheckIn({ bookingId, passengerId, flightId: '', seatNumber: null, seatPreference: '', cabinClass: '', status: 'confirmed', fareAmount: 0, currency: '', paymentMethod: '', boardingPassUrl: null, createdAt: '', updatedAt: '' } as never);

    if (!result.eligible) {
      req.auditPassengerId = passengerId;
      req.auditOutcome = 'failure';

      res.status(422).json(
        errorEnvelope(422, result.reason ?? 'Check-in window not open. Must be within 24 hours of departure.', {
          field: 'departure_time',
          constraint: 'within 24h pre-departure',
        })
      );
      return;
    }

    req.auditPassengerId = passengerId;
    req.auditOutcome = 'success';

    res.status(200).json(
      successEnvelope({
        eligible: result.eligible,
        boardingPassUrl: result.boardingPassUrl ?? null,
      })
    );
  } catch (err: unknown) {
    req.auditPassengerId = passengerId;
    req.auditOutcome = 'failure';

    const message = err instanceof Error ? err.message : 'Failed to validate check-in';
    res.status(500).json(errorEnvelope(500, message));
  }
}

// GET /bookings/:id/boarding-pass
export async function boardingPassHandler(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
  const passengerId = req.user?.passenger_id;

  if (!passengerId) {
    res.status(401).json(errorEnvelope(401, 'Unauthorized: passenger identity missing'));
    return;
  }

  const bookingId = req.params['id'];

  if (!bookingId) {
    res.status(400).json(errorEnvelope(400, 'Missing booking id'));
    return;
  }

  try {
    const result = await getBoardingPassUrl({ bookingId, passengerId, flightId: '', seatNumber: null, seatPreference: '', cabinClass: '', status: 'confirmed', fareAmount: 0, currency: '', paymentMethod: '', boardingPassUrl: null, createdAt: '', updatedAt: '' } as never);

    if (!result.boardingPassUrl) {
      req.auditPassengerId = passengerId;
      req.auditOutcome = 'failure';

      res.status(404).json(
        errorEnvelope(404, 'Boarding pass not available for this booking')
      );
      return;
    }

    req.auditPassengerId = passengerId;
    req.auditOutcome = 'success';

    const boardingPassUrl = result.boardingPassUrl;

    // Stream the PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="boarding-pass-${bookingId}.pdf"`);

    const urlObj = new URL(boardingPassUrl);
    const transport = urlObj.protocol === 'https:' ? https : http;

    transport.get(boardingPassUrl, (pdfRes) => {
      if (pdfRes.statusCode && pdfRes.statusCode >= 400) {
        res.status(502).json(errorEnvelope(502, 'Failed to retrieve boarding pass document'));
        return;
      }
      pdfRes.pipe(res);
    }).on('error', (_streamErr) => {
      res.status(502).json(errorEnvelope(502, 'Error streaming boarding pass'));
    });
  } catch (err: unknown) {
    req.auditPassengerId = passengerId;
    req.auditOutcome = 'failure';

    const message = err instanceof Error ? err.message : 'Failed to retrieve boarding pass';
    res.status(500).json(errorEnvelope(500, message));
  }
}

// Re-export audit middleware for use in route registration
export { auditMiddleware };