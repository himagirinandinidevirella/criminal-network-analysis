"""
Graph service — all Neo4j knowledge-graph operations.

Provides the data layer for the network analysis page:
full/ego graph extraction, community detection, shortest paths,
key-player ranking (PageRank/centrality), what-if simulation,
link prediction and network statistics.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from app.database import neo4j_connection as neo
from app.database.redis_connection import cache_get, cache_set, TTL
from app.ml_models.gnn_model import get_gnn_model

logger = logging.getLogger("crimenet.graph")

NODE_LABELS = ["Person", "Organization", "Location", "Vehicle", "Account", "CrimeEvent"]

RISK_BANDS = {
    "CRITICAL": (81, 100),
    "HIGH": (61, 80),
    "MEDIUM": (31, 60),
    "LOW": (0, 30),
}


def _serialise_node(labels: list[str], props: dict[str, Any]) -> dict[str, Any]:
    """Convert a Neo4j node into the frontend-friendly shape."""
    label = labels[0] if labels else "Node"
    data = {"id": props.get("id"), "label": label, **props}
    # Normalise list-like string fields that Neo4j may return as lists already.
    return {"data": data, "label": label}


def _serialise_edge(source: str, target: str, rel_type: str, props: dict[str, Any]) -> dict[str, Any]:
    """Convert a relationship into the Cytoscape edge shape."""
    strength = props.get("strength", props.get("amount", props.get("frequency", 1.0)))
    try:
        strength = float(strength)
    except (TypeError, ValueError):
        strength = 1.0
    return {
        "data": {
            "id": f"{source}-{target}-{rel_type}",
            "source": source,
            "target": target,
            "label": rel_type,
            "type": rel_type,
            "strength": strength,
            **props,
        }
    }


_in_memory_graph: Optional[dict[str, Any]] = None


def _get_in_memory_graph() -> dict[str, Any]:
    """Build or return cached in-memory synthetic graph when Neo4j is unavailable."""
    global _in_memory_graph
    if _in_memory_graph is not None:
        return _in_memory_graph
    try:
        from data.synthetic_data_generator import build_dataset
        ds = build_dataset()
        nodes = []
        for p in ds.get("persons", []):
            nodes.append({"data": {"id": p["id"], "label": "Person", **p}, "label": "Person"})
        for o in ds.get("organizations", []):
            nodes.append({"data": {"id": o["id"], "label": "Organization", **o}, "label": "Organization"})
        for l in ds.get("locations", []):
            nodes.append({"data": {"id": l["id"], "label": "Location", **l}, "label": "Location"})
        for v in ds.get("vehicles", []):
            nodes.append({"data": {"id": v["id"], "label": "Vehicle", **v}, "label": "Vehicle"})
        for a in ds.get("accounts", []):
            nodes.append({"data": {"id": a["id"], "label": "Account", **a}, "label": "Account"})
        for c in ds.get("crime_events", []):
            nodes.append({"data": {"id": c["id"], "label": "CrimeEvent", **c}, "label": "CrimeEvent"})

        edges = []
        rel_specs = [
            ("KNOWS", ds.get("knows", [])),
            ("MEMBER_OF", ds.get("member_of", [])),
            ("COMMUNICATED_WITH", ds.get("communicated", [])),
            ("TRANSACTED_WITH", ds.get("transacted", [])),
            ("OWNS_VEHICLE", ds.get("owns_vehicle", [])),
            ("OWNS_ACCOUNT", ds.get("owns_account", [])),
            ("LOCATED_AT", ds.get("located_at", [])),
            ("OPERATES_IN", ds.get("operates_in", [])),
            ("RIVAL_OF", ds.get("rival_of", [])),
            ("PARTICIPATED_IN", ds.get("participated", [])),
            ("USED_IN", ds.get("used_in", [])),
        ]
        for rel_type, rel_list in rel_specs:
            for r in rel_list:
                edges.append(_serialise_edge(r["source"], r["target"], rel_type, r))

        _in_memory_graph = {"nodes": nodes, "edges": edges}
        logger.info("Loaded in-memory fallback graph (%d nodes, %d edges)", len(nodes), len(edges))
    except Exception as exc:
        logger.error("Failed to build fallback graph: %s", exc)
        _in_memory_graph = {"nodes": [], "edges": []}
    return _in_memory_graph


def get_full_graph(
    crime_type: Optional[str] = None,
    risk_level: Optional[str] = None,
    organization: Optional[str] = None,
    location: Optional[str] = None,
    limit: int = 2000,
) -> dict[str, Any]:
    """Return the full knowledge graph (or a filtered slice) for visualisation."""
    try:
        where: list[str] = []
        params: dict[str, Any] = {}

        if risk_level and risk_level in RISK_BANDS:
            low, high = RISK_BANDS[risk_level]
            where.append("n.risk_score >= $risk_low AND n.risk_score <= $risk_high")
            params["risk_low"], params["risk_high"] = low, high
        if crime_type:
            where.append("ANY(c IN coalesce(n.crime_types, []) WHERE c CONTAINS $crime)")
            params["crime"] = crime_type
        if organization:
            where.append("n:Organization AND n.name CONTAINS $org")
            params["org"] = organization
        if location:
            where.append("n:Location AND n.name CONTAINS $loc")
            params["loc"] = location

        where_clause = "WHERE " + " AND ".join(where) if where else ""

        nodes_rows = neo.run_query(
            f"""
            MATCH (n)
            {where_clause}
            RETURN labels(n) AS labels, properties(n) AS props
            LIMIT $limit
            """,
            {**params, "limit": limit},
        )
        nodes = [_serialise_node(r["labels"], r["props"]) for r in nodes_rows]
        node_ids = {n["data"]["id"] for n in nodes}

        if not node_ids:
            return {"nodes": [], "edges": []}

        edges_rows = neo.run_query(
            """
            MATCH (a)-[r]->(b)
            WHERE a.id IN $ids AND b.id IN $ids
            RETURN a.id AS source, b.id AS target, type(r) AS rel_type, properties(r) AS props
            LIMIT $limit
            """,
            {"ids": list(node_ids), "limit": limit * 3},
        )
        edges = [
            _serialise_edge(r["source"], r["target"], r["rel_type"], r["props"])
            for r in edges_rows
        ]
        return {"nodes": nodes, "edges": edges}
    except Exception as exc:
        logger.warning("Neo4j query failed, falling back to in-memory graph: %s", exc)
        fallback = _get_in_memory_graph()
        nodes = fallback["nodes"]
        if risk_level and risk_level in RISK_BANDS:
            low, high = RISK_BANDS[risk_level]
            nodes = [n for n in nodes if low <= n["data"].get("risk_score", 0) <= high]
        if crime_type:
            nodes = [n for n in nodes if crime_type in n["data"].get("crime_types", [])]
        if organization:
            nodes = [n for n in nodes if organization.lower() in (n["data"].get("name") or "").lower()]
        if location:
            nodes = [n for n in nodes if location.lower() in (n["data"].get("name") or "").lower()]
        
        nodes = nodes[:limit]
        node_ids = {n["data"]["id"] for n in nodes}
        edges = [
            e for e in fallback["edges"]
            if e["data"]["source"] in node_ids and e["data"]["target"] in node_ids
        ][:limit * 3]
        return {"nodes": nodes, "edges": edges}


def get_person_network(person_id: str, depth: int = 1, limit: int = 300) -> dict[str, Any]:
    """Return the ego network around a person (1 or 2 hops)."""
    try:
        if depth > 1:
            depth_expr = "*1..2"
        else:
            depth_expr = "*1"

        rows = neo.run_query(
            f"""
            MATCH (p:Person {{id: $pid}})
            OPTIONAL MATCH (p)-[{depth_expr}]-(m)
            RETURN labels(p) AS labels, properties(p) AS props, collect(m) AS neighbours
            """,
            {"pid": person_id},
        )
        if not rows:
            return {"nodes": [], "edges": []}

        # Collect the ego node and its neighbours.
        node_ids: set[str] = set()
        node_list: list[dict[str, Any]] = []
        seen: set[str] = set()
        for row in rows:
            for node in ([row] + [
                {"labels": list(n.labels), "props": dict(n)} for n in row.get("neighbours", [])
            ]):
                nid = node["props"].get("id")
                if nid and nid not in seen:
                    seen.add(nid)
                    node_ids.add(nid)
                    node_list.append(_serialise_node(node["labels"], node["props"]))

        edges = neo.run_query(
            """
            MATCH (a)-[r]->(b)
            WHERE a.id IN $ids AND b.id IN $ids
            RETURN a.id AS source, b.id AS target, type(r) AS rel_type, properties(r) AS props
            LIMIT $limit
            """,
            {"ids": list(node_ids), "limit": limit},
        )
        return {
            "nodes": node_list,
            "edges": [_serialise_edge(e["source"], e["target"], e["rel_type"], e["props"]) for e in edges],
        }
    except Exception as exc:
        logger.warning("Neo4j ego query failed, falling back to in-memory graph: %s", exc)
        fallback = _get_in_memory_graph()
        ego_nodes = [n for n in fallback["nodes"] if n["data"].get("id") == person_id]
        if not ego_nodes:
            return {"nodes": [], "edges": []}
        
        neighbor_ids = set()
        for e in fallback["edges"]:
            if e["data"]["source"] == person_id:
                neighbor_ids.add(e["data"]["target"])
            elif e["data"]["target"] == person_id:
                neighbor_ids.add(e["data"]["source"])
        
        all_ids = {person_id} | neighbor_ids
        nodes = [n for n in fallback["nodes"] if n["data"].get("id") in all_ids][:limit]
        edges = [
            e for e in fallback["edges"]
            if e["data"]["source"] in all_ids and e["data"]["target"] in all_ids
        ][:limit]
        return {"nodes": nodes, "edges": edges}


def find_path(from_id: str, to_id: str) -> dict[str, Any]:
    """Return the shortest path between two entities with relationship types."""
    try:
        row = neo.run_query(
            """
            MATCH (a {id: $from}), (b {id: $to})
            MATCH p = shortestPath((a)-[*..6]-(b))
            RETURN
              [n IN nodes(p) | {id: n.id, name: coalesce(n.name, n.registration_number, n.account_number, n.case_number, n.id), label: head(labels(n))}] AS nodes,
              [r IN relationships(p) | {type: type(r), from: startNode(r).id, to: endNode(r).id, strength: coalesce(r.strength, r.amount, r.frequency, 1.0)}] AS edges,
              length(p) AS hops
            """,
            {"from": from_id, "to": to_id},
        )
        if not row:
            return {"found": False, "nodes": [], "edges": [], "hops": None}
        return {
            "found": True,
            "nodes": row[0]["nodes"],
            "edges": row[0]["edges"],
            "hops": row[0]["hops"],
        }
    except Exception as exc:
        logger.warning("Neo4j shortest path query failed, calculating on in-memory graph: %s", exc)
        import networkx as nx
        graph = get_full_graph(limit=5000)
        G = nx.Graph()
        node_map = {}
        for n in graph["nodes"]:
            nid = n["data"]["id"]
            node_map[nid] = n["data"]
            G.add_node(nid)
        for e in graph["edges"]:
            G.add_edge(e["data"]["source"], e["data"]["target"], rel_type=e["data"].get("type", "CONNECTED_TO"), strength=e["data"].get("strength", 1.0))
        
        if not G.has_node(from_id) or not G.has_node(to_id):
            return {"found": False, "nodes": [], "edges": [], "hops": None}
        try:
            path_nodes = nx.shortest_path(G, source=from_id, target=to_id)
            out_nodes = [{"id": nid, "name": node_map.get(nid, {}).get("name") or nid, "label": node_map.get(nid, {}).get("label", "Node")} for nid in path_nodes]
            out_edges = []
            for u, v in zip(path_nodes[:-1], path_nodes[1:]):
                edata = G.get_edge_data(u, v) or {}
                out_edges.append({"from": u, "to": v, "type": edata.get("rel_type", "KNOWS"), "strength": edata.get("strength", 1.0)})
            return {"found": True, "nodes": out_nodes, "edges": out_edges, "hops": len(path_nodes) - 1}
        except nx.NetworkXNoPath:
            return {"found": False, "nodes": [], "edges": [], "hops": None}


def get_communities() -> list[dict[str, Any]]:
    """Detect communities (gangs/networks) and enrich with member details."""
    graph = get_full_graph()
    communities = get_gnn_model().detect_communities(graph["nodes"], graph["edges"])
    node_map = {n["data"].get("id"): n["data"] for n in graph["nodes"]}
    for community in communities:
        community["members_detail"] = [
            {
                "id": mid,
                "name": node_map.get(mid, {}).get("name", mid),
                "risk_score": node_map.get(mid, {}).get("risk_score", 0),
                "label": node_map.get(mid, {}).get("label"),
            }
            for mid in community["members"][:20]
        ]
    return communities


def get_key_players() -> dict[str, Any]:
    """Rank the top entities by PageRank and centrality metrics."""
    graph = get_full_graph(limit=5000)
    centralities = get_gnn_model().compute_centralities(graph["nodes"], graph["edges"])
    node_map = {n["data"].get("id"): n["data"] for n in graph["nodes"]}

    def _enrich(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out = []
        for item in items:
            node = node_map.get(item["id"], {})
            out.append({
                **item,
                "name": node.get("name") or item["id"],
                "label": node.get("label"),
                "risk_score": node.get("risk_score", 0),
                "crime_types": node.get("crime_types", []),
            })
        return out

    return {
        "top_pagerank": _enrich(centralities["pagerank"]),
        "top_betweenness": _enrich(centralities["betweenness"]),
        "top_degree": _enrich(centralities["degree"]),
        "hubs": _enrich(centralities["degree"][:10]),
        "bridges": _enrich(centralities["betweenness"][:10]),
    }


def what_if(criminal_id: str, action: str = "ARREST") -> dict[str, Any]:
    """Simulate removing a criminal and compare network structure before/after."""
    graph = get_full_graph(limit=5000)
    gnn = get_gnn_model()

    before = gnn.compute_centralities(graph["nodes"], graph["edges"])

    nodes_after = [n for n in graph["nodes"] if n["data"].get("id") != criminal_id]
    edges_after = [
        e for e in graph["edges"]
        if e["data"].get("source") != criminal_id and e["data"].get("target") != criminal_id
    ]
    after = gnn.compute_centralities(nodes_after, edges_after)

    before_comms = len(gnn.detect_communities(graph["nodes"], graph["edges"]))
    after_comms = len(gnn.detect_communities(nodes_after, edges_after))

    def _sum(mapping: dict) -> float:
        vals = mapping.get("full", {}).get("pagerank", {})
        return round(sum(vals.values()), 3)

    return {
        "action": action,
        "criminal_id": criminal_id,
        "before": {
            "node_count": len(graph["nodes"]),
            "edge_count": len(graph["edges"]),
            "communities": before_comms,
            "pagerank_total": _sum(before),
        },
        "after": {
            "node_count": len(nodes_after),
            "edge_count": len(edges_after),
            "communities": after_comms,
            "pagerank_total": _sum(after),
        },
        "impact": {
            "nodes_removed": len(graph["nodes"]) - len(nodes_after),
            "edges_removed": len(graph["edges"]) - len(edges_after),
            "community_fragmentation": after_comms - before_comms,
            "network_resilience": "FRAGMENTED" if after_comms > before_comms else "RESILIENT",
        },
    }


def predict_links(top_k: int = 10, threshold: float = 0.75) -> list[dict[str, Any]]:
    """Predict probable hidden connections between entities."""
    graph = get_full_graph(limit=5000)
    return get_gnn_model().predict_links(graph["nodes"], graph["edges"], top_k, threshold)


def get_statistics() -> dict[str, Any]:
    """Return aggregate network statistics for the dashboard."""
    cache_key = "network:statistics"
    cached = cache_get(cache_key)
    if cached:
        return cached

    try:
        counts: dict[str, Any] = {}
        for label in NODE_LABELS:
            rows = neo.run_query(
                f"MATCH (n:{label}) RETURN count(n) AS c"
            )
            counts[label.lower()] = rows[0]["c"] if rows else 0

        edges = neo.run_query("MATCH ()-[r]->() RETURN count(r) AS c")
        risk_dist = neo.run_query(
            """
            MATCH (p:Person)
            RETURN
              sum(CASE WHEN p.risk_score >= 81 THEN 1 ELSE 0 END) AS critical,
              sum(CASE WHEN p.risk_score >= 61 AND p.risk_score < 81 THEN 1 ELSE 0 END) AS high,
              sum(CASE WHEN p.risk_score >= 31 AND p.risk_score < 61 THEN 1 ELSE 0 END) AS medium,
              sum(CASE WHEN p.risk_score < 31 THEN 1 ELSE 0 END) AS low
            """
        )[0]

        stats = {
            "nodes": counts,
            "total_nodes": sum(counts.values()),
            "relationships": edges[0]["c"] if edges else 0,
            "risk_distribution": risk_dist,
            "crime_types": _crime_type_counts(),
        }
        cache_set(cache_key, stats, TTL["graph"])
        return stats
    except Exception as exc:
        logger.warning("Neo4j stats query failed, falling back to in-memory stats: %s", exc)
        fallback = _get_in_memory_graph()
        counts = {label.lower(): 0 for label in NODE_LABELS}
        crit, high, med, low = 0, 0, 0, 0
        crime_map: dict[str, int] = {}
        for n in fallback["nodes"]:
            lbl = n["data"].get("label", "Node").lower()
            if lbl in counts:
                counts[lbl] += 1
            if lbl == "person":
                score = n["data"].get("risk_score", 0)
                if score >= 81: crit += 1
                elif score >= 61: high += 1
                elif score >= 31: med += 1
                else: low += 1
                for ct in n["data"].get("crime_types", []):
                    crime_map[ct] = crime_map.get(ct, 0) + 1
        
        crime_types = sorted([{"type": k, "count": v} for k, v in crime_map.items()], key=lambda x: x["count"], reverse=True)[:10]
        stats = {
            "nodes": counts,
            "total_nodes": len(fallback["nodes"]),
            "relationships": len(fallback["edges"]),
            "risk_distribution": {"critical": crit, "high": high, "medium": med, "low": low},
            "crime_types": crime_types,
        }
        cache_set(cache_key, stats, TTL["graph"])
        return stats


def _crime_type_counts() -> list[dict[str, Any]]:
    """Count crime-event types across the graph."""
    try:
        rows = neo.run_query(
            """
            MATCH (c:CrimeEvent)
            RETURN c.crime_type AS type, count(c) AS count
            ORDER BY count DESC LIMIT 10
            """
        )
        return [{"type": r.get("type", "Unknown"), "count": r["count"]} for r in rows]
    except Exception:
        return []

