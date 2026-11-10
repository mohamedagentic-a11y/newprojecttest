import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  BookingEntity,
  CheckInResponse,
  CreateBookingRequest,
  RebookRequest,
  ApiError,
  createBooking as apiCreateBooking,
  rebookFlight as apiRebookFlight,
  checkIn as apiCheckIn,
  getBoardingPass as apiGetBoardingPass,
} from '../../api/bookingApi';

// ─── State Shape ────────────────────────────────────────────────────────────

interface BookingState {
  bookings: BookingEntity[];
  selectedBooking: BookingEntity | null;

  // rebook
  rebookStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  rebookError: string | null;
  rebookedBooking: BookingEntity | null;

  // check-in
  checkinEligible: boolean | null;
  checkinLoading: boolean;
  checkinError: string | null;

  // boarding pass
  boardingPassUrl: string | null;
  boardingPassLoading: boolean;
  boardingPassError: string | null;

  // create booking
  createStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  createError: string | null;

  // general loading
  loading: boolean;
  error: string | null;
}

const initialState: BookingState = {
  bookings: [],
  selectedBooking: null,

  rebookStatus: 'idle',
  rebookError: null,
  rebookedBooking: null,

  checkinEligible: null,
  checkinLoading: false,
  checkinError: null,

  boardingPassUrl: null,
  boardingPassLoading: false,
  boardingPassError: null,

  createStatus: 'idle',
  createError: null,

  loading: false,
  error: null,
};

// ─── Async Thunks ────────────────────────────────────────────────────────────

export const createBooking = createAsyncThunk<
  BookingEntity,
  CreateBookingRequest,
  { rejectValue: string }
>('booking/createBooking', async (request, { rejectWithValue }) => {
  try {
    const booking = await apiCreateBooking(request);
    return booking;
  } catch (err) {
    const apiErr = err as ApiError;
    return rejectWithValue(apiErr.message ?? 'Failed to create booking');
  }
});

export const rebookFlight = createAsyncThunk<
  BookingEntity,
  { bookingId: string; rebookRequest: RebookRequest },
  { rejectValue: string }
>('booking/rebookFlight', async ({ bookingId, rebookRequest }, { rejectWithValue }) => {
  try {
    const updated = await apiRebookFlight(bookingId, rebookRequest);
    return updated as BookingEntity;
  } catch (err) {
    const apiErr = err as ApiError;
    return rejectWithValue(apiErr.message ?? 'Failed to rebook flight');
  }
});

export const fetchCheckinStatus = createAsyncThunk<
  CheckInResponse,
  string,
  { rejectValue: string }
>('booking/fetchCheckinStatus', async (bookingId, { rejectWithValue }) => {
  try {
    const response = await apiCheckIn(bookingId);
    return response;
  } catch (err) {
    const apiErr = err as ApiError;
    return rejectWithValue(apiErr.message ?? 'Failed to fetch check-in status');
  }
});

export const fetchBoardingPass = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>('booking/fetchBoardingPass', async (bookingId, { rejectWithValue }) => {
  try {
    const url = await apiGetBoardingPass(bookingId);
    return url;
  } catch (err) {
    const apiErr = err as ApiError;
    return rejectWithValue(apiErr.message ?? 'Failed to fetch boarding pass');
  }
});

// ─── Slice ───────────────────────────────────────────────────────────────────

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    setSelectedBooking(state, action: PayloadAction<BookingEntity | null>) {
      state.selectedBooking = action.payload;
    },
    addBookingToList(state, action: PayloadAction<BookingEntity>) {
      const exists = state.bookings.find((b) => b.id === action.payload.id);
      if (!exists) {
        state.bookings.push(action.payload);
      }
    },
    setBookings(state, action: PayloadAction<BookingEntity[]>) {
      state.bookings = action.payload;
    },
    clearRebookState(state) {
      state.rebookStatus = 'idle';
      state.rebookError = null;
      state.rebookedBooking = null;
    },
    clearCheckinState(state) {
      state.checkinEligible = null;
      state.checkinError = null;
    },
    clearBoardingPassState(state) {
      state.boardingPassUrl = null;
      state.boardingPassError = null;
    },
    clearCreateState(state) {
      state.createStatus = 'idle';
      state.createError = null;
    },
  },
  extraReducers: (builder) => {
    // ── createBooking ──────────────────────────────────────────────────────
    builder
      .addCase(createBooking.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.createStatus = 'succeeded';
        state.createError = null;
        state.bookings.push(action.payload);
        state.selectedBooking = action.payload;
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.createError = action.payload ?? 'Unknown error';
      });

    // ── rebookFlight ───────────────────────────────────────────────────────
    builder
      .addCase(rebookFlight.pending, (state) => {
        state.rebookStatus = 'loading';
        state.rebookError = null;
        state.rebookedBooking = null;
      })
      .addCase(rebookFlight.fulfilled, (state, action) => {
        state.rebookStatus = 'succeeded';
        state.rebookError = null;
        state.rebookedBooking = action.payload;

        // Update in list
        const idx = state.bookings.findIndex((b) => b.id === action.payload.id);
        if (idx !== -1) {
          state.bookings[idx] = action.payload;
        }

        // Update selected if it matches
        if (state.selectedBooking?.id === action.payload.id) {
          state.selectedBooking = action.payload;
        }
      })
      .addCase(rebookFlight.rejected, (state, action) => {
        state.rebookStatus = 'failed';
        state.rebookError = action.payload ?? 'Unknown error';
      });

    // ── fetchCheckinStatus ─────────────────────────────────────────────────
    builder
      .addCase(fetchCheckinStatus.pending, (state) => {
        state.checkinLoading = true;
        state.checkinError = null;
        state.checkinEligible = null;
      })
      .addCase(fetchCheckinStatus.fulfilled, (state, action) => {
        state.checkinLoading = false;
        state.checkinEligible = action.payload.eligible;
        // Also store boarding pass URL if provided by check-in response
        if (action.payload.boardingPassUrl) {
          state.boardingPassUrl = action.payload.boardingPassUrl;
        }
      })
      .addCase(fetchCheckinStatus.rejected, (state, action) => {
        state.checkinLoading = false;
        state.checkinError = action.payload ?? 'Unknown error';
        state.checkinEligible = false;
      });

    // ── fetchBoardingPass ──────────────────────────────────────────────────
    builder
      .addCase(fetchBoardingPass.pending, (state) => {
        state.boardingPassLoading = true;
        state.boardingPassError = null;
      })
      .addCase(fetchBoardingPass.fulfilled, (state, action) => {
        state.boardingPassLoading = false;
        state.boardingPassUrl = action.payload;
      })
      .addCase(fetchBoardingPass.rejected, (state, action) => {
        state.boardingPassLoading = false;
        state.boardingPassError = action.payload ?? 'Unknown error';
      });
  },
});

export const {
  setSelectedBooking,
  addBookingToList,
  setBookings,
  clearRebookState,
  clearCheckinState,
  clearBoardingPassState,
  clearCreateState,
} = bookingSlice.actions;

export default bookingSlice.reducer;

// Exported for the modules that import these by name.
export { bookingSlice };
