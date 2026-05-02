"""Theme-agnostic workspace payloads for operator dashboards."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

from engine.analytics import DEFAULT_DATA_DIR, graph_evidence, portfolio_evidence, workspace_evidence


DEFAULT_THEME = {
    "--mie-bg": "#f7f7f4",
    "--mie-panel": "#ffffff",
    "--mie-text": "#1e2528",
    "--mie-muted": "#667074",
    "--mie-accent": "#0f766e",
    "--mie-risk": "#b42318",
}


def accelerated_visual_capabilities() -> dict[str, Any]:
    packages = {
        "cudf": importlib.util.find_spec("cudf") is not None,
        "cuxfilter": importlib.util.find_spec("cuxfilter") is not None,
        "hdbscan": importlib.util.find_spec("hdbscan") is not None,
    }
    return {
        "available": all(packages.values()),
        "packages": packages,
        "compute_source": "High-Performance Compute Cluster" if packages["cudf"] else "Standard Edge Node",
    }


def _require_module(module_name: str) -> Any:
    if importlib.util.find_spec(module_name) is None:
        raise RuntimeError(f"{module_name} is not installed; accelerated visual mode is unavailable.")
    return __import__(module_name)


def load_scripts_cudf(data_dir: Path = DEFAULT_DATA_DIR) -> Any:
    """Load scripts into cuDF and add operator fields for cuxfilter controls."""

    cudf = _require_module("cudf")
    gdf = cudf.read_parquet(data_dir / "scripts_150k.parquet")

    if "budget_tier" not in gdf.columns:
        gdf["budget_tier"] = "Lean"
        premium_mask = (gdf["runtime_minutes"] >= 115) | gdf["genre_primary"].isin(["Action", "Sci-Fi", "Fantasy"])
        standard_mask = (gdf["runtime_minutes"] >= 85) | gdf["platform_fit"].isin(["Streaming", "Theatrical"])
        gdf.loc[standard_mask, "budget_tier"] = "Standard"
        gdf.loc[premium_mask, "budget_tier"] = "Premium"

    return gdf


def add_hdbscan_emergent_trends(frame: Any, min_cluster_size: int = 250) -> Any:
    """Color-code records by HDBSCAN trend clusters when hdbscan is installed."""

    hdbscan = _require_module("hdbscan")
    feature_columns = [
        "viability_score",
        "completion_prediction",
        "cultural_risk_score",
        "music_momentum_score",
        "audience_behavior_score",
        "prime_time_affinity",
    ]
    pandas_frame = frame[feature_columns].to_pandas() if hasattr(frame, "to_pandas") else frame[feature_columns]
    features = pandas_frame.fillna(0.0).to_numpy()
    clusterer = hdbscan.HDBSCAN(min_cluster_size=min_cluster_size)
    labels = clusterer.fit_predict(features)
    frame["emergent_trend"] = [f"Emergent Trend {label}" if label >= 0 else "Noise / Long Tail" for label in labels]
    return frame


def cuxfilter_dashboard_spec() -> dict[str, Any]:
    """Describe the accelerated dashboard controls without importing cuxfilter."""

    return {
        "theme": "cuxfilter.themes.dark",
        "dataframe": "cuDF:data/scripts_150k.parquet",
        "charts": [
            {"type": "bar", "column": "target_demo", "label": "Target Demographic"},
            {"type": "range_slider", "column": "viability_score", "label": "Commercial Viability"},
            {"type": "bar", "column": "budget_tier", "label": "Budget Tier"},
            {
                "type": "scatter",
                "x": "viability_score",
                "y": "cultural_risk_score",
                "color": "emergent_trend",
                "label": "Emergent Trends",
            },
        ],
    }


def stand_up_cuxfilter_server(
    data_dir: Path = DEFAULT_DATA_DIR,
    port: int = 8787,
    title: str = "Media Intelligence Engine Operator Workspace",
    start: bool = True,
) -> dict[str, Any]:
    """Create and optionally start a dark cuxfilter dashboard backed by cuDF."""

    capabilities = accelerated_visual_capabilities()
    missing = [name for name, installed in capabilities["packages"].items() if not installed]
    if missing:
        return {
            "status": "unavailable",
            "missing": missing,
            "capabilities": capabilities,
            "spec": cuxfilter_dashboard_spec(),
        }

    cuxfilter = _require_module("cuxfilter")
    gdf = add_hdbscan_emergent_trends(load_scripts_cudf(data_dir=data_dir))
    cux_df = cuxfilter.DataFrame.from_dataframe(gdf)
    charts = [
        cuxfilter.charts.bar("target_demo", title="Target Demographic"),
        cuxfilter.charts.range_slider("viability_score"),
        cuxfilter.charts.bar("budget_tier", title="Budget Tier"),
        cuxfilter.charts.scatter(
            x="viability_score",
            y="cultural_risk_score",
            aggregate_col="script_id",
            color_palette="Viridis",
            title="Emergent Trends",
        ),
    ]
    dashboard = cux_df.dashboard(charts, theme=cuxfilter.themes.dark, title=title)
    if start:
        dashboard.show(port=port)
    return {
        "status": "running" if start else "ready",
        "port": port,
        "theme": "cuxfilter.themes.dark",
        "dashboard": dashboard,
        "capabilities": capabilities,
        "spec": cuxfilter_dashboard_spec(),
    }


def workspace_payload(
    data_dir: Path = DEFAULT_DATA_DIR,
    theme: dict[str, str] | None = None,
    filters: dict[str, Any] | None = None,
    limit: int = 250,
) -> dict[str, Any]:
    css_variables = {**DEFAULT_THEME, **(theme or {})}
    portfolio = portfolio_evidence(data_dir=data_dir, limit=25)
    workspace = workspace_evidence(data_dir=data_dir, filters=filters, limit=limit)
    graph = graph_evidence(data_dir=data_dir)
    return {
        "workspace_type": "interactive_media_intelligence",
        "theme": css_variables,
        "accelerated_visuals": {
            "capabilities": accelerated_visual_capabilities(),
            "cuxfilter": cuxfilter_dashboard_spec(),
        },
        "streams": {
            "portfolio": portfolio,
            "workspace": workspace,
            "graph": graph,
        },
    }
