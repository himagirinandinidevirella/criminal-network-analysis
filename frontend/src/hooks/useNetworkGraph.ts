/**
 * useNetworkGraph — manage the Cytoscape graph instance lifecycle.
 */
import { useEffect, useRef } from "react";
import cytoscape, { type Core } from "cytoscape";
import type { GraphData } from "@/types/network.types";
import { enrichGraph, toCytoscapeElements, graphStylesheet } from "@/utils/graphUtils";

interface Options {
  graph: GraphData | null;
  layout?: string;
  onNodeClick?: (id: string) => void;
  onNodeDblClick?: (id: string) => void;
  onEdgeClick?: (source: string, target: string) => void;
}

/**
 * Initialise a Cytoscape graph in the given container and keep it in sync
 * with the GraphData payload.
 */
export function useNetworkGraph(
  containerRef: React.RefObject<HTMLDivElement>,
  { graph, layout = "cose", onNodeClick, onNodeDblClick, onEdgeClick }: Options
): React.MutableRefObject<Core | null> {
  const cyRef = useRef<Core | null>(null);

  // Initialise once.
  useEffect(() => {
    if (!containerRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: graphStylesheet,
      layout: { name: layout } as cytoscape.LayoutOptions,
      wheelSensitivity: 0.2,
    });
    cyRef.current = cy;

    cy.on("tap", "node", (evt) => {
      onNodeClick?.(evt.target.id());
    });
    cy.on("dbltap", "node", (evt) => {
      onNodeDblClick?.(evt.target.id());
    });
    cy.on("tap", "edge", (evt) => {
      const edge = evt.target;
      onEdgeClick?.(edge.source().id(), edge.target().id());
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update elements when the graph changes.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !graph) return;
    const enriched = enrichGraph(graph);
    cy.elements().remove();
    cy.add(toCytoscapeElements(enriched));
    cy.layout({ name: layout } as cytoscape.LayoutOptions).run();
  }, [graph, layout]);

  return cyRef;
}

/** Register extra layout extensions (cola/dagre) — called once at startup. */
export function registerGraphExtensions(): void {
  try {
    // Dynamically import the layout extensions; they self-register.
    import("cytoscape-cola").then((mod) => {
      cytoscape.use(mod.default || mod);
    });
    import("cytoscape-dagre").then((mod) => {
      cytoscape.use(mod.default || mod);
    });
  } catch {
    // Extensions are optional — core layouts (cose/circle/grid) still work.
  }
}
