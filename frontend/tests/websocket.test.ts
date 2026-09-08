import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", () => ({
  IS_DEMO: false,
  SESSION_KEYS: { access: "crimenet_access_token" },
}));
vi.mock("@/services/api", () => ({ API_BASE_URL: "" }));
import { alertSocket } from "@/services/websocket";

class NativeSocketDouble {
  static OPEN = 1;
  static instances: NativeSocketDouble[] = [];
  readyState = 0;
  onopen?: () => void;
  onclose?: () => void;
  onmessage?: (event: { data: string }) => void;
  onerror?: () => void;
  send = vi.fn();
  constructor(public url: string) {
    NativeSocketDouble.instances.push(this);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}
const removers: Array<() => void> = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", NativeSocketDouble);
  NativeSocketDouble.instances = [];
  localStorage.setItem("crimenet_access_token", "test-token");
});
afterEach(() => {
  removers.splice(0).forEach((remove) => remove());
  alertSocket.disconnect();
  vi.useRealTimers();
});

it("uses FastAPI's native WebSocket URL and JSON subscribe protocol", () => {
  removers.push(alertSocket.onAlert(vi.fn()));
  alertSocket.connect();
  alertSocket.subscribe(["raja-khan"]);
  const socket = NativeSocketDouble.instances[0];
  expect(socket.url).toBe("ws://demo.test/ws/alerts?token=test-token");
  socket.open();
  expect(socket.send).toHaveBeenCalledWith(
    JSON.stringify({ type: "subscribe", criminal_ids: ["raja-khan"] }),
  );
});

it("delivers typed alerts once, despite targeted and broadcast duplicates", () => {
  const listener = vi.fn();
  removers.push(alertSocket.onAlert(listener));
  alertSocket.connect();
  const socket = NativeSocketDouble.instances[0];
  socket.open();
  socket.onmessage?.({ data: "not json" });
  socket.onmessage?.({ data: JSON.stringify({ type: "pong" }) });
  const alert = { id: 42, title: "Test alert" };
  socket.onmessage?.({
    data: JSON.stringify({ type: "alert.subscription", data: alert }),
  });
  socket.onmessage?.({
    data: JSON.stringify({ type: "alert.new", data: alert }),
  });
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith(alert);
});

it("reconnects with backoff and reads the latest access token", async () => {
  removers.push(alertSocket.onAlert(vi.fn()));
  alertSocket.connect();
  NativeSocketDouble.instances[0].open();
  NativeSocketDouble.instances[0].close();
  localStorage.setItem("crimenet_access_token", "refreshed-token");
  await vi.advanceTimersByTimeAsync(1000);
  expect(NativeSocketDouble.instances).toHaveLength(2);
  expect(NativeSocketDouble.instances[1].url).toContain(
    "token=refreshed-token",
  );
});

it("cleans up socket and timers when the last subscriber leaves", () => {
  const remove = alertSocket.onAlert(vi.fn());
  alertSocket.connect();
  const socket = NativeSocketDouble.instances[0];
  socket.open();
  expect(vi.getTimerCount()).toBe(1);
  remove();
  expect(socket.readyState).toBe(3);
  expect(vi.getTimerCount()).toBe(0);
});
