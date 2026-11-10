import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  getLoyaltyBalance,
  redeemMiles,
  LoyaltyAccountEntity,
  LoyaltyTransaction,
  RedeemRequest,
  RedeemResponse,
  ApiError,
} from '../../api/loyaltyApi';

interface LoyaltyState {
  milesBalance: number;
  tierStatus: 'standard' | 'silver' | 'gold' | 'platinum';
  transactionHistory: LoyaltyTransaction[];
  loading: boolean;
  redeemLoading: boolean;
  error: string | null;
  redeemError: string | null;
  lastRedeemedTransactionId: string | null;
}

const initialState: LoyaltyState = {
  milesBalance: 0,
  tierStatus: 'standard',
  transactionHistory: [],
  loading: false,
  redeemLoading: false,
  error: null,
  redeemError: null,
  lastRedeemedTransactionId: null,
};

export const fetchLoyaltyBalance = createAsyncThunk<
  LoyaltyAccountEntity,
  void,
  { rejectValue: string }
>('loyalty/fetchLoyaltyBalance', async (_, { rejectWithValue }) => {
  try {
    const account = await getLoyaltyBalance();
    return account;
  } catch (err) {
    const apiError = err as ApiError;
    return rejectWithValue(apiError.message ?? 'Failed to fetch loyalty balance');
  }
});

export const redeemMilesThunk = createAsyncThunk<
  RedeemResponse,
  RedeemRequest,
  { rejectValue: string }
>('loyalty/redeemMiles', async (request, { rejectWithValue }) => {
  try {
    const response = await redeemMiles(request);
    return response;
  } catch (err) {
    const apiError = err as ApiError;
    return rejectWithValue(apiError.message ?? 'Failed to redeem miles');
  }
});

const loyaltySlice = createSlice({
  name: 'loyalty',
  initialState,
  reducers: {
    clearLoyaltyError(state) {
      state.error = null;
    },
    clearRedeemError(state) {
      state.redeemError = null;
    },
    clearLastRedeemedTransactionId(state) {
      state.lastRedeemedTransactionId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLoyaltyBalance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchLoyaltyBalance.fulfilled,
        (state, action: PayloadAction<LoyaltyAccountEntity>) => {
          state.loading = false;
          state.milesBalance = action.payload.milesBalance;
          state.tierStatus = action.payload.tierStatus;
          state.transactionHistory = action.payload.transactionHistory;
        }
      )
      .addCase(fetchLoyaltyBalance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      })
      .addCase(redeemMilesThunk.pending, (state) => {
        state.redeemLoading = true;
        state.redeemError = null;
        state.lastRedeemedTransactionId = null;
      })
      .addCase(
        redeemMilesThunk.fulfilled,
        (state, action: PayloadAction<RedeemResponse>) => {
          state.redeemLoading = false;
          state.milesBalance = action.payload.newBalance;
          state.lastRedeemedTransactionId = action.payload.transactionId;
        }
      )
      .addCase(redeemMilesThunk.rejected, (state, action) => {
        state.redeemLoading = false;
        state.redeemError = action.payload ?? 'Unknown error';
      });
  },
});

export const {
  clearLoyaltyError,
  clearRedeemError,
  clearLastRedeemedTransactionId,
} = loyaltySlice.actions;

export default loyaltySlice.reducer;

// Exported for the modules that import these by name.
export { loyaltySlice };
