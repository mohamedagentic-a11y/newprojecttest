import { apiClient, ApiError } from './apiClient';

export interface CreateBookingPayload {
  flightId: string;
  seatPreference?: 'window' | 'aisle' | 'middle';
  paymentMethod: 'miles' | 'card';
}

export interface RebookFlightPayload {
  newFlightId: string;
  paymentMethod: 'miles' | 'card';
}

export interface BookingEntity {
  id: string;
  flightId: string;
  passengerId: string;
  seatPreference?: string;
  paymentMethod: string;
  status: string;
  pnr?: string;
  createdAt: string;
  updatedAt?: string;
  flight?: {
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    cabinClass: string;
  };
  passenger?: {
    name: string;
    email: string;
  };
}

export interface CheckInResponse {
  eligible: boolean;
  boardingPassUrl?: string;
}

export interface BoardingPassBlob {
  blob: Blob;
  filename: string;
}

export async function createBookingApi(payload: CreateBookingPayload): Promise<BookingEntity> {
  const data = await apiClient.post<BookingEntity>('/bookings', payload);
  return data;
}

export async function rebookFlightApi(id: string, payload: RebookFlightPayload): Promise<BookingEntity> {
  const data = await apiClient.put<BookingEntity>(`/bookings/${id}/rebook`, payload);
  return data;
}

export async function getBookingApi(id: string): Promise<BookingEntity> {
  const data = await apiClient.get<BookingEntity>(`/bookings/${id}`);
  return data;
}

export async function checkInApi(id: string): Promise<CheckInResponse> {
  const data = await apiClient.get<CheckInResponse>(`/bookings/${id}/checkin`);
  return data;
}

export async function getBoardingPassApi(id: string): Promise<BoardingPassBlob> {
  const response = await apiClient.get<Blob>(`/bookings/${id}/boarding-pass`, {
    responseType: 'blob',
  } as any);
  return {
    blob: response as unknown as Blob,
    filename: `boarding-pass-${id}.pdf`,
  };
}

export { ApiError };