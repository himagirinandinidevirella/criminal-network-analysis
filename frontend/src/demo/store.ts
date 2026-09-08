import { sanitizeTrackingTrails } from "@/utils/cctvTrackingUtils";
import { seedDemoState } from "./data";
import { workspaceChanged } from "./events";
import type { DemoState } from "./types";

export const DEMO_STORAGE_KEY = "crimenet:demo-workspace:v1";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Each response is a copy: Redux freezes its payloads, not our source data. */
export class DemoRepository {
  constructor(private storage: StorageLike) {}

  read(): DemoState {
    const raw = this.storage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      try {
        const value = JSON.parse(raw) as DemoState;
        const arrays: Array<keyof DemoState> = [
          "people",
          "organizations",
          "locations",
          "vehicles",
          "accounts",
          "crimes",
          "transactions",
          "edges",
          "alerts",
          "rules",
          "notes",
          "evidence",
          "audit",
          "reports",
          "shares",
        ];
        if (
          value.version === 1 &&
          arrays.every((key) => Array.isArray(value[key])) &&
          value.people.every(
            (p) => typeof p.id === "string" && typeof p.risk_score === "number",
          )
        ) {
          value.cctv_trails = sanitizeTrackingTrails(value.cctv_trails);
          return value;
        }
      } catch {
        /* An incompatible/corrupt demo cache can safely be re-seeded. */
      }
    }
    const state = seedDemoState();
    this.save(state);
    return state;
  }

  save(state: DemoState): void {
    try {
      this.storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    } catch {
      throw new Error(
        "Browser storage is full or unavailable. Free some space or reset the demo workspace in Settings.",
      );
    }
  }

  update<T>(change: (state: DemoState) => T): T {
    const state = this.read();
    const result = change(state);
    this.save(state); // Do not report success or emit events before persistence succeeds.
    workspaceChanged();
    return structuredClone(result);
  }

  reset(): void {
    this.save(seedDemoState());
    workspaceChanged();
  }
}
let instance: DemoRepository | undefined;
export function demoRepository(): DemoRepository {
  return (instance ??= new DemoRepository(window.localStorage));
}

export function addAudit(
  state: DemoState,
  target_id: string,
  action: string,
  detail: string,
): void {
  state.audit.unshift({
    id: crypto.randomUUID(),
    target_id,
    action,
    detail,
    created_at: new Date().toISOString(),
  });
  state.audit = state.audit.slice(0, 200);
}

export async function sha256(input: string | ArrayBuffer): Promise<string> {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
