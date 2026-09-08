import type { Alert } from "@/types/alert.types";

const listeners = new Set<(alert: Alert) => void>();
export function onDemoAlert(listener: (alert: Alert) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function emitDemoAlert(alert: Alert): void {
  listeners.forEach((listener) => listener(structuredClone(alert)));
}
export const WORKSPACE_CHANGED = "crimenet:demo-workspace-changed";
export function workspaceChanged(): void {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(WORKSPACE_CHANGED));
}
