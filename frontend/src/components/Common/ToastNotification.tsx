/**
 * ToastNotification — thin wrapper around react-hot-toast for consistent usage.
 */
import toast from "react-hot-toast";

const BASE = {
  borderRadius: "8px",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: "12px",
  color: "#FCFAF5",
  background: "#1B2530",
} as const;

export function successToast(message: string): void {
  toast.success(message, {
    style: { ...BASE, border: "1px solid #1E7A55" },
  });
}

export function errorToast(message: string): void {
  toast.error(message, {
    style: { ...BASE, border: "1px solid #B3261E" },
  });
}

export function infoToast(message: string): void {
  toast(message, {
    icon: "ℹ️",
    style: { ...BASE, border: "1px solid #DDD5C2" },
  });
}

export default { successToast, errorToast, infoToast };
