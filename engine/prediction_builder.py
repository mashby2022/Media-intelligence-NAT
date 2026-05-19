"""Guided Model Studio / Prediction Builder helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


PREDICTION_OPTIONS: dict[str, list[str]] = {
    "objectives": ["audience_prediction", "ip_fit", "genre_saturation", "slate_gap_analysis", "churn_risk", "scenario_modeling"],
    "assets": ["title", "slate", "distributor", "audience_cluster", "book_ip", "uploaded_concept_script"],
    "strategies": ["baseline", "segment_first", "ensemble", "time_series", "graph_community", "sdg_augmented", "explainability_first"],
    "models": ["logistic_regression", "xgboost", "catboost", "clustering", "leiden_communities", "stacked_ensemble"],
    "publish_targets": ["dashboard_tile", "memo", "executive_summary", "deck", "api_object"],
}


MODEL_PRIORS: dict[str, dict[str, float | str]] = {
    "logistic_regression": {"score": 0.68, "confidence": "medium"},
    "xgboost": {"score": 0.78, "confidence": "medium"},
    "catboost": {"score": 0.77, "confidence": "medium"},
    "clustering": {"score": 0.64, "confidence": "low"},
    "leiden_communities": {"score": 0.73, "confidence": "medium"},
    "stacked_ensemble": {"score": 0.84, "confidence": "high"},
}


RUN_STORE: dict[str, dict[str, Any]] = {}


def prediction_builder_options() -> dict[str, Any]:
    return {
        "workflow": "guided_run_builder",
        "options": PREDICTION_OPTIONS,
        "default": {
            "objective": "ip_fit",
            "asset_type": "book_ip",
            "strategy": "sdg_augmented",
            "models": ["xgboost", "leiden_communities", "stacked_ensemble"],
            "publish_target": "memo",
        },
        "secrets_exposed": False,
    }


def run_prediction_builder(payload: dict[str, Any]) -> dict[str, Any]:
    objective = _validated(payload.get("objective"), PREDICTION_OPTIONS["objectives"], "ip_fit")
    asset = payload.get("asset") or {"type": "book_ip", "id": "ip_book_001", "title": "The Glass Orchard"}
    asset_type = _validated(asset.get("type") if isinstance(asset, dict) else None, PREDICTION_OPTIONS["assets"], "book_ip")
    strategy = _validated(payload.get("strategy"), PREDICTION_OPTIONS["strategies"], "sdg_augmented")
    requested_models = payload.get("models") or ["xgboost", "leiden_communities", "stacked_ensemble"]
    models = [model for model in requested_models if model in PREDICTION_OPTIONS["models"]] or ["xgboost"]
    publish_target = _validated(payload.get("publish_target"), PREDICTION_OPTIONS["publish_targets"], "memo")
    strategy_boost = {
        "baseline": 0.0,
        "segment_first": 0.03,
        "ensemble": 0.05,
        "time_series": 0.025,
        "graph_community": 0.04,
        "sdg_augmented": 0.06,
        "explainability_first": 0.02,
    }[strategy]
    model_results = []
    for model in models:
        prior = MODEL_PRIORS[model]
        score = min(0.97, round(float(prior["score"]) + strategy_boost, 3))
        model_results.append(
            {
                "model": model,
                "score": score,
                "confidence": prior["confidence"],
                "notes": _model_notes(model=model, strategy=strategy, objective=objective),
            }
        )
    best_model = max(model_results, key=lambda row: row["score"])
    run_id = f"prediction_{objective}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
    result = {
        "run_id": run_id,
        "objective": objective,
        "asset": {"type": asset_type, **(asset if isinstance(asset, dict) else {})},
        "strategy": strategy,
        "models": model_results,
        "best_model": best_model,
        "comparison": {
            "baseline_score": MODEL_PRIORS["logistic_regression"]["score"],
            "best_score": best_model["score"],
            "lift_vs_baseline": round(best_model["score"] - float(MODEL_PRIORS["logistic_regression"]["score"]), 3),
        },
        "agent_notes": {
            "missing_data": _missing_data(strategy=strategy, asset_type=asset_type),
            "low_confidence_drivers": ["limited external book trend history"] if asset_type == "book_ip" else [],
            "recommended_refinements": [
                "Run SDG metadata enrichment" if strategy != "sdg_augmented" else "Compare against non-SDG baseline",
                "Add comparable adaptation outcomes",
                "Publish selected output for stakeholder review",
            ],
        },
        "publish_options": PREDICTION_OPTIONS["publish_targets"],
        "selected_publish_target": publish_target,
        "secrets_exposed": False,
    }
    RUN_STORE[run_id] = result
    return result


def get_prediction_run(run_id: str) -> dict[str, Any] | None:
    return RUN_STORE.get(run_id)


def prediction_comparison(run_id: str) -> dict[str, Any] | None:
    run = get_prediction_run(run_id)
    if not run:
        return None
    return {
        "run_id": run_id,
        "objective": run["objective"],
        "strategy": run["strategy"],
        "comparison": run["comparison"],
        "models": run["models"],
        "secrets_exposed": False,
    }


def prediction_notes(run_id: str) -> dict[str, Any] | None:
    run = get_prediction_run(run_id)
    if not run:
        return None
    return {
        "run_id": run_id,
        "agent_notes": run["agent_notes"],
        "best_model": run["best_model"],
        "secrets_exposed": False,
    }


def publish_prediction_run(run_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any] | None:
    run = get_prediction_run(run_id)
    if not run:
        return None
    payload = payload or {}
    target = _validated(payload.get("publish_target"), PREDICTION_OPTIONS["publish_targets"], run["selected_publish_target"])
    return {
        "run_id": run_id,
        "publish_target": target,
        "status": "published_to_demo_surface",
        "artifact": {
            "type": target,
            "title": f"{run['objective'].replace('_', ' ').title()} - {run['best_model']['model']} recommendation",
            "summary": f"Best score {run['best_model']['score']} using {run['strategy']} strategy.",
        },
        "secrets_exposed": False,
    }


def _validated(value: Any, allowed: list[str], fallback: str) -> str:
    value = str(value or "").strip()
    return value if value in allowed else fallback


def _model_notes(*, model: str, strategy: str, objective: str) -> list[str]:
    notes = [f"Evaluated for {objective.replace('_', ' ')} under {strategy.replace('_', ' ')} strategy."]
    if model == "stacked_ensemble":
        notes.append("Best for balancing metadata, market, and graph signals.")
    if model == "leiden_communities":
        notes.append("Useful for graph-community/IP adjacency explanation.")
    if strategy == "sdg_augmented":
        notes.append("Includes synthetic enrichment branch for sparse fields.")
    return notes


def _missing_data(*, strategy: str, asset_type: str) -> list[str]:
    missing = ["source_confidence"]
    if asset_type == "book_ip":
        missing.extend(["rights_status", "publisher_momentum"])
    if strategy == "time_series":
        missing.append("longitudinal_history")
    return list(dict.fromkeys(missing))
