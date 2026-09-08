import { CCTVTrackingError, handleCCTVTracking } from "./cctvTracking";
/**
 * Opt-in Axios adapter for the standalone demo. Never falls through to a server.
 * All mutations stay in this browser; roles and tokens are a UI demonstration,
 * NOT authentication or a security boundary.
 */
import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from "axios";
import type { Alert } from "@/types/alert.types";
import type { ChatResponse } from "@/types/api.types";
import type { ReportRequest } from "@/services/exportService";
import { DEMO_ACCOUNTS, DEMO_NOTICE } from "./data";
import { DEMO_CCTV_CAMERAS } from "./cctv";
import { formatPlaybackTime, LOCAL_CCTV_SOURCE } from "@/utils/cctvUtils";
import {
  communities,
  extractFir,
  fullGraph,
  hotspots,
  matchesPerson,
  profile,
  search,
  shortestPath,
  statistics,
  whatIf,
} from "./analysis";
import { addAudit, demoRepository, DemoRepository, sha256 } from "./store";
import { emitDemoAlert } from "./events";
import { buildReport, renderReport } from "./reports";
import type {
  DemoReportType,
  DemoShare,
  DemoState,
  ReportFormat,
} from "./types";

class DemoError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
const required = (value: unknown, field: string, maxLength = 12000): string => {
  if (typeof value !== "string" || !value.trim())
    throw new DemoError(`${field} is required`);
  if (value.length > maxLength) throw new DemoError(`${field} is too long`);
  return value.trim();
};
const paginate = <T>(items: T[], page: unknown, limit: unknown) => {
  const p = Math.max(1, Math.floor(Number(page) || 1));
  const l = Math.min(1000, Math.max(1, Math.floor(Number(limit) || 30)));
  return {
    items: items.slice((p - 1) * l, p * l),
    total: items.length,
    page: p,
    limit: l,
    pages: Math.ceil(items.length / l),
  };
};
function findShare(state: DemoState, token: string): DemoShare {
  // A permanent, explicitly synthetic sample for the no-login landing page.
  if (token === "demo-token-2025")
    return {
      token,
      access_level: "VIEW",
      expires_at: Infinity,
      report: buildReport(state, "executive", "", {
        format: "JSON",
        classification: "SYNTHETIC DEMO",
      }),
    };
  const share = state.shares.find(
    (s) => s.token === token && s.expires_at > Date.now(),
  );
  if (!share)
    throw new DemoError(
      "This local preview link is invalid or has expired. Demo links only work in the browser that created them.",
      404,
    );
  return share;
}
function answer(state: DemoState, message: string): ChatResponse {
  const q = message.toLowerCase();
  const mentioned = state.people.filter((p) =>
    q.includes(p.name.toLowerCase()),
  );
  let response: string;
  let data: unknown = null;
  let intent = "help";
  if (mentioned.length >= 2 && /connect|path|between/.test(q)) {
    const path = shortestPath(
      fullGraph(state),
      mentioned[0].id,
      mentioned[1].id,
    );
    response = path.found
      ? `The shortest path in the synthetic graph is ${path.nodes.map((n) => n.name).join(" → ")} (${path.hops} hops). A graph connection alone does not imply wrongdoing.`
      : "No path was found within six hops.";
    data = path;
    intent = "path";
  } else if (mentioned.length && /associate|connection/.test(q)) {
    const p = profile(state, mentioned[0].id);
    response = `${p.person.name}'s direct associates in the fixture:\n${p.associates
      .slice(0, 8)
      .map((a) => `• ${a.name} — ${a.relation.replace(/_/g, " ")}`)
      .join("\n")}`;
    data = p.associates;
    intent = "associates";
  } else if (/top|highest|risk/.test(q)) {
    const people = [...state.people]
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 5);
    response = `Five highest sample scores:\n${people.map((p, i) => `${i + 1}. ${p.name}: ${p.risk_score}/100`).join("\n")}\nThese scores are seeded examples, not predictions about real people.`;
    data = people;
    intent = "risk";
  } else if (/gang|network|communit/.test(q)) {
    const groups = communities(state);
    response = `The fixture contains these seeded networks (not a Louvain result):\n${groups.map((g) => `• ${g.name}: ${g.size} members`).join("\n")}`;
    data = groups;
    intent = "communities";
  } else if (/transaction|financial|transfer/.test(q)) {
    const transactions = state.transactions.filter((t) => t.flagged);
    response = `${transactions.length} transfers are flagged in the sample data:\n${transactions.map((t) => `• ${t.name}: INR ${t.amount.toLocaleString("en-IN")} (${t.from_account} → ${t.to_account})`).join("\n")}\nNo live bank accounts are connected.`;
    data = transactions;
    intent = "transactions";
  } else if (/hotspot|location|city/.test(q)) {
    const locations = hotspots(state);
    response = `Fictional case counts by location:\n${locations.map((l) => `• ${l.name}: ${l.crime_count} cases`).join("\n")}\nThis is not a real crime heatmap.`;
    data = locations;
    intent = "hotspots";
  } else if (mentioned.length) {
    const p = profile(state, mentioned[0].id);
    response = `${p.person.name} (${p.person.criminal_id}) is a fictional record based in ${p.person.address}.\nSample score: ${p.risk.score}/100.\n${p.associates.length} direct associates, ${p.accounts.length} accounts and ${p.crimes.length} sample case records.`;
    data = p;
    intent = "profile";
  } else {
    response =
      "I am a local, rule-based demo assistant, not an LLM. I can look up the synthetic graph: try a named person's profile or associates, a path between two people, top sample scores, transactions, gangs, or hotspots. I cannot predict crimes, match biometrics, or investigate real people.";
  }
  return {
    response,
    data,
    intent,
    follow_ups: [
      "Who are Raja Khan's top associates?",
      "Connect Raja Khan and Vikram Rao",
      "Crime hotspots",
    ],
    timestamp: new Date().toISOString(),
  };
}

async function handle(
  repo: DemoRepository,
  config: InternalAxiosRequestConfig,
) {
  const url = new URL(config.url ?? "/", window.location.origin);
  Object.entries(config.params ?? {}).forEach(([key, value]) =>
    url.searchParams.set(key, String(value)),
  );
  const path = url.pathname.replace(/\/$/, "");
  const method = (config.method ?? "get").toUpperCase();
  let body: Record<string, unknown> = {};
  if (config.data instanceof FormData)
    body = Object.fromEntries(config.data.entries());
  else if (typeof config.data === "string" && config.data) {
    try {
      body = JSON.parse(config.data);
    } catch {
      throw new DemoError("Invalid JSON request");
    }
  } else if (config.data && typeof config.data === "object") body = config.data;
  const query = Object.fromEntries(url.searchParams.entries());
  const state = repo.read();

  if (method === "GET" && path === "/health")
    return {
      status: "demo",
      storage: "This browser only",
      data: "Synthetic fixtures",
      models: "Not connected",
      face_detection: "Opt-in browser-local Tiny Face Detector",
      blockchain: "Not connected",
      version: "1.0.0-demo",
    };
  if (method === "POST" && path === "/api/auth/login") {
    const account = DEMO_ACCOUNTS.find(
      (a) =>
        a.badge_id === String(body.badge_id).trim().toLowerCase() &&
        a.password === body.password,
    );
    if (!account)
      throw new DemoError(
        "Badge or password is incorrect. Use one of the documented demo accounts.",
        401,
      );
    const { password: _password, ...user } = account;
    return {
      access_token: `demo-access-${user.id}`,
      refresh_token: `demo-refresh-${user.id}`,
      role: user.role,
      user_profile: {
        ...user,
        department: String(body.department || "Demo workspace"),
        email: user.badge_id,
      },
    };
  }
  if (method === "POST" && path === "/api/auth/refresh") {
    const account = DEMO_ACCOUNTS.find(
      (a) => `demo-refresh-${a.id}` === body.refresh_token,
    );
    if (!account)
      throw new DemoError("Demo session expired. Sign in again.", 401);
    return { access_token: `demo-access-${account.id}` };
  }
  const publicMatch = path.match(
    /^\/api\/public\/report\/([^/]+)(\/download)?$/,
  );
  if (publicMatch) {
    const share = findShare(state, publicMatch[1]);
    if (method === "POST" && publicMatch[2]) {
      if (share.access_level !== "DOWNLOAD")
        throw new DemoError("This preview is view-only", 403);
      return renderReport({ ...share.report, format: "JSON" });
    }
    if (method === "GET" && !publicMatch[2])
      return {
        report_id: share.report.id,
        access_level: share.access_level,
        watermarked: true,
        notice: `${DEMO_NOTICE} This is a local snapshot, not a secure public sharing service.`,
        report: share.report,
      };
  }

  const token = String(config.headers.get("Authorization") ?? "").replace(
    /^Bearer /,
    "",
  );
  const account = DEMO_ACCOUNTS.find((a) => `demo-access-${a.id}` === token);
  if (!account) throw new DemoError("Sign in to the demo workspace first", 401);
  const { password: _password, ...user } = account;
  if (
    path === "/api/demo/cctv/trails" ||
    path.startsWith("/api/demo/cctv/trails/")
  )
    return handleCCTVTracking(repo, method, path, body, user.name);
  const ensurePerson = (id: string) => {
    if (!state.people.some((p) => p.id === id))
      throw new DemoError("Person not found", 404);
  };
  const active = () => state.alerts.filter((a) => a.status !== "RESOLVED");

  if (method === "GET") {
    if (path === "/api/auth/me")
      return {
        user_profile: { ...user, department: "Demo workspace" },
        permissions: {
          view_all: true,
          edit_all: true,
          delete_records: false,
          generate_reports: true,
          manage_users: false,
          view_audit_logs: true,
        },
      };
    if (path === "/api/network/full") return fullGraph(state, query);
    if (path === "/api/network/statistics") return statistics(state);
    if (path === "/api/network/communities") return communities(state);
    if (path === "/api/network/locations")
      return hotspots(state, query.crime_type);
    if (path === "/api/criminals") {
      const people = state.people
        .filter((p) => matchesPerson(p, query))
        .sort((a, b) =>
          query.sort_by === "name"
            ? a.name.localeCompare(b.name)
            : b.risk_score - a.risk_score,
        );
      return paginate(people, query.page, query.limit);
    }
    const personRoute = path.match(/^\/api\/criminals\/([^/]+)(\/timeline)?$/);
    if (personRoute) {
      const id = personRoute[1];
      ensurePerson(id);
      if (personRoute[2])
        return {
          events: state.crimes
            .filter((c) => c.person_ids.includes(id))
            .map((c) => ({
              date: c.date,
              kind: "CRIME",
              label: c.crime_type,
              detail: c.description,
              case_number: c.case_number,
            })),
        };
      return profile(state, id);
    }
    if (path === "/api/alerts/active") return active();
    if (path === "/api/alerts/history") return state.alerts;
    if (path === "/api/alerts/statistics")
      return {
        total: state.alerts.length,
        ...Object.fromEntries(
          ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((severity) => [
            severity.toLowerCase(),
            active().filter((a) => a.severity === severity).length,
          ]),
        ),
      };
    if (path === "/api/alerts/rules") return state.rules;
    if (path === "/api/reports/history")
      return state.reports.map(({ sections: _sections, ...r }) => ({
        ...r,
        file_url: `/api/reports/${r.id}/download`,
      }));
    const download = path.match(/^\/api\/reports\/([^/]+)\/download$/);
    if (download) {
      const report = state.reports.find((r) => r.id === download[1]);
      if (!report)
        throw new DemoError("Report no longer exists in this workspace", 404);
      return renderReport(report);
    }
    if (path === "/api/search/saved") return [];
    if (path === "/api/demo/status")
      return {
        mode: "browser-demo",
        notice: DEMO_NOTICE,
        data_seeded: true,
        persons: state.people.length,
        ready: true,
        ...statistics(state),
      };
    if (path === "/api/demo/cases") return state.crimes;
    if (path === "/api/demo/cctv/cameras") return DEMO_CCTV_CAMERAS;
    const workspace = path.match(/^\/api\/demo\/workspace(?:\/([^/]+))?$/);
    if (workspace)
      return {
        notes: state.notes.filter(
          (n) => !workspace[1] || n.criminal_id === workspace[1],
        ),
        evidence: state.evidence.filter(
          (e) => !workspace[1] || e.criminal_id === workspace[1],
        ),
        audit: state.audit.filter(
          (a) => !workspace[1] || a.target_id === workspace[1],
        ),
      };
  }
  if (method === "POST") {
    if (path === "/api/network/path")
      return shortestPath(
        fullGraph(state),
        required(body.from_id, "From person"),
        required(body.to_id, "To person"),
      );
    if (path === "/api/network/whatif")
      return whatIf(state, required(body.criminal_id, "Person"));
    if (path === "/api/search/intelligent")
      return paginate(
        search(
          state,
          String(body.query ?? ""),
          (body.filters as Record<string, unknown>) ?? {},
        ),
        body.page,
        body.limit,
      );
    if (path === "/api/criminals/analyze-fir")
      return extractFir(state, required(body.fir_text, "FIR text", 30000));
    if (path === "/api/chat/message")
      return answer(state, required(body.message, "Message", 2000));
    if (path === "/api/demo/reset") {
      repo.reset();
      return { reset: true };
    }
    if (path === "/api/demo/cctv/flag") {
      const cameraId = required(body.camera_id, "Camera ID", 50);
      const camera = DEMO_CCTV_CAMERAS.find((item) => item.id === cameraId);
      if (!camera && cameraId !== LOCAL_CCTV_SOURCE)
        throw new DemoError("Camera not found", 404);
      if (camera && camera.status !== "AVAILABLE")
        throw new DemoError("This camera has no available footage to flag");
      const playback = body.playback_seconds;
      if (
        typeof playback !== "number" ||
        !Number.isFinite(playback) ||
        playback < 0 ||
        playback > 604800
      )
        throw new DemoError("Invalid playback time");
      const note = required(body.note, "Review note", 500);
      if (note.length < 3)
        throw new DemoError("Review note must be at least 3 characters");
      if (body.severity !== "MEDIUM" && body.severity !== "HIGH")
        throw new DemoError("Choose Medium or High review priority");
      const viewId =
        body.view_id == null ? "" : required(body.view_id, "View ID", 50);
      if (viewId && !DEMO_CCTV_CAMERAS.some((camera) => camera.id === viewId))
        throw new DemoError("Invalid camera view");
      const name = camera?.name ?? "Local demo recording";
      const alert = repo.update((s) => {
        const alert: Alert = {
          id: Math.max(0, ...s.alerts.map((a) => a.id)) + 1,
          title: `CCTV review: ${name}`,
          description: `${viewId ? viewId + " / " : ""}${cameraId} · At ${formatPlaybackTime(playback)}. ${note}\nManually flagged in the synthetic demo. No automated identity matching or crime classification was performed.`,
          severity: body.severity as "MEDIUM" | "HIGH",
          category: "CCTV",
          criminal_id: null,
          criminal_name: null,
          source: "Manual CCTV review (demo)",
          status: "ACTIVE",
          created_at: new Date().toISOString(),
        };
        s.alerts.unshift(alert);
        s.alerts = s.alerts.slice(0, 200);
        addAudit(
          s,
          cameraId,
          "CCTV_REVIEW_FLAGGED",
          `${user.name} flagged ${name} at ${formatPlaybackTime(playback)} for manual review. No footage was stored.`,
        );
        return alert;
      });
      emitDemoAlert(alert);
      return alert;
    }
    if (path === "/api/demo/trigger-alert") {
      const alert = repo.update((s) => {
        const alert: Alert = {
          id: Math.max(0, ...s.alerts.map((a) => a.id)) + 1,
          title: "Simulated financial alert",
          description:
            "A manually triggered fictional transfer event. This is a local event, not a live monitoring stream.",
          severity: "CRITICAL",
          category: "FINANCIAL",
          criminal_id: "raja-khan",
          criminal_name: "Raja Khan",
          source: "Manual demo event",
          status: "ACTIVE",
          created_at: new Date().toISOString(),
        };
        s.alerts.unshift(alert);
        s.alerts = s.alerts.slice(0, 200);
        return alert;
      });
      emitDemoAlert(alert);
      return alert;
    }
    const alertAction = path.match(
      /^\/api\/alerts\/(\d+)\/(resolve|assign|escalate)$/,
    );
    if (alertAction)
      return repo.update((s) => {
        const alert = s.alerts.find((a) => a.id === Number(alertAction[1]));
        if (!alert) throw new DemoError("Alert not found", 404);
        if (alertAction[2] === "resolve") {
          alert.status = "RESOLVED";
          alert.resolution = required(body.resolution_note, "Resolution note");
        }
        if (alertAction[2] === "assign") {
          alert.assigned_to = String(body.officer_id || user.name);
        }
        if (alertAction[2] === "escalate") {
          alert.status = "ESCALATED";
          alert.severity = "CRITICAL";
        }
        addAudit(
          s,
          String(alert.id),
          `ALERT_${alertAction[2].toUpperCase()}`,
          user.name,
        );
        return alert;
      });
    if (path === "/api/alerts/rules")
      return repo.update((s) => {
        const threshold = Number(
          (body.conditions as { threshold?: number })?.threshold,
        );
        if (!Number.isFinite(threshold) || threshold <= 0)
          throw new DemoError("Threshold must be a positive number");
        const rule = {
          id: Math.max(0, ...s.rules.map((r) => r.id)) + 1,
          rule_name: required(body.rule_type, "Rule type"),
          conditions_json: JSON.stringify({ threshold }),
          active: true,
          created_by: user.name,
          created_at: new Date().toISOString(),
        };
        s.rules.unshift(rule);
        s.rules = s.rules.slice(0, 100);
        return rule;
      });
    const action = path.match(
      /^\/api\/actions\/(verify|flag|notes|evidence)\/([^/]+)$/,
    );
    if (action) {
      const [, kind, id] = action;
      ensurePerson(id);
      if (kind === "evidence") {
        const file = body.file;
        if (!(file instanceof File) || !file.size)
          throw new DemoError("Select a non-empty file");
        if (file.size > 5 * 1024 * 1024)
          throw new DemoError("The demo file limit is 5 MB");
        const digest = await sha256(await file.arrayBuffer());
        return repo.update((s) => {
          const evidence = {
            id: crypto.randomUUID(),
            criminal_id: id,
            file_name: file.name,
            size: file.size,
            sha256: digest,
            created_at: new Date().toISOString(),
          };
          s.evidence.unshift(evidence);
          s.evidence = s.evidence.slice(0, 100);
          addAudit(
            s,
            id,
            "CHECKSUM_RECORDED",
            `${file.name} — SHA-256 ${digest}. File contents were not stored.`,
          );
          return evidence;
        });
      }
      return repo.update((s) => {
        const person = s.people.find((p) => p.id === id)!;
        if (kind === "verify") person.verified = true;
        if (kind === "flag") person.important_flag = true;
        if (kind === "notes") {
          const content = required(body.note_content, "Note", 4000);
          s.notes.unshift({
            id: crypto.randomUUID(),
            criminal_id: id,
            content,
            officer: user.name,
            created_at: new Date().toISOString(),
          });
          s.notes = s.notes.slice(0, 200);
        }
        person.updated_at = new Date().toISOString();
        addAudit(
          s,
          id,
          kind.toUpperCase(),
          `${user.name} updated a synthetic record locally.`,
        );
        return {
          criminal_id: id,
          verified: person.verified,
          important_flag: person.important_flag,
        };
      });
    }
    const reportRoute = path.match(
      /^\/api\/reports\/(criminal|network|case|executive)(?:\/([^/]+))?$/,
    );
    if (reportRoute) {
      const format = String(body.format || "PDF");
      if (!["PDF", "CSV", "EXCEL", "JSON"].includes(format))
        throw new DemoError("Unsupported report format");
      const request: ReportRequest = {
        format: format as ReportFormat,
        classification: String(body.classification || "SYNTHETIC DEMO"),
        sections: body.sections as string[] | undefined,
      };
      const report = buildReport(
        state,
        reportRoute[1] as DemoReportType,
        reportRoute[2] ?? "",
        request,
      );
      const blob = await renderReport(report);
      repo.update((s) => {
        s.reports.unshift(report);
        s.reports = s.reports.slice(0, 20);
        addAudit(s, report.entity_id, "REPORT_CREATED", report.title);
      });
      return blob;
    }
    if (path === "/api/actions/share") {
      const id = required(body.report_id, "Report or person ID");
      const report =
        state.reports.find((r) => r.id === id) ??
        buildReport(state, "criminal", id, {
          format: "JSON",
          classification: "SYNTHETIC DEMO",
        });
      const hours = Number(body.expiry_hours || 24);
      if (![24, 168, 720].includes(hours))
        throw new DemoError("Choose a valid expiry");
      if (!["VIEW", "DOWNLOAD"].includes(String(body.access_level)))
        throw new DemoError("Choose a valid access level");
      const share: DemoShare = {
        token: crypto.randomUUID(),
        report: structuredClone(report),
        access_level: body.access_level as "VIEW" | "DOWNLOAD",
        expires_at: Date.now() + hours * 3600000,
      };
      repo.update((s) => {
        s.shares.unshift(share);
        s.shares = s.shares
          .filter((s) => s.expires_at > Date.now())
          .slice(0, 30);
      });
      return {
        share_url: `${window.location.origin}/public/report/${share.token}`,
      };
    }
  }
  throw new DemoError(
    `This feature is not available in the browser demo (${method} ${path}). Use the full backend for this integration.`,
    501,
  );
}

export function createDemoAdapter(repository?: DemoRepository): AxiosAdapter {
  return async (config) => {
    try {
      const result = await handle(repository ?? demoRepository(), config);
      return {
        config,
        status: 200,
        statusText: "OK",
        headers: new AxiosHeaders(),
        data:
          result instanceof Blob
            ? result
            : {
                success: true,
                data: structuredClone(result),
                message: "Browser demo",
                error: null,
                timestamp: new Date().toISOString(),
              },
      };
    } catch (error) {
      const status =
        error instanceof DemoError || error instanceof CCTVTrackingError
          ? error.status
          : 400;
      const message =
        error instanceof Error ? error.message : "Demo request failed";
      throw new AxiosError(message, "ERR_DEMO_REQUEST", config, undefined, {
        config,
        status,
        statusText: message,
        headers: new AxiosHeaders(),
        data: {
          success: false,
          data: null,
          message,
          error: message,
          detail: message,
        },
      });
    }
  };
}
export const demoAdapter = createDemoAdapter();
