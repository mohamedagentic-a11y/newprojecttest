import apiClient, { ApiError } from './apiClient';

export type IncidentType = 'delayed' | 'damaged' | 'lost' | 'pilfered' | 'other';

export interface BaggageClaimRequest {
  pnr: string;
  incidentType: IncidentType;
  description: string;
  files: string[];
}

export interface BaggageClaimTimelineEvent {
  timestamp: string;
  status: string;
  note?: string;
}

export interface BaggageClaimEntity {
  id: string;
  pnr: string;
  incidentType: IncidentType;
  description: string;
  files: string[];
  trackingId: string;
  status: string;
  timeline: BaggageClaimTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export async function submitBaggageClaim(
  request: BaggageClaimRequest
): Promise<BaggageClaimEntity> {
  return post<BaggageClaimEntity>('/baggage/claims', request);
}

export async function getBaggageClaim(id: string): Promise<BaggageClaimEntity> {
  return get<BaggageClaimEntity>(`/baggage/claims/${id}`);
}

// Re-export for direct use — destructured from the default export of apiClient
// The apiClient default export exposes get, post, etc. as methods on the instance.
// We call them via the imported client.

function get<T>(path: string): Promise<T> {
  return (apiClient as unknown as { get: (path: string) => Promise<T> }).get(path);
}

function post<T>(path: string, body: unknown): Promise<T> {
  return (apiClient as unknown as { post: (path: string, body: unknown) => Promise<T> }).post(
    path,
    body
  );
}

export { ApiError };