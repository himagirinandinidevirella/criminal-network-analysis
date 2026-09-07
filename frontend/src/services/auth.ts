/**
 * Auth service — login, profile and role helpers.
 */
import { get, post } from "./api";
import type { LoginResponse, MeResponse, UserProfile } from "@/types/api.types";

export interface LoginPayload {
  badge_id: string;
  password: string;
  department?: string;
}

/** Authenticate and persist tokens. */
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const result = await post<LoginResponse>("/api/auth/login", payload);
  localStorage.setItem("crimenet_access_token", result.access_token);
  localStorage.setItem("crimenet_refresh_token", result.refresh_token);
  localStorage.setItem("crimenet_user", JSON.stringify(result.user_profile));
  return result;
}

/** Fetch the current user's profile and permissions. */
export function fetchMe(): Promise<MeResponse> {
  return get<MeResponse>("/api/auth/me");
}

/** Read the cached user profile from localStorage. */
export function getStoredUser(): UserProfile | null {
  const raw = localStorage.getItem("crimenet_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

/** Whether the user is currently authenticated. */
export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem("crimenet_access_token"));
}
