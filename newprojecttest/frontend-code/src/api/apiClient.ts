import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (!BASE_URL) {
  throw new Error('VITE_API_BASE_URL is not set. Please configure it in your environment.');
}

const TOKEN_KEY = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_TOKEN_KEY ?? 'access_token';

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function removeStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface SuccessEnvelope<T> {
  status: 'success';
  data: T;
  meta?: {
    requestId?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}

interface ErrorEnvelope {
  status: 'error';
  code?: number;
  message?: string;
  details?: Record<string, unknown>;
  meta?: {
    requestId?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}

type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

class ApiError extends Error {
  public readonly code?: number;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code?: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void): void {
  refreshSubscribers.push(cb);
}

function notifyRefreshSubscribers(token: string): void {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function clearRefreshSubscribers(): void {
  refreshSubscribers = [];
}

const axiosInstance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = getStoredToken();
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        return new Promise<AxiosResponse>((resolve, reject) => {
          subscribeTokenRefresh((newToken: string) => {
            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            }
            resolve(axiosInstance(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axiosInstance.post<SuccessEnvelope<{ accessToken: string }>>(
          '/api/v1/auth/refresh',
        );

        const envelope = refreshResponse.data;
        if (envelope.status !== 'success') {
          throw new ApiError('Token refresh failed');
        }

        const newToken = envelope.data.accessToken;
        setStoredToken(newToken);
        isRefreshing = false;
        notifyRefreshSubscribers(newToken);

        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        }

        return axiosInstance(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        clearRefreshSubscribers();
        removeStoredToken();
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

function unwrap<T>(response: AxiosResponse<ApiEnvelope<T>>): T {
  const envelope = response.data;

  if (envelope.status === 'success') {
    return (envelope as SuccessEnvelope<T>).data;
  }

  const errorEnvelope = envelope as ErrorEnvelope;
  throw new ApiError(
    errorEnvelope.message ?? 'An unknown error occurred',
    errorEnvelope.code,
    errorEnvelope.details,
  );
}

async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await axiosInstance.get<ApiEnvelope<T>>(url, config);
  return unwrap<T>(response);
}

async function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await axiosInstance.post<ApiEnvelope<T>>(url, data, config);
  return unwrap<T>(response);
}

async function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await axiosInstance.put<ApiEnvelope<T>>(url, data, config);
  return unwrap<T>(response);
}

async function patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await axiosInstance.patch<ApiEnvelope<T>>(url, data, config);
  return unwrap<T>(response);
}

async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await axiosInstance.delete<ApiEnvelope<T>>(url, config);
  return unwrap<T>(response);
}

export const apiClient = {
  get,
  post,
  put,
  patch,
  delete: del,
  setToken: setStoredToken,
  removeToken: removeStoredToken,
  getToken: getStoredToken,
  instance: axiosInstance,
};

export { ApiError };
export type { SuccessEnvelope, ErrorEnvelope, ApiEnvelope };