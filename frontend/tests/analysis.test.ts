import { describe, expect, it } from "vitest";
import { seedDemoState } from "@/demo/data";
import {
  communities,
  componentCount,
  extractFir,
  fullGraph,
  hotspots,
  profile,
  search,
  shortestPath,
  statistics,
  whatIf,
} from "@/demo/analysis";

const seed = () => seedDemoState(new Date("2026-09-07T10:00:00Z"));
describe("synthetic graph", () => {
  it("is deterministic, coherent, and contains no dangling edges", () => {
    const state = seed();
    expect(seed()).toEqual(state);
    const graph = fullGraph(state),
      ids = new Set(graph.nodes.map((n) => n.data.id));
    expect(state.people).toHaveLength(40);
    expect(graph.nodes).toHaveLength(112);
    expect(ids.size).toBe(graph.nodes.length);
    expect(new Set(graph.edges.map((e) => e.data.id)).size).toBe(
      graph.edges.length,
    );
    expect(
      graph.edges.every(
        (e) => ids.has(e.data.source) && ids.has(e.data.target),
      ),
    ).toBe(true);
    expect(statistics(state).total_nodes).toBe(112);
    expect(
      Object.values(statistics(state).risk_distribution).reduce(
        (a, b) => a + b,
        0,
      ),
    ).toBe(40);
    expect(communities(state).reduce((sum, c) => sum + c.size, 0)).toBe(40);
  });
  it("combines filters and limits without dangling edges", () => {
    const graph = fullGraph(seed(), {
      crime_type: "Drug Trafficking",
      risk_level: "CRITICAL",
      limit: 15,
    });
    expect(graph.nodes.length).toBeLessThanOrEqual(15);
    const people = graph.nodes.filter((n) => n.data.label === "Person");
    expect(people.length).toBeGreaterThan(0);
    expect(
      people.every(
        (n) =>
          Number(n.data.risk_score) >= 81 &&
          n.data.crime_types?.includes("Drug Trafficking"),
      ),
    ).toBe(true);
    const ids = graph.nodes.map((n) => n.data.id);
    expect(
      graph.edges.every(
        (e) => ids.includes(e.data.source) && ids.includes(e.data.target),
      ),
    ).toBe(true);
    expect(fullGraph(seed(), { crime_type: "Unknown" })).toEqual({
      nodes: [],
      edges: [],
    });
  });
  it("searches identifiers, aliases and multiple terms, respecting filters", () => {
    const state = seed();
    expect(search(state, "Raja Khan").map((n) => n.id)).toContain("raja-khan");
    expect(search(state, "raja bhai")[0].id).toBe("raja-khan");
    expect(search(state, "MH-01-AX-9999")[0].kind).toBe("Vehicle");
    expect(search(state, "XXXX1234")[0].kind).toBe("Account");
    expect(search(state, "Raja", { risk_level: "LOW" })).toHaveLength(0);
    expect(
      search(state, "Raja", {
        status: "UNDER_INVESTIGATION",
        crime_type: "Drug Trafficking",
      }),
    ).toHaveLength(1);
    expect(search(state, "nonexistent record")).toHaveLength(0);
  });
  it("calculates actual shortest paths, same-node paths and missing paths", () => {
    const graph = fullGraph(seed());
    const path = shortestPath(graph, "raja-khan", "vikram-rao");
    expect(path.found).toBe(true);
    expect(path.hops).toBe(2);
    expect(path.nodes.map((n) => n.id)).toEqual([
      "raja-khan",
      "meena-patil",
      "vikram-rao",
    ]);
    expect(shortestPath(graph, "raja-khan", "raja-khan").hops).toBe(0);
    expect(shortestPath(graph, "missing", "raja-khan").found).toBe(false);
    expect(
      shortestPath({ ...graph, edges: [] }, "raja-khan", "vikram-rao").found,
    ).toBe(false);
    expect(shortestPath(graph, "raja-khan", "vikram-rao", 1).found).toBe(false);
  });
  it("simulates removal without modifying the original dataset", () => {
    const state = seed(),
      before = JSON.stringify(state),
      result = whatIf(state, "raja-khan");
    expect(result.before.node_count).toBe(112);
    expect(result.after.node_count).toBe(111);
    expect(result.impact.edges_removed).toBe(
      state.edges.filter((e) =>
        [e.data.source, e.data.target].includes("raja-khan"),
      ).length,
    );
    expect(result.before.communities).toBe(componentCount(fullGraph(state)));
    expect(JSON.stringify(state)).toBe(before);
    expect(() => whatIf(state, "missing")).toThrow("Person not found");
  });
  it("keeps profile totals, map counts and filtered cases consistent", () => {
    const state = seed(),
      p = profile(state, "raja-khan");
    expect(p.risk.factors.reduce((sum, f) => sum + f.contribution, 0)).toBe(
      p.risk.score,
    );
    expect(p.accounts[0].account_number).toBe("XXXX1234");
    expect(p.vehicles[0].registration_number).toBe("MH-01-AX-9999");
    expect(hotspots(state).reduce((sum, h) => sum + h.crime_count, 0)).toBe(
      state.crimes.length,
    );
    expect(
      hotspots(state, "Cyber Crime").reduce((sum, h) => sum + h.crime_count, 0),
    ).toBe(state.crimes.filter((c) => c.crime_type === "Cyber Crime").length);
  });
  it("extracts fixture matches and identifier candidates without mutation", () => {
    const state = seed(),
      before = JSON.stringify(state);
    const result = extractFir(
      state,
      "Raja Khan met Meena Patil in Mumbai near MH-01-AX-9999. Account XXXX1234.",
    );
    expect(result.entities.map((e) => e.type)).toEqual(
      expect.arrayContaining(["PERSON", "LOCATION", "VEHICLE", "ACCOUNT"]),
    );
    expect(result.created).toEqual({});
    expect(JSON.stringify(state)).toBe(before);
    expect(extractFir(state, "No known records here.").entities).toHaveLength(
      0,
    );
    expect(result.model?.engine).toBe("Dictionary + regex preview");
  });
});
