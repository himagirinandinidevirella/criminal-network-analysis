import type {
  Criminal,
  CriminalProfile,
  FIRAnalysisResult,
} from "@/types/criminal.types";
import type {
  Community,
  GraphData,
  GraphNode,
  NetworkStatistics,
  PathResult,
  WhatIfResult,
} from "@/types/network.types";
import { levelFor, riskColor } from "@/utils/riskUtils";
import type { DemoState } from "./types";

export type Filters = Record<string, unknown>;
export function matchesPerson(person: Criminal, filters: Filters): boolean {
  return (
    (!filters.risk_level ||
      levelFor(person.risk_score) === filters.risk_level) &&
    (!filters.crime_type ||
      person.crime_types.includes(String(filters.crime_type))) &&
    (!filters.status || person.status === filters.status)
  );
}

export function fullGraph(state: DemoState, filters: Filters = {}): GraphData {
  const nodes: GraphNode[] = [
    ...state.people.map((p) => ({ data: { ...p, label: "Person" } })),
    ...state.organizations.map((o) => ({
      data: { ...o, label: "Organization" },
    })),
    ...state.locations.map((l) => ({ data: { ...l, label: "Location" } })),
    ...state.vehicles.map((v) => ({
      data: { ...v, label: "Vehicle", name: v.registration_number },
    })),
    ...state.accounts.map((a) => ({
      data: { ...a, label: "Account", name: a.account_number },
    })),
    ...state.crimes.map((c) => ({
      data: { ...c, label: "CrimeEvent", name: c.case_number ?? c.id },
    })),
    ...state.transactions.map((t) => ({
      data: { ...t, label: "Transaction" },
    })),
  ];
  const degrees = new Map<string, number>();
  state.edges.forEach(({ data: e }) => {
    degrees.set(e.source, (degrees.get(e.source) ?? 0) + 1);
    degrees.set(e.target, (degrees.get(e.target) ?? 0) + 1);
  });
  const max = Math.max(1, ...degrees.values());
  nodes.forEach((n) => {
    n.data.centrality = (degrees.get(n.data.id) ?? 0) / max;
  });
  let selected = nodes;
  if (filters.risk_level || filters.crime_type || filters.status) {
    const people = new Set(
      state.people.filter((p) => matchesPerson(p, filters)).map((p) => p.id),
    );
    const keep = new Set(people);
    const personIds = new Set(state.people.map((p) => p.id));
    state.edges.forEach(({ data: e }) => {
      if (people.has(e.source) && !personIds.has(e.target)) keep.add(e.target);
      if (people.has(e.target) && !personIds.has(e.source)) keep.add(e.source);
    });
    selected = nodes.filter((n) => keep.has(n.data.id));
  }
  const limit = Number(filters.limit);
  if (Number.isFinite(limit) && limit > 0)
    selected = selected.slice(0, Math.floor(limit));
  const ids = new Set(selected.map((n) => n.data.id));
  return {
    nodes: selected,
    edges: state.edges.filter(
      ({ data: e }) => ids.has(e.source) && ids.has(e.target),
    ),
  };
}

export function statistics(state: DemoState): NetworkStatistics {
  const graph = fullGraph(state);
  const nodes: Record<string, number> = {};
  graph.nodes.forEach((n) => {
    const label = n.data.label.toLowerCase();
    nodes[label] = (nodes[label] ?? 0) + 1;
  });
  const risk_distribution = { critical: 0, high: 0, medium: 0, low: 0 };
  const crimes: Record<string, number> = {};
  state.people.forEach((p) => {
    risk_distribution[
      levelFor(p.risk_score).toLowerCase() as keyof typeof risk_distribution
    ]++;
  });
  state.crimes.forEach((c) => {
    crimes[c.crime_type] = (crimes[c.crime_type] ?? 0) + 1;
  });
  return {
    nodes,
    total_nodes: graph.nodes.length,
    relationships: graph.edges.length,
    risk_distribution,
    crime_types: Object.entries(crimes).map(([type, count]) => ({
      type,
      count,
    })),
  };
}

export function communities(state: DemoState): Community[] {
  return state.organizations.map((o, i) => {
    const members = state.edges
      .filter((e) => e.data.type === "MEMBER_OF" && e.data.target === o.id)
      .map((e) => e.data.source);
    return {
      id: i + 1,
      name: o.name,
      members,
      size: members.length,
      crime_types: o.crime_types,
      members_detail: state.people
        .filter((p) => members.includes(p.id))
        .map((p) => ({
          id: p.id,
          name: p.name,
          risk_score: p.risk_score,
          label: "Person",
        })),
    };
  });
}

export function hotspots(state: DemoState, crimeType = "") {
  const counts = state.locations.map((location) => ({
    ...location,
    crime_count: state.crimes.filter(
      (c) =>
        c.location_id === location.id &&
        (!crimeType || c.crime_type === crimeType),
    ).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.crime_count));
  return counts
    .map((c) => ({ ...c, hotspot_score: c.crime_count / max }))
    .sort((a, b) => b.crime_count - a.crime_count);
}

/** Breadth-first shortest path, treating relationship direction as traversable both ways. */
export function shortestPath(
  graph: GraphData,
  from: string,
  to: string,
  maxHops = 6,
): PathResult {
  const none: PathResult = { found: false, nodes: [], edges: [], hops: null };
  const nodeById = new Map(graph.nodes.map((n) => [n.data.id, n.data]));
  if (!nodeById.has(from) || !nodeById.has(to)) return none;
  const seen = new Set([from]);
  const queue: string[][] = [[from]];
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i];
    const last = path[path.length - 1];
    if (last === to)
      return {
        found: true,
        hops: path.length - 1,
        nodes: path.map((id) => {
          const n = nodeById.get(id)!;
          return { id, name: String(n.name), label: n.label };
        }),
        edges: path.slice(1).map((id, index) => {
          const previous = path[index];
          const e = graph.edges.find(
            ({ data }) =>
              (data.source === previous && data.target === id) ||
              (data.source === id && data.target === previous),
          )!.data;
          return {
            from: previous,
            to: id,
            type: String(e.type),
            strength: e.strength ?? 0.5,
          };
        }),
      };
    if (path.length - 1 >= maxHops) continue;
    for (const { data: e } of graph.edges) {
      const next =
        e.source === last ? e.target : e.target === last ? e.source : undefined;
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return none;
}

export function componentCount(graph: GraphData): number {
  const remaining = new Set(graph.nodes.map((n) => n.data.id));
  let count = 0;
  while (remaining.size) {
    const root = remaining.values().next().value as string;
    remaining.delete(root);
    const queue = [root];
    count++;
    for (let i = 0; i < queue.length; i++) {
      for (const { data: e } of graph.edges) {
        const next =
          e.source === queue[i]
            ? e.target
            : e.target === queue[i]
              ? e.source
              : undefined;
        if (next && remaining.delete(next)) queue.push(next);
      }
    }
  }
  return count;
}

export function whatIf(state: DemoState, criminalId: string): WhatIfResult {
  if (!state.people.some((p) => p.id === criminalId))
    throw new Error("Person not found");
  const before = fullGraph(state);
  const after = {
    nodes: before.nodes.filter((n) => n.data.id !== criminalId),
    edges: before.edges.filter(
      (e) => e.data.source !== criminalId && e.data.target !== criminalId,
    ),
  };
  const metrics = (g: GraphData) => ({
    node_count: g.nodes.length,
    edge_count: g.edges.length,
    communities: componentCount(g),
    pagerank_total: 0,
  });
  const fragmentation = componentCount(after) - componentCount(before);
  return {
    action: "REMOVE_NODE",
    criminal_id: criminalId,
    before: metrics(before),
    after: metrics(after),
    impact: {
      nodes_removed: 1,
      edges_removed: before.edges.length - after.edges.length,
      community_fragmentation: fragmentation,
      network_resilience:
        fragmentation > 0
          ? "More disconnected components"
          : "Connected structure retained",
    },
  };
}

export function profile(state: DemoState, id: string): CriminalProfile {
  const person = state.people.find((p) => p.id === id);
  if (!person) throw new Error("Person not found");
  const adjacent = state.edges.filter(
    (e) => e.data.source === id || e.data.target === id,
  );
  const associates = state.people
    .filter(
      (p) =>
        p.id !== id &&
        adjacent.some((e) => e.data.source === p.id || e.data.target === p.id),
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      risk_score: p.risk_score,
      crime_types: p.crime_types,
      relation: String(
        adjacent.find((e) => e.data.source === p.id || e.data.target === p.id)
          ?.data.type ?? "KNOWS",
      ),
    }));
  const a = Math.round(person.risk_score * 0.35),
    b = Math.round(person.risk_score * 0.3),
    c = Math.round(person.risk_score * 0.2);
  return {
    person,
    associates,
    vehicles: state.vehicles.filter((v) => v.owner_id === id),
    accounts: state.accounts.filter((a) => a.owner_id === id),
    crimes: state.crimes.filter((c) => c.person_ids.includes(id)),
    risk: {
      score: person.risk_score,
      level: levelFor(person.risk_score),
      color: riskColor(levelFor(person.risk_score)),
      engine: "synthetic-fixture (not an ML inference)",
      factors: [a, b, c, person.risk_score - a - b - c].map((value, i) => ({
        feature: [
          "sample_activity",
          "sample_financial",
          "sample_connections",
          "sample_history",
        ][i],
        contribution: value,
        value,
      })),
    },
    network_stats: { degree: adjacent.length, associates: associates.length },
  };
}

export function search(state: DemoState, query: string, filters: Filters = {}) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return fullGraph(state)
    .nodes.filter(({ data: n }) => {
      if (
        (filters.risk_level || filters.crime_type || filters.status) &&
        (n.label !== "Person" ||
          !matchesPerson(n as unknown as Criminal, filters))
      )
        return false;
      const haystack = [
        n.name,
        n.id,
        n.label,
        n.aliases,
        n.address,
        n.crime_types,
        n.criminal_id,
        n.bank_name,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .map(({ data: n }) => ({ ...n, kind: n.label }))
    .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0));
}

/** Preview only: match fixture names and simple identifiers, never infer guilt or create people. */
export function extractFir(state: DemoState, text: string): FIRAnalysisResult {
  const lower = text.toLowerCase();
  const entities: FIRAnalysisResult["entities"] = [];
  for (const { data: n } of fullGraph(state).nodes) {
    if (["Transaction", "CrimeEvent"].includes(n.label)) continue;
    const name = String(n.name);
    if (lower.includes(name.toLowerCase()))
      entities.push({
        text: name,
        type: n.label.toUpperCase(),
        confidence: 1,
        source: "Exact match to synthetic fixture",
        meta: { id: n.id },
      });
  }
  // A city substring can match a location even when the neighbourhood is omitted.
  state.locations.forEach((l) => {
    if (
      lower.includes(l.city.toLowerCase()) &&
      !entities.some((e) => e.meta?.id === l.id)
    )
      entities.push({
        text: l.city,
        type: "LOCATION",
        confidence: 1,
        source: "Synthetic city dictionary",
        meta: { id: l.id },
      });
  });
  for (const candidate of text.match(
    /\b[A-Z]{2}[- ]?\d{2}[- ]?[A-Z]{1,2}[- ]?\d{4}\b/g,
  ) ?? []) {
    if (!entities.some((e) => e.text === candidate))
      entities.push({
        text: candidate,
        type: "VEHICLE",
        confidence: 0.7,
        source: "Identifier pattern; unverified candidate",
      });
  }
  for (const candidate of text.match(/\bXXXX\d{4}\b/g) ?? []) {
    if (!entities.some((e) => e.text === candidate))
      entities.push({
        text: candidate,
        type: "ACCOUNT",
        confidence: 0.7,
        source: "Identifier pattern; unverified candidate",
      });
  }
  const ids = new Set(entities.map((e) => e.meta?.id));
  const names = new Map(
    fullGraph(state).nodes.map((n) => [n.data.id, String(n.data.name)]),
  );
  return {
    entities,
    created: {},
    model: {
      engine: "Dictionary + regex preview",
      note: "No model is loaded and no graph records are created.",
    },
    relationships: state.edges
      .filter((e) => ids.has(e.data.source) && ids.has(e.data.target))
      .map((e) => ({
        source: names.get(e.data.source)!,
        target: names.get(e.data.target)!,
        relation: String(e.data.type),
      })),
  };
}
