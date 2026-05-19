"""Four-agent orchestration contracts for the Miranda demo platform."""

from __future__ import annotations

from typing import Any


AGENT_CATALOG: dict[str, dict[str, Any]] = {
    "query_planner": {
        "agent_id": "query_planner",
        "name": "Query Planner Agent",
        "role": "Classifies the user request, persona, input type, output format, and target use case.",
        "inputs": ["raw_query", "conversation_context"],
        "outputs": ["use_case", "persona", "input_type", "requested_output", "routing_confidence"],
        "tools": ["use_case_registry", "persona_router"],
        "evals": ["use_case_selected", "persona_selected", "output_format_selected"],
    },
    "data_enrichment": {
        "agent_id": "data_enrichment",
        "name": "Data Enrichment Agent",
        "role": "Detects missing metadata and prepares enrichment requests for title, IP, audience, and concept records.",
        "inputs": ["asset_payload", "input_analysis", "source_registry"],
        "outputs": ["metadata_gaps", "enrichment_plan", "source_confidence"],
        "tools": ["metadata_gap_detector", "source_registry", "nemo_data_designer_sdg"],
        "evals": ["metadata_completeness", "source_confidence_present", "secret_boundary_preserved"],
    },
    "prediction_validator": {
        "agent_id": "prediction_validator",
        "name": "Prediction Validation Agent",
        "role": "Checks low-confidence predictions, weak features, unsupported claims, and follow-up refinements.",
        "inputs": ["prediction_outputs", "evidence_package", "model_profile"],
        "outputs": ["confidence_notes", "low_confidence_drivers", "recommended_refinements"],
        "tools": ["comparison_engine", "missing_data_notes", "eval_runner"],
        "evals": ["confidence_present", "missing_data_reported", "unsupported_claim_rate"],
    },
    "persona_output": {
        "agent_id": "persona_output",
        "name": "Persona Output Agent",
        "role": "Renders the selected result for executive, development, marketing, research, legal, or operator users.",
        "inputs": ["shared_insight_package", "persona", "requested_output"],
        "outputs": ["memo", "dashboard_tile", "executive_summary", "deck_outline", "api_object"],
        "tools": ["template_renderer", "format_validator", "dispatch_ready_output"],
        "evals": ["persona_fit", "format_schema", "evidence_coverage"],
    },
}


def agent_catalog() -> list[dict[str, Any]]:
    return list(AGENT_CATALOG.values())


def agent_plan_for_use_case(use_case_id: str) -> list[dict[str, Any]]:
    agent_ids = ["query_planner", "data_enrichment", "prediction_validator", "persona_output"]
    if use_case_id == "media_greenlight":
        agent_ids = ["query_planner", "data_enrichment", "prediction_validator", "persona_output"]
    return [AGENT_CATALOG[agent_id] for agent_id in agent_ids]


def orchestration_trace(query_plan: dict[str, Any]) -> list[dict[str, Any]]:
    use_case = query_plan.get("use_case", "media_greenlight")
    persona = query_plan.get("persona", "executive")
    missing_data = query_plan.get("missing_data", [])
    return [
        {
            "event_type": "agent",
            "agent_id": "query_planner",
            "actor": "Query Planner Agent",
            "message": f"Routed request to {use_case} for {persona} output.",
            "status": "complete",
            "offset_ms": 0,
        },
        {
            "event_type": "agent",
            "agent_id": "data_enrichment",
            "actor": "Data Enrichment Agent",
            "message": (
                f"Detected metadata gaps: {', '.join(missing_data)}."
                if missing_data
                else "No blocking metadata gaps detected for this query."
            ),
            "status": "complete",
            "offset_ms": 90,
        },
        {
            "event_type": "agent",
            "agent_id": "prediction_validator",
            "actor": "Prediction Validation Agent",
            "message": "Prepared confidence, evidence, and refinement checks.",
            "status": "complete",
            "offset_ms": 180,
        },
        {
            "event_type": "agent",
            "agent_id": "persona_output",
            "actor": "Persona Output Agent",
            "message": f"Prepared {query_plan.get('requested_output', 'executive_summary')} response format.",
            "status": "complete",
            "offset_ms": 260,
        },
    ]
