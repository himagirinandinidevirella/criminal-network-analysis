/** Native WebSocket transport matching FastAPI (not the Socket.IO protocol). */
import type { Alert, WsAlertMessage } from "@/types/alert.types";
import { API_BASE_URL } from "./api";
import { IS_DEMO, SESSION_KEYS } from "@/config/runtime";
import { onDemoAlert } from "@/demo/events";

type AlertListener = (alert: Alert) => void;
class AlertSocket {
  private socket: WebSocket | null = null;
  private listeners = new Set<AlertListener>();
  private subscriptions = new Set<string>();
  private demoUnsubscribe: (() => void) | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private attempts = 0;
  private seen = new Set<number>();

  private deliver(alert: Alert): void {
    // FastAPI sends both a targeted event and a broadcast to subscribers.
    if (!alert || this.seen.has(alert.id)) return;
    this.seen.add(alert.id);
    if (this.seen.size > 500)
      this.seen.delete(this.seen.values().next().value!);
    this.listeners.forEach((fn) => fn(alert));
  }

  connect(): void {
    const token = localStorage.getItem(SESSION_KEYS.access);
    if (!token) return;
    if (IS_DEMO) {
      this.demoUnsubscribe ??= onDemoAlert((alert) => this.deliver(alert));
      return;
    }
    if (this.socket || this.retry) return;
    const url = new URL("/ws/alerts", API_BASE_URL || window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("token", token);
    const socket = new WebSocket(url.toString());
    this.socket = socket;
    socket.onopen = () => {
      this.attempts = 0;
      if (this.subscriptions.size)
        this.send({ type: "subscribe", criminal_ids: [...this.subscriptions] });
      this.heartbeat = setInterval(() => this.send({ type: "ping" }), 25000);
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WsAlertMessage;
        if (
          message.type === "alert.new" ||
          message.type === "alert.subscription"
        )
          this.deliver(message.data);
      } catch {
        /* Ignore malformed/unrelated messages. */
      }
    };
    socket.onclose = () => {
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = null;
      if (this.socket !== socket) return;
      this.socket = null;
      if (this.listeners.size && localStorage.getItem(SESSION_KEYS.access)) {
        this.retry = setTimeout(
          () => {
            this.retry = null;
            this.connect();
          },
          Math.min(30000, 1000 * 2 ** this.attempts++),
        );
      }
    };
    socket.onerror = () => socket.close();
  }
  private send(payload: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(payload));
  }
  subscribe(criminalIds: string[]): void {
    criminalIds.forEach((id) => this.subscriptions.add(id));
    this.send({ type: "subscribe", criminal_ids: criminalIds });
  }
  onAlert(listener: AlertListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) this.disconnect();
    };
  }
  disconnect(): void {
    if (this.retry) clearTimeout(this.retry);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.retry = null;
    this.heartbeat = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.demoUnsubscribe?.();
    this.demoUnsubscribe = null;
    this.subscriptions.clear();
    this.seen.clear();
  }
}
export const alertSocket = new AlertSocket();
