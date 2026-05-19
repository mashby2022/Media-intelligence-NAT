"""Use-case registry for the modular Miranda/NAT demo platform."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


USE_CASE_REGISTRY: dict[str, dict[str, Any]] = {
    "media_greenlight": {
        "use_case_id": "media_greenlight",
        "name": "Media Greenlight Briefing",
        "status": "active",
        "description": "Rank title/slate opportunities and generate an executive greenlight brief.",
        "default_personas": ["executive", "development", "operator"],
        "mvc_layers": {
            "model": ["portfolio_evidence", "market_signals", "historical_memory", "cultural_graph"],
            "controller": ["nat_compatible_workflow", "tool_router", "reasoning_trace", "dispatch_ready_output"],
            "template": ["executive_brief", "operator_workspace", "communication_artifact"],
        },
        "nat": {
            "workflow_config": "agent/workflows/media_greenlight.yml",
            "runtime": "python_fallback",
            "nat_compatible": True,
            "nat_execution_enabled": False,
            "tools": [
                "get_portfolio_evidence",
                "query_historical_memory",
                "get_market_signal_evidence",
                "analyze_cultural_signal_network",
            ],
            "evals": ["schema_contract", "trace_completeness", "evidence_presence", "no_secret_leakage"],
        },
        "inputs": ["title", "slate", "audience_cluster", "uploaded_concept"],
        "outputs": ["executive_summary", "memo", "dashboard_tile", "deck_outline", "api_object"],
    },
    "ip_scouting": {
        "use_case_id": "ip_scouting",
        "name": "IP Scouting",
        "status": "planned",
        "description": "Identify rising books/IP and adaptation opportunities before competitors.",
        "default_personas": ["development", "executive", "legal"],
        "mvc_layers": {
            "model": ["book_trend_signals", "ip_profiles", "market_signals", "rights_metadata"],
            "controller": ["query_planner", "data_enrichment", "prediction_validation", "persona_output"],
            "template": ["development_memo", "executive_summary", "legal_risk_view"],
        },
        "nat": {
            "workflow_config": "agent/workflows/ip_scouting.yml",
            "runtime": "planned",
            "nat_compatible": True,
            "nat_execution_enabled": False,
            "tools": ["book_trend_signals", "metadata_enrichment", "market_signals", "memory_lookup"],
            "evals": ["metadata_completeness", "rights_gap_check", "adaptation_fit_schema"],
        },
        "inputs": ["book_ip", "topic", "paragraph", "rights_roster"],
        "outputs": ["development_memo", "executive_summary", "deck_outline", "api_object"],
    },
    "title_enrichment": {
        "use_case_id": "title_enrichment",
        "name": "Title Metadata Enrichment",
        "status": "planned",
        "description": "Detect missing title/IP fields and prepare enrichment recommendations.",
        "default_personas": ["operator", "research", "legal"],
        "mvc_layers": {
            "model": ["title_metadata", "source_registry", "client_private_fields", "sdg_enrichment_candidates"],
            "controller": ["gap_detector", "source_router", "enrichment_validator"],
            "template": ["metadata_gap_report", "operator_queue", "api_object"],
        },
        "nat": {
            "workflow_config": "agent/workflows/title_enrichment.yml",
            "runtime": "planned",
            "nat_compatible": True,
            "nat_execution_enabled": False,
            "tools": ["metadata_gap_detector", "source_registry", "nemo_data_designer_sdg"],
            "evals": ["field_completeness", "source_confidence", "pii_secret_boundary"],
        },
        "inputs": ["title_metadata_record", "uploaded_concept", "book_ip", "deal_roster_item"],
        "outputs": ["metadata_gap_report", "dashboard_tile", "api_object"],
    },
    "audience_expansion": {
        "use_case_id": "audience_expansion",
        "name": "Audience Expansion",
        "status": "planned",
        "description": "Find underserved markets, audience segments, and expansion lanes.",
        "default_personas": ["marketing", "research", "executive"],
        "mvc_layers": {
            "model": ["audience_profiles", "market_signals", "historical_memory", "regional_language_signals"],
            "controller": ["segment_router", "market_gap_analysis", "confidence_validator"],
            "template": ["marketing_angle", "research_report", "executive_summary"],
        },
        "nat": {
            "workflow_config": "agent/workflows/audience_expansion.yml",
            "runtime": "planned",
            "nat_compatible": True,
            "nat_execution_enabled": False,
            "tools": ["audience_profiles", "market_signals", "knowledge_search", "persona_output"],
            "evals": ["segment_coverage", "unsupported_claim_rate", "recommendation_stability"],
        },
        "inputs": ["audience_cluster", "topic", "title", "slate"],
        "outputs": ["marketing_angle", "research_report", "executive_summary", "deck_outline"],
    },
    "persona_report": {
        "use_case_id": "persona_report",
        "name": "Persona Report Rendering",
        "status": "planned",
        "description": "Render the same evidence package for executive, development, marketing, research, legal, or operator users.",
        "default_personas": ["executive", "development", "marketing", "research", "legal", "operator"],
        "mvc_layers": {
            "model": ["shared_insight_package", "persona_context", "output_contracts"],
            "controller": ["persona_router", "template_selector", "format_validator"],
            "template": ["memo", "dashboard", "report", "deck_outline", "api_object"],
        },
        "nat": {
            "workflow_config": "agent/workflows/persona_report.yml",
            "runtime": "planned",
            "nat_compatible": True,
            "nat_execution_enabled": False,
            "tools": ["persona_router", "template_renderer", "format_validator"],
            "evals": ["persona_fit", "format_schema", "evidence_coverage"],
        },
        "inputs": ["shared_insight_package", "persona", "format"],
        "outputs": ["memo", "dashboard", "report", "deck_outline", "api_object"],
    },
    "prediction_builder": {
        "use_case_id": "prediction_builder",
        "name": "Model Studio / Prediction Builder",
        "status": "planned",
        "description": "Guide users through objective, asset, strategy, model selection, comparison, agent notes, and publishing.",
        "default_personas": ["operator", "development", "research", "executive"],
        "mvc_layers": {
            "model": ["assets", "model_registry", "prediction_outputs", "sdg_variants"],
            "controller": ["guided_run_builder", "strategy_planner", "model_runner", "comparison_engine", "prediction_validator"],
            "template": ["dashboard_tile", "memo", "executive_summary", "deck", "api_object"],
        },
        "nat": {
            "workflow_config": "agent/workflows/prediction_builder.yml",
            "runtime": "planned",
            "nat_compatible": True,
            "nat_execution_enabled": False,
            "tools": ["objective_planner", "asset_resolver", "strategy_selector", "model_runner", "publisher"],
            "evals": ["prediction_confidence", "missing_data_notes", "comparison_schema", "publish_contract"],
        },
        "objectives": ["audience_prediction", "ip_fit", "genre_saturation", "slate_gap_analysis", "churn_risk", "scenario_modeling"],
        "assets": ["title", "slate", "distributor", "audience_cluster", "book_ip", "uploaded_concept_script"],
        "strategies": ["baseline", "segment_first", "ensemble", "time_series", "graph_community", "sdg_augmented", "explainability_first"],
        "models": ["logistic_regression", "xgboost", "catboost", "clustering", "leiden_communities", "stacked_ensemble"],
        "outputs": ["dashboard_tile", "memo", "executive_summary", "deck", "api_object"],
    },
}


def list_use_cases() -> list[dict[str, Any]]:
    return [
        {
            "use_case_id": use_case["use_case_id"],
            "name": use_case["name"],
            "status": use_case["status"],
            "description": use_case["description"],
            "default_personas": use_case["default_personas"],
            "outputs": use_case["outputs"],
            "nat": {
                "runtime": use_case["nat"]["runtime"],
                "nat_compatible": use_case["nat"]["nat_compatible"],
                "nat_execution_enabled": use_case["nat"]["nat_execution_enabled"],
            },
        }
        for use_case in USE_CASE_REGISTRY.values()
    ]


def get_use_case(use_case_id: str) -> dict[str, Any]:
    use_case = USE_CASE_REGISTRY.get(use_case_id)
    if not use_case:
        raise KeyError(use_case_id)
    return deepcopy(use_case)


def use_case_readiness(use_case_id: str) -> dict[str, Any]:
    use_case = get_use_case(use_case_id)
    active = use_case["status"] == "active"
    return {
        "use_case_id": use_case_id,
        "status": "ready" if active else "planned",
        "runtime": use_case["nat"]["runtime"],
        "nat_compatible": use_case["nat"]["nat_compatible"],
        "nat_execution_enabled": use_case["nat"]["nat_execution_enabled"],
        "workflow_config": use_case["nat"]["workflow_config"],
        "checks": [
            {"name": "contract_registered", "passed": True},
            {"name": "tools_declared", "passed": bool(use_case["nat"]["tools"])},
            {"name": "evals_declared", "passed": bool(use_case["nat"]["evals"])},
            {"name": "runtime_active", "passed": active},
        ],
    }
