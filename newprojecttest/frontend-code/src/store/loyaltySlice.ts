import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient, ApiError } from '../api/apiClient';

export interface LoyaltyTransaction {
  transactionId: string;
  type: 'earn' | 'redeem';
  amount: number;
  description: string;
  timestamp: string;
}

export interface LoyaltyAccount {
  milesBalance: number;
  tierStatus: 'bronze' | 'silver' | 'gold' | 'platinum';
  transactions: LoyaltyTransaction[];
}

export interface RedemptionResult {
  newBalance: number;
  transactionId: string;
}

export interface LoyaltyState {
  milesBalance: number | null;
  tierStatus: string | null;
  transactions: LoyaltyTransaction[];
  loading: boolean;
  error: string | null;
  redemptionStatus: 'idle' | 'pending' | 'succeeded' | 'failed';
  redemptionError: string | null;
  lastFetched: number | null;
}

const initialState: LoyaltyState = {
  milesBalance: null,
  tierStatus: null,
  transactions: [],
  loading: false,
  error: null,
  redemptionStatus: 'idle',
  redemptionError: null,
  lastFetched: null,
};

export const fetchLoyaltyBalance = createAsyncThunk<
  LoyaltyAccount,
  void,
  { rejectValue: string }
>('loyalty/fetchBalance', async (_, { rejectWithValue }) => {
  try {
    const data = await apiClient.get<LoyaltyAccount>('/loyalty/balance');
    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      return rejectWithValue(err.message);
    }
    return rejectWithValue('Failed to fetch loyalty balance');
  }
});

export interface RedeemMilesPayload {
  amount: number;
  serviceType: 'upgrade' | 'discount';
}

export const redeemMilesThunk = createAsyncThunk<
  RedemptionResult,
  RedeemMilesPayload,
  { rejectValue: string }
>('loyalty/redeemMiles', async (payload, { rejectWithValue, getState }) => {
  const state = getState() as { loyalty: LoyaltyState };
  const currentBalance = state.loyalty.milesBalance;

  if (currentBalance !== null && currentBalance < payload.amount) {
    return rejectWithValue('Insufficient miles balance for this redemption');
  }

  try {
    const data = await apiClient.post<RedemptionResult>('/loyalty/redeem', {
      amount: payload.amount,
      serviceType: payload.serviceType,
    });
    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      return rejectWithValue(err.message);
    }
    return rejectWithValue('Miles redemption failed');
  }
});

export const loyaltySlice = createSlice({
  name: 'loyalty',
  initialState,
  reducers: {
    clearRedemptionStatus(state) {
      state.redemptionStatus = 'idle';
      state.redemptionError = null;
    },
    invalidateCache(state) {
      state.lastFetched = null;
    },
    resetLoyalty() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLoyaltyBalance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLoyaltyBalance.fulfilled, (state, action: PayloadAction<LoyaltyAccount>) => {
        state.loading = false;
        state.milesBalance = action.payload.milesBalance;
        state.tierStatus = action.payload.tierStatus;
        state.transactions = action.payload.transactions ?? [];
        state.lastFetched = Date.now();
        state.error = null;
      })
      .addCase(fetchLoyaltyBalance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error fetching loyalty balance';
      })
      .addCase(redeemMilesThunk.pending, (state) => {
        state.redemptionStatus = 'pending';
        state.redemptionError = null;
      })
      .addCase(redeemMilesThunk.fulfilled, (state, action: PayloadAction<RedemptionResult>) => {
        state.redemptionStatus = 'succeeded';
        state.milesBalance = action.payload.newBalance;
        state.lastFetched = null;
        const redemptionTransaction: LoyaltyTransaction = {
          transactionId: action.payload.transactionId,
          type: 'redeem',
          amount: 0,
          description: 'Miles redeemed',
          timestamp: new Date().toISOString(),
        };
        state.transactions = [redemptionTransaction, ...state.transactions];
      })
      .addCase(redeemMilesThunk.rejected, (state, action) => {
        state.redemptionStatus = 'failed';
        state.redemptionError = action.payload ?? 'Unknown error during redemption';
      });
  },
});

export const { clearRedemptionStatus, invalidateCache, resetLoyalty } = loyaltySlice.actions;

export default loyaltySlice.reducer;