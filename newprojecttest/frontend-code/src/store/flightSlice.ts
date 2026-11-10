import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient, ApiError } from '../api/apiClient';

// Types

export interface FlightEntity {
  id: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  cabinClass: string;
  airline: string;
  flightNumber: string;
  price: number;
  currency: string;
  availableSeats: number;
  duration: string;
  stops: number;
}

export interface SeatEntity {
  seatNumber: string;
  cabinClass: string;
  status: 'available' | 'occupied' | 'locked' | 'selected';
  position: 'window' | 'middle' | 'aisle';
  row: number;
  column: string;
}

export interface SeatMapData {
  flightId: string;
  cabinClass: string;
  seats: SeatEntity[];
  totalRows: number;
  columns: string[];
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  cabinClass: string;
}

export interface FlightSearchMeta {
  syncedFrom: string;
  cachedTTL: number;
}

export interface FlightSearchResult {
  flights: FlightEntity[];
  meta: FlightSearchMeta | null;
}

export interface LockedSeat {
  seatNumber: string;
  flightId: string;
  lockedAt: string;
}

export interface FlightState {
  searchResults: FlightEntity[];
  searchMeta: FlightSearchMeta | null;
  searchLoading: boolean;
  searchError: string | null;

  selectedFlight: FlightEntity | null;

  seatMap: SeatMapData | null;
  seatMapLoading: boolean;
  seatMapError: string | null;

  lockedSeats: LockedSeat[];
  selectedSeat: string | null;
}

const initialState: FlightState = {
  searchResults: [],
  searchMeta: null,
  searchLoading: false,
  searchError: null,

  selectedFlight: null,

  seatMap: null,
  seatMapLoading: false,
  seatMapError: null,

  lockedSeats: [],
  selectedSeat: null,
};

// Thunks

export const searchFlightsThunk = createAsyncThunk<
  FlightSearchResult,
  FlightSearchParams,
  { rejectValue: string }
>(
  'flights/searchFlights',
  async (params, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams({
        origin: params.origin,
        destination: params.destination,
        departureDate: params.departureDate,
        cabinClass: params.cabinClass,
      });

      const result = await apiClient.get<{ flights: FlightEntity[]; meta: FlightSearchMeta }>(
        `/flights/search?${queryParams.toString()}`
      );

      return {
        flights: Array.isArray(result) ? result : (result as any).data ?? result,
        meta: (result as any).meta ?? null,
      };
    } catch (err) {
      if (err instanceof ApiError) {
        return rejectWithValue(err.message);
      }
      return rejectWithValue('An unexpected error occurred while searching flights.');
    }
  }
);

export const fetchSeatMap = createAsyncThunk<
  SeatMapData,
  { flightId: string; cabinClass?: string },
  { rejectValue: string }
>(
  'flights/fetchSeatMap',
  async ({ flightId, cabinClass }, { rejectWithValue }) => {
    try {
      const result = await apiClient.get<SeatMapData>(`/flights/${flightId}`);

      // Normalize result into SeatMapData shape
      const seatMap: SeatMapData = {
        flightId,
        cabinClass: cabinClass ?? 'economy',
        seats: (result as any).seats ?? [],
        totalRows: (result as any).totalRows ?? 0,
        columns: (result as any).columns ?? [],
      };

      return seatMap;
    } catch (err) {
      if (err instanceof ApiError) {
        return rejectWithValue(err.message);
      }
      return rejectWithValue('An unexpected error occurred while fetching seat map.');
    }
  }
);

// Slice

export const flightSlice = createSlice({
  name: 'flights',
  initialState,
  reducers: {
    setSelectedFlight(state, action: PayloadAction<FlightEntity | null>) {
      state.selectedFlight = action.payload;
      // Clear seat map when flight changes
      if (action.payload?.id !== state.seatMap?.flightId) {
        state.seatMap = null;
        state.seatMapError = null;
        state.selectedSeat = null;
      }
    },

    clearSearchResults(state) {
      state.searchResults = [];
      state.searchMeta = null;
      state.searchError = null;
    },

    clearSearchError(state) {
      state.searchError = null;
    },

    clearSeatMapError(state) {
      state.seatMapError = null;
    },

    setSelectedSeat(state, action: PayloadAction<string | null>) {
      state.selectedSeat = action.payload;
    },

    lockSeat(state, action: PayloadAction<{ seatNumber: string; flightId: string }>) {
      const { seatNumber, flightId } = action.payload;
      const alreadyLocked = state.lockedSeats.some(
        (s) => s.seatNumber === seatNumber && s.flightId === flightId
      );
      if (!alreadyLocked) {
        state.lockedSeats.push({
          seatNumber,
          flightId,
          lockedAt: new Date().toISOString(),
        });
      }
      // Update seat status in seat map if loaded
      if (state.seatMap && state.seatMap.flightId === flightId) {
        const seat = state.seatMap.seats.find((s) => s.seatNumber === seatNumber);
        if (seat) {
          seat.status = 'locked';
        }
      }
    },

    unlockSeat(state, action: PayloadAction<{ seatNumber: string; flightId: string }>) {
      const { seatNumber, flightId } = action.payload;
      state.lockedSeats = state.lockedSeats.filter(
        (s) => !(s.seatNumber === seatNumber && s.flightId === flightId)
      );
      // Update seat status in seat map if loaded
      if (state.seatMap && state.seatMap.flightId === flightId) {
        const seat = state.seatMap.seats.find((s) => s.seatNumber === seatNumber);
        if (seat && seat.status === 'locked') {
          seat.status = 'available';
        }
      }
    },

    clearLockedSeats(state) {
      state.lockedSeats = [];
    },

    resetFlightState() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    // searchFlightsThunk
    builder
      .addCase(searchFlightsThunk.pending, (state) => {
        state.searchLoading = true;
        state.searchError = null;
      })
      .addCase(searchFlightsThunk.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.searchResults = action.payload.flights;
        state.searchMeta = action.payload.meta;
        state.searchError = null;
      })
      .addCase(searchFlightsThunk.rejected, (state, action) => {
        state.searchLoading = false;
        state.searchError = action.payload ?? 'Search failed.';
      });

    // fetchSeatMap
    builder
      .addCase(fetchSeatMap.pending, (state) => {
        state.seatMapLoading = true;
        state.seatMapError = null;
      })
      .addCase(fetchSeatMap.fulfilled, (state, action) => {
        state.seatMapLoading = false;
        state.seatMap = action.payload;
        state.seatMapError = null;
      })
      .addCase(fetchSeatMap.rejected, (state, action) => {
        state.seatMapLoading = false;
        state.seatMapError = action.payload ?? 'Failed to load seat map.';
      });
  },
});

export const {
  setSelectedFlight,
  clearSearchResults,
  clearSearchError,
  clearSeatMapError,
  setSelectedSeat,
  lockSeat,
  unlockSeat,
  clearLockedSeats,
  resetFlightState,
} = flightSlice.actions;

export default flightSlice.reducer;