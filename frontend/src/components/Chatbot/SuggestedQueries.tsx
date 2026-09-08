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
      <p className="mt-4 border-t border-paper-line pt-3 text-[11px] text-ink-soft">
        Conversation history is temporary and clears when you leave this page.
      </p>
    </div>
  );
}
