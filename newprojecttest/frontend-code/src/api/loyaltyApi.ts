import { apiClient, ApiError } from './apiClient';

export interface LoyaltyBalance {
  milesBalance: number;
  tierStatus: string;
  transactionHistorySummary?: {
    totalEarned: number;
    totalRedeemed: number;
    lastTransaction?: string;
  };
}

export interface RedeemMilesRequest {
  amount: number;
  serviceType: 'upgrade' | 'discount';
  idempotencyKey?: string;
}

export interface RedeemMilesResponse {
  newBalance: number;
  transactionId: string;
}

export async function getLoyaltyBalanceApi(): Promise<LoyaltyBalance> {
  return apiClient.get<LoyaltyBalance>('/loyalty/balance');
}

export async function redeemMilesApi(
  payload: RedeemMilesRequest
): Promise<RedeemMilesResponse> {
  return apiClient.post<RedeemMilesResponse>('/loyalty/redeem', payload);
}

export { ApiError };