/**
 * Axios API client.
 *
 * Centralises the base URL, JWT injection, response unwrapping and error
 * normalisation. Every service module imports from here.
 */
import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";
import type { ApiResponse } from "@/types/api.types";

// Relative base URL: the Vite dev server proxies /api and /ws to the backend,
// so the browser never needs to know the backend host (works in preview too).
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "";

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: attach the JWT access token ────────────────────────
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("crimenet_access_token");
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: refresh token once on 401 ─────────────────────────
let isRefreshing = false;

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original?._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("crimenet_refresh_token");
      if (refreshToken && !isRefreshing) {
        isRefreshing = true;
        try {
          const resp = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const token = resp.data?.data?.access_token;
          if (token) {
            localStorage.setItem("crimenet_access_token", token);
            original.headers = original.headers ?? {};
            (original.headers as Record<string, string>).Authorization = `Bearer ${token}`;
            return client(original);
          }
        } catch {
          clearSession();
        } finally {
          isRefreshing = false;
        }
      }
      clearSession();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

/** Remove stored auth tokens. */
export function clearSession(): void {
  localStorage.removeItem("crimenet_access_token");
  localStorage.removeItem("crimenet_refresh_token");
  localStorage.removeItem("crimenet_user");
}

/**
 * Perform a GET and unwrap the standard response envelope, returning `data`.
 */
export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const resp = await client.get<ApiResponse<T>>(url, config);
  return resp.data.data;
}

/** Perform a POST and unwrap the envelope. */
export async function post<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const resp = await client.post<ApiResponse<T>>(url, body, config);
  return resp.data.data;
}

/** Perform a multipart form POST (file uploads). */
export async function postForm<T>(
  url: string,
  formData: FormData,
  config?: AxiosRequestConfig
): Promise<T> {
  const resp = await client.post<ApiResponse<T>>(url, formData, {
    ...config,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return resp.data.data;
}

/**
 * Download a binary file (PDF/CSV/Excel) from a POST endpoint.
 * Returns the Blob for triggering a browser download.
 */
export async function postDownload(url: string, body?: unknown): Promise<Blob> {
  const resp = await client.post(url, body, { responseType: "blob" });
  return resp.data as Blob;
}

export default client;
