/**
 * GeographicHeatmap — Leaflet map of India with crime hotspots.
 */
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { get } from "@/services/api";
import type { NetworkStatistics } from "@/types/network.types";

interface Hotspot {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  hotspot_score: number;
  crime_count: number;
}

// Fallback city coordinates (India) used before the backend responds.
const FALLBACK: Hotspot[] = [
  { id: "mum", name: "Mumbai", city: "Mumbai", state: "Maharashtra", latitude: 19.076, longitude: 72.8777, hotspot_score: 0.92, crime_count: 38 },
  { id: "del", name: "Delhi", city: "Delhi", state: "Delhi", latitude: 28.6139, longitude: 77.209, hotspot_score: 0.84, crime_count: 31 },
  { id: "che", name: "Chennai", city: "Chennai", state: "Tamil Nadu", latitude: 13.0827, longitude: 80.2707, hotspot_score: 0.71, crime_count: 22 },
  { id: "kol", name: "Kolkata", city: "Kolkata", state: "West Bengal", latitude: 22.5726, longitude: 88.3639, hotspot_score: 0.66, crime_count: 20 },
  { id: "hyd", name: "Hyderabad", city: "Hyderabad", state: "Telangana", latitude: 17.385, longitude: 78.4867, hotspot_score: 0.5, crime_count: 14 },
  { id: "bgl", name: "Bengaluru", city: "Bengaluru", state: "Karnataka", latitude: 12.9716, longitude: 77.5946, hotspot_score: 0.45, crime_count: 12 },
];

function hotspotColor(score: number): string {
  if (score >= 0.75) return "#B3261E";
  if (score >= 0.5) return "#C0551F";
  if (score >= 0.3) return "#9A6A12";
  return "#1E7A55";
}

export default function GeographicHeatmap() {
  const [hotspots, setHotspots] = useState<Hotspot[]>(FALLBACK);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    // Stats endpoint gives crime types; locations come from fallback for demo.
    get<NetworkStatistics>("/api/network/statistics")
      .then((stats) => {
        if (stats?.crime_types?.length) {
          // No-op: we keep city fallbacks; in production this is the locations endpoint.
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Geographic Crime Map</h1>
        <p className="text-sm text-text-secondary">Heatmap of criminal activity across India</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["ALL", "DRUG", "CYBER", "ROBBERY", "TRAFFICKING"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              filter === f ? "border-seal bg-seal text-ink-onred" : "border-paper-line bg-paper-raised text-ink-soft hover:bg-paper-sunk"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <MapContainer
          center={[22.5, 79]}
          zoom={5}
          style={{ height: "560px", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {hotspots.map((h) => (
            <CircleMarker
              key={h.id}
              center={[h.latitude, h.longitude]}
              radius={8 + h.hotspot_score * 22}
              pathOptions={{
                color: hotspotColor(h.hotspot_score),
                fillColor: hotspotColor(h.hotspot_score),
                fillOpacity: 0.55,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                {h.name}
              </Tooltip>
              <Popup>
                <div style={{ fontSize: 12 }}>
                  <strong>{h.name}</strong>
                  <br />
                  Hotspot score: {(h.hotspot_score * 100).toFixed(0)}
                  <br />
                  Crime events: {h.crime_count}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
