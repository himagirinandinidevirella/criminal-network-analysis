/**
 * IntelligentSearch — search across entities + FIR auto-analysis workflow.
 */
import { useEffect, useRef, useState } from "react";
import { Search, FileSearch, Loader2 } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import { analyzeFir } from "@/store/criminalSlice";
import { get, post } from "@/services/api";
import type { Criminal, FIRAnalysisResult } from "@/types/criminal.types";
import type { Paginated } from "@/types/api.types";
import SearchResults from "./SearchResults";
import AdvancedFilters from "./AdvancedFilters";
import CriminalCard from "@/components/Criminal/CriminalCard";
import { errorToast } from "@/components/Common/ToastNotification";

interface Props {
  initialQuery?: string;
}

const SAMPLE_FIR = `FIR No: 042/2024
Raja Khan, aged 38, of Dharavi, Mumbai, is the leader of the Mumbai Drug Syndicate. He was seen in a black BMW MH-01-AX-9999 with Shyam Verma. A suspicious transfer of Rs. 45,00,000 from account XXXX1234 at State Bank of India (IFSC SBIN0001234) was flagged. Meena Patil manages hawala operations.`;

import AutoInvestigator from "./AutoInvestigator";
import { Sparkles } from "lucide-react";

export default function IntelligentSearch({ initialQuery = "" }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const firResult = useSelector((state: RootState) => state.criminal.firResult);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"investigator" | "search" | "fir">(
    initialQuery ? "search" : "investigator"
  );
  const [firText, setFirText] = useState(SAMPLE_FIR);
  const [firLoading, setFirLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (initialQuery) {
      setMode("search");
      runSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const runSearch = async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await post<{ items: Array<Record<string, unknown>> }>("/api/search/intelligent", {
        query: q,
        filters: {},
        page: 1,
        limit: 30,
      });
      setResults(res.items);
    } catch {
      errorToast("Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryChange = (q: string) => {
    setQuery(q);
    clearTimeout(debounceRef.current);
    // Debounced search (300ms).
    debounceRef.current = setTimeout(() => runSearch(q), 300);
  };

  const runFir = async () => {
    if (!firText.trim()) return;
    setFirLoading(true);
    try {
      await dispatch(analyzeFir({ fir_text: firText, language: "en" })).unwrap();
    } catch {
      errorToast("FIR analysis failed");
    } finally {
      setFirLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Investigation Command Center</h1>
        <p className="text-sm text-text-secondary">
          Autonomous forensic evidence analysis, biometric matching, and multi-hop syndicate correlation
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setMode("investigator")}
          className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition ${
            mode === "investigator"
              ? "border-seal bg-seal text-ink-onred"
              : "border-paper-line bg-paper-raised text-ink-soft hover:bg-paper-sunk"
          }`}
        >
          <Sparkles className="h-4 w-4" /> Autonomous AI Investigator (AFIS & IDs)
        </button>
        <button
          onClick={() => setMode("search")}
          className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition ${
            mode === "search"
              ? "border-seal bg-seal text-ink-onred"
              : "border-paper-line bg-paper-raised text-ink-soft hover:bg-paper-sunk"
          }`}
        >
          <Search className="h-4 w-4" /> Database Entity Search
        </button>
        <button
          onClick={() => setMode("fir")}
          className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition ${
            mode === "fir"
              ? "border-seal bg-seal text-ink-onred"
              : "border-paper-line bg-paper-raised text-ink-soft hover:bg-paper-sunk"
          }`}
        >
          <FileSearch className="h-4 w-4" /> Graph Extraction Pipeline
        </button>
      </div>

      {mode === "investigator" ? (
        <AutoInvestigator />
      ) : mode === "search" ? (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search by name, alias, vehicle registration, account, location…"
              className="w-full rounded-xl border border-border bg-bg-tertiary py-3 pl-10 pr-3 text-sm text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
              autoFocus
            />
          </div>
          <AdvancedFilters onApply={(filters) => runSearch(query)} />
          {loading && (
            <div className="flex justify-center py-6 text-text-muted">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          <SearchResults results={results} />
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="glass rounded-2xl p-4">
            <h3 className="mb-3 text-sm font-semibold">FIR Document</h3>
            <textarea
              value={firText}
              onChange={(e) => setFirText(e.target.value)}
              rows={14}
              className="w-full rounded-xl border border-border bg-bg-tertiary p-3 font-mono text-xs text-text-primary focus:border-accent-blue focus:outline-none"
            />
            <button
              onClick={runFir}
              disabled={firLoading}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-blue py-2.5 text-sm font-semibold text-white transition hover:bg-seal-dark disabled:opacity-50"
            >
              {firLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
              ANALYZE FIR
            </button>
          </div>

          <div className="space-y-4">
            {firResult && (
              <div className="glass rounded-2xl p-4">
                <h3 className="mb-3 text-sm font-semibold">Extracted Entities</h3>
                <div className="space-y-2">
                  {(["PERSON", "LOCATION", "ORGANIZATION", "VEHICLE", "ACCOUNT"] as const).map((type) => {
                    const entities = firResult.entities.filter((e) => e.type === type);
                    if (entities.length === 0) return null;
                    return (
                      <div key={type} className="rounded-lg bg-bg-tertiary p-3">
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-accent-cyan">
                          {type}s ({entities.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {entities.slice(0, 8).map((e, i) => (
                            <span
                              key={i}
                              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-secondary"
                            >
                              {e.text}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {Object.keys(firResult.created).length > 0 && (
                  <p className="mt-3 text-xs text-risk-low">
                    ✅ Graph updated: {Object.entries(firResult.created).map(([k, v]) => `${k} ×${v}`).join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* Related criminals */}
            <div className="glass rounded-2xl p-4">
              <h3 className="mb-3 text-sm font-semibold">Linked Persons</h3>
              <RelatedCriminals />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Loads a few high-risk criminals to link the FIR to the graph. */
function RelatedCriminals() {
  const [items, setItems] = useState<Criminal[]>([]);
  useEffect(() => {
    get<Paginated<Criminal>>("/api/criminals/?limit=4&sort_by=risk_score")
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, []);
  return (
    <div className="space-y-2">
      {items.map((c) => (
        <CriminalCard key={c.id} criminal={c} />
      ))}
      {items.length === 0 && <p className="py-2 text-xs text-text-muted">No linked persons</p>}
    </div>
  );
}
