/**
 * WebSocket service — real-time alert stream (socket.io-client).
 */
import { io, type Socket } from "socket.io-client";
import type { Alert } from "@/types/alert.types";
import { API_BASE_URL } from "./api";

type AlertListener = (alert: Alert) => void;

class AlertSocket {
  private socket: Socket | null = null;
  private listeners = new Set<AlertListener>();

  /** Connect (if a token exists) and wire up alert listeners. */
  connect(): void {
    const token = localStorage.getItem("crimenet_access_token");
    if (!token || this.socket) return;
    this.socket = io(API_BASE_URL, {
      path: "/ws/alerts",
      transports: ["websocket"],
      auth: { token },
    });
    this.socket.on("connect", () => {
      console.info("[ws] connected to alert stream");
    });
    this.socket.on("alert.new", (payload: { data: Alert }) => {
      this.listeners.forEach((fn) => fn(payload.data));
    });
    this.socket.on("alert.subscription", (payload: { data: Alert }) => {
      this.listeners.forEach((fn) => fn(payload.data));
    });
    this.socket.on("disconnect", () => {
      console.info("[ws] disconnected");
    });
  }

  /** Subscribe to alerts for specific criminal ids. */
  subscribe(criminalIds: string[]): void {
    this.socket?.emit("subscribe", { criminal_ids: criminalIds });
  }

  /** Register a listener; returns an unsubscribe function. */
  onAlert(listener: AlertListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const alertSocket = new AlertSocket();
