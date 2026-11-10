import { Request, Response, NextFunction } from 'express';
import { LoyaltyService } from '../services/LoyaltyService';

const loyaltyService = new LoyaltyService();

function generateRequestId(): string {
  return 'req_' + Math.random().toString(36).substring(2, 11);
}

function successEnvelope(data: unknown, requestId: string) {
  return {
    status: 'success',
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

function errorEnvelope(code: number, message: string, requestId: string, details?: unknown) {
  return {
    status: 'error',
    code,
    message,
    ...(details ? { details } : {}),
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

export class LoyaltyController {
  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = generateRequestId();

    try {
      const passenger = (req as Request & { user?: { passenger_id?: string; passengerId?: string; tier_status?: string } }).user;

      if (!passenger || (!passenger.passenger_id && !passenger.passengerId)) {
        res.status(401).json(errorEnvelope(401, 'Unauthorized: passenger identity missing from token.', requestId));
        return;
      }

      const passengerId: string = (passenger.passenger_id ?? passenger.passengerId)!;

      const result = await loyaltyService.getBalance(passengerId);

      res.status(200).json(successEnvelope(result, requestId));
    } catch (err: unknown) {
      next(err);
    }
  }

  async redeemMiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = generateRequestId();

    try {
      const passenger = (req as Request & { user?: { passenger_id?: string; passengerId?: string; tier_status?: string } }).user;

      if (!passenger || (!passenger.passenger_id && !passenger.passengerId)) {
        res.status(401).json(errorEnvelope(401, 'Unauthorized: passenger identity missing from token.', requestId));
        return;
      }

      const passengerId: string = (passenger.passenger_id ?? passenger.passengerId)!;
      const tierStatus: string = passenger.tier_status ?? '';

      const { amount, serviceType, idempotencyKey, referenceId } = req.body as {
        amount?: unknown;
        serviceType?: unknown;
        idempotencyKey?: unknown;
        referenceId?: unknown;
      };

      if (typeof amount !== 'number' || amount <= 0) {
        res.status(400).json(
          errorEnvelope(400, 'Invalid request: "amount" must be a positive number.', requestId, {
            field: 'amount',
            constraint: '> 0',
          }),
        );
        return;
      }

      if (!serviceType || typeof serviceType !== 'string' || serviceType.trim() === '') {
        res.status(400).json(
          errorEnvelope(400, 'Invalid request: "serviceType" is required.', requestId, {
            field: 'serviceType',
            constraint: 'non-empty string',
          }),
        );
        return;
      }

      if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
        res.status(400).json(
          errorEnvelope(400, 'Invalid request: "idempotencyKey" is required to prevent duplicate deductions.', requestId, {
            field: 'idempotencyKey',
            constraint: 'non-empty string',
          }),
        );
        return;
      }

      // Validate tier eligibility before delegating to service
      if (tierStatus && !loyaltyService.validateTier(tierStatus)) {
        const threshold = loyaltyService.getTierThreshold(tierStatus);
        res.status(403).json(
          errorEnvelope(
            403,
            `Redemption blocked: tier "${tierStatus}" is not eligible for redemption. Minimum threshold: ${threshold} miles.`,
            requestId,
            {
              field: 'tier_status',
              constraint: `eligible tier required; threshold: ${threshold}`,
            },
          ),
        );
        return;
      }

      const input = {
        passengerId,
        amount: amount as number,
        serviceType: serviceType as string,
        idempotencyKey: idempotencyKey as string,
        ...(referenceId && typeof referenceId === 'string' ? { referenceId } : {}),
      };

      const result = await loyaltyService.redeemMiles(input);

      res.status(200).json(
        successEnvelope(
          {
            newBalance: result.newBalance,
            transactionId: result.transactionId,
          },
          requestId,
        ),
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();

        if (msg.includes('insufficient') || msg.includes('balance') || msg.includes('below minimum')) {
          res.status(422).json(
            errorEnvelope(422, err.message, requestId, {
              field: 'amount',
              constraint: 'balance >= required amount',
            }),
          );
          return;
        }

        if (msg.includes('tier') || msg.includes('ineligible') || msg.includes('threshold')) {
          res.status(403).json(
            errorEnvelope(403, err.message, requestId, {
              field: 'tier_status',
              constraint: 'eligible tier required',
            }),
          );
          return;
        }

        if (msg.includes('duplicate') || msg.includes('idempotency')) {
          res.status(409).json(
            errorEnvelope(409, err.message, requestId, {
              field: 'idempotencyKey',
              constraint: 'unique per redemption attempt',
            }),
          );
          return;
        }
      }

      next(err);
    }
  }
}