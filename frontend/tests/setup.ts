import { beforeEach, vi } from "vitest";
import { webcrypto } from "node:crypto";

export class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
}
const storage = new MemoryStorage();
const browser = Object.assign(new EventTarget(), {
  location: { origin: "http://demo.test", pathname: "/login", assign: vi.fn() },
  localStorage: storage,
});
vi.stubGlobal("window", browser);
vi.stubGlobal("localStorage", storage);
vi.stubGlobal("crypto", webcrypto);
beforeEach(() => {
  storage.clear();
  vi.clearAllMocks();
});
