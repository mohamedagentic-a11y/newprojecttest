import { apiClient, ApiError } from './apiClient';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tierStatus: string;
}

export interface RefreshResponse {
  accessToken: string;
}

export async function loginApi(credentials: LoginRequest): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>('/auth/login', credentials);
}

export async function refreshTokenApi(): Promise<RefreshResponse> {
  return apiClient.post<RefreshResponse>('/auth/refresh', {});
}

export { ApiError };