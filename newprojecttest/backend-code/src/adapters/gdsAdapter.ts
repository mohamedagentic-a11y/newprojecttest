import axios, { AxiosInstance, AxiosError } from 'axios';

const GDS_API_URL = process.env.GDS_API_URL;
const GDS_API_KEY = process.env.GDS_API_KEY;

if (!GDS_API_URL) {
  throw new Error('GDS_API_URL environment variable is required but not set.');
}
if (!GDS_API_KEY) {
  throw new Error('GDS_API_KEY environment variable is required but not set.');
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  cabinClass: string;
  cursor?: string;
  limit?: number;
}

export interface FlightEntity {
  flightId: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  cabinClass: string;
  availableSeats: number;
  fare: {
    amount: number;
    currency: string;
    fareClass: string;
  };
  duration: number;
  stops: number;
  aircraft: string;
}

export interface GDSSearchResponse {
  flights: FlightEntity[];
  pagination?: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
  syncedFrom: 'GDS' | 'CACHE';
  cachedTTL: number;
  cachedAt?: number;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry {
  data: GDSSearchResponse;
  storedAt: number;
}

const cache = new Map<string, CacheEntry>();

function buildCacheKey(params: FlightSearchParams): string {
  return [
    params.origin,
    params.destination,
    params.departureDate,
    params.cabinClass,
    params.cursor ?? '',
    params.limit ?? 20,
  ].join('|');
}

function getCached(key: string): GDSSearchResponse | null {
  const entry = cache.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.storedAt;
  if (age > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return {
    ...entry.data,
    syncedFrom: 'CACHE',
    cachedTTL: Math.round((CACHE_TTL_MS - age) / 1000),
    cachedAt: entry.storedAt,
  };
}

function setCache(key: string, data: GDSSearchResponse): void {
  cache.set(key, { data, storedAt: Date.now() });
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

const FAILURE_THRESHOLD = 5;
const RECOVERY_TIMEOUT_MS = 60 * 1000; // 60 seconds before attempting half-open

interface CircuitBreaker {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number | null;
  successCount: number;
}

const circuit: CircuitBreaker = {
  state: 'CLOSED',
  failureCount: 0,
  lastFailureTime: null,
  successCount: 0,
};

function recordSuccess(): void {
  circuit.failureCount = 0;
  circuit.successCount += 1;
  if (circuit.state === 'HALF_OPEN') {
    circuit.state = 'CLOSED';
    console.info('[GDSAdapter] Circuit breaker transitioned to CLOSED after recovery.');
  }
}

function recordFailure(): void {
  circuit.failureCount += 1;
  circuit.lastFailureTime = Date.now();
  circuit.successCount = 0;

  if (circuit.state === 'HALF_OPEN') {
    circuit.state = 'OPEN';
    console.warn('[GDSAdapter] Circuit breaker transitioned back to OPEN after half-open failure.');
    return;
  }

  if (circuit.failureCount >= FAILURE_THRESHOLD && circuit.state === 'CLOSED') {
    circuit.state = 'OPEN';
    console.warn(
      `[GDSAdapter] Circuit breaker OPENED after ${circuit.failureCount} consecutive failures.`
    );
  }
}

function isCircuitOpen(): boolean {
  if (circuit.state === 'OPEN') {
    const timeSinceLastFailure = circuit.lastFailureTime
      ? Date.now() - circuit.lastFailureTime
      : Infinity;

    if (timeSinceLastFailure >= RECOVERY_TIMEOUT_MS) {
      circuit.state = 'HALF_OPEN';
      console.info('[GDSAdapter] Circuit breaker transitioned to HALF_OPEN — allowing probe request.');
      return false;
    }
    return true;
  }
  return false;
}

// ─── Axios Instance ───────────────────────────────────────────────────────────

const gdsClient: AxiosInstance = axios.create({
  baseURL: GDS_API_URL,
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${GDS_API_KEY}`,
  },
});

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * Searches for real-time flight inventory and fare data via GDS.
 * Falls back to cached data on consecutive failures (circuit breaker).
 */
export async function searchFlights(params: FlightSearchParams): Promise<GDSSearchResponse> {
  const cacheKey = buildCacheKey(params);

  // If circuit is open, return cached data or throw
  if (isCircuitOpen()) {
    console.warn('[GDSAdapter] Circuit is OPEN — serving from cache if available.');
    const cached = getCached(cacheKey);
    if (cached) {
      return cached;
    }
    throw new Error(
      'GDS service is temporarily unavailable and no cached data exists for this query. Please try again later.'
    );
  }

  try {
    const response = await gdsClient.get<{
      flights: FlightEntity[];
      pagination?: {
        nextCursor: string | null;
        hasMore: boolean;
        limit: number;
      };
    }>('/inventory/search', {
      params: {
        origin: params.origin,
        destination: params.destination,
        departureDate: params.departureDate,
        cabinClass: params.cabinClass,
        cursor: params.cursor,
        limit: params.limit ?? 20,
      },
    });

    const result: GDSSearchResponse = {
      flights: response.data.flights,
      pagination: response.data.pagination,
      syncedFrom: 'GDS',
      cachedTTL: 900,
    };

    recordSuccess();
    setCache(cacheKey, result);

    return result;
  } catch (err) {
    recordFailure();

    const axiosError = err as AxiosError;
    console.error(
      '[GDSAdapter] GDS request failed:',
      axiosError.response?.status,
      axiosError.message
    );

    // Attempt cache fallback after failure
    const cached = getCached(cacheKey);
    if (cached) {
      console.warn('[GDSAdapter] Returning stale cache after GDS failure.');
      return cached;
    }

    throw new Error(
      `GDS request failed: ${axiosError.message}. No cached fallback available.`
    );
  }
}

/**
 * Fetches fare details for a specific flight from the GDS.
 * Uses circuit-breaker and cache with same TTL logic.
 */
export async function getFlightFare(
  flightId: string,
  cabinClass: string
): Promise<FlightEntity['fare']> {
  const cacheKey = `fare|${flightId}|${cabinClass}`;

  if (isCircuitOpen()) {
    console.warn('[GDSAdapter] Circuit is OPEN — cannot retrieve fare from GDS.');
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.storedAt <= CACHE_TTL_MS) {
      return (cached.data as unknown as { fare: FlightEntity['fare'] }).fare;
    }
    throw new Error('GDS service is temporarily unavailable. No cached fare data for this flight.');
  }

  try {
    const response = await gdsClient.get<{ fare: FlightEntity['fare'] }>(
      `/inventory/fares/${flightId}`,
      { params: { cabinClass } }
    );

    recordSuccess();
    cache.set(cacheKey, {
      data: response.data as unknown as GDSSearchResponse,
      storedAt: Date.now(),
    });

    return response.data.fare;
  } catch (err) {
    recordFailure();

    const axiosError = err as AxiosError;
    console.error(
      '[GDSAdapter] GDS fare request failed:',
      axiosError.response?.status,
      axiosError.message
    );

    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.storedAt <= CACHE_TTL_MS) {
      console.warn('[GDSAdapter] Returning cached fare after GDS failure.');
      return (cached.data as unknown as { fare: FlightEntity['fare'] }).fare;
    }

    throw new Error(
      `GDS fare request failed: ${axiosError.message}. No cached fallback available.`
    );
  }
}

/**
 * Returns the current state of the circuit breaker (for health checks/monitoring).
 */
export function getCircuitBreakerStatus(): {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number | null;
} {
  return {
    state: circuit.state,
    failureCount: circuit.failureCount,
    lastFailureTime: circuit.lastFailureTime,
  };
}

/**
 * Clears the in-memory cache (useful for testing or admin-triggered invalidation).
 */
export function clearCache(): void {
  cache.clear();
  console.info('[GDSAdapter] Cache cleared.');
}