/**
 * SuggestedQueries — quick query chips + conversation history summary.
 */
import { Sparkles } from "lucide-react";

interface Props {
  onQuery: (q: string) => void;
}

const QUERIES = [
  "Who are Raja Khan's top associates?",
  "Connect Raja Khan and Vikram Rao",
  "Top 5 highest risk criminals",
  "Show suspicious transactions",
  "Crime hotspots",
  "Which gangs are active?",
  "Profile of Raja Khan",
];

export default function SuggestedQueries({ onQuery }: Props) {
  return (
    <div className="glass hidden w-64 flex-col overflow-y-auto rounded-2xl p-4 lg:flex">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-accent-cyan" /> Suggested Queries
      </h3>
      <div className="space-y-2">
        {QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => onQuery(q)}
            className="w-full rounded-lg bg-bg-tertiary px-3 py-2 text-left text-xs text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
          >
            {q}
          </button>
        ))}
      </div>
      <div className="mt-4 border-t border-border pt-3">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Conversation History
        </h4>
        <ul className="space-y-1 text-[11px] text-text-muted">
          <li>• Today (3)</li>
          <li>• Yesterday (7)</li>
          <li>• 2 days ago (4)</li>
        </ul>
      </div>
    </div>
  );
}
