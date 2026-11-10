import { FlightRepository, Flight, SearchFlightsParams, SearchFlightsResult, UpsertFlightPayload } from '../repositories/FlightRepository';
import { GDSAdapter, FlightSearchParams, FlightSearchResult, FlightOffer } from '../integrations/GDSAdapter';

interface SearchOptions {
  origin: string;
  destination: string;
  departureDate: string;
  cabinClass?: string;
  cursor?: string;
  limit?: number;
}

interface SearchFlightsServiceResult {
  data: Flight[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
  meta: {
    syncedFrom: string;
    cachedTTL: number;
  };
}

interface RateLimitBucket {
  count: number;
  windowStart: number;
}

export class FlightService {
  private flightRepository: FlightRepository;
  private gdsAdapter: GDSAdapter;

  // 30 req/min guard: keyed by a caller-supplied key (e.g. passenger_id or IP)
  private rateLimitBuckets: Map<string, RateLimitBucket> = new Map();
  private readonly RATE_LIMIT_MAX = 30;
  private readonly RATE_LIMIT_WINDOW_MS = 60_000;

  constructor(flightRepository: FlightRepository, gdsAdapter: GDSAdapter) {
    this.flightRepository = flightRepository;
    this.gdsAdapter = gdsAdapter;
  }

  /**
   * Checks the internal 30-req/min guard.
   * Returns true if the caller is within the allowed rate, false if exceeded.
   */
  private checkRateLimit(callerKey: string): boolean {
    const now = Date.now();
    const bucket = this.rateLimitBuckets.get(callerKey);

    if (!bucket || now - bucket.windowStart >= this.RATE_LIMIT_WINDOW_MS) {
      this.rateLimitBuckets.set(callerKey, { count: 1, windowStart: now });
      return true;
    }

    if (bucket.count >= this.RATE_LIMIT_MAX) {
      return false;
    }

    bucket.count += 1;
    return true;
  }

  /**
   * Returns how many milliseconds remain in the current rate-limit window for the caller.
   */
  getRateLimitResetMs(callerKey: string): number {
    const bucket = this.rateLimitBuckets.get(callerKey);
    if (!bucket) return 0;
    const elapsed = Date.now() - bucket.windowStart;
    return Math.max(0, this.RATE_LIMIT_WINDOW_MS - elapsed);
  }

  /**
   * Primary flight search:
   * 1. Enforces 30-req/min guard.
   * 2. Calls GDS for real-time inventory.
   * 3. Upserts GDS results into the DB for caching.
   * 4. Falls back to cached DB results on GDS failure.
   */
  async searchFlights(
    options: SearchOptions,
    callerKey: string
  ): Promise<SearchFlightsServiceResult> {
    // Enforce internal rate limit
    if (!this.checkRateLimit(callerKey)) {
      const retryAfterMs = this.getRateLimitResetMs(callerKey);
      const err: any = new Error('Flight search rate limit exceeded (30 req/min)');
      err.statusCode = 429;
      err.retryAfterMs = retryAfterMs;
      throw err;
    }

    const cabinClass = options.cabinClass ?? 'economy';

    let gdsResult: FlightSearchResult | null = null;
    let usedGDS = false;

    // Attempt GDS call
    try {
      const gdsParams: FlightSearchParams = {
        origin: options.origin,
        destination: options.destination,
        departureDate: options.departureDate,
        cabinClass,
        cursor: options.cursor,
        limit: options.limit,
      };
      gdsResult = await this.gdsAdapter.searchFlights(gdsParams);
      usedGDS = true;
    } catch (gdsError) {
      // GDS unavailable — fall through to cached results
      gdsResult = null;
    }

    if (usedGDS && gdsResult) {
      // Persist GDS results asynchronously (non-blocking) and collect upserted flights
      const upsertedFlights: Flight[] = [];

      await Promise.all(
        gdsResult.data.map(async (offer: FlightOffer) => {
          try {
            const payload: UpsertFlightPayload = {
              flight_number: offer.flightNumber,
              origin: offer.origin,
              destination: offer.destination,
              departure_time: new Date(offer.departureTime),
              arrival_time: new Date(offer.arrivalTime),
              cabin_class: offer.cabinClass,
              fare_amount: offer.amount,
              currency: offer.currency,
              available_seats: offer.availableSeats,
              airline_code: offer.carrier,
              gds_source: gdsResult!.syncedFrom,
              gds_synced_at: new Date(),
            };
            const flight = await this.flightRepository.upsertFromGDS(payload);
            upsertedFlights.push(flight);
          } catch {
            // Individual upsert failure should not abort the response
          }
        })
      );

      return {
        data: upsertedFlights,
        pagination: {
          nextCursor: gdsResult.nextCursor ?? null,
          hasMore: gdsResult.hasMore,
          limit: gdsResult.limit,
        },
        meta: {
          syncedFrom: gdsResult.syncedFrom,
          cachedTTL: gdsResult.cachedTTL,
        },
      };
    }

    // Fallback: cached DB results
    const dbParams: SearchFlightsParams = {
      origin: options.origin,
      destination: options.destination,
      departureDate: options.departureDate,
      cabinClass: options.cabinClass,
      cursor: options.cursor,
      limit: options.limit,
    };

    const cached: SearchFlightsResult = await this.flightRepository.searchFlights(dbParams);

    return {
      data: cached.data,
      pagination: {
        nextCursor: cached.nextCursor,
        hasMore: cached.hasMore,
        limit: cached.limit,
      },
      meta: {
        syncedFrom: 'cache',
        cachedTTL: 0,
      },
    };
  }

  /**
   * Retrieves a single flight by ID from the repository.
   */
  async getFlightById(id: string): Promise<Flight | null> {
    return this.flightRepository.findById(id);
  }
}