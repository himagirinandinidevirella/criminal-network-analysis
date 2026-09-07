/**
 * CrimeHotspots — ranked list of hotspot cities (companion to the map).
 */
import { MapPin } from "lucide-react";

interface Hotspot {
  id: string;
  name: string;
  hotspot_score: number;
  crime_count: number;
}

interface Props {
  hotspots: Hotspot[];
}

export default function CrimeHotspots({ hotspots }: Props) {
  return (
    <div className="glass rounded-2xl p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <MapPin className="h-4 w-4 text-risk-critical" /> Crime Hotspots
      </h3>
      <ol className="space-y-2">
        {hotspots.map((h, i) => (
          <li key={h.id} className="flex items-center gap-3 rounded-lg bg-bg-tertiary px-3 py-2">
            <span className="text-sm font-bold text-text-muted">#{i + 1}</span>
            <div className="flex-1">
              <p className="text-xs font-medium">{h.name}</p>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-bg-hover">
                <div
                  className="h-full rounded-full bg-risk-critical"
                  style={{ width: `${h.hotspot_score * 100}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-text-muted">{h.crime_count} cases</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
