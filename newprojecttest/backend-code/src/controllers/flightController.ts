import { Request, Response } from 'express';
import { searchAvailableFlights, FlightServiceSearchParams, PaginatedFlightResult } from '../services/flightService';
import { v4 as uuidv4 } from 'uuid';

export async function searchFlights(req: Request, res: Response): Promise<void> {
  const { origin, destination, departureDate, cabinClass, cursor, limit } = req.query;

  if (!origin || !destination || !departureDate || !cabinClass) {
    res.status(400).json({
      status: 'error',
      code: 400,
      message: 'Missing required query parameters: origin, destination, departureDate, cabinClass',
      meta: {
        requestId: uuidv4(),
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const params: FlightServiceSearchParams = {
    origin: origin as string,
    destination: destination as string,
    departureDate: departureDate as string,
    cabinClass: cabinClass as string,
    cursor: cursor as string | undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
  };

  try {
    const result: PaginatedFlightResult = await searchAvailableFlights(params);

    res.status(200).json({
      status: 'success',
      data: result.flights,
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        limit: result.limit,
      },
      meta: {
        requestId: uuidv4(),
        timestamp: new Date().toISOString(),
        syncedFrom: result.syncedFrom,
        cachedTTL: result.cachedTTL,
        ...(result.cachedAt !== undefined ? { cachedAt: result.cachedAt } : {}),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    res.status(500).json({
      status: 'error',
      code: 500,
      message,
      meta: {
        requestId: uuidv4(),
        timestamp: new Date().toISOString(),
      },
    });
  }
}