import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';
import { destroySocket } from './socket';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// ── Request interceptor: adjunta JWT ──────────────────────────────────────────
axiosInstance.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: 401 → intenta refresh, si falla → logout ───────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Skip token refresh for endpoints that legitimately return 401 as a business error
    // (e.g. QR scan with invalid/tampered code — not a JWT expiry).
    const isQrEndpoint = original.url?.includes('/api/qr/');
    if (error.response?.status === 401 && !original._retry && !isQrEndpoint) {
      const refreshToken = useAuthStore.getState().getRefreshToken();

      if (!refreshToken) {
        destroySocket();
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token: string) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(axiosInstance(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
          refresh_token: refreshToken,
        });
        const store = useAuthStore.getState();
        store.setTokens(data, store.user!);

        refreshQueue.forEach((cb) => cb(data.access_token));
        refreshQueue = [];

        original.headers.Authorization = `Bearer ${data.access_token}`;
        return axiosInstance(original);
      } catch {
        destroySocket();
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ── Métodos tipados ───────────────────────────────────────────────────────────
const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    axiosInstance.get<T>(url, config).then((r) => r.data),

  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    axiosInstance.post<T>(url, data, config).then((r) => r.data),

  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    axiosInstance.patch<T>(url, data, config).then((r) => r.data),

  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    axiosInstance.put<T>(url, data, config).then((r) => r.data),

  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    axiosInstance.delete<T>(url, config).then((r) => r.data),
};

export default api;
