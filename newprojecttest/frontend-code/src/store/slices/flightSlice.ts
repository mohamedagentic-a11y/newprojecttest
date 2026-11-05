import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { searchFlights as searchFlightsApi, FlightEntity, FlightSearchParams, FlightSearchMeta, PaginationMeta } from '../../api/flightApi';

interface FlightState {
  results: FlightEntity[];
  pagination: PaginationMeta | null;
  meta: FlightSearchMeta | null;
  loading: boolean;
  error: string | null;
}

const initialState: FlightState = {
  results: [],
  pagination: null,
  meta: null,
  loading: false,
  error: null,
};

export const searchFlights = createAsyncThunk<
  { flights: FlightEntity[]; meta: FlightSearchMeta },
  FlightSearchParams,
  { rejectValue: string }
>(
  'flights/searchFlights',
  async (params, { rejectWithValue }) => {
    try {
      const result = await searchFlightsApi(params);
      return result;
    } catch (err: unknown) {
      if (err instanceof Error) {
        return rejectWithValue(err.message);
      }
      return rejectWithValue('An unknown error occurred while searching flights.');
    }
  }
);

const flightSlice = createSlice({
  name: 'flights',
  initialState,
  reducers: {
    clearFlightResults(state) {
      state.results = [];
      state.pagination = null;
      state.meta = null;
      state.error = null;
      state.loading = false;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchFlights.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        searchFlights.fulfilled,
        (state, action: PayloadAction<{ flights: FlightEntity[]; meta: FlightSearchMeta }>) => {
          const { flights, meta } = action.payload;
          state.loading = false;
          state.error = null;
          // If this is a cursor-based next-page load, append; otherwise replace
          const incoming = action.meta.arg;
          if (incoming.cursor) {
            state.results = [...state.results, ...flights];
          } else {
            state.results = flights;
          }
          state.meta = meta;
          state.pagination = meta.pagination;
        }
      )
      .addCase(searchFlights.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to search flights.';
      });
  },
});

export const { clearFlightResults, clearError } = flightSlice.actions;
export default flightSlice.reducer;

// Exported for the modules that import these by name.
export { flightSlice };
