import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { fetchHotspots, type Hotspot } from "@/services/geography";
import { IS_DEMO } from "@/config/runtime";

export default function GeographicSummary() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetchHotspots()
      .then(setHotspots)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  return (
    <section className="glass rounded-2xl p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <MapPin className="h-4 w-4 text-teal" />
        {IS_DEMO ? "Sample Case Locations" : "Top Hotspots"}
      </h2>
      {loading ? (
        <p className="py-6 text-center text-xs text-ink-soft">
          Loading locations…
        </p>
      ) : failed ? (
        <p className="text-xs text-risk-critical">
          Location data is unavailable.
        </p>
      ) : !hotspots.length ? (
        <p className="text-xs text-ink-soft">No location records.</p>
      ) : (
        <ul className="space-y-3">
          {hotspots.slice(0, 5).map((h) => (
            <li key={h.id}>
              <div className="mb-1 flex justify-between gap-2 text-xs">
                <span className="text-ink-soft">{h.name}</span>
                <span className="shrink-0 text-ink-faint">
                  {h.crime_count} cases
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-paper-sunk">
                <div
                  className="h-full rounded-full bg-teal"
                  style={{
                    width: `${Math.max(0, Math.min(100, h.hotspot_score * 100))}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/map"
        className="mt-4 inline-block text-xs font-semibold text-teal"
      >
        Open geographic view →
      </Link>
    </section>
  );
}
