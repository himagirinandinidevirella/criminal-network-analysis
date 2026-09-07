/**
 * ChatMessage — a single chat bubble with optional follow-up chips.
 */
import { Bot, User, Network } from "lucide-react";

interface Props {
  role: "user" | "assistant";
  content: string;
  followUps?: string[];
  onFollowUp?: (q: string) => void;
  onViewNetwork?: () => void;
}

export default function ChatMessage({ role, content, followUps, onFollowUp, onViewNetwork }: Props) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          isUser ? "bg-seal-soft text-seal" : "bg-paper-sunk text-teal"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
            isUser ? "bg-seal text-ink-onred" : "bg-paper-sunk text-text-primary"
          }`}
        >
          {content}
        </div>

        {!isUser && onViewNetwork && (
          <button
            onClick={onViewNetwork}
            className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-accent-cyan hover:underline"
          >
            <Network className="h-3.5 w-3.5" /> View in Network Map
          </button>
        )}

        {!isUser && followUps && followUps.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {followUps.map((q) => (
              <button
                key={q}
                onClick={() => onFollowUp?.(q)}
                className="rounded-full border border-border px-3 py-1 text-[11px] text-text-secondary transition hover:bg-bg-hover"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
