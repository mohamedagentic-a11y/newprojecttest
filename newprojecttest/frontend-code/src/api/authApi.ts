import apiClient from './apiClient';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tierStatus: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>('/auth/login', { email, password });
}

export async function refreshToken(): Promise<RefreshTokenResponse> {
  return apiClient.post<RefreshTokenResponse>('/auth/refresh', {});
}