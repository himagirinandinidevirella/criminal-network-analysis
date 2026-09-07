/**
 * useRealTimeAlerts — real-time alert effects (sound, flash, toast, browser
 * notification). Self-subscribes to the alert WebSocket stream so any mounted
 * instance reacts the moment a new alert is broadcast.
 */
import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import type { Alert } from "@/types/alert.types";
import { alertSocket } from "@/services/websocket";

interface Options {
  onAlert?: (alert: Alert) => void;
  sound?: boolean;
}

/**
 * React to newly received alerts: play a sound for critical alerts, flash a
 * red overlay, show a toast, and emit a browser notification when permitted.
 */
export function useRealTimeAlerts({ onAlert, sound = true }: Options = {}): {
  handleAlert: (alert: Alert) => void;
} {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  useEffect(() => {
    audioRef.current = new Audio("/assets/sounds/alert.mp3");
    // The sound file is optional — degrade gracefully if missing.
    audioRef.current.onerror = () => {
      /* no-op */
    };
  }, []);

  useEffect(() => {
    alertSocket.connect();
    const unsubscribe = alertSocket.onAlert((alert) => {
      // Toast notification.
      toast(`${alert.severity}: ${alert.title}`, {
        icon: alert.severity === "CRITICAL" ? "🚨" : "⚠️",
        style: {
          background: alert.severity === "CRITICAL" ? "#5E1610" : "#1B2530",
          color: "#FCFAF5",
          border: alert.severity === "CRITICAL" ? "1px solid #B3261E" : "1px solid #DDD5C2",
        },
      });

      // Sound for critical/high alerts.
      if (sound && (alert.severity === "CRITICAL" || alert.severity === "HIGH")) {
        audioRef.current?.play().catch(() => {
          /* autoplay may be blocked; ignore */
        });
      }

      // Red flash overlay for critical alerts.
      if (alert.severity === "CRITICAL") {
        const overlay = document.createElement("div");
        overlay.style.cssText =
          "position:fixed;inset:0;background:rgba(239,68,68,0.3);z-index:9999;pointer-events:none;animation:flashRed 0.5s ease-in-out;";
        document.body.appendChild(overlay);
        setTimeout(() => overlay.remove(), 600);
      }

      // Browser notification (requires permission).
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`CrimeNet AI — ${alert.severity} alert`, {
          body: alert.title,
        });
      }

      onAlertRef.current?.(alert);
    });
    return unsubscribe;
  }, [sound]);

  return {
    handleAlert: (alert: Alert) => {
      onAlertRef.current?.(alert);
    },
  };
}
