import { configureStore } from '@reduxjs/toolkit';
import { authSlice } from './slices/authSlice';
import { bookingSlice } from './slices/bookingSlice';
import { flightSlice } from './slices/flightSlice';
import { loyaltySlice } from './slices/loyaltySlice';
import { baggageSlice } from './slices/baggageSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    booking: bookingSlice.reducer,
    flight: flightSlice.reducer,
    loyalty: loyaltySlice.reducer,
    baggage: baggageSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;