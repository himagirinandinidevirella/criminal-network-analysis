/**
 * Alert types.
 */

export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Alert {
  id: number;
  title: string;
  description: string;
  severity: AlertSeverity;
  category: string;
  criminal_id?: string | null;
  criminal_name?: string | null;
  source: string;
  status: string;
  assigned_to?: string | null;
  resolution?: string | null;
  created_at?: string;
}

export interface AlertStats {
  total?: number;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
}

export interface AlertRule {
  id: number;
  rule_name: string;
  conditions_json: string;
  notify_to?: string | null;
  active: boolean;
  created_by?: string | null;
  created_at?: string;
}

/** WebSocket alert payload types. */
export type WsAlertMessage =
  | { type: "alert.new"; data: Alert }
  | { type: "alert.subscription"; data: Alert }
  | { type: "subscribed" | "unsubscribed"; data: string[] }
  | { type: "pong" };
