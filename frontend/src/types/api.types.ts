/**
 * Shared API envelope and auth types.
 */

/** Standard API response envelope used by every backend endpoint. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message: string;
  error: string | null;
  timestamp: string;
}

/** Paginated list payload. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export type Role = "ADMIN" | "SENIOR_OFFICER" | "OFFICER" | "ANALYST" | "VIEWER";

export interface UserProfile {
  id: number | string;
  badge_id: string;
  name: string;
  role: Role;
  department?: string | null;
  email?: string | null;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user_profile: UserProfile;
  role: Role;
}

export interface Permissions {
  view_all: boolean;
  edit_all: boolean;
  delete_records: boolean;
  generate_reports: boolean;
  manage_users: boolean;
  view_audit_logs: boolean;
}

export interface MeResponse {
  user_profile: UserProfile;
  permissions: Permissions;
}

/** Chatbot message and response. */
export interface ChatMessage {
  message: string;
  session_id?: string;
  context?: unknown[];
}

export interface ChatResponse {
  response: string;
  data: unknown;
  follow_ups: string[];
  intent: string;
  timestamp: string;
}
