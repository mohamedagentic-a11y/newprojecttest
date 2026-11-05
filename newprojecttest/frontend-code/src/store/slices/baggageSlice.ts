import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  BaggageClaimRequest,
  BaggageClaimEntity,
  ApiError,
  submitBaggageClaim,
  getBaggageClaim,
} from '../../api/baggageApi';

export interface BaggageState {
  claims: BaggageClaimEntity[];
  activeClaimDetail: BaggageClaimEntity | null;
  submissionStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  fetchStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  submissionError: string | null;
  fetchError: string | null;
}

const initialState: BaggageState = {
  claims: [],
  activeClaimDetail: null,
  submissionStatus: 'idle',
  fetchStatus: 'idle',
  submissionError: null,
  fetchError: null,
};

export const submitClaim = createAsyncThunk<
  BaggageClaimEntity,
  BaggageClaimRequest,
  { rejectValue: string }
>('baggage/submitClaim', async (claimRequest, { rejectWithValue }) => {
  try {
    const entity = await submitBaggageClaim(claimRequest);
    return entity;
  } catch (err) {
    if (err instanceof ApiError) {
      return rejectWithValue(err.message);
    }
    return rejectWithValue('An unexpected error occurred while submitting the claim.');
  }
});

export const fetchClaimById = createAsyncThunk<
  BaggageClaimEntity,
  string,
  { rejectValue: string }
>('baggage/fetchClaimById', async (claimId, { rejectWithValue }) => {
  try {
    const entity = await getBaggageClaim(claimId);
    return entity;
  } catch (err) {
    if (err instanceof ApiError) {
      return rejectWithValue(err.message);
    }
    return rejectWithValue('An unexpected error occurred while fetching the claim.');
  }
});

const baggageSlice = createSlice({
  name: 'baggage',
  initialState,
  reducers: {
    clearSubmissionStatus(state) {
      state.submissionStatus = 'idle';
      state.submissionError = null;
    },
    clearActiveClaimDetail(state) {
      state.activeClaimDetail = null;
      state.fetchStatus = 'idle';
      state.fetchError = null;
    },
    clearFetchError(state) {
      state.fetchError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // submitClaim
      .addCase(submitClaim.pending, (state) => {
        state.submissionStatus = 'loading';
        state.submissionError = null;
      })
      .addCase(submitClaim.fulfilled, (state, action: PayloadAction<BaggageClaimEntity>) => {
        state.submissionStatus = 'succeeded';
        state.submissionError = null;
        const exists = state.claims.findIndex((c) => c.id === action.payload.id);
        if (exists >= 0) {
          state.claims[exists] = action.payload;
        } else {
          state.claims.push(action.payload);
        }
        state.activeClaimDetail = action.payload;
      })
      .addCase(submitClaim.rejected, (state, action) => {
        state.submissionStatus = 'failed';
        state.submissionError = action.payload ?? 'Failed to submit claim.';
      })

      // fetchClaimById
      .addCase(fetchClaimById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchClaimById.fulfilled, (state, action: PayloadAction<BaggageClaimEntity>) => {
        state.fetchStatus = 'succeeded';
        state.fetchError = null;
        state.activeClaimDetail = action.payload;
        const exists = state.claims.findIndex((c) => c.id === action.payload.id);
        if (exists >= 0) {
          state.claims[exists] = action.payload;
        } else {
          state.claims.push(action.payload);
        }
      })
      .addCase(fetchClaimById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError = action.payload ?? 'Failed to fetch claim.';
      });
  },
});

export const { clearSubmissionStatus, clearActiveClaimDetail, clearFetchError } =
  baggageSlice.actions;

export default baggageSlice.reducer;

// Exported for the modules that import these by name.
export { baggageSlice };
