/** Manage graph lifetime, latest callbacks and asynchronous layout registration. */
import { useEffect, useRef } from "react";
import cytoscape, { type Core } from "cytoscape";
import type { GraphData } from "@/types/network.types";
import {
  enrichGraph,
  toCytoscapeElements,
  graphStylesheet,
} from "@/utils/graphUtils";

interface Options {
  graph: GraphData | null;
  layout?: string;
  selectedNodeId?: string | null;
  onNodeClick?: (id: string) => void;
  onNodeDblClick?: (id: string) => void;
  onEdgeClick?: (source: string, target: string) => void;
}
let extensions: Promise<boolean> | undefined;
export function registerGraphExtensions(): Promise<boolean> {
  return (extensions ??= import("cytoscape-dagre")
    .then((mod) => {
      cytoscape.use(mod.default || mod);
      return true;
    })
    .catch(() => false));
}
export function useNetworkGraph(
  containerRef: React.RefObject<HTMLDivElement>,
  options: Options,
): React.MutableRefObject<Core | null> {
  const { graph, layout = "cose", selectedNodeId } = options;
  const callbacks = useRef(options);
  callbacks.current = options;
  const cyRef = useRef<Core | null>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: graphStylesheet,
      layout: { name: "preset" },
      wheelSensitivity: 0.2,
    });
    cyRef.current = cy;
    cy.on("tap", "node", (evt) =>
      callbacks.current.onNodeClick?.(evt.target.id()),
    );
    cy.on("dbltap", "node", (evt) =>
      callbacks.current.onNodeDblClick?.(evt.target.id()),
    );
    cy.on("tap", "edge", (evt) =>
      callbacks.current.onEdgeClick?.(
        evt.target.source().id(),
        evt.target.target().id(),
      ),
    );
    const resize = new ResizeObserver(() => {
      if (!cy.destroyed()) cy.resize();
    });
    resize.observe(containerRef.current);
    return () => {
      resize.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const cy = cyRef.current;
    if (!cy || !graph) return;
    (async () => {
      const layoutReady =
        layout !== "dagre" || (await registerGraphExtensions());
      if (cancelled || cy.destroyed()) return;
      cy.elements().remove();
      cy.add(toCytoscapeElements(enrichGraph(graph)));
      const name = layoutReady ? layout : "grid";
      cy.layout({
        name,
        animate: false,
        padding: 30,
      } as cytoscape.LayoutOptions).run();
      const selected = callbacks.current.selectedNodeId;
      if (selected) cy.getElementById(selected).select();
    })();
    return () => {
      cancelled = true;
    };
  }, [graph, layout]);
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().unselect();
    if (selectedNodeId) cy.getElementById(selectedNodeId).select();
  }, [selectedNodeId]);
  return cyRef;
}
