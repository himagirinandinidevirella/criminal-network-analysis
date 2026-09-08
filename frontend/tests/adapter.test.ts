import axios from "axios";
import { beforeEach, describe, expect, it } from "vitest";
import { createDemoAdapter } from "@/demo/adapter";
import { DemoRepository, DEMO_STORAGE_KEY, sha256 } from "@/demo/store";
import { onDemoAlert } from "@/demo/events";
import { MemoryStorage } from "./setup";

let storage: MemoryStorage;
let repo: DemoRepository;
let api: ReturnType<typeof axios.create>;
beforeEach(() => {
  storage = new MemoryStorage();
  repo = new DemoRepository(storage);
  api = axios.create({
    adapter: createDemoAdapter(repo),
    headers: { Authorization: "Bearer demo-access-admin" },
  });
});
describe("demo API transport", () => {
  it("validates login and rejects unsupported features instead of faking success", async () => {
    await expect(
      api.post("/api/auth/login", {
        badge_id: "admin@crimenet.gov.in",
        password: "wrong",
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    const result = await api.post("/api/auth/login", {
      badge_id: "admin@crimenet.gov.in",
      password: "Admin@123",
    });
    expect(result.data.data.access_token).toBe("demo-access-admin");
    expect(result.data.data.user_profile).not.toHaveProperty("password");
    await expect(api.get("/api/unknown")).rejects.toMatchObject({
      response: { status: 501 },
    });
    await expect(
      api.get("/api/network/statistics", {
        headers: { Authorization: "Bearer real-jwt" },
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    const refreshed = await api.post("/api/auth/refresh", {
      refresh_token: "demo-refresh-admin",
    });
    expect(refreshed.data.data.access_token).toBe("demo-access-admin");
  });
  it("provides paginated search and real profile errors", async () => {
    const result = await api.post("/api/search/intelligent", {
      query: "",
      filters: { risk_level: "HIGH" },
      page: 1,
      limit: 2,
    });
    expect(result.data.data.items).toHaveLength(2);
    expect(result.data.data.total).toBeGreaterThan(2);
    await expect(api.get("/api/criminals/missing")).rejects.toMatchObject({
      response: { status: 404 },
    });
    expect((await api.get("/api/auth/me")).data.data.user_profile.role).toBe(
      "ADMIN",
    );
  });
  it("persists notes and review actions, isolates payloads, and resets only demo state", async () => {
    storage.setItem("crimenet_access_token", "production-value");
    await api.post("/api/actions/verify/shyam-verma", {});
    await api.post("/api/actions/flag/shyam-verma", {});
    const form = new FormData();
    form.append("note_content", "Synthetic follow-up");
    await api.post("/api/actions/notes/shyam-verma", form);
    const reloaded = new DemoRepository(storage).read();
    expect(reloaded.people.find((p) => p.id === "shyam-verma")).toMatchObject({
      verified: true,
      important_flag: true,
    });
    expect(reloaded.notes[0].content).toBe("Synthetic follow-up");
    Object.freeze(
      (await api.get("/api/criminals/shyam-verma")).data.data.person,
    );
    await api.post("/api/actions/flag/shyam-verma", {});
    await api.post("/api/demo/reset", {});
    expect(repo.read().notes).toHaveLength(0);
    expect(
      repo.read().people.find((p) => p.id === "shyam-verma")?.verified,
    ).toBe(false);
    expect(storage.getItem("crimenet_access_token")).toBe("production-value");
  });
  it("emits local alert events and handles assign/escalate/resolve", async () => {
    const events: number[] = [];
    const unsubscribe = onDemoAlert((alert) => events.push(alert.id));
    const { data } = await api.post("/api/demo/trigger-alert", {});
    expect(events).toEqual([data.data.id]);
    unsubscribe();
    const id = data.data.id;
    await api.post(`/api/alerts/${id}/assign`, { officer_id: "demo-officer" });
    await api.post(`/api/alerts/${id}/escalate`, {});
    expect(repo.read().alerts[0]).toMatchObject({
      assigned_to: "demo-officer",
      status: "ESCALATED",
    });
    await api.post(`/api/alerts/${id}/resolve`, {
      resolution_note: "Reviewed sample",
    });
    expect((await api.get("/api/alerts/active")).data.data).toHaveLength(5);
    expect((await api.get("/api/alerts/statistics")).data.data.total).toBe(6);
  });
  it("validates thresholds and note limits", async () => {
    await expect(
      api.post("/api/alerts/rules", {
        rule_type: "FINANCIAL_SPIKE",
        conditions: { threshold: 0 },
      }),
    ).rejects.toThrow("positive");
    await api.post("/api/alerts/rules", {
      rule_type: "FINANCIAL_SPIKE",
      conditions: { threshold: 20000 },
    });
    expect(repo.read().rules).toHaveLength(2);
    const form = new FormData();
    form.append("note_content", "x".repeat(4001));
    await expect(
      api.post("/api/actions/notes/raja-khan", form),
    ).rejects.toThrow("too long");
  });
  it("stores an actual checksum, never file contents, with a size limit", async () => {
    const form = new FormData();
    form.append("file", new File(["synthetic file"], "sample.txt"));
    const result = await api.post("/api/actions/evidence/raja-khan", form);
    expect(result.data.data.sha256).toBe(await sha256("synthetic file"));
    expect(repo.read().evidence[0].size).toBe(14);
    expect(JSON.stringify(repo.read().evidence)).not.toContain(
      "synthetic file",
    );
    const oversized = new FormData();
    oversized.append(
      "file",
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.bin"),
    );
    await expect(
      api.post("/api/actions/evidence/raja-khan", oversized),
    ).rejects.toThrow("5 MB");
  });
  it("saves immutable report snapshots and checks local preview access/expiry", async () => {
    const result = await api.post("/api/reports/criminal/raja-khan", {
      format: "JSON",
      sections: ["Personal Profile"],
      classification: "DEMO",
    });
    const report = JSON.parse(await result.data.text());
    expect(report.sections["Personal Profile"].name).toBe("Raja Khan");
    expect(Object.keys(report.sections)).toEqual(["Personal Profile"]);
    const form = new FormData();
    form.append("report_id", report.id);
    form.append("expiry_hours", "24");
    form.append("access_level", "VIEW");
    const response = await api.post("/api/actions/share", form);
    const token = response.data.data.share_url.split("/").pop();
    repo.update((s) => {
      s.people[0].name = "Changed record";
    });
    const preview = await api.get(`/api/public/report/${token}`, {
      headers: { Authorization: "" },
    });
    expect(preview.data.data.report.sections["Personal Profile"].name).toBe(
      "Raja Khan",
    );
    await expect(
      api.post(
        `/api/public/report/${token}/download`,
        {},
        { headers: { Authorization: "" } },
      ),
    ).rejects.toMatchObject({ response: { status: 403 } });
    repo.update((s) => {
      s.shares[0].access_level = "DOWNLOAD";
    });
    expect(
      (await api.post(`/api/public/report/${token}/download`)).data,
    ).toBeInstanceOf(Blob);
    repo.update((s) => {
      s.shares[0].expires_at = Date.now() - 1;
    });
    await expect(api.get(`/api/public/report/${token}`)).rejects.toMatchObject({
      response: { status: 404 },
    });
    expect(
      JSON.parse(
        await (await api.get(`/api/reports/${report.id}/download`)).data.text(),
      ).sections["Personal Profile"].name,
    ).toBe("Raja Khan");
  });
  it("answers supported questions and explains the limits of unsupported questions", async () => {
    const result = await api.post("/api/chat/message", {
      message: "Connect Raja Khan and Vikram Rao",
    });
    expect(result.data.data.intent).toBe("path");
    expect(result.data.data.data.hops).toBe(2);
    const unsupported = await api.post("/api/chat/message", {
      message: "Tell me tomorrow's arrest targets",
    });
    expect(unsupported.data.data.response).toContain("not an LLM");
  });
  it("recovers corrupt caches and reports storage failures", () => {
    storage.setItem(DEMO_STORAGE_KEY, "broken json");
    expect(repo.read().people).toHaveLength(40);
    const broken = new DemoRepository({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
    });
    expect(() => broken.read()).toThrow("storage is full or unavailable");
  });
});
