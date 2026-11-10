import apiClient from './apiClient';

export type CabinClass = 'economy' | 'business' | 'first';

export interface FlightEntity {
  id: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  arrivalDate: string;
  airline: string;
  flightNumber: string;
  cabinClass: CabinClass;
  price: number;
  currency: string;
  seatsAvailable: number;
  duration: string;
  stops: number;
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  cabinClass: CabinClass;
  cursor?: string;
  limit?: number;
}

export interface PaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export interface FlightSearchMeta {
  syncedFrom: string;
  cachedTTL: number;
  pagination: PaginationMeta;
}

export interface FlightSearchResult {
  flights: FlightEntity[];
  meta: FlightSearchMeta;
}

export async function searchFlights(
  params: FlightSearchParams
): Promise<FlightSearchResult> {
  const query = new URLSearchParams();

  query.set('origin', params.origin);
  query.set('destination', params.destination);
  query.set('departureDate', params.departureDate);
  query.set('cabinClass', params.cabinClass);

  if (params.cursor !== undefined && params.cursor !== '') {
    query.set('cursor', params.cursor);
  }

  if (params.limit !== undefined) {
    query.set('limit', String(params.limit));
  }

  const response = await apiClient.get<{ data: FlightEntity[]; meta: FlightSearchMeta }>(
    `/flights/search?${query.toString()}`
  );

  return {
    flights: response.data,
    meta: response.meta,
  };
}