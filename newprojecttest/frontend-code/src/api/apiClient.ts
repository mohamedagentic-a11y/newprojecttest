import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL as string | undefined;
if (!baseURL) {
  throw new Error('VITE_API_BASE_URL is not set. Please configure it in your environment.');
}

// We import the store lazily to avoid circular dependency issues.
// The store is used only inside interceptors, which run after module initialization.
let storeInstance: ReturnType<typeof import('../store/index')['default']> | null = null;

async function getStore() {
  if (!storeInstance) {
    const storeModule = await import('../store/index');
    storeInstance = storeModule.default;
  }
  return storeInstance;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApiSuccessEnvelope<T> {
  status: 'success';
  data: T;
  meta?: {
    requestId?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}

interface ApiErrorEnvelope {
  status: 'error';
  code?: number;
  message?: string;
  details?: unknown;
  meta?: {
    requestId?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}

type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export class ApiError extends Error {
  public code?: number;
  public details?: unknown;

  constructor(message: string, code?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

// ─── Token refresh state ──────────────────────────────────────────────────────

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function onRefreshFailed() {
  refreshSubscribers = [];
}

// ─── In-memory access token ───────────────────────────────────────────────────
// The access token lives in Redux state; we pull it from the store on each request.

async function getAccessToken(): Promise<string | null> {
  try {
    const store = await getStore();
    const state = store.getState() as {
      auth?: { accessToken?: string | null };
    };
    return state?.auth?.accessToken ?? null;
  } catch {
    return null;
  }
}

async function setAccessToken(token: string): Promise<void> {
  try {
    const store = await getStore();
    const { setAccessToken: setToken } = await import('../store/index').then(
      () => import('../store/slices/authSlice').catch(() => null)
    ).then(async (mod) => {
      if (mod && 'setAccessToken' in mod) return mod as { setAccessToken: (t: string) => { type: string; payload: string } };
      // fallback: dispatch a generic action if authSlice isn't available as expected
      return { setAccessToken: (t: string) => ({ type: 'auth/setAccessToken', payload: t }) };
    });
    store.dispatch(setToken(token));
  } catch {
    // If we can't update the store, we still proceed; the retry will use the new token directly.
  }
}

async function clearAuth(): Promise<void> {
  try {
    const store = await getStore();
    store.dispatch({ type: 'auth/clearAuth' });
  } catch {
    // best effort
  }
}

// ─── Axios instance ───────────────────────────────────────────────────────────

const instance: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true, // Send HttpOnly refresh-token cookie on every request
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request interceptor ──────────────────────────────────────────────────────

instance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    const token = await getAccessToken();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor ─────────────────────────────────────────────────────

instance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Queue this request until refresh is done
        return new Promise<AxiosResponse>((resolve, reject) => {
          subscribeTokenRefresh((newToken: string) => {
            originalRequest.headers = originalRequest.headers ?? {};
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            resolve(instance(originalRequest));
          });
          // If refresh fails, we propagate rejection
          setTimeout(() => {
            if (!originalRequest.headers?.['Authorization']) {
              reject(error);
            }
          }, 10000);
        });
      }

      isRefreshing = true;

      try {
        // Attempt to refresh using the HttpOnly cookie (withCredentials already set)
        const refreshResponse = await axios.post<ApiSuccessEnvelope<{ accessToken: string }>>(
          `${baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const envelope = refreshResponse.data;
        if (envelope.status !== 'success' || !envelope.data?.accessToken) {
          throw new ApiError('Token refresh failed');
        }

        const newAccessToken = envelope.data.accessToken;
        await setAccessToken(newAccessToken);

        isRefreshing = false;
        onRefreshed(newAccessToken);

        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return instance(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        onRefreshFailed();
        await clearAuth();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ─── Envelope unwrapper ───────────────────────────────────────────────────────

function unwrap<T>(envelope: ApiEnvelope<T>): T {
  if (envelope.status === 'success') {
    return (envelope as ApiSuccessEnvelope<T>).data;
  }
  const err = envelope as ApiErrorEnvelope;
  throw new ApiError(
    err.message ?? 'An unknown API error occurred.',
    err.code,
    err.details
  );
}

// ─── Typed helpers ────────────────────────────────────────────────────────────

async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await instance.get<ApiEnvelope<T>>(url, config);
  return unwrap<T>(response.data);
}

async function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await instance.post<ApiEnvelope<T>>(url, data, config);
  return unwrap<T>(response.data);
}

async function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await instance.put<ApiEnvelope<T>>(url, data, config);
  return unwrap<T>(response.data);
}

async function patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await instance.patch<ApiEnvelope<T>>(url, data, config);
  return unwrap<T>(response.data);
}

async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await instance.delete<ApiEnvelope<T>>(url, config);
  return unwrap<T>(response.data);
}

export { get, post, put, patch, del as delete };
export default instance;