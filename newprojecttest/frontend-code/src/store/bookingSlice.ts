import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient, ApiError } from '../api/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BookingEntity {
  id: string;
  flightId: string;
  passengerId: string;
  seatPreference: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface CheckInResult {
  eligible: boolean;
  boardingPassUrl: string;
}

export interface BoardingPassResult {
  url: string;
  bookingId: string;
}

export interface CreateBookingPayload {
  flightId: string;
  seatPreference: string;
  paymentMethod: string;
}

export interface RebookPayload {
  bookingId: string;
  newFlightId: string;
  paymentMethod: string;
}

export interface CheckInPayload {
  bookingId: string;
}

export interface BookingState {
  bookings: BookingEntity[];
  activeBooking: BookingEntity | null;
  rebooking: {
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
  };
  checkIn: {
    result: CheckInResult | null;
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
  };
  boardingPass: {
    result: BoardingPassResult | null;
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
  };
  listStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  listError: string | null;
  createStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  createError: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: BookingState = {
  bookings: [],
  activeBooking: null,
  rebooking: {
    status: 'idle',
    error: null,
  },
  checkIn: {
    result: null,
    status: 'idle',
    error: null,
  },
  boardingPass: {
    result: null,
    status: 'idle',
    error: null,
  },
  listStatus: 'idle',
  listError: null,
  createStatus: 'idle',
  createError: null,
};

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchBookings = createAsyncThunk<
  BookingEntity,
  string,
  { rejectValue: string }
>('bookings/fetchBookings', async (bookingId: string, { rejectWithValue }) => {
  try {
    const data = await apiClient.get<BookingEntity>(`/bookings/${bookingId}`);
    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      return rejectWithValue(err.message);
    }
    return rejectWithValue('Failed to fetch booking');
  }
});

export const createBookingThunk = createAsyncThunk<
  BookingEntity,
  CreateBookingPayload,
  { rejectValue: string }
>('bookings/createBooking', async (payload: CreateBookingPayload, { rejectWithValue }) => {
  try {
    const data = await apiClient.post<BookingEntity>('/bookings', payload);
    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      return rejectWithValue(err.message);
    }
    return rejectWithValue('Failed to create booking');
  }
});

export const rebookThunk = createAsyncThunk<
  BookingEntity,
  RebookPayload,
  { rejectValue: string }
>('bookings/rebook', async (payload: RebookPayload, { rejectWithValue }) => {
  try {
    const { bookingId, newFlightId, paymentMethod } = payload;
    const data = await apiClient.put<BookingEntity>(`/bookings/${bookingId}/rebook`, {
      newFlightId,
      paymentMethod,
    });
    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      return rejectWithValue(err.message);
    }
    return rejectWithValue('Failed to rebook flight');
  }
});

export const checkInThunk = createAsyncThunk<
  CheckInResult,
  CheckInPayload,
  { rejectValue: string }
>('bookings/checkIn', async (payload: CheckInPayload, { rejectWithValue }) => {
  try {
    const data = await apiClient.get<CheckInResult>(`/bookings/${payload.bookingId}/checkin`);
    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      return rejectWithValue(err.message);
    }
    return rejectWithValue('Failed to perform check-in');
  }
});

export const fetchBoardingPass = createAsyncThunk<
  BoardingPassResult,
  string,
  { rejectValue: string }
>('bookings/fetchBoardingPass', async (bookingId: string, { rejectWithValue }) => {
  try {
    const data = await apiClient.get<BoardingPassResult>(`/bookings/${bookingId}/boarding-pass`);
    return { ...data, bookingId };
  } catch (err) {
    if (err instanceof ApiError) {
      return rejectWithValue(err.message);
    }
    return rejectWithValue('Failed to fetch boarding pass');
  }
});

// ─── Slice ────────────────────────────────────────────────────────────────────

export const bookingSlice = createSlice({
  name: 'bookings',
  initialState,
  reducers: {
    setActiveBooking(state, action: PayloadAction<BookingEntity | null>) {
      state.activeBooking = action.payload;
    },
    clearCreateStatus(state) {
      state.createStatus = 'idle';
      state.createError = null;
    },
    clearRebookStatus(state) {
      state.rebooking.status = 'idle';
      state.rebooking.error = null;
    },
    clearCheckInStatus(state) {
      state.checkIn.status = 'idle';
      state.checkIn.error = null;
      state.checkIn.result = null;
    },
    clearBoardingPassStatus(state) {
      state.boardingPass.status = 'idle';
      state.boardingPass.error = null;
      state.boardingPass.result = null;
    },
  },
  extraReducers: (builder) => {
    // fetchBookings
    builder
      .addCase(fetchBookings.pending, (state) => {
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchBookings.fulfilled, (state, action: PayloadAction<BookingEntity>) => {
        state.listStatus = 'succeeded';
        const booking = action.payload;
        const existingIndex = state.bookings.findIndex((b) => b.id === booking.id);
        if (existingIndex !== -1) {
          state.bookings[existingIndex] = booking;
        } else {
          state.bookings.push(booking);
        }
        state.activeBooking = booking;
      })
      .addCase(fetchBookings.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.listError = action.payload ?? 'Unknown error';
      });

    // createBookingThunk
    builder
      .addCase(createBookingThunk.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
      })
      .addCase(createBookingThunk.fulfilled, (state, action: PayloadAction<BookingEntity>) => {
        state.createStatus = 'succeeded';
        const booking = action.payload;
        const existingIndex = state.bookings.findIndex((b) => b.id === booking.id);
        if (existingIndex !== -1) {
          state.bookings[existingIndex] = booking;
        } else {
          state.bookings.push(booking);
        }
        state.activeBooking = booking;
      })
      .addCase(createBookingThunk.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.createError = action.payload ?? 'Unknown error';
      });

    // rebookThunk
    builder
      .addCase(rebookThunk.pending, (state) => {
        state.rebooking.status = 'loading';
        state.rebooking.error = null;
      })
      .addCase(rebookThunk.fulfilled, (state, action: PayloadAction<BookingEntity>) => {
        state.rebooking.status = 'succeeded';
        const updated = action.payload;
        const existingIndex = state.bookings.findIndex((b) => b.id === updated.id);
        if (existingIndex !== -1) {
          state.bookings[existingIndex] = updated;
        } else {
          state.bookings.push(updated);
        }
        if (state.activeBooking?.id === updated.id) {
          state.activeBooking = updated;
        }
      })
      .addCase(rebookThunk.rejected, (state, action) => {
        state.rebooking.status = 'failed';
        state.rebooking.error = action.payload ?? 'Unknown error';
      });

    // checkInThunk
    builder
      .addCase(checkInThunk.pending, (state) => {
        state.checkIn.status = 'loading';
        state.checkIn.error = null;
        state.checkIn.result = null;
      })
      .addCase(checkInThunk.fulfilled, (state, action: PayloadAction<CheckInResult>) => {
        state.checkIn.status = 'succeeded';
        state.checkIn.result = action.payload;
      })
      .addCase(checkInThunk.rejected, (state, action) => {
        state.checkIn.status = 'failed';
        state.checkIn.error = action.payload ?? 'Unknown error';
      });

    // fetchBoardingPass
    builder
      .addCase(fetchBoardingPass.pending, (state) => {
        state.boardingPass.status = 'loading';
        state.boardingPass.error = null;
        state.boardingPass.result = null;
      })
      .addCase(fetchBoardingPass.fulfilled, (state, action: PayloadAction<BoardingPassResult>) => {
        state.boardingPass.status = 'succeeded';
        state.boardingPass.result = action.payload;
      })
      .addCase(fetchBoardingPass.rejected, (state, action) => {
        state.boardingPass.status = 'failed';
        state.boardingPass.error = action.payload ?? 'Unknown error';
      });
  },
});

export const {
  setActiveBooking,
  clearCreateStatus,
  clearRebookStatus,
  clearCheckInStatus,
  clearBoardingPassStatus,
} = bookingSlice.actions;

export default bookingSlice.reducer;