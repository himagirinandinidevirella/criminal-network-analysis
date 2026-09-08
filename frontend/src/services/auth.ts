import { SESSION_KEYS } from "@/config/runtime";
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
  localStorage.setItem(SESSION_KEYS.access, result.access_token);
  localStorage.setItem(SESSION_KEYS.refresh, result.refresh_token);
  localStorage.setItem(SESSION_KEYS.user, JSON.stringify(result.user_profile));
  return result;
}

/** Fetch the current user's profile and permissions. */
export function fetchMe(): Promise<MeResponse> {
  return get<MeResponse>("/api/auth/me");
}

/** Read the cached user profile from localStorage. */
export function getStoredUser(): UserProfile | null {
  const raw = localStorage.getItem(SESSION_KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

/** Whether the user is currently authenticated. */
export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem(SESSION_KEYS.access));
}
