"""Miranda query planning helpers for use-case and persona routing."""

from __future__ import annotations

from typing import Any

from agent.orchestration import orchestration_trace


USE_CASE_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("prediction_builder", ("model", "prediction", "predict", "churn", "scenario", "saturation", "ensemble", "xgboost", "catboost")),
    ("ip_scouting", ("book", "ip", "rights", "author", "scout", "adaptation", "goodreads", "property")),
    ("title_enrichment", ("missing", "metadata", "enrich", "incomplete", "field", "title data")),
    ("audience_expansion", ("audience", "market", "underserved", "segment", "geo", "language", "expansion")),
    ("persona_report", ("memo", "report", "deck", "legal", "marketing", "research", "api", "summary")),
]

PERSONA_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("legal", ("legal", "rights", "deal", "risk", "contract")),
    ("marketing", ("marketing", "campaign", "audience", "positioning", "social")),
    ("research", ("research", "evidence", "study", "analysis", "report")),
    ("development", ("development", "develop", "greenlight", "slate", "ip", "book")),
    ("operator", ("operator", "dashboard", "validate", "trace", "data")),
    ("executive", ("executive", "ceo", "leadership", "summary", "brief")),
]

INPUT_TYPE_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("uploaded_concept_script", ("script", "treatment", "concept", "upload")),
    ("book_ip", ("book", "ip", "author", "rights", "property")),
    ("audience_cluster", ("audience", "segment", "cluster")),
    ("slate", ("slate", "portfolio")),
    ("title", ("title", "show", "film", "series")),
    ("topic", ("topic", "market", "trend", "genre")),
]

OUTPUT_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("deck_outline", ("deck", "slides", "presentation")),
    ("api_object", ("api", "json", "object")),
    ("dashboard_tile", ("dashboard", "tile")),
    ("memo", ("memo", "report")),
    ("executive_summary", ("summary", "brief")),
]


def _match_keyword(text: str, options: list[tuple[str, tuple[str, ...]]], fallback: str) -> str:
    for value, keywords in options:
        if any(keyword in text for keyword in keywords):
            return value
    return fallback


def plan_miranda_query(raw_query: str) -> dict[str, Any]:
    normalized = " ".join(raw_query.lower().split())
    use_case = _match_keyword(normalized, USE_CASE_KEYWORDS, "media_greenlight")
    persona = _match_keyword(normalized, PERSONA_KEYWORDS, "executive")
    input_type = _match_keyword(normalized, INPUT_TYPE_KEYWORDS, "topic")
    requested_output = _match_keyword(normalized, OUTPUT_KEYWORDS, "executive_summary")

    needs_enrichment = use_case in {"ip_scouting", "title_enrichment", "prediction_builder"} or any(
        term in normalized for term in ("missing", "incomplete", "enrich", "sparse", "unknown")
    )
    selected_agents = [
        "query_planner",
        "data_enrichment" if needs_enrichment else "evidence_retrieval",
        "prediction_validator" if use_case == "prediction_builder" else "evidence_validator",
        "persona_output",
    ]
    tools_by_use_case = {
        "media_greenlight": ["portfolio_evidence", "historical_memory", "market_signals"],
        "ip_scouting": ["book_trend_signals", "metadata_enrichment", "market_signals", "memory_lookup"],
        "title_enrichment": ["metadata_gap_detector", "source_registry", "nemo_data_designer_sdg"],
        "audience_expansion": ["audience_profiles", "market_signals", "knowledge_search"],
        "persona_report": ["persona_router", "template_renderer", "format_validator"],
        "prediction_builder": ["objective_planner", "asset_resolver", "strategy_selector", "model_runner"],
    }
    missing_data = []
    if use_case in {"ip_scouting", "prediction_builder"}:
        missing_data.extend(["rights_status", "publisher_momentum"])
    if needs_enrichment:
        missing_data.append("source_confidence")

    refinement_options = {
        "media_greenlight": ["Compare by audience segment", "Show operator evidence", "Generate executive memo"],
        "ip_scouting": ["Narrow by genre", "Compare global adaptation fit", "Show legal/IP risk"],
        "title_enrichment": ["Run SDG enrichment", "Prioritize high-impact fields", "Show source confidence"],
        "audience_expansion": ["Narrow to one market", "Compare language segments", "Show marketing angle"],
        "persona_report": ["Switch persona", "Change output format", "Include evidence appendix"],
        "prediction_builder": ["Run SDG-augmented strategy", "Compare baseline and ensemble", "Publish as dashboard tile"],
    }

    return {
        "raw_query": raw_query,
        "use_case": use_case,
        "persona": persona,
        "input_type": input_type,
        "requested_output": requested_output,
        "needs_enrichment": needs_enrichment,
        "selected_agents": selected_agents,
        "tools_used": tools_by_use_case[use_case],
        "missing_data": missing_data,
        "refinement_options": refinement_options[use_case],
        "agent_trace": orchestration_trace(
            {
                "use_case": use_case,
                "persona": persona,
                "requested_output": requested_output,
                "missing_data": missing_data,
            }
        ),
    }
