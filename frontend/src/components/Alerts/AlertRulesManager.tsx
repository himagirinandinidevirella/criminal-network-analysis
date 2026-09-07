/**
 * AlertRulesManager — create/list custom alert rules.
 */
import { useEffect, useState } from "react";
import { get, post } from "@/services/api";
import type { AlertRule } from "@/types/alert.types";
import { successToast } from "@/components/Common/ToastNotification";

interface Props {
  onClose: () => void;
}

const RULE_TYPES = ["FINANCIAL_SPIKE", "COMMUNICATION_SPIKE", "HOTSPOT_VISIT", "NEW_CONNECTION", "RISK_THRESHOLD"];

export default function AlertRulesManager({ onClose }: Props) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [ruleType, setRuleType] = useState(RULE_TYPES[0]);
  const [threshold, setThreshold] = useState("");

  useEffect(() => {
    get<AlertRule[]>("/api/alerts/rules").then(setRules).catch(() => setRules([]));
  }, []);

  const create = async () => {
    try {
      await post("/api/alerts/rules", {
        rule_type: ruleType,
        conditions: { threshold: Number(threshold) || 0 },
        notify_to: "",
      });
      successToast("Alert rule created");
      get<AlertRule[]>("/api/alerts/rules").then(setRules);
    } catch {
      successToast("Failed to create rule");
    }
  };

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Alert Rules</h3>
        <button onClick={onClose} className="text-xs text-text-muted hover:text-text-primary">Close</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={ruleType}
          onChange={(e) => setRuleType(e.target.value)}
          className="rounded-lg border border-border bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary"
        >
          {RULE_TYPES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <input
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          placeholder="Threshold"
          className="w-28 rounded-lg border border-border bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary placeholder-text-muted"
        />
        <button
          onClick={create}
          className="rounded-lg bg-accent-blue px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-seal-dark"
        >
          Add Rule
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {rules.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-lg bg-bg-tertiary px-3 py-2 text-xs">
            <span className="font-medium">{r.rule_name}</span>
            <span className={r.active ? "text-risk-low" : "text-text-muted"}>
              {r.active ? "Active" : "Inactive"}
            </span>
          </li>
        ))}
        {rules.length === 0 && (
          <li className="py-2 text-center text-xs text-text-muted">No rules configured yet.</li>
        )}
      </ul>
    </div>
  );
}
