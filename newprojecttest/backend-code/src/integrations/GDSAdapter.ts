import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

if (!process.env.GDS_BASE_URL) {
  throw new Error('GDS_BASE_URL environment variable is required');
}
if (!process.env.GDS_CLIENT_ID) {
  throw new Error('GDS_CLIENT_ID environment variable is required');
}
if (!process.env.GDS_CLIENT_SECRET) {
  throw new Error('GDS_CLIENT_SECRET environment variable is required');
}

const GDS_BASE_URL: string = process.env.GDS_BASE_URL;
const GDS_CLIENT_ID: string = process.env.GDS_CLIENT_ID;
const GDS_CLIENT_SECRET: string = process.env.GDS_CLIENT_SECRET;
const GDS_TOKEN_URL: string = process.env.GDS_TOKEN_URL || (() => { throw new Error('GDS_TOKEN_URL environment variable is required'); })();
const GDS_API_KEY: string | undefined = process.env.GDS_API_KEY;

const MAX_RETRIES = 4;
const INITIAL_BACKOFF_MS = 500;

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  cabinClass: string;
  cursor?: string;
  limit?: number;
}

export interface FlightSearchResult {
  data: FlightOffer[];
  pagination: {
    nextCursor?: string;
    hasMore: boolean;
    limit: number;
  };
  meta: {
    syncedFrom: string;
    cachedTTL: number;
  };
}

export interface FlightOffer {
  flightId: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  cabinClass: string;
  price: {
    amount: number;
    currency: string;
  };
  availableSeats: number;
  carrier: string;
  flightNumber: string;
  [key: string]: unknown;
}

export interface SeatMapParams {
  flightId: string;
  cabinClass?: string;
}

export interface SeatMap {
  flightId: string;
  cabins: SeatCabin[];
  [key: string]: unknown;
}

export interface SeatCabin {
  cabinClass: string;
  rows: SeatRow[];
}

export interface SeatRow {
  rowNumber: number;
  seats: Seat[];
}

export interface Seat {
  seatNumber: string;
  available: boolean;
  type: string;
  [key: string]: unknown;
}

export interface BookingConfirmationParams {
  flightId: string;
  passengerDetails: PassengerDetails;
  seatPreference?: string;
  paymentMethod: string;
  loyaltyNumber?: string;
  [key: string]: unknown;
}

export interface PassengerDetails {
  passengerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  documentNumber?: string;
  [key: string]: unknown;
}

export interface BookingConfirmationResult {
  pnr: string;
  bookingReference: string;
  status: string;
  flightId: string;
  seatAssigned?: string;
  ticketNumber?: string;
  [key: string]: unknown;
}

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (!status) {
      // Network error — retry
      return true;
    }
    return status === 429 || status === 503 || status === 502 || status === 504;
  }
  return false;
}

async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialBackoffMs: number = INITIAL_BACKOFF_MS
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries || !isRetryableError(error)) {
        throw error;
      }
      const jitter = Math.random() * 200;
      const backoff = initialBackoffMs * Math.pow(2, attempt - 1) + jitter;
      console.warn(
        `GDSAdapter: attempt ${attempt} failed, retrying in ${Math.round(backoff)}ms...`,
        axios.isAxiosError(error) ? error.message : error
      );
      await sleep(backoff);
    }
  }
}

export class GDSAdapter {
  private readonly httpClient: AxiosInstance;
  private tokenCache: TokenCache | null = null;

  constructor() {
    this.httpClient = axios.create({
      baseURL: GDS_BASE_URL,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(GDS_API_KEY ? { 'X-API-Key': GDS_API_KEY } : {}),
      },
    });
  }

  private async fetchOAuthToken(): Promise<string> {
    const response = await axios.post<OAuthTokenResponse>(
      GDS_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: GDS_CLIENT_ID,
        client_secret: GDS_CLIENT_SECRET,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15_000,
      }
    );

    const { access_token, expires_in } = response.data;
    // Buffer by 60 seconds to avoid using a nearly-expired token
    const expiresAt = Date.now() + (expires_in - 60) * 1000;
    this.tokenCache = { accessToken: access_token, expiresAt };
    return access_token;
  }

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.accessToken;
    }
    return withExponentialBackoff(() => this.fetchOAuthToken(), 3, 300);
  }

  private async buildAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return { Authorization: `Bearer ${token}` };
  }

  private async authenticatedGet<T>(
    path: string,
    params?: Record<string, unknown>,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    const authHeaders = await this.buildAuthHeaders();
    return this.httpClient.get<T>(path, {
      ...config,
      params,
      headers: {
        ...config?.headers,
        ...authHeaders,
      },
    });
  }

  private async authenticatedPost<T>(
    path: string,
    data: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    const authHeaders = await this.buildAuthHeaders();
    return this.httpClient.post<T>(path, data, {
      ...config,
      headers: {
        ...config?.headers,
        ...authHeaders,
      },
    });
  }

  /**
   * Search for available flights via GDS. Retries with exponential backoff on transient failures.
   */
  async searchFlights(params: FlightSearchParams): Promise<FlightSearchResult> {
    return withExponentialBackoff(async () => {
      const response = await this.authenticatedGet<FlightSearchResult>(
        '/flights/search',
        {
          origin: params.origin,
          destination: params.destination,
          departureDate: params.departureDate,
          cabinClass: params.cabinClass,
          ...(params.cursor ? { cursor: params.cursor } : {}),
          limit: params.limit ?? 20,
        }
      );
      return response.data;
    });
  }

  /**
   * Retrieve seat map for a specific flight. Retries with exponential backoff on transient failures.
   */
  async getSeatMap(params: SeatMapParams): Promise<SeatMap> {
    return withExponentialBackoff(async () => {
      const queryParams: Record<string, unknown> = {};
      if (params.cabinClass) {
        queryParams.cabinClass = params.cabinClass;
      }
      const response = await this.authenticatedGet<SeatMap>(
        `/flights/${encodeURIComponent(params.flightId)}/seatmap`,
        Object.keys(queryParams).length > 0 ? queryParams : undefined
      );
      return response.data;
    });
  }

  /**
   * Dispatch booking confirmation to GDS. Retries with exponential backoff on transient failures.
   */
  async confirmBooking(
    params: BookingConfirmationParams
  ): Promise<BookingConfirmationResult> {
    return withExponentialBackoff(async () => {
      const response = await this.authenticatedPost<BookingConfirmationResult>(
        '/bookings/confirm',
        params
      );
      return response.data;
    });
  }

  /**
   * Cancel an existing booking in the GDS. Retries with exponential backoff on transient failures.
   */
  async cancelBooking(pnr: string): Promise<{ status: string; pnr: string }> {
    return withExponentialBackoff(async () => {
      const response = await this.authenticatedPost<{ status: string; pnr: string }>(
        `/bookings/${encodeURIComponent(pnr)}/cancel`,
        {}
      );
      return response.data;
    });
  }

  /**
   * Rebook (modify) an existing booking in the GDS. Retries with exponential backoff on transient failures.
   */
  async rebookFlight(
    pnr: string,
    newFlightId: string,
    paymentMethod: string
  ): Promise<BookingConfirmationResult> {
    return withExponentialBackoff(async () => {
      const response = await this.authenticatedPost<BookingConfirmationResult>(
        `/bookings/${encodeURIComponent(pnr)}/rebook`,
        { newFlightId, paymentMethod }
      );
      return response.data;
    });
  }
}