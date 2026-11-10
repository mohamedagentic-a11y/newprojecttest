import { configureStore } from '@reduxjs/toolkit';
import { authSlice } from './authSlice';
import { bookingSlice } from './bookingSlice';
import { loyaltySlice } from './loyaltySlice';
import { baggageSlice } from './baggageSlice';
import { flightSlice } from './flightSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    booking: bookingSlice.reducer,
    loyalty: loyaltySlice.reducer,
    baggage: baggageSlice.reducer,
    flight: flightSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;