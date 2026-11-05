import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { login, LoginResponse } from '../../api/authApi';

export type Role =
  | 'Corporate Traveler'
  | 'Leisure Passenger'
  | 'Travel Operations Specialist';

export interface AuthState {
  accessToken: string | null;
  passenger_id: string | null;
  tier_status: string | null;
  role: Role | null;
  preferred_language: 'en' | 'ar';
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  accessToken: null,
  passenger_id: null,
  tier_status: null,
  role: null,
  preferred_language: 'en',
  loading: false,
  error: null,
};

export interface LoginCredentials {
  email: string;
  password: string;
}

export const loginThunk = createAsyncThunk<
  LoginResponse,
  LoginCredentials,
  { rejectValue: string }
>('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const response = await login(credentials.email, credentials.password);
    return response;
  } catch (err: unknown) {
    if (err instanceof Error) {
      return rejectWithValue(err.message);
    }
    return rejectWithValue('Login failed');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{
        accessToken: string;
        passenger_id: string;
        tier_status: string;
        role: Role;
        preferred_language: 'en' | 'ar';
      }>
    ) {
      state.accessToken = action.payload.accessToken;
      state.passenger_id = action.payload.passenger_id;
      state.tier_status = action.payload.tier_status;
      state.role = action.payload.role;
      state.preferred_language = action.payload.preferred_language;
      state.error = null;
    },
    clearCredentials(state) {
      state.accessToken = null;
      state.passenger_id = null;
      state.tier_status = null;
      state.role = null;
      state.preferred_language = 'en';
      state.error = null;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.accessToken = action.payload.accessToken;
        state.tier_status = action.payload.tierStatus;
        state.error = null;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Login failed';
      });
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;

// Exported for the modules that import these by name.
export { authSlice };
