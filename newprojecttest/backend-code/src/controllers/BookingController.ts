import { Request, Response, NextFunction } from 'express';
import { BookingService, BookingServiceError } from '../services/BookingService';

const bookingService = new BookingService();

function requestId(): string {
  return 'req_' + Math.random().toString(36).substr(2, 9);
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

function errorEnvelope(code: number, message: string, details?: unknown) {
  return {
    status: 'error',
    code,
    message,
    ...(details !== undefined ? { details } : {}),
    meta: {
      requestId: requestId(),
      timestamp: new Date().toISOString(),
    },
  };
}

function mapServiceErrorToHttp(err: BookingServiceError): {
  status: number;
  body: ReturnType<typeof errorEnvelope>;
} {
  switch (err.code) {
    case 'REBOOK_WINDOW_CLOSED':
      return {
        status: 403,
        body: errorEnvelope(403, err.message, {
          field: 'departure_time',
          constraint: '< T-2h',
        }),
      };
    case 'ALREADY_CHECKED_IN':
      return {
        status: 409,
        body: errorEnvelope(409, err.message),
      };
    case 'CHECKIN_WINDOW_NOT_OPEN':
      return {
        status: 409,
        body: errorEnvelope(409, err.message, {
          field: 'departure_time',
          constraint: 'outside check-in window',
        }),
      };
    case 'NOT_FOUND':
      return {
        status: 404,
        body: errorEnvelope(404, err.message),
      };
    case 'FORBIDDEN':
      return {
        status: 403,
        body: errorEnvelope(403, err.message),
      };
    case 'VALIDATION_ERROR':
      return {
        status: 400,
        body: errorEnvelope(400, err.message),
      };
    default:
      return {
        status: 500,
        body: errorEnvelope(500, err.message || 'Internal server error'),
      };
  }
}

export class BookingController {
  /**
   * POST /bookings
   * Creates a new flight reservation.
   */
  async createBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const passengerId: string = (req as Request & { user?: { passenger_id: string } }).user
        ?.passenger_id as string;

      if (!passengerId) {
        res.status(401).json(errorEnvelope(401, 'Unauthorized'));
        return;
      }

      const { flightId, seatPreference, paymentMethod } = req.body as {
        flightId: string;
        seatPreference?: string;
        paymentMethod?: string;
      };

      if (!flightId) {
        res.status(400).json(errorEnvelope(400, 'flightId is required'));
        return;
      }

      const booking = await bookingService.createBooking({
        passengerId,
        flightId,
        seatPreference,
        paymentMethod,
      });

      res.status(201).json(successEnvelope(booking));
    } catch (err) {
      if (err instanceof BookingServiceError) {
        const { status, body } = mapServiceErrorToHttp(err);
        res.status(status).json(body);
        return;
      }
      next(err);
    }
  }

  /**
   * PUT /bookings/:id/rebook
   * Modifies flight within T-2h window. Enforces cutoff per BR-003.
   */
  async rebookFlight(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const passengerId: string = (req as Request & { user?: { passenger_id: string } }).user
        ?.passenger_id as string;

      if (!passengerId) {
        res.status(401).json(errorEnvelope(401, 'Unauthorized'));
        return;
      }

      const bookingId = req.params['id'];
      const { newFlightId, paymentMethod } = req.body as {
        newFlightId: string;
        paymentMethod?: string;
      };

      if (!bookingId) {
        res.status(400).json(errorEnvelope(400, 'Booking ID is required'));
        return;
      }

      if (!newFlightId) {
        res.status(400).json(errorEnvelope(400, 'newFlightId is required'));
        return;
      }

      const updatedBooking = await bookingService.rebookFlight({
        bookingId,
        passengerId,
        newFlightId,
        paymentMethod,
      });

      res.status(200).json(successEnvelope(updatedBooking));
    } catch (err) {
      if (err instanceof BookingServiceError) {
        const { status, body } = mapServiceErrorToHttp(err);
        res.status(status).json(body);
        return;
      }
      next(err);
    }
  }

  /**
   * GET /bookings/:id
   * Retrieves a booking by ID.
   */
  async getBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const passengerId: string = (req as Request & { user?: { passenger_id: string } }).user
        ?.passenger_id as string;

      if (!passengerId) {
        res.status(401).json(errorEnvelope(401, 'Unauthorized'));
        return;
      }

      const bookingId = req.params['id'];

      if (!bookingId) {
        res.status(400).json(errorEnvelope(400, 'Booking ID is required'));
        return;
      }

      const booking = await bookingService.getBookingById({ bookingId, passengerId });

      res.status(200).json(successEnvelope(booking));
    } catch (err) {
      if (err instanceof BookingServiceError) {
        const { status, body } = mapServiceErrorToHttp(err);
        res.status(status).json(body);
        return;
      }
      next(err);
    }
  }

  /**
   * GET /bookings/:id/checkin
   * Validates check-in window (24h pre-departure) per Feature-5.1.
   * Returns 409 if already checked in (US-007 AC-02).
   */
  async checkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const passengerId: string = (req as Request & { user?: { passenger_id: string } }).user
        ?.passenger_id as string;

      if (!passengerId) {
        res.status(401).json(errorEnvelope(401, 'Unauthorized'));
        return;
      }

      const bookingId = req.params['id'];

      if (!bookingId) {
        res.status(400).json(errorEnvelope(400, 'Booking ID is required'));
        return;
      }

      const result = await bookingService.checkIn({ bookingId, passengerId });

      res.status(200).json(successEnvelope(result));
    } catch (err) {
      if (err instanceof BookingServiceError) {
        const { status, body } = mapServiceErrorToHttp(err);
        res.status(status).json(body);
        return;
      }
      next(err);
    }
  }

  /**
   * GET /bookings/:id/boarding-pass
   * Streams a PDF boarding pass per Feature-5.2 / US-008.
   */
  async getBoardingPass(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const passengerId: string = (req as Request & { user?: { passenger_id: string } }).user
        ?.passenger_id as string;

      if (!passengerId) {
        res.status(401).json(errorEnvelope(401, 'Unauthorized'));
        return;
      }

      const bookingId = req.params['id'];

      if (!bookingId) {
        res.status(400).json(errorEnvelope(400, 'Booking ID is required'));
        return;
      }

      const pdfBuffer = await bookingService.generateBoardingPass({ bookingId, passengerId });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="boarding-pass-${bookingId}.pdf"`,
      );
      res.setHeader('Content-Length', pdfBuffer.length);
      res.status(200).end(pdfBuffer);
    } catch (err) {
      if (err instanceof BookingServiceError) {
        const { status, body } = mapServiceErrorToHttp(err);
        res.status(status).json(body);
        return;
      }
      next(err);
    }
  }
}