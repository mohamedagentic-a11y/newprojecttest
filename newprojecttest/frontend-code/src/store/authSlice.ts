import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient, ApiError } from '../api/apiClient';

export type PassengerRole =
  | 'Corporate Traveler'
  | 'Leisure Passenger'
  | 'Travel Operations Specialist';

export type TierStatus = 'standard' | 'silver' | 'gold' | 'platinum';

export interface AuthState {
  accessToken: string | null;
  role: PassengerRole | null;
  tierStatus: TierStatus | null;
  loading: boolean;
  error: string | null;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponseData {
  accessToken: string;
  refreshToken: string;
  tierStatus: TierStatus;
  role?: PassengerRole;
}

const TOKEN_KEY = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_TOKEN_KEY ?? 'auth_access_token';
const ROLE_KEY = 'auth_role';
const TIER_KEY = 'auth_tier_status';

function persistAuth(token: string, role: PassengerRole | null, tier: TierStatus | null): void {
  localStorage.setItem(TOKEN_KEY, token);
  if (role) localStorage.setItem(ROLE_KEY, role);
  if (tier) localStorage.setItem(TIER_KEY, tier);
}

function clearPersistedAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(TIER_KEY);
}

function loadPersistedAuth(): Pick<AuthState, 'accessToken' | 'role' | 'tierStatus'> {
  const accessToken = localStorage.getItem(TOKEN_KEY);
  const role = localStorage.getItem(ROLE_KEY) as PassengerRole | null;
  const tierStatus = localStorage.getItem(TIER_KEY) as TierStatus | null;
  return { accessToken, role, tierStatus };
}

const persisted = loadPersistedAuth();

const initialState: AuthState = {
  accessToken: persisted.accessToken,
  role: persisted.role,
  tierStatus: persisted.tierStatus,
  loading: false,
  error: null,
};

export const loginThunk = createAsyncThunk<
  { accessToken: string; role: PassengerRole | null; tierStatus: TierStatus },
  LoginCredentials,
  { rejectValue: string }
>('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const data = await apiClient.post<LoginResponseData>(
      '/auth/login',
      credentials
    );

    const role: PassengerRole | null = data.role ?? null;
    const tierStatus: TierStatus = data.tierStatus ?? 'standard';
    const accessToken: string = data.accessToken;

    persistAuth(accessToken, role, tierStatus);

    return { accessToken, role, tierStatus };
  } catch (err) {
    if (err instanceof ApiError) {
      return rejectWithValue(err.message);
    }
    return rejectWithValue('An unexpected error occurred during login.');
  }
});

export const logoutAction = createAsyncThunk<void, void, { rejectValue: string }>(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      clearPersistedAuth();
    } catch (err) {
      clearPersistedAuth();
      if (err instanceof ApiError) {
        return rejectWithValue(err.message);
      }
      return rejectWithValue('Logout failed.');
    }
  }
);

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
      localStorage.setItem(TOKEN_KEY, action.payload);
    },
    setRole(state, action: PayloadAction<PassengerRole>) {
      state.role = action.payload;
      localStorage.setItem(ROLE_KEY, action.payload);
    },
    clearError(state) {
      state.error = null;
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
        state.role = action.payload.role;
        state.tierStatus = action.payload.tierStatus;
        state.error = null;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Login failed.';
      })
      .addCase(logoutAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logoutAction.fulfilled, (state) => {
        state.loading = false;
        state.accessToken = null;
        state.role = null;
        state.tierStatus = null;
        state.error = null;
      })
      .addCase(logoutAction.rejected, (state, action) => {
        state.loading = false;
        state.accessToken = null;
        state.role = null;
        state.tierStatus = null;
        state.error = action.payload ?? 'Logout failed.';
      });
  },
});

export const { setAccessToken, setRole, clearError } = authSlice.actions;

export default authSlice.reducer;