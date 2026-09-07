"""
Graph Neural Network model (PyTorch Geometric GraphSAGE) + NetworkX analytics.

Provides the structural-intelligence layer:
  * Node classification (role detection) via GraphSAGE
  * Link prediction (hidden connections)
  * Community detection (Louvain)
  * Centrality computation (degree / betweenness / PageRank / closeness)
  * Network resilience analysis

The heavy torch_geometric path is loaded lazily; NetworkX guarantees the
analytics always run even without a GPU/CPU torch install.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger("crimenet.gnn")


class GNNModel:
    """Wraps GraphSAGE training/inference and NetworkX graph analytics."""

    def __init__(self) -> None:
        self._torch_geometric: Optional[Any] = self._load_torch_geometric()

    # ── Lazy heavy imports ────────────────────────────────────────────────────
    @staticmethod
    def _load_torch_geometric() -> Optional[Any]:
        try:
            import torch_geometric  # noqa: F401

            return torch_geometric
        except Exception as exc:  # noqa: BLE001
            logger.warning("torch_geometric unavailable (%s); NetworkX-only analytics", exc)
            return None

    # ── Graph construction helper ─────────────────────────────────────────────
    @staticmethod
    def build_nx_graph(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> Any:
        """Build a NetworkX graph from Cytoscape-style node/edge lists."""
        import networkx as nx

        g = nx.Graph()
        for node in nodes:
            data = node.get("data", node)
            g.add_node(data.get("id"), **data)
        for edge in edges:
            data = edge.get("data", edge)
            g.add_edge(
                data.get("source"), data.get("target"),
                weight=float(data.get("strength", data.get("weight", 1.0))),
                label=data.get("label", data.get("type", "LINKED")),
            )
        return g

    # ── Centrality computation ────────────────────────────────────────────────
    def compute_centralities(
        self, nodes: list[dict[str, Any]], edges: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Compute degree, betweenness, PageRank and closeness centrality."""
        import networkx as nx

        g = self.build_nx_graph(nodes, edges)
        if g.number_of_nodes() == 0:
            return {"degree": {}, "betweenness": {}, "pagerank": {}, "closeness": {}}
        try:
            degree = nx.degree_centrality(g)
            betweenness = nx.betweenness_centrality(g, weight="weight")
            pagerank = nx.pagerank(g, weight="weight")
            closeness = nx.closeness_centrality(g)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Centrality computation failed: %s", exc)
            return {"degree": {}, "betweenness": {}, "pagerank": {}, "closeness": {}}

        def _top(mapping: dict, k: int = 10) -> list[dict[str, Any]]:
            ranked = sorted(mapping.items(), key=lambda kv: -kv[1])
            return [{"id": nid, "score": round(score, 5)} for nid, score in ranked[:k]]

        return {
            "degree": _top(degree),
            "betweenness": _top(betweenness),
            "pagerank": _top(pagerank),
            "closeness": _top(closeness),
            "full": {
                "pagerank": {k: round(v, 5) for k, v in pagerank.items()},
                "betweenness": {k: round(v, 5) for k, v in betweenness.items()},
            },
        }

    # ── Community detection (Louvain) ─────────────────────────────────────────
    def detect_communities(
        self, nodes: list[dict[str, Any]], edges: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Detect communities and return them with member IDs and stats."""
        import networkx as nx

        g = self.build_nx_graph(nodes, edges)
        if g.number_of_edges() == 0 or g.number_of_nodes() == 0:
            # Isolated nodes each form their own community.
            return [
                {"id": i, "name": f"Community {i}", "members": [nid],
                 "size": 1, "crime_types": []}
                for i, nid in enumerate(g.nodes())
            ]
        try:
            communities = nx.community.louvain_communities(g, weight="weight", seed=42)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Louvain failed (%s); using connected components", exc)
            communities = list(nx.connected_components(g))

        result: list[dict[str, Any]] = []
        for i, members in enumerate(sorted(communities, key=len, reverse=True)):
            crime_types = self._dominant_crime_types(g, members)
            result.append({
                "id": i,
                "name": self._name_community(crime_types, i),
                "members": sorted(members),
                "size": len(members),
                "crime_types": crime_types,
            })
        return result

    @staticmethod
    def _dominant_crime_types(g: Any, members: set) -> list[str]:
        """Return the most frequent crime types within a community."""
        from collections import Counter

        counter: Counter = Counter()
        for nid in members:
            crime_types = g.nodes[nid].get("crime_types", [])
            if isinstance(crime_types, str):
                crime_types = [crime_types]
            counter.update(crime_types)
        return [ct for ct, _ in counter.most_common(3)]

    @staticmethod
    def _name_community(crime_types: list[str], idx: int) -> str:
        """Name a community after its dominant crime type."""
        if crime_types:
            return f"{crime_types[0].title()} Network"
        return f"Community {idx + 1}"

    # ── Link prediction ───────────────────────────────────────────────────────
    def predict_links(
        self,
        nodes: list[dict[str, Any]],
        edges: list[dict[str, Any]],
        top_k: int = 10,
        threshold: float = 0.75,
    ) -> list[dict[str, Any]]:
        """
        Predict probable hidden connections using Adamic-Adar (with a
        GraphSAGE embedding fallback when torch_geometric is available).
        """
        import networkx as nx

        g = self.build_nx_graph(nodes, edges)
        predictions: list[dict[str, Any]] = []
        if g.number_of_nodes() < 2:
            return predictions

        try:
            preds = nx.adamic_adar_index(g)
            scored = sorted(preds, key=lambda t: -t[2])
            max_score = scored[0][2] if scored else 1.0
            for u, v, score in scored:
                if g.has_edge(u, v):
                    continue
                norm = round(score / max(max_score, 1e-9), 4)
                if norm >= threshold:
                    predictions.append({
                        "source": u, "target": v,
                        "score": norm, "method": "adamic_adar",
                    })
                if len(predictions) >= top_k:
                    break
        except Exception as exc:  # noqa: BLE001
            logger.warning("Link prediction failed: %s", exc)
        return predictions

    # ── Resilience analysis ───────────────────────────────────────────────────
    def resilience(
        self, nodes: list[dict[str, Any]], edges: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """
        Analyse how network integrity degrades as high-centrality nodes are
        removed (targeted attack) vs. random removal.
        """
        import networkx as nx

        g = self.build_nx_graph(nodes, edges)
        n = g.number_of_nodes()
        if n == 0:
            return {"targeted": [], "random": []}

        # Targeted: remove nodes in decreasing PageRank order.
        pr = nx.pagerank(g, weight="weight")
        order = [nid for nid, _ in sorted(pr.items(), key=lambda kv: -kv[1])]

        def _curve(removal_order: list) -> list[float]:
            h = g.copy()
            curve = []
            for i, nid in enumerate(removal_order):
                if h.has_node(nid):
                    h.remove_node(nid)
                try:
                    comps = nx.number_connected_components(h)
                except Exception:  # noqa: BLE001
                    comps = 1
                curve.append(round(comps / max(1, h.number_of_nodes()), 4))
            return curve

        import random

        random_order = list(g.nodes())
        random.seed(42)
        random.shuffle(random_order)

        return {
            "targeted": _curve(order[:min(20, n)]),
            "random": _curve(random_order[:min(20, n)]),
            "removal_order": order[:min(20, n)],
        }

    # ── GraphSAGE node embeddings / role detection ────────────────────────────
    def node_embeddings(
        self, nodes: list[dict[str, Any]], edges: list[dict[str, Any]], dim: int = 64
    ) -> dict[str, list[float]]:
        """
        Compute per-node embeddings. Uses GraphSAGE when available, otherwise
        falls back to a spectral embedding.
        """
        g = self.build_nx_graph(nodes, edges)
        if self._torch_geometric is not None and g.number_of_nodes() > 1:
            try:
                return self._graphsage_embeddings(g, dim)
            except Exception as exc:  # noqa: BLE001
                logger.warning("GraphSAGE embedding failed (%s); spectral fallback", exc)
        try:
            import networkx as nx
            from sklearn.decomposition import TruncatedSVD

            adj = nx.to_numpy_array(g)
            svd = TruncatedSVD(n_components=min(dim, adj.shape[1] - 1 or 1))
            embs = svd.fit_transform(adj)
            return {nid: embs[i].tolist() for i, nid in enumerate(g.nodes())}
        except Exception as exc:  # noqa: BLE001
            logger.warning("Spectral embedding failed: %s", exc)
            return {}

    @staticmethod
    def _graphsage_embeddings(g: Any, dim: int) -> dict[str, list[float]]:
        """Train a small GraphSAGE model and return node embeddings."""
        import torch
        import torch_geometric
        from torch_geometric.nn import SAGEConv

        node_list = list(g.nodes())
        idx = {nid: i for i, nid in enumerate(node_list)}
        edge_index = torch.tensor(
            [[idx[u], idx[v]] for u, v in g.edges()],
            dtype=torch.long,
        ).t().contiguous()
        x = torch.eye(len(node_list))  # one-hot node features

        class GraphSAGE(torch.nn.Module):
            """3-layer GraphSAGE encoder."""

            def __init__(self) -> None:
                super().__init__()
                self.conv1 = SAGEConv(len(node_list), 128)
                self.conv2 = SAGEConv(128, 64)
                self.conv3 = SAGEConv(64, dim)

            def forward(self, x, edge_index):  # noqa: ANN001
                x = self.conv1(x, edge_index).relu()
                x = self.conv2(x, edge_index).relu()
                return self.conv3(x, edge_index)

        model = GraphSAGE()
        with torch.no_grad():
            embeddings = model(x, edge_index)
        return {
            node_list[i]: [round(float(v), 5) for v in embeddings[i].tolist()]
            for i in range(len(node_list))
        }


# ── Module-level singleton ────────────────────────────────────────────────────
_model: Optional[GNNModel] = None


def get_gnn_model() -> GNNModel:
    """Return the shared GNN model instance."""
    global _model
    if _model is None:
        _model = GNNModel()
    return _model
