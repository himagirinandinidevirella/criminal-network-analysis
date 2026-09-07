/**
 * CrimeTimeline — full-screen interactive timeline of network events.
 */
import { useEffect, useState } from "react";
import { Play, Pause } from "lucide-react";
import { get } from "@/services/api";
import type { TimelineEvent } from "@/types/criminal.types";
import EventCard from "./EventCard";

interface Props {
  criminalId?: string;
}

export default function CrimeTimeline({ criminalId }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const url = criminalId
      ? `/api/criminals/${criminalId}/timeline`
      : "/api/criminals/raja-khan/timeline";
    get<{ events: TimelineEvent[] }>(url)
      .then((r) => setEvents(r.events))
      .catch(() => setEvents([]));
  }, [criminalId]);

  // Play animation: reveal events one at a time.
  useEffect(() => {
    if (!playing || events.length === 0) return;
    if (index >= events.length) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIndex((i) => i + 1), 700);
    return () => clearTimeout(t);
  }, [playing, index, events.length]);

  const visible = events.slice(0, playing ? index : events.length);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Investigation Timeline</h3>
        <button
          onClick={() => {
            setPlaying((p) => !p);
            if (index >= events.length) setIndex(0);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-accent-blue px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-seal-dark"
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {playing ? "Pause" : "Play evolution"}
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-xs text-text-muted">No timeline events.</p>
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-5">
          {visible.map((e, i) => (
            <EventCard key={i} event={e} />
          ))}
        </ol>
      )}
    </div>
  );
}
