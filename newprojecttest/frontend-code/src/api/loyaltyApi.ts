import apiClient, { ApiError } from './apiClient';

export interface LoyaltyTransaction {
  transactionId: string;
  date: string;
  description: string;
  miles: number;
  type: 'credit' | 'debit';
}

export interface LoyaltyAccountEntity {
  passengerId: string;
  milesBalance: number;
  tierStatus: 'standard' | 'silver' | 'gold' | 'platinum';
  transactionHistory: LoyaltyTransaction[];
}

export interface RedeemRequest {
  amount: number;
  serviceType: 'upgrade' | 'booking' | 'ancillary' | string;
}

export interface RedeemResponse {
  newBalance: number;
  transactionId: string;
}

export const getLoyaltyBalance = async (): Promise<LoyaltyAccountEntity> => {
  return apiClient.get<LoyaltyAccountEntity>('/loyalty/balance');
};

export const redeemMiles = async (payload: RedeemRequest): Promise<RedeemResponse> => {
  return apiClient.post<RedeemResponse>('/loyalty/redeem', payload);
};

export { ApiError };