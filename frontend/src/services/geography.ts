import { get } from "./api";
import { IS_DEMO } from "@/config/runtime";
import type { GraphData } from "@/types/network.types";

export interface Hotspot {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  hotspot_score: number;
  crime_count: number;
}
/** Demo counts are computed from fixture cases; backend mode reads actual graph nodes. */
export async function fetchHotspots(crimeType = ""): Promise<Hotspot[]> {
  const endpoint = `/api/network/locations?crime_type=${encodeURIComponent(crimeType)}`;
  if (IS_DEMO) return get<Hotspot[]>(endpoint);
  try {
    // Fast path: dedicated hotspots endpoint (one lightweight Cypher query).
    return await get<Hotspot[]>(endpoint);
  } catch (err) {
    // Fallback for older backends without /api/network/locations: derive
    // hotspots from the full graph. If this also fails, the error propagates
    // so the map shows its load-failure state.
    const graph = await get<GraphData>(
      `/api/network/full?limit=20000&crime_type=${encodeURIComponent(crimeType)}`,
    );
    if (graph.nodes.length === 0) throw err;
    return graph.nodes
      .filter((n) => n.data.label === "Location")
      .map(({ data: n }) => ({
        id: n.id,
        name: String(n.name ?? n.city ?? "Location"),
        city: String(n.city ?? ""),
        state: String(n.state ?? ""),
        latitude: Number(n.latitude),
        longitude: Number(n.longitude),
        hotspot_score: Number(n.hotspot_score ?? 0),
        crime_count: Number(n.crime_count ?? 0),
      }))
      .filter((h) => Number.isFinite(h.latitude) && Number.isFinite(h.longitude))
      .sort((a, b) => b.crime_count - a.crime_count);
  }
}
