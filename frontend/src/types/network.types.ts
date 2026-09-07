/**
 * Network graph and analysis types.
 */

/** A Cytoscape-compatible node. */
export interface GraphNode {
  data: {
    id: string;
    label: string;
    name?: string;
    risk_score?: number;
    crime_types?: string[];
    [key: string]: unknown;
  };
  label?: string;
}

/** A Cytoscape-compatible edge. */
export interface GraphEdge {
  data: {
    id: string;
    source: string;
    target: string;
    label?: string;
    type?: string;
    strength?: number;
    [key: string]: unknown;
  };
}

/** A graph payload for the network map. */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** A detected community / gang. */
export interface Community {
  id: number;
  name: string;
  members: string[];
  size: number;
  crime_types: string[];
  members_detail?: Array<{ id: string; name: string; risk_score: number; label?: string }>;
}

/** A ranked key player. */
export interface KeyPlayer {
  id: string;
  score: number;
  name: string;
  label?: string;
  risk_score?: number;
  crime_types?: string[];
}

/** Key-player rankings. */
export interface KeyPlayers {
  top_pagerank: KeyPlayer[];
  top_betweenness: KeyPlayer[];
  top_degree: KeyPlayer[];
  hubs: KeyPlayer[];
  bridges: KeyPlayer[];
}

/** A shortest-path result. */
export interface PathResult {
  found: boolean;
  nodes: Array<{ id: string; name: string; label: string }>;
  edges: Array<{ type: string; from: string; to: string; strength: number }>;
  hops: number | null;
}

/** A what-if simulation result. */
export interface WhatIfResult {
  action: string;
  criminal_id: string;
  before: { node_count: number; edge_count: number; communities: number; pagerank_total: number };
  after: { node_count: number; edge_count: number; communities: number; pagerank_total: number };
  impact: {
    nodes_removed: number;
    edges_removed: number;
    community_fragmentation: number;
    network_resilience: string;
  };
}

/** Network-wide statistics. */
export interface NetworkStatistics {
  nodes: Record<string, number>;
  total_nodes: number;
  relationships: number;
  risk_distribution: { critical: number; high: number; medium: number; low: number };
  crime_types: Array<{ type: string; count: number }>;
}
