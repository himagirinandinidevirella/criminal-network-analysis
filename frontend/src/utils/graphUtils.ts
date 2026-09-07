/**
 * Graph styling/transformation helpers for Cytoscape.
 * Light "dossier" palette: ink, seal red, teal, ochre on paper.
 */
import type { StylesheetJson } from "cytoscape";
import type { GraphData, GraphNode } from "@/types/network.types";

/** Colour a node by its label/type. */
export function nodeColor(node: GraphNode): string {
  const label = (node.data.label || "").toLowerCase();
  if (label === "person") {
    const risk = node.data.risk_score ?? 0;
    if (risk >= 81) return "#B3261E"; // critical
    if (risk >= 61) return "#C0551F"; // high
    if (risk >= 31) return "#9A6A12"; // medium
    return "#1E7A55"; // low
  }
  switch (label) {
    case "organization":
      return "#22303E"; // ink navy
    case "location":
      return "#17645B"; // institutional teal
    case "vehicle":
      return "#8A6D3B"; // ochre
    case "account":
      return "#5B6B7A"; // steel
    case "crimeevent":
      return "#C13B26"; // seal red
    default:
      return "#8A8F8B";
  }
}

/** Map a GraphData payload to Cytoscape elements. */
export function toCytoscapeElements(graph: GraphData) {
  const nodes = graph.nodes.map((n) => ({
    data: { ...n.data },
  }));
  const edges = graph.edges.map((e) => ({
    data: { ...e.data },
  }));
  return [...nodes, ...edges];
}

/** Default Cytoscape stylesheet for the criminal network map. */
export const graphStylesheet: StylesheetJson = [
  {
    selector: "node",
    style: {
      "background-color": "data(color)",
      label: "data(name)",
      color: "#1B2530",
      "font-size": 9,
      "text-valign": "bottom",
      "text-margin-y": 4,
      "text-outline-width": 2,
      "text-outline-color": "#F5F1E8",
      width: "mapData(size, 0, 100, 12, 42)",
      height: "mapData(size, 0, 100, 12, 42)",
      "border-width": 1,
      "border-color": "#F5F1E8",
    },
  },
  {
    selector: "node[label = 'Person']",
    style: {
      shape: "ellipse",
      "background-color": "data(color)",
    },
  },
  {
    selector: "node[label = 'Organization']",
    style: {
      shape: "round-diamond",
      "background-color": "#22303E",
    },
  },
  {
    selector: "node[label = 'Location']",
    style: {
      shape: "round-hexagon",
      "background-color": "#17645B",
    },
  },
  {
    selector: "node[label = 'Vehicle']",
    style: {
      shape: "round-rectangle",
      "background-color": "#8A6D3B",
    },
  },
  {
    selector: "node[label = 'Account']",
    style: {
      shape: "round-rectangle",
      "background-color": "#5B6B7A",
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 3,
      "border-color": "#C13B26",
    },
  },
  {
    selector: "edge",
    style: {
      width: "mapData(strength, 0, 1, 1, 5)",
      "line-color": "#9A948A",
      "target-arrow-color": "#8A8F8B",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      opacity: 0.7,
      label: "data(label)",
      "font-size": 7,
      color: "#8A8F8B",
      "text-outline-color": "#F5F1E8",
      "text-outline-width": 2,
    },
  },
  {
    selector: "edge[type = 'COMMUNICATED_WITH']",
    style: {
      "line-style": "dashed",
      "line-color": "#17645B",
    },
  },
  {
    selector: "edge[type = 'TRANSACTED_WITH']",
    style: {
      "line-color": "#9A6A12",
    },
  },
  {
    selector: "edge[type = 'TRANSFERRED_TO']",
    style: {
      "line-color": "#9A6A12",
      "line-style": "dashed",
    },
  },
  {
    selector: "edge[type = 'RIVAL_OF']",
    style: {
      "line-color": "#B3261E",
      "line-style": "double",
    },
  },
  {
    selector: "edge[type = 'MEMBER_OF']",
    style: {
      "line-color": "#C13B26",
    },
  },
  {
    selector: "edge[type = 'KNOWS']",
    style: {
      "line-color": "#8A8F8B",
    },
  },
] as unknown as StylesheetJson;

/** Compute a node size from PageRank-style centrality (0-100 scale). */
export function computeSize(centrality?: number, risk?: number): number {
  const base = centrality ?? 0;
  return Math.max(12, Math.min(100, base * 100));
}

/** Enrich graph nodes with colour/size used by the Cytoscape stylesheet. */
export function enrichGraph(graph: GraphData): GraphData {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        color: nodeColor(n),
        size: computeSize(
          typeof n.data.centrality === "number" ? (n.data.centrality as number) : undefined,
          typeof n.data.risk_score === "number" ? (n.data.risk_score as number) : undefined
        ),
      },
    })),
    edges: graph.edges.map((e) => ({
      ...e,
      data: {
        ...e.data,
        color: "#9A948A",
      },
    })),
  };
}
