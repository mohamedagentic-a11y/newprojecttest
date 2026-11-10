import apiClient, { ApiError } from './apiClient';

export interface PassengerProfileEntity {
  passengerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  documentUrl: string;
  preferredLanguage: string;
  tierStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequest {
  phone?: string;
  documentUrl?: string;
}

export interface ExportJobResponse {
  status: string;
  exportJobId: string;
}

export const passengerApi = {
  getProfile: (): Promise<PassengerProfileEntity> => {
    return apiClient.get<PassengerProfileEntity>('/passengers/profile');
  },

  updateProfile: (data: UpdateProfileRequest): Promise<PassengerProfileEntity> => {
    return apiClient.put<PassengerProfileEntity>('/passengers/profile', data);
  },

  exportData: (): Promise<ExportJobResponse> => {
    return apiClient.get<ExportJobResponse>('/passengers/export');
  },
};

export { ApiError };

export default passengerApi;