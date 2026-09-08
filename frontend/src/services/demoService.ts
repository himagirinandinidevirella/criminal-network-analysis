/**
 * demoService — backend helpers used by the guided demo tour.
 */
import { get, post } from "./api";

/** Locate a criminal by name via the intelligent search endpoint. */
export async function findCriminalIdByName(
  name: string,
): Promise<string | null> {
  try {
    const res = await post<{ items: Array<Record<string, unknown>> }>(
      "/api/search/intelligent",
      { query: name, filters: {}, page: 1, limit: 5 },
    );
    const person = res.items.find(
      (r) =>
        r.kind === "Person" &&
        String(r.name).toLowerCase() === name.toLowerCase(),
    );
    return (person?.id as string) ?? null;
  } catch {
    return null;
  }
}

/** Trigger a sample alert (local event bus in standalone mode, WebSocket in backend mode). */
export async function triggerDemoAlert(): Promise<void> {
  await post("/api/demo/trigger-alert", {});
}

/** Check whether the synthetic dataset is seeded (demo readiness). */
export async function demoStatus(): Promise<{
  data_seeded: boolean;
  persons: number;
  ready: boolean;
}> {
  return get("/api/demo/status");
}

/** Send a chat message through the AI assistant. */
export async function sendDemoChat(
  message: string,
): Promise<{ response: string; follow_ups: string[] }> {
  return post("/api/chat/message", {
    message,
    session_id: `demo-${Date.now()}`,
    context: [],
  });
}
