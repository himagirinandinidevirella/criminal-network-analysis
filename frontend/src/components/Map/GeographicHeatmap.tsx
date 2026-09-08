/** Local coordinate view by default; the optional OSM layer requires internet. */
import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { IS_DEMO } from "@/config/runtime";
import { fetchHotspots, type Hotspot } from "@/services/geography";
import CrimeHotspots from "./CrimeHotspots";

const FILTERS = [
  "All",
  "Drug Trafficking",
  "Money Laundering",
  "Cyber Crime",
  "Extortion",
  "Robbery",
];
const color = (score: number) =>
  score >= 0.75 ? "#B3261E" : score >= 0.5 ? "#C0551F" : "#9A6A12";
export default function GeographicHeatmap() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [filter, setFilter] = useState("All");
  const [basemap, setBasemap] = useState(!IS_DEMO);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchHotspots(filter === "All" ? "" : filter)
      .then((data) => {
        if (!cancelled) setHotspots(data.filter((h) => h.crime_count > 0));
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Could not load locations. Please check the data connection.",
          );
          setHotspots([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Geographic Crime Map
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {IS_DEMO
            ? "Fictional case locations — not a real crime heatmap. Marker size reflects sample case counts."
            : "Location records from the knowledge graph."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={f === filter}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${f === filter ? "border-seal bg-seal text-white" : "border-paper-line text-ink-soft hover:bg-paper-sunk"}`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-ink-soft">
        <p role="status">
          {loading
            ? "Updating locations…"
            : `${hotspots.reduce((sum, h) => sum + h.crime_count, 0)} case records across ${hotspots.length} locations`}
        </p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={basemap}
            onChange={(e) => setBasemap(e.target.checked)}
            className="accent-seal"
          />
          OpenStreetMap basemap (requires internet)
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-risk-critical">
          {error}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-4">
        <div className="glass overflow-hidden rounded-2xl xl:col-span-3">
          <MapContainer
            center={[22.5, 79]}
            zoom={5}
            style={{
              height: "520px",
              width: "100%",
              backgroundImage: "radial-gradient(#cfc5b0 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
            scrollWheelZoom
          >
            {basemap && (
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            )}
            {hotspots.map((h) => (
              <CircleMarker
                key={h.id}
                center={[h.latitude, h.longitude]}
                radius={8 + h.hotspot_score * 16}
                pathOptions={{
                  color: color(h.hotspot_score),
                  fillColor: color(h.hotspot_score),
                  fillOpacity: 0.55,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]} permanent={!basemap}>
                  {h.city || h.name}
                </Tooltip>
                <Popup>
                  <div className="text-xs">
                    <strong>{h.name}</strong>
                    <p>
                      {IS_DEMO ? "Synthetic case records" : "Crime records"}:{" "}
                      {h.crime_count}
                    </p>
                    <p>
                      {h.latitude.toFixed(3)}° N, {h.longitude.toFixed(3)}° E
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
          {!basemap && (
            <p className="border-t border-paper-line px-4 py-2 text-[11px] text-ink-soft">
              Offline coordinate view · drag to pan, +/− to zoom · basemap
              optional
            </p>
          )}
        </div>
        <CrimeHotspots hotspots={hotspots} />
      </div>
    </div>
  );
}
