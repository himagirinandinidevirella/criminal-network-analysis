import { IS_DEMO } from "@/config/runtime";
/**
 * InvestigatorChatbot — the CrimeNet AI assistant chat interface.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bot, Send, Mic, Paperclip } from "lucide-react";
import { post } from "@/services/api";
import type { ChatResponse } from "@/types/api.types";
import ChatMessage from "./ChatMessage";
import SuggestedQueries from "./SuggestedQueries";

interface Message {
  role: "user" | "assistant";
  content: string;
  followUps?: string[];
  data?: unknown;
}

const WELCOME: Message = {
  role: "assistant",
  content: IS_DEMO
    ? "Welcome! I am a rule-based demo helper, not an LLM. I can look up the fictional graph: try profiles, associates, paths, sample scores, transactions or networks. Do not enter real case or personal data."
    : "Hello! I can help query the network and review records. What would you like to find?",
  followUps: [
    "Top 5 highest risk criminals",
    "Detected gangs",
    "Suspicious transactions",
  ],
};

export default function InvestigatorChatbot() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoQuery = searchParams.get("q");
  const didAutoSend = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  // Support deep-linking (e.g. demo mode navigates to /chat?q=…).
  useEffect(() => {
    if (autoQuery && !didAutoSend.current) {
      didAutoSend.current = true;
      send(autoQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoQuery]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || typing) return;
    setMessages((m) => [...m, { role: "user", content }]);
    setInput("");
    setTyping(true);
    try {
      // Local-LLM answers can take 30-45s on CPU; the 30s axios default
      // aborts mid-generation and shows "couldn't reach the analysis engine".
      const res = await post<ChatResponse>("/api/chat/message", {
        message: content,
        session_id: sessionId,
        context: [],
      }, { timeout: 120000 });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.response,
          followUps: res.follow_ups,
          data: res.data,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't reach the analysis engine. Please try again.",
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="flex min-h-[480px] h-[calc(100dvh-15rem)] gap-4">
      {/* Chat panel */}
      <div className="glass flex flex-1 flex-col overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Bot className="h-5 w-5 text-accent-blue" />
          <div>
            <h1 className="text-sm font-bold">
              {IS_DEMO ? "CrimeNet Demo Assistant" : "CrimeNet AI Assistant"}
            </h1>
            <p className="text-[11px] text-teal">
              {IS_DEMO
                ? "Local rule-based queries · synthetic data only"
                : "Network query assistant"}
            </p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <ChatMessage
              key={i}
              role={m.role}
              content={m.content}
              followUps={m.followUps}
              onFollowUp={(q) => send(q)}
              onViewNetwork={() => navigate("/network")}
            />
          ))}
          {typing && (
            <div className="flex items-center gap-1 text-text-muted">
              <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted" />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-text-muted"
                style={{ animationDelay: "0.15s" }}
              />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-text-muted"
                style={{ animationDelay: "0.3s" }}
              />
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2 border-t border-border p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question…"
            aria-label="Question"
            maxLength={2000}
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
          />
          <button
            type="submit"
            disabled={typing || !input.trim()}
            className="rounded-lg disabled:opacity-50 bg-accent-blue p-2 text-white transition hover:bg-seal-dark"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Suggested queries rail */}
      <SuggestedQueries onQuery={send} />
    </div>
  );
}
