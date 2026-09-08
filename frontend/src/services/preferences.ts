import { IS_DEMO } from "@/config/runtime";
export interface AlertPreferences {
  toasts: boolean;
  sound: boolean;
  browser: boolean;
}
const KEY = IS_DEMO
  ? "crimenet:demo-alert-preferences"
  : "crimenet:alert-preferences";
export function getAlertPreferences(): AlertPreferences {
  try {
    return {
      toasts: true,
      sound: false,
      browser: false,
      ...JSON.parse(localStorage.getItem(KEY) || "{}"),
    };
  } catch {
    return { toasts: true, sound: false, browser: false };
  }
}
export function saveAlertPreferences(value: AlertPreferences): void {
  localStorage.setItem(KEY, JSON.stringify(value));
}
export async function enableBrowserNotifications(): Promise<
  NotificationPermission | "unsupported"
> {
  if (!("Notification" in window)) return "unsupported";
  const permission = await Notification.requestPermission();
  saveAlertPreferences({
    ...getAlertPreferences(),
    browser: permission === "granted",
  });
  return permission;
}
