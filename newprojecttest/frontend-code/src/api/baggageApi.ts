import { apiClient, ApiError } from './apiClient';

export interface BaggageClaimSubmitPayload {
  pnr: string;
  incidentType: 'delayed' | 'damaged' | 'lost' | 'other';
  description: string;
  files: string[];
}

export interface BaggageClaimEntity {
  id: string;
  pnr: string;
  incidentType: string;
  description: string;
  files: string[];
  status: string;
  trackingNumber: string;
  createdAt: string;
  updatedAt: string;
  timeline?: Array<{
    status: string;
    message: string;
    timestamp: string;
  }>;
}

export async function submitClaimApi(
  payload: BaggageClaimSubmitPayload
): Promise<BaggageClaimEntity> {
  try {
    const result = await apiClient.post<BaggageClaimEntity>(
      '/baggage/claims',
      payload
    );
    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      'Failed to submit baggage claim',
      0,
      undefined
    );
  }
}

export async function getClaimApi(id: string): Promise<BaggageClaimEntity> {
  try {
    const result = await apiClient.get<BaggageClaimEntity>(
      `/baggage/claims/${id}`
    );
    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      'Failed to retrieve baggage claim',
      0,
      undefined
    );
  }
}