/**
 * AgencyShareManager — grant, verify and revoke time-boxed inter-agency access
 * (STATE_POLICE, CBI, NIA, COURT, INTERPOL, CUSTOMS, NCB).
 */
import { useState } from "react";
import { Share2, ShieldCheck, ShieldOff, KeyRound } from "lucide-react";
import {
  grantShare, verifyShare, revokeShare, getDataPermissions,
} from "@/services/blockchainService";
import { successToast, errorToast } from "@/components/Common/ToastNotification";
import type { AccessLevel, AgencyName, SharePermission } from "@/types/blockchain.types";

const AGENCIES: AgencyName[] = ["STATE_POLICE", "CBI", "NIA", "COURT", "INTERPOL", "CUSTOMS", "NCB"];
const LEVELS: AccessLevel[] = ["READ_ONLY", "FULL_ACCESS", "ANALYSIS_ONLY"];

export default function AgencyShareManager() {
  const [dataId, setDataId] = useState("");
  const [dataType, setDataType] = useState("CRIMINAL");
  const [toAgency, setToAgency] = useState<AgencyName>("CBI");
  const [fromAgency, setFromAgency] = useState("STATE_POLICE");
  const [level, setLevel] = useState<AccessLevel>("READ_ONLY");
  const [hours, setHours] = useState(24);
  const [purpose, setPurpose] = useState("Joint investigation");
  const [permissionId, setPermissionId] = useState("");
  const [checkResult, setCheckResult] = useState<string>("");
  const [permissions, setPermissions] = useState<SharePermission[]>([]);
  const [busy, setBusy] = useState(false);

  const grant = async () => {
    if (!dataId) {
      errorToast("Provide a data id");
      return;
    }
    setBusy(true);
    try {
      const res = await grantShare({
        data_id: dataId,
        data_type: dataType,
        to_agency: toAgency,
        from_agency: fromAgency,
        access_level: level,
        duration_hours: hours,
        purpose,
      });
      successToast(`Access granted to ${res.to_agency}`);
      setPermissionId(res.permission_id);
      loadPermissions(dataId);
    } catch {
      errorToast("Grant failed");
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    if (!permissionId) return;
    try {
      const res = await verifyShare(permissionId);
      setCheckResult(res.hasAccess ? `ACCESS GRANTED (${res.level})` : "ACCESS DENIED / EXPIRED");
      successToast(res.hasAccess ? "Permission valid" : "Permission invalid");
    } catch {
      errorToast("Check failed");
    }
  };

  const revoke = async () => {
    if (!permissionId) return;
    try {
      await revokeShare(permissionId, "Revoked by officer");
      successToast("Access revoked");
      setCheckResult("REVOKED");
      if (dataId) loadPermissions(dataId);
    } catch {
      errorToast("Revoke failed");
    }
  };

  const loadPermissions = async (id: string) => {
    try {
      const res = await getDataPermissions(id);
      setPermissions(res.permissions);
    } catch {
      setPermissions([]);
    }
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <Share2 className="h-5 w-5 text-accent-cyan" />
        <h3 className="text-sm font-semibold">Inter-Agency Sharing</h3>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          value={dataId}
          onChange={(e) => setDataId(e.target.value)}
          placeholder="Data ID (criminal/case)"
          className="col-span-2 rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <input
          value={dataType}
          onChange={(e) => setDataType(e.target.value)}
          placeholder="Data type"
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <input
          type="number"
          min={1}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          title="Duration (hours)"
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select
          value={fromAgency}
          onChange={(e) => setFromAgency(e.target.value)}
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        >
          {AGENCIES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={toAgency}
          onChange={(e) => setToAgency(e.target.value as AgencyName)}
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        >
          {AGENCIES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as AccessLevel)}
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        >
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <input
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Purpose"
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={grant}
          disabled={busy || !dataId}
          className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-seal-dark disabled:opacity-50"
        >
          {busy ? "Granting…" : "Grant access"}
        </button>
        <button
          onClick={() => dataId && loadPermissions(dataId)}
          disabled={!dataId}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-hover disabled:opacity-50"
        >
          <KeyRound className="h-4 w-4" /> List permissions
        </button>
      </div>

      {/* Permission check/revoke */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={permissionId}
          onChange={(e) => setPermissionId(e.target.value)}
          placeholder="Permission ID (0x…)"
          className="flex-1 rounded-lg border border-border bg-bg-tertiary px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <button
          onClick={check}
          disabled={!permissionId}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-2 text-sm text-accent-cyan transition hover:bg-accent-cyan/20 disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4" /> Check
        </button>
        <button
          onClick={revoke}
          disabled={!permissionId}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-risk-critical/40 bg-risk-critical/10 px-3 py-2 text-sm text-risk-critical transition hover:bg-risk-critical/20 disabled:opacity-50"
        >
          <ShieldOff className="h-4 w-4" /> Revoke
        </button>
      </div>

      {checkResult && (
        <p className="mb-3 rounded-lg bg-bg-tertiary/60 p-2 text-center text-xs font-semibold text-text-primary">
          {checkResult}
        </p>
      )}

      {permissions.length > 0 && (
        <ul className="space-y-1.5">
          {permissions.map((p) => (
            <li key={p.permissionId} className="rounded-lg border border-border/60 bg-bg-tertiary/50 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-text-primary">{p.fromAgency} → {p.toAgency}</span>
                <span className="rounded-full bg-seal-soft px-2 py-0.5 text-[10px] text-seal">{p.accessLevel}</span>
                <span className={p.isActive ? "text-risk-low" : "text-risk-critical"}>
                  {p.isActive ? "ACTIVE" : "REVOKED"}
                </span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-text-muted">
                {p.permissionId.slice(0, 30)}… · expires {p.formattedExpiry || "—"} · accesses {p.accessCount}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
