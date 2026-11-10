import { apiClient, ApiError } from './apiClient';

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  cabinClass?: string;
  cursor?: string;
  limit?: number;
}

export interface FlightEntity {
  id: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  cabinClass: string;
  price: number;
  currency: string;
  availableSeats: number;
  carrier: string;
  flightNumber: string;
  duration: number;
  stops: number;
}

export interface FlightSearchMeta {
  syncedFrom: string;
  cachedTTL: number;
  pagination?: {
    nextCursor: string;
    hasMore: boolean;
    limit: number;
  };
}

export interface FlightSearchResult {
  flights: FlightEntity[];
  meta: FlightSearchMeta;
}

export async function searchFlightsApi(
  params: FlightSearchParams
): Promise<FlightSearchResult> {
  const queryParams = new URLSearchParams();

  queryParams.set('origin', params.origin);
  queryParams.set('destination', params.destination);
  queryParams.set('departureDate', params.departureDate);

  if (params.cabinClass) {
    queryParams.set('cabinClass', params.cabinClass);
  }
  if (params.cursor) {
    queryParams.set('cursor', params.cursor);
  }
  if (params.limit !== undefined) {
    queryParams.set('limit', String(params.limit));
  }

  const result = await apiClient.get<{ data: FlightEntity[]; meta: FlightSearchMeta }>(
    `/flights/search?${queryParams.toString()}`
  );

  return {
    flights: result.data,
    meta: result.meta,
  };
}

export async function getFlightByIdApi(id: string): Promise<FlightEntity> {
  const result = await apiClient.get<FlightEntity>(`/flights/${id}`);
  return result;
}

export { ApiError };