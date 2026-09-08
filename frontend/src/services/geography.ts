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
  if (IS_DEMO)
    return get<Hotspot[]>(
      `/api/network/locations?crime_type=${encodeURIComponent(crimeType)}`,
    );
  const graph = await get<GraphData>(
    `/api/network/full?limit=20000&crime_type=${encodeURIComponent(crimeType)}`,
  );
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
