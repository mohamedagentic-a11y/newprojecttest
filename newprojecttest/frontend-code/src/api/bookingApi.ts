import apiClient, { ApiError } from './apiClient';

export interface CreateBookingRequest {
  flightId: string;
  seatPreference: 'window' | 'aisle' | 'middle';
  paymentMethod: 'miles' | 'card';
}

export interface RebookRequest {
  newFlightId: string;
  paymentMethod: 'miles' | 'card';
}

export interface BookingEntity {
  id: string;
  flightId: string;
  passengerId: string;
  seatPreference: string;
  paymentMethod: string;
  status: string;
  pnr: string;
  createdAt: string;
  updatedAt: string;
  flight?: {
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    flightNumber: string;
    cabinClass: string;
  };
  passenger?: {
    name: string;
    email: string;
  };
  fareDifference?: number;
  transactionId?: string;
}

export interface CheckInResponse {
  eligible: boolean;
  boardingPassUrl: string;
}

export type UpdatedBookingEntity = BookingEntity;

export { ApiError };

export async function createBooking(request: CreateBookingRequest): Promise<BookingEntity> {
  return post<BookingEntity>('/bookings', request);
}

export async function rebookFlight(id: string, request: RebookRequest): Promise<UpdatedBookingEntity> {
  return put<UpdatedBookingEntity>(`/bookings/${id}/rebook`, request);
}

export async function checkIn(id: string): Promise<CheckInResponse> {
  return get<CheckInResponse>(`/bookings/${id}/checkin`);
}

export async function getBoardingPass(id: string): Promise<Blob> {
  const response = await fetch(`/api/bookings/${id}/boarding-pass`, {
    method: 'GET',
    headers: {
      Accept: 'application/pdf',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(response.status, errorBody);
  }

  return response.blob();
}

function get<T>(path: string): Promise<T> {
  return (apiClient as unknown as { get: <U>(path: string) => Promise<U> }).get<T>(path);
}

function post<T>(path: string, body: unknown): Promise<T> {
  return (apiClient as unknown as { post: <U>(path: string, body: unknown) => Promise<U> }).post<T>(path, body);
}

function put<T>(path: string, body: unknown): Promise<T> {
  return (apiClient as unknown as { put: <U>(path: string, body: unknown) => Promise<U> }).put<T>(path, body);
}