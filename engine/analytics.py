"""Persona-agnostic analytics over the Media Intelligence Engine data plane."""

from __future__ import annotations

import importlib.util
import time
from pathlib import Path
from typing import Any

import polars as pl

from engine.data_generator import _detect_effective_mode


DEFAULT_DATA_DIR = Path("data")


def compute_source_label() -> str:
    if _detect_effective_mode() == "ONLINE":
        return "High-Performance Compute Cluster"
    return "Standard Edge Node"


def _benchmark(started_at: float, rows_processed: int) -> dict[str, Any]:
    latency_ms = max((time.perf_counter() - started_at) * 1000, 0.001)
    throughput = rows_processed / (latency_ms / 1000)
    return {
        "latency_ms": round(latency_ms, 3),
        "throughput": round(throughput, 3),
        "compute_source": compute_source_label(),
    }


def load_scripts(data_dir: Path = DEFAULT_DATA_DIR) -> pl.DataFrame:
    return pl.read_parquet(data_dir / "scripts_150k.parquet")


def load_graph_edges(data_dir: Path = DEFAULT_DATA_DIR) -> pl.DataFrame:
    path = data_dir / "cultural_graph_edges.parquet"
    if not path.exists():
        return pl.DataFrame(
            {
                "source_id": [],
                "source_type": [],
                "target_id": [],
                "target_type": [],
                "edge_type": [],
                "weight": [],
                "source_name": [],
                "source_url": [],
            }
        )
    return pl.read_parquet(path)


def load_market_signals(data_dir: Path = DEFAULT_DATA_DIR) -> pl.DataFrame:
    path = data_dir / "market_signal_snapshot.parquet"
    if not path.exists():
        return pl.DataFrame(
            {
                "signal_id": [],
                "signal_name": [],
                "signal_category": [],
                "rank": [],
                "signal_strength": [],
                "primary_metric": [],
                "primary_metric_name": [],
                "metadata": [],
                "source_name": [],
                "source_url": [],
            }
        )
    return pl.read_parquet(path)


def graph_engine_capabilities() -> dict[str, Any]:
    packages = {
        "cudf": importlib.util.find_spec("cudf") is not None,
        "cugraph": importlib.util.find_spec("cugraph") is not None,
        "networkx": importlib.util.find_spec("networkx") is not None,
    }
    return {
        "accelerated_available": packages["cudf"] and packages["cugraph"],
        "standard_available": packages["networkx"],
        "packages": packages,
        "active_engine": "cuGraph" if packages["cudf"] and packages["cugraph"] else "NetworkX/Polars",
        "compute_source": "High-Performance Compute Cluster"
        if packages["cudf"] and packages["cugraph"]
        else "Standard Edge Node",
    }


def load_graph_edges_cudf(data_dir: Path = DEFAULT_DATA_DIR) -> Any:
    if importlib.util.find_spec("cudf") is None:
        raise RuntimeError("cudf is not installed; cuGraph loading is unavailable.")
    cudf = __import__("cudf")
    return cudf.read_parquet(data_dir / "cultural_graph_edges.parquet")


def build_cugraph(data_dir: Path = DEFAULT_DATA_DIR) -> Any:
    if importlib.util.find_spec("cugraph") is None:
        raise RuntimeError("cugraph is not installed; accelerated graph analytics are unavailable.")
    cugraph = __import__("cugraph")
    gdf = load_graph_edges_cudf(data_dir)
    graph = cugraph.Graph(directed=False)
    graph.from_cudf_edgelist(gdf, source="source_id", destination="target_id", edge_attr="weight")
    return graph


def _budget_tier_expr() -> pl.Expr:
    return (
        pl.when((pl.col("runtime_minutes") >= 115) | (pl.col("genre_primary").is_in(["Action", "Sci-Fi", "Fantasy"])))
        .then(pl.lit("Premium"))
        .when((pl.col("runtime_minutes") >= 85) | (pl.col("platform_fit").is_in(["Streaming", "Theatrical"])))
        .then(pl.lit("Standard"))
        .otherwise(pl.lit("Lean"))
        .alias("budget_tier")
    )


def _emergent_trend_expr() -> pl.Expr:
    return (
        pl.when((pl.col("music_momentum_score") >= 0.82) & (pl.col("viability_score") >= 0.8))
        .then(pl.lit("Momentum Breakout"))
        .when((pl.col("cultural_risk_score") >= 0.5) & (pl.col("completion_prediction") >= 0.62))
        .then(pl.lit("Risk-Reward Narrative"))
        .when((pl.col("audience_behavior_score") >= 0.72) & (pl.col("prime_time_affinity") >= 0.45))
        .then(pl.lit("Audience Pull"))
        .otherwise(pl.lit("Stable Demand"))
        .alias("emergent_trend")
    )


def with_operator_fields(scripts: pl.DataFrame) -> pl.DataFrame:
    """Add Phase 2 operator fields without mutating the stored Parquet schema."""

    defaults = {
        "runtime_minutes": 90,
        "audience_behavior_score": 0.65,
        "prime_time_affinity": 0.0,
        "music_momentum_score": 0.5,
        "viability_score": 0.5,
        "completion_prediction": 0.5,
        "cultural_risk_score": 0.5,
        "genre_primary": "Unknown",
        "platform_fit": "Unknown",
    }
    missing_defaults = [
        pl.lit(value).alias(column) for column, value in defaults.items() if column not in scripts.columns
    ]
    if missing_defaults:
        scripts = scripts.with_columns(missing_defaults)

    expressions: list[pl.Expr] = []
    if "budget_tier" not in scripts.columns:
        expressions.append(_budget_tier_expr())
    if "emergent_trend" not in scripts.columns:
        expressions.append(_emergent_trend_expr())
    if not expressions:
        return scripts
    return scripts.with_columns(expressions)


def _apply_script_filters(scripts: pl.DataFrame, filters: dict[str, Any] | None = None) -> pl.DataFrame:
    filters = filters or {}
    filtered = with_operator_fields(scripts)
    for column, key in [
        ("genre_primary", "genre"),
        ("platform_fit", "platform"),
        ("target_demo", "demo"),
        ("market", "market"),
        ("risk_category", "risk_category"),
        ("budget_tier", "budget_tier"),
        ("emergent_trend", "emergent_trend"),
    ]:
        value = filters.get(key)
        if value:
            filtered = filtered.filter(pl.col(column) == value)
    min_viability = filters.get("min_viability")
    if min_viability is not None:
        filtered = filtered.filter(pl.col("viability_score") >= float(min_viability))
    max_risk = filters.get("max_risk")
    if max_risk is not None:
        filtered = filtered.filter(pl.col("cultural_risk_score") <= float(max_risk))
    return filtered


def portfolio_evidence(data_dir: Path = DEFAULT_DATA_DIR, limit: int = 10) -> dict[str, Any]:
    started_at = time.perf_counter()
    scripts = load_scripts(data_dir)
    rows_processed = scripts.height

    summary = scripts.select(
        pl.len().alias("records"),
        pl.col("viability_score").mean().round(4).alias("avg_viability"),
        pl.col("completion_prediction").mean().round(4).alias("avg_completion_prediction"),
        pl.col("cultural_risk_score").mean().round(4).alias("avg_cultural_risk"),
        pl.col("script_id").n_unique().alias("unique_scripts"),
    ).to_dicts()[0]
    genre_breakdown = (
        scripts.group_by("genre_primary")
        .agg(
            pl.len().alias("records"),
            pl.col("viability_score").mean().round(4).alias("avg_viability"),
            pl.col("cultural_risk_score").mean().round(4).alias("avg_cultural_risk"),
        )
        .sort(["avg_viability", "records"], descending=[True, True])
        .to_dicts()
    )
    top_candidates = (
        scripts.sort(["viability_score", "completion_prediction"], descending=[True, True])
        .select(
            "script_id",
            "title",
            "genre_primary",
            "platform_fit",
            "target_demo",
            "market",
            "viability_score",
            "completion_prediction",
            "risk_category",
            "music_momentum_score",
        )
        .head(limit)
        .to_dicts()
    )

    return {
        "evidence_type": "portfolio_summary",
        "summary": summary,
        "genre_breakdown": genre_breakdown,
        "top_candidates": top_candidates,
        "benchmark": _benchmark(started_at, rows_processed),
    }


def market_signal_evidence(data_dir: Path = DEFAULT_DATA_DIR, limit: int = 10) -> dict[str, Any]:
    started_at = time.perf_counter()
    signals = load_market_signals(data_dir)
    rows_processed = signals.height
    if signals.is_empty():
        category_counts: list[dict[str, Any]] = []
        top_signals: list[dict[str, Any]] = []
    else:
        category_counts = (
            signals.group_by("signal_category")
            .agg(
                pl.len().alias("signals"),
                pl.col("signal_strength").mean().round(4).alias("avg_signal_strength"),
            )
            .sort("signals", descending=True)
            .to_dicts()
        )
        top_signals = (
            signals.sort(["signal_strength", "rank"], descending=[True, False])
            .head(limit)
            .to_dicts()
        )
    return {
        "evidence_type": "market_signal_snapshot",
        "summary": {"signals": rows_processed},
        "category_counts": category_counts,
        "top_signals": top_signals,
        "benchmark": _benchmark(started_at, rows_processed),
    }


def workspace_evidence(
    data_dir: Path = DEFAULT_DATA_DIR,
    filters: dict[str, Any] | None = None,
    limit: int = 250,
) -> dict[str, Any]:
    started_at = time.perf_counter()
    scripts = with_operator_fields(load_scripts(data_dir))
    filtered = _apply_script_filters(scripts, filters)
    rows_processed = scripts.height

    if filtered.is_empty():
        kpis = {
            "records": 0,
            "avg_viability": None,
            "avg_completion_prediction": None,
            "avg_cultural_risk": None,
            "high_viability_records": 0,
        }
        scatter_points: list[dict[str, Any]] = []
        table_rows: list[dict[str, Any]] = []
        segment_breakdown: list[dict[str, Any]] = []
    else:
        kpis = filtered.select(
            pl.len().alias("records"),
            pl.col("viability_score").mean().round(4).alias("avg_viability"),
            pl.col("completion_prediction").mean().round(4).alias("avg_completion_prediction"),
            pl.col("cultural_risk_score").mean().round(4).alias("avg_cultural_risk"),
            (pl.col("viability_score") >= 0.8).sum().alias("high_viability_records"),
        ).to_dicts()[0]
        ranked = filtered.sort(["viability_score", "completion_prediction"], descending=[True, True]).head(limit)
        scatter_points = ranked.select(
            "script_id",
            "title",
            "genre_primary",
            "platform_fit",
            "target_demo",
            "viability_score",
            "completion_prediction",
            "cultural_risk_score",
            "risk_category",
            "music_momentum_score",
            "budget_tier",
            "emergent_trend",
        ).to_dicts()
        table_rows = ranked.select(
            "script_id",
            "title",
            "genre_primary",
            "platform_fit",
            "target_demo",
            "market",
            "budget_tier",
            "emergent_trend",
            "viability_score",
            "completion_prediction",
            "risk_category",
        ).to_dicts()
        segment_breakdown = (
            filtered.group_by(["genre_primary", "platform_fit"])
            .agg(
                pl.len().alias("records"),
                pl.col("viability_score").mean().round(4).alias("avg_viability"),
                pl.col("cultural_risk_score").mean().round(4).alias("avg_cultural_risk"),
            )
            .sort(["avg_viability", "records"], descending=[True, True])
            .head(20)
            .to_dicts()
        )

    filter_options = {
        "genres": scripts.get_column("genre_primary").unique().sort().to_list(),
        "platforms": scripts.get_column("platform_fit").unique().sort().to_list(),
        "demos": scripts.get_column("target_demo").unique().sort().to_list(),
        "markets": scripts.get_column("market").unique().sort().to_list(),
        "risk_categories": scripts.get_column("risk_category").unique().sort().to_list(),
        "budget_tiers": scripts.get_column("budget_tier").unique().sort().to_list(),
        "emergent_trends": scripts.get_column("emergent_trend").unique().sort().to_list(),
    }

    return {
        "evidence_type": "operator_workspace",
        "filters": filters or {},
        "filter_options": filter_options,
        "kpis": kpis,
        "scatter_points": scatter_points,
        "table_rows": table_rows,
        "segment_breakdown": segment_breakdown,
        "benchmark": _benchmark(started_at, rows_processed),
    }


def graph_evidence(data_dir: Path = DEFAULT_DATA_DIR) -> dict[str, Any]:
    started_at = time.perf_counter()
    edges = load_graph_edges(data_dir)
    rows_processed = edges.height
    if edges.is_empty():
        edge_counts: list[dict[str, Any]] = []
        target_counts: list[dict[str, Any]] = []
    else:
        edge_counts = edges.group_by("edge_type").agg(pl.len().alias("edges")).sort("edges", descending=True).to_dicts()
        target_counts = (
            edges.group_by("target_type").agg(pl.len().alias("edges")).sort("edges", descending=True).to_dicts()
        )
    return {
        "evidence_type": "graph_summary",
        "summary": {"edges": rows_processed},
        "edge_counts": edge_counts,
        "target_counts": target_counts,
        "graph_engine": graph_engine_capabilities(),
        "benchmark": _benchmark(started_at, rows_processed),
    }


def _empty_signal_network(signal_id: str, started_at: float, rows_processed: int) -> dict[str, Any]:
    return {
        "evidence_type": "cultural_signal_network",
        "signal_id": signal_id,
        "summary": {
            "connected_scripts": 0,
            "related_signals": 0,
            "avg_viability": None,
            "avg_cultural_risk": None,
            "structural_boost_index": None,
            "structural_vulnerability_index": None,
        },
        "boosted_scripts": [],
        "vulnerable_scripts": [],
        "related_signals": [],
        "communities": [],
        "graph_engine": graph_engine_capabilities(),
        "benchmark": _benchmark(started_at, rows_processed),
    }


def _weighted_pagerank(adjacency: dict[str, dict[str, float]], iterations: int = 30, damping: float = 0.85) -> dict[str, float]:
    if not adjacency:
        return {}
    nodes = list(adjacency)
    node_count = len(nodes)
    ranks = {node: 1.0 / node_count for node in nodes}
    base = (1.0 - damping) / node_count
    for _ in range(iterations):
        next_ranks = {node: base for node in nodes}
        for source, targets in adjacency.items():
            total_weight = sum(targets.values()) or 1.0
            for target, weight in targets.items():
                next_ranks[target] += damping * ranks[source] * (weight / total_weight)
        ranks = next_ranks
    return ranks


def _connected_communities(adjacency: dict[str, dict[str, float]], limit: int) -> list[set[str]]:
    remaining = set(adjacency)
    communities: list[set[str]] = []
    while remaining and len(communities) < limit:
        root = remaining.pop()
        community = {root}
        stack = [root]
        while stack:
            node = stack.pop()
            for neighbor in adjacency.get(node, {}):
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    community.add(neighbor)
                    stack.append(neighbor)
        communities.append(community)
    return sorted(communities, key=len, reverse=True)


def cultural_signal_network_evidence(
    signal_id: str,
    data_dir: Path = DEFAULT_DATA_DIR,
    limit: int = 10,
) -> dict[str, Any]:
    """Run PageRank/community-style analysis for scripts connected to a cultural signal."""

    started_at = time.perf_counter()
    scripts = with_operator_fields(load_scripts(data_dir))
    rows_processed = scripts.height
    linked = scripts.filter(pl.col("cultural_signal_ids").list.contains(signal_id))
    if linked.is_empty():
        return _empty_signal_network(signal_id, started_at, rows_processed)

    signal_rows = (
        linked.select("script_id", "cultural_signal_ids")
        .explode("cultural_signal_ids")
        .rename({"cultural_signal_ids": "related_signal_id"})
    )
    related_signals = (
        signal_rows.group_by("related_signal_id")
        .agg(pl.len().alias("shared_scripts"))
        .sort("shared_scripts", descending=True)
        .head(limit)
        .to_dicts()
    )

    ranked = linked.with_columns(
        (
            (pl.col("viability_score") * 0.35)
            + (pl.col("completion_prediction") * 0.25)
            + (pl.col("music_momentum_score") * 0.20)
            + (pl.col("audience_behavior_score") * 0.10)
            - (pl.col("cultural_risk_score") * 0.10)
        )
        .round(4)
        .alias("structural_boost_score"),
        (
            (pl.col("cultural_risk_score") * 0.45)
            + ((1 - pl.col("completion_prediction")) * 0.25)
            + ((1 - pl.col("viability_score")) * 0.20)
            + ((1 - pl.col("music_momentum_score")) * 0.10)
        )
        .round(4)
        .alias("structural_vulnerability_score"),
    )

    adjacency: dict[str, dict[str, float]] = {}
    for row in signal_rows.iter_rows(named=True):
        source = str(row["script_id"])
        target = str(row["related_signal_id"])
        adjacency.setdefault(source, {})[target] = 1.0
        adjacency.setdefault(target, {})[source] = 1.0

    communities: list[dict[str, Any]] = []
    graph_engine = graph_engine_capabilities()
    pagerank = _weighted_pagerank(adjacency)
    script_pagerank = pl.DataFrame(
        [
            {"script_id": node, "pagerank": round(score, 6)}
            for node, score in pagerank.items()
            if str(node).startswith("script_")
        ]
    )
    if not script_pagerank.is_empty():
        ranked = ranked.join(script_pagerank, on="script_id", how="left").with_columns(pl.col("pagerank").fill_null(0.0))
        ranked = ranked.with_columns(
            (pl.col("structural_boost_score") + (pl.col("pagerank") * 10)).round(4).alias(
                "structural_boost_score"
            )
        )
    for idx, community in enumerate(_connected_communities(adjacency, limit=limit), start=1):
        script_count = sum(str(node).startswith("script_") for node in community)
        signal_count = len(community) - script_count
        communities.append(
            {
                "community_id": f"community_{idx:03d}",
                "scripts": script_count,
                "signals": signal_count,
                "contains_target_signal": signal_id in community,
            }
        )

    boosted_scripts = (
        ranked.sort(["structural_boost_score", "viability_score"], descending=[True, True])
        .select(
            "script_id",
            "title",
            "genre_primary",
            "platform_fit",
            "target_demo",
            "budget_tier",
            "emergent_trend",
            "viability_score",
            "completion_prediction",
            "cultural_risk_score",
            "risk_category",
            "structural_boost_score",
        )
        .head(limit)
        .to_dicts()
    )
    vulnerable_scripts = (
        ranked.sort(["structural_vulnerability_score", "cultural_risk_score"], descending=[True, True])
        .select(
            "script_id",
            "title",
            "genre_primary",
            "platform_fit",
            "target_demo",
            "budget_tier",
            "emergent_trend",
            "viability_score",
            "completion_prediction",
            "cultural_risk_score",
            "risk_category",
            "structural_vulnerability_score",
        )
        .head(limit)
        .to_dicts()
    )
    summary = ranked.select(
        pl.len().alias("connected_scripts"),
        pl.col("viability_score").mean().round(4).alias("avg_viability"),
        pl.col("cultural_risk_score").mean().round(4).alias("avg_cultural_risk"),
        pl.col("structural_boost_score").mean().round(4).alias("structural_boost_index"),
        pl.col("structural_vulnerability_score").mean().round(4).alias("structural_vulnerability_index"),
    ).to_dicts()[0]
    summary["related_signals"] = signal_rows.get_column("related_signal_id").n_unique()

    return {
        "evidence_type": "cultural_signal_network",
        "signal_id": signal_id,
        "summary": summary,
        "boosted_scripts": boosted_scripts,
        "vulnerable_scripts": vulnerable_scripts,
        "related_signals": related_signals,
        "communities": communities,
        "graph_engine": graph_engine,
        "benchmark": _benchmark(started_at, rows_processed),
    }
