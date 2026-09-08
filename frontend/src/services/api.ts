/** Same-origin API client. Browser demo is an explicit, isolated transport. */
import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
} from "axios";
import type { ApiResponse } from "@/types/api.types";
import { IS_DEMO, SESSION_KEYS } from "@/config/runtime";

export const API_BASE_URL = IS_DEMO ? "" : import.meta.env.VITE_API_URL || "";
const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
  ...(IS_DEMO
    ? {
        adapter: async (config) =>
          (await import("@/demo/adapter")).demoAdapter(config),
      }
    : {}),
});
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(SESSION_KEYS.access);
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

/** Prefer the server's useful error rather than "Request failed with status...". */
export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data;
    if (body && typeof body === "object" && !(body instanceof Blob)) {
      if (typeof body.detail === "string") return body.detail;
      if (typeof body.message === "string") return body.message;
      if (Array.isArray(body.detail))
        return body.detail
          .map((d: { msg?: string }) => d.msg)
          .filter(Boolean)
          .join("; ");
    }
  }
  return error instanceof Error
    ? error.message
    : "Request failed. Please try again.";
}

let refreshPromise: Promise<string> | null = null;
client.interceptors.response.use(
  (response) => {
    if (response.data?.success === false)
      throw new Error(
        response.data.message || response.data.error || "Request failed",
      );
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    // Invalid credentials should stay on the form, never loop through refresh.
    const authRequest = /\/api\/auth\/(login|refresh)/.test(
      original?.url ?? "",
    );
    if (
      original &&
      error.response?.status === 401 &&
      !authRequest &&
      !original._retry
    ) {
      original._retry = true;
      const refresh = localStorage.getItem(SESSION_KEYS.refresh);
      if (refresh) {
        try {
          refreshPromise ??= client
            .post<ApiResponse<{ access_token: string }>>("/api/auth/refresh", {
              refresh_token: refresh,
            })
            .then((resp) => {
              const token = resp.data.data.access_token;
              if (!token) throw new Error("Invalid refresh response");
              localStorage.setItem(SESSION_KEYS.access, token);
              return token;
            })
            .finally(() => {
              refreshPromise = null;
            });
          const token = await refreshPromise;
          original.headers = {
            ...original.headers,
            Authorization: `Bearer ${token}`,
          };
          return client(original);
        } catch {
          /* Clear only this mode's session. */
        }
      }
      clearSession();
      if (window.location.pathname !== "/login")
        window.location.assign("/login");
    }
    return Promise.reject(error);
  },
);

export function clearSession(): void {
  Object.values(SESSION_KEYS).forEach((key) => localStorage.removeItem(key));
}
export async function get<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  return (await client.get<ApiResponse<T>>(url, config)).data.data;
}
export async function post<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return (await client.post<ApiResponse<T>>(url, body, config)).data.data;
}
export async function postForm<T>(
  url: string,
  formData: FormData,
  config?: AxiosRequestConfig,
): Promise<T> {
  return (
    await client.post<ApiResponse<T>>(url, formData, {
      ...config,
      headers: { ...config?.headers, "Content-Type": "multipart/form-data" },
    })
  ).data.data;
}
export async function postDownload(url: string, body?: unknown): Promise<Blob> {
  return (await client.post<Blob>(url, body, { responseType: "blob" })).data;
}
export async function getDownload(url: string): Promise<Blob> {
  return (await client.get<Blob>(url, { responseType: "blob" })).data;
}
export default client;
