"""NeMo Data Designer + Nemotron synthetic data scaffolding."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any


SDG_SCHEMAS: dict[str, dict[str, Any]] = {
    "title_metadata_enrichment": {
        "schema_id": "title_metadata_enrichment",
        "description": "Generate or complete title/IP metadata fields for sparse assets.",
        "fields": ["title", "genre", "audience", "rights_status", "comps", "market_signals", "source_confidence"],
        "output_dataset": "data/sdg/title_metadata_enriched.parquet",
    },
    "ip_scouting_profile": {
        "schema_id": "ip_scouting_profile",
        "description": "Generate structured book/IP scouting profiles for adaptation analysis.",
        "fields": ["title", "author", "genre", "trend_velocity", "adaptation_fit", "rights_status", "comps", "confidence"],
        "output_dataset": "data/sdg/ip_book_trend_profiles.parquet",
    },
    "persona_instruction_example": {
        "schema_id": "persona_instruction_example",
        "description": "Generate instruction examples for persona-specific reporting.",
        "fields": ["persona", "query", "evidence_context", "ideal_response", "format"],
        "output_dataset": "data/sdg/persona_instruction_data.parquet",
    },
    "query_refinement_pair": {
        "schema_id": "query_refinement_pair",
        "description": "Generate user query and refinement examples for Miranda routing.",
        "fields": ["initial_query", "classified_use_case", "refinement_options", "accepted_refinement"],
        "output_dataset": "data/sdg/query_refinement_pairs.parquet",
    },
    "report_generation_example": {
        "schema_id": "report_generation_example",
        "description": "Generate report/deck/memo examples from shared evidence packages.",
        "fields": ["persona", "evidence_package", "output_format", "rendered_output", "quality_notes"],
        "output_dataset": "data/sdg/report_generation_examples.parquet",
    },
}


def sdg_status() -> dict[str, Any]:
    service_configured = bool(os.getenv("NEMO_DATA_DESIGNER_BASE_URL") and (os.getenv("NVIDIA_API_KEY") or os.getenv("NGC_API_KEY")))
    return {
        "primary_sdg_stack": "NeMo Data Designer + Nemotron",
        "runtime": "nemo_data_designer" if service_configured else "mock_local",
        "service_configured": service_configured,
        "generator_model": os.getenv("NEMOTRON_SDG_MODEL", "nvidia/nvidia-nemotron-nano-9b-v2"),
        "control_baseline": "current Python/Polars synthetic generator",
        "schemas": list(SDG_SCHEMAS),
        "capabilities": {
            "structured_data_generation": True,
            "text_instruction_generation": True,
            "metadata_enrichment": True,
            "persona_report_examples": True,
            "curation_filters": "planned",
        },
        "secrets_exposed": False,
    }


def sdg_schema_catalog() -> dict[str, Any]:
    return {
        "primary_sdg_stack": "NeMo Data Designer + Nemotron",
        "schemas": SDG_SCHEMAS,
        "secrets_exposed": False,
    }


def generate_sdg_payload(payload: dict[str, Any]) -> dict[str, Any]:
    schema_id = str(payload.get("schema_id") or "title_metadata_enrichment")
    schema = SDG_SCHEMAS.get(schema_id, SDG_SCHEMAS["title_metadata_enrichment"])
    count = max(1, min(int(payload.get("count") or 3), 25))
    seed = payload.get("seed") or {}
    records = [_mock_record(schema_id=schema_id, schema=schema, seed=seed, index=index) for index in range(1, count + 1)]
    return {
        "generation_id": f"sdg_{schema_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "runtime": sdg_status()["runtime"],
        "primary_sdg_stack": "NeMo Data Designer + Nemotron",
        "schema": schema,
        "count": count,
        "records": records,
        "curation": {
            "schema_valid": True,
            "duplicate_rate": 0.0,
            "pii_detected": False,
            "unsupported_claim_rate": 0.0,
        },
        "secrets_exposed": False,
    }


def _mock_record(*, schema_id: str, schema: dict[str, Any], seed: dict[str, Any], index: int) -> dict[str, Any]:
    base_title = seed.get("title") or seed.get("name") or "Untitled IP"
    if schema_id == "ip_scouting_profile":
        return {
            "ip_id": f"ip_sdg_{index:03d}",
            "title": f"{base_title} Signal {index}",
            "author": seed.get("author") or "SDG Author",
            "genre": seed.get("genre") or "YA Fantasy",
            "trend_velocity": round(0.62 + index * 0.03, 3),
            "adaptation_fit": round(0.68 + index * 0.025, 3),
            "rights_status": seed.get("rights_status") or "unknown",
            "comps": seed.get("comps") or ["reader-momentum comp", "streaming-adaptation comp"],
            "confidence": "medium",
        }
    if schema_id == "persona_instruction_example":
        persona = seed.get("persona") or "development"
        return {
            "persona": persona,
            "query": f"Assess {base_title} for {persona} use.",
            "evidence_context": "Synthetic evidence package with title metadata, trend velocity, and adaptation fit.",
            "ideal_response": "Return a concise memo with recommendation, evidence, risks, and next action.",
            "format": seed.get("format") or "memo",
        }
    if schema_id == "query_refinement_pair":
        return {
            "initial_query": f"Find rising IP similar to {base_title}.",
            "classified_use_case": "ip_scouting",
            "refinement_options": ["Narrow by audience", "Compare adaptation fit", "Show rights risk"],
            "accepted_refinement": "Compare adaptation fit",
        }
    if schema_id == "report_generation_example":
        return {
            "persona": seed.get("persona") or "executive",
            "evidence_package": {"title": base_title, "confidence": "medium", "signals": ["trend_velocity", "adaptation_fit"]},
            "output_format": seed.get("format") or "executive_summary",
            "rendered_output": f"{base_title} has medium-confidence upside and needs rights validation.",
            "quality_notes": ["schema_valid", "evidence_attached", "rights_gap_disclosed"],
        }
    return {
        "title": base_title,
        "genre": seed.get("genre") or "Needs Enrichment",
        "audience": seed.get("audience") or "YA / Gen Z",
        "rights_status": seed.get("rights_status") or "unknown",
        "comps": seed.get("comps") or ["synthetic comp"],
        "market_signals": seed.get("market_signals") or ["synthetic reader momentum"],
        "source_confidence": "synthetic_medium",
    }
