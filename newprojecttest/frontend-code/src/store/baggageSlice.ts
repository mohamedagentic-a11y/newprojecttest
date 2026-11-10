import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { apiClient, ApiError } from '../api/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export type IncidentType = 'delayed' | 'damaged' | 'lost' | 'other';

export interface TimelineEvent {
  timestamp: string;
  status: string;
  description: string;
}

export interface BaggageClaimEntity {
  id: string;
  pnr: string;
  incidentType: IncidentType;
  description: string;
  files: string[];
  status: string;
  trackingId: string;
  timeline: TimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface SubmitClaimPayload {
  pnr: string;
  incidentType: IncidentType;
  description: string;
  files: string[];
}

// ─── State ───────────────────────────────────────────────────────────────────

export interface BaggageState {
  claims: BaggageClaimEntity[];
  activeClaim: BaggageClaimEntity | null;
  submissionStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  fetchStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  submissionError: string | null;
  fetchError: string | null;
  lastSubmittedId: string | null;
}

const initialState: BaggageState = {
  claims: [],
  activeClaim: null,
  submissionStatus: 'idle',
  fetchStatus: 'idle',
  submissionError: null,
  fetchError: null,
  lastSubmittedId: null,
};

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const submitClaimThunk = createAsyncThunk<
  BaggageClaimEntity,
  SubmitClaimPayload,
  { rejectValue: string }
>('baggage/submitClaim', async (payload, { rejectWithValue }) => {
  try {
    const data = await apiClient.post<BaggageClaimEntity>(
      '/baggage/claims',
      payload
    );
    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      return rejectWithValue(err.message);
    }
    return rejectWithValue('An unexpected error occurred while submitting the claim.');
  }
});

export const fetchClaim = createAsyncThunk<
  BaggageClaimEntity,
  string,
  { rejectValue: string }
>('baggage/fetchClaim', async (claimId, { rejectWithValue }) => {
  try {
    const data = await apiClient.get<BaggageClaimEntity>(
      `/baggage/claims/${claimId}`
    );
    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      return rejectWithValue(err.message);
    }
    return rejectWithValue('An unexpected error occurred while fetching the claim.');
  }
});

// ─── Slice ───────────────────────────────────────────────────────────────────

export const baggageSlice = createSlice({
  name: 'baggage',
  initialState,
  reducers: {
    clearActiveClaim(state) {
      state.activeClaim = null;
      state.fetchStatus = 'idle';
      state.fetchError = null;
    },
    clearSubmissionStatus(state) {
      state.submissionStatus = 'idle';
      state.submissionError = null;
      state.lastSubmittedId = null;
    },
    setActiveClaim(state, action: PayloadAction<BaggageClaimEntity>) {
      state.activeClaim = action.payload;
    },
  },
  extraReducers: (builder) => {
    // ── submitClaimThunk ─────────────────────────────────────────────────────
    builder.addCase(submitClaimThunk.pending, (state) => {
      state.submissionStatus = 'loading';
      state.submissionError = null;
      state.lastSubmittedId = null;
    });
    builder.addCase(
      submitClaimThunk.fulfilled,
      (state, action: PayloadAction<BaggageClaimEntity>) => {
        state.submissionStatus = 'succeeded';
        state.submissionError = null;
        state.lastSubmittedId = action.payload.id;
        // Upsert into claims list
        const idx = state.claims.findIndex((c) => c.id === action.payload.id);
        if (idx === -1) {
          state.claims.push(action.payload);
        } else {
          state.claims[idx] = action.payload;
        }
        state.activeClaim = action.payload;
      }
    );
    builder.addCase(submitClaimThunk.rejected, (state, action) => {
      state.submissionStatus = 'failed';
      state.submissionError = action.payload ?? 'Submission failed.';
    });

    // ── fetchClaim ───────────────────────────────────────────────────────────
    builder.addCase(fetchClaim.pending, (state) => {
      state.fetchStatus = 'loading';
      state.fetchError = null;
    });
    builder.addCase(
      fetchClaim.fulfilled,
      (state, action: PayloadAction<BaggageClaimEntity>) => {
        state.fetchStatus = 'succeeded';
        state.fetchError = null;
        state.activeClaim = action.payload;
        // Upsert into claims list
        const idx = state.claims.findIndex((c) => c.id === action.payload.id);
        if (idx === -1) {
          state.claims.push(action.payload);
        } else {
          state.claims[idx] = action.payload;
        }
      }
    );
    builder.addCase(fetchClaim.rejected, (state, action) => {
      state.fetchStatus = 'failed';
      state.fetchError = action.payload ?? 'Failed to fetch claim.';
    });
  },
});

export const { clearActiveClaim, clearSubmissionStatus, setActiveClaim } =
  baggageSlice.actions;

export default baggageSlice.reducer;