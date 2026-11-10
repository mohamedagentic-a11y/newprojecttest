import { Request, Response } from 'express';
import {
  getMilesBalanceAndTier,
  redeemMiles,
} from '../services/loyaltyService';

function makeRequestId(): string {
  return 'req_' + Math.random().toString(36).substring(2, 11);
}

function makeTimestamp(): string {
  return new Date().toISOString();
}

export async function getLoyaltyBalance(req: Request, res: Response): Promise<void> {
  const requestId = makeRequestId();
  const timestamp = makeTimestamp();

  try {
    const result = await getMilesBalanceAndTier();

    const loyaltyAccountEntity = {
      passengerId: result.passengerId,
      tierStatus: result.tierStatus,
      milesBalance: result.milesBalance,
      pendingMiles: result.pendingMiles,
      asOf: result.asOf,
    };

    res.status(200).json({
      status: 'success',
      data: loyaltyAccountEntity,
      meta: {
        requestId,
        timestamp,
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to retrieve loyalty balance.';

    res.status(500).json({
      status: 'error',
      code: 500,
      message,
      meta: {
        requestId,
        timestamp,
      },
    });
  }
}

export async function redeemLoyaltyMiles(req: Request, res: Response): Promise<void> {
  const requestId = makeRequestId();
  const timestamp = makeTimestamp();

  const { amount, serviceType } = req.body as { amount?: unknown; serviceType?: unknown };

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({
      status: 'error',
      code: 400,
      message: 'Invalid or missing field: amount must be a positive number.',
      details: {
        field: 'amount',
        constraint: 'positive finite number',
      },
      meta: {
        requestId,
        timestamp,
      },
    });
    return;
  }

  if (typeof serviceType !== 'string' || serviceType.trim() === '') {
    res.status(400).json({
      status: 'error',
      code: 400,
      message: 'Invalid or missing field: serviceType must be a non-empty string.',
      details: {
        field: 'serviceType',
        constraint: 'non-empty string',
      },
      meta: {
        requestId,
        timestamp,
      },
    });
    return;
  }

  try {
    const result = await redeemMiles();

    if (result.newBalance === undefined || result.transactionId === undefined) {
      res.status(500).json({
        status: 'error',
        code: 500,
        message: 'Redemption service returned an incomplete result.',
        meta: {
          requestId,
          timestamp,
        },
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        newBalance: result.newBalance,
        transactionId: result.transactionId,
      },
      meta: {
        requestId,
        timestamp,
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Miles redemption failed.';

    const isBusinessError =
      message.toLowerCase().includes('threshold') ||
      message.toLowerCase().includes('insufficient') ||
      message.toLowerCase().includes('tier') ||
      message.toLowerCase().includes('eligible');

    if (isBusinessError) {
      res.status(422).json({
        status: 'error',
        code: 422,
        message,
        details: {
          field: 'amount',
          constraint: 'tier threshold validation',
        },
        meta: {
          requestId,
          timestamp,
        },
      });
    } else {
      res.status(500).json({
        status: 'error',
        code: 500,
        message,
        meta: {
          requestId,
          timestamp,
        },
      });
    }
  }
}