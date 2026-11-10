import { Request, Response, NextFunction } from 'express';
import { FlightService } from '../services/FlightService';

const flightService = new FlightService();

function generateRequestId(): string {
  return 'req_' + Math.random().toString(36).substring(2, 11);
}

function successEnvelope(data: unknown, meta?: Record<string, unknown>) {
  return {
    status: 'success',
    data,
    meta: {
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
      ...meta,
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

export class FlightController {
  async searchFlights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { origin, destination, departureDate, cabinClass, cursor, limit } = req.query;

      if (!origin || !destination || !departureDate) {
        res.status(400).json(
          errorEnvelope(400, 'Missing required query parameters: origin, destination, departureDate', {
            field: 'query',
            constraint: 'origin, destination, and departureDate are required',
          })
        );
        return;
      }

      // Build a caller key from the authenticated passenger or IP for rate limiting
      const callerKey =
        (req as Request & { user?: { passenger_id?: string } }).user?.passenger_id ||
        req.ip ||
        'anonymous';

      const parsedLimit = limit ? Math.min(parseInt(limit as string, 10), 50) : 20;

      const options = {
        origin: origin as string,
        destination: destination as string,
        departureDate: departureDate as string,
        cabinClass: cabinClass as string | undefined,
        cursor: cursor as string | undefined,
        limit: parsedLimit,
      };

      let result;
      try {
        result = await flightService.searchFlights(options, callerKey);
      } catch (svcErr: unknown) {
        // Check if the error is a rate limit error from the service layer
        if (svcErr instanceof Error && svcErr.message.toLowerCase().includes('rate limit')) {
          const resetMs = flightService.getRateLimitResetMs(callerKey);
          const retryAfterSec = Math.ceil(resetMs / 1000);
          res.set('Retry-After', String(retryAfterSec));
          res.set('X-RateLimit-Limit', '30');
          res.set('X-RateLimit-Remaining', '0');
          res.set('X-RateLimit-Reset', String(Date.now() + resetMs));
          res.status(429).json(
            errorEnvelope(429, 'Too many requests. GDS search rate limit reached.', {
              retryAfter: retryAfterSec,
            })
          );
          return;
        }
        throw svcErr;
      }

      const { data, pagination, usedGDS, gds_synced_at } = result;

      res.status(200).json({
        ...successEnvelope(data, {
          syncedFrom: usedGDS ?? 'GDS',
          cachedTTL: 900,
          syncedAt: gds_synced_at ?? null,
        }),
        pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  async getFlightById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json(errorEnvelope(400, 'Flight ID is required.'));
        return;
      }

      const flight = await flightService.getFlightById(id);

      if (!flight) {
        res.status(404).json(
          errorEnvelope(404, `Flight with id '${id}' was not found.`, {
            field: 'id',
            constraint: 'must reference an existing flight',
          })
        );
        return;
      }

      const {
        flight_number,
        departure_time,
        arrival_time,
        cabin_class,
        fare_amount,
        currency,
        available_seats,
        airline_code,
        gds_source,
        gds_synced_at,
      } = flight;

      res.status(200).json(
        successEnvelope(
          {
            id,
            flight_number,
            departure_time,
            arrival_time,
            cabin_class,
            fare_amount,
            currency,
            available_seats,
            airline_code,
            gds_source,
            gds_synced_at,
          },
          {
            syncedFrom: gds_source ?? 'GDS',
            syncedAt: gds_synced_at ?? null,
          }
        )
      );
    } catch (err) {
      next(err);
    }
  }
}