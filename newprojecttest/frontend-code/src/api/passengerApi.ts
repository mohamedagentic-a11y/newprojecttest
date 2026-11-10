import { apiClient, ApiError } from './apiClient';

export interface PassengerProfileEntity {
  passengerId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  documentUrl?: string;
  preferredLanguage?: string;
  tierStatus?: string;
  contactDetails?: Record<string, unknown>;
}

export interface UpdateProfilePayload {
  phone?: string;
  documentUrl?: string;
  [key: string]: unknown;
}

export interface ExportDataResponse {
  status: string;
  exportJobId: string;
}

export async function getProfileApi(): Promise<PassengerProfileEntity> {
  return apiClient.get<PassengerProfileEntity>('/passengers/profile');
}

export async function updateProfileApi(
  payload: UpdateProfilePayload
): Promise<PassengerProfileEntity> {
  return apiClient.put<PassengerProfileEntity>('/passengers/profile', payload);
}

export async function exportDataApi(): Promise<ExportDataResponse> {
  return apiClient.get<ExportDataResponse>('/passengers/export');
}

export { ApiError };