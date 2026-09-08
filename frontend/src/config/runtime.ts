/** Demo is opt-in at build/start time, never an automatic API-error fallback. */
export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === "true";

// Demo credentials must never be sent to the real backend after changing modes.
const prefix = IS_DEMO ? "crimenet_demo" : "crimenet";
export const SESSION_KEYS = {
  access: `${prefix}_access_token`,
  refresh: `${prefix}_refresh_token`,
  user: `${prefix}_user`,
} as const;
