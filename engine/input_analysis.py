"""Deterministic input analysis and enrichment helpers for richer demo inputs."""

from __future__ import annotations

from typing import Any


FIELD_KEYWORDS: dict[str, tuple[str, ...]] = {
    "title": ("title", "name", "project"),
    "author_creator": ("author", "creator", "writer", "showrunner"),
    "genre": ("genre", "thriller", "romance", "sci-fi", "comedy", "drama", "fantasy", "horror"),
    "audience": ("audience", "gen z", "ya", "family", "adult", "segment"),
    "rights_status": ("rights", "option", "deal", "licensed", "available"),
    "comps": ("comp", "similar", "lookalike", "benchmark"),
    "market_signals": ("trend", "market", "momentum", "social", "goodreads", "spotify", "netflix"),
    "source_confidence": ("source", "confidence", "verified", "provenance"),
}


def _text_from_payload(payload: dict[str, Any]) -> str:
    if "text" in payload:
        return str(payload.get("text") or "")
    if "content" in payload:
        return str(payload.get("content") or "")
    return " ".join(str(value) for value in payload.values() if isinstance(value, (str, int, float)))


def _has_payload_value(payload: dict[str, Any], field: str) -> bool:
    if field not in payload:
        return False
    value = payload.get(field)
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, set, dict)):
        return bool(value)
    return True


def detect_input_type(payload: dict[str, Any]) -> str:
    explicit_type = str(payload.get("input_type") or payload.get("type") or "").strip().lower()
    if explicit_type:
        return explicit_type
    normalized = _text_from_payload(payload).lower()
    if payload.get("rights_status") or "deal" in normalized or "rights" in normalized:
        return "deal_ip_roster_item"
    if payload.get("author") or "book" in normalized or "author" in normalized or "goodreads" in normalized:
        return "book_ip"
    if payload.get("title") and len(normalized.split()) < 80:
        return "title_metadata_record"
    if "script" in normalized or len(normalized.split()) > 600:
        return "full_script"
    if "treatment" in normalized or len(normalized.split()) > 120:
        return "treatment"
    return "paragraph"


def analyze_input(payload: dict[str, Any]) -> dict[str, Any]:
    text = _text_from_payload(payload)
    normalized = text.lower()
    present_fields = [
        field
        for field, keywords in FIELD_KEYWORDS.items()
        if _has_payload_value(payload, field) or any(keyword in normalized for keyword in keywords)
    ]
    required_fields = ["title", "genre", "audience", "rights_status", "comps", "market_signals", "source_confidence"]
    missing_fields = [field for field in required_fields if field not in present_fields]
    input_type = detect_input_type(payload)
    enrichment_priority = [
        field
        for field in ["rights_status", "source_confidence", "market_signals", "comps", "audience", "genre", "title"]
        if field in missing_fields
    ]
    return {
        "input_type": input_type,
        "text_length": len(text),
        "word_count": len(text.split()),
        "present_fields": present_fields,
        "missing_fields": missing_fields,
        "enrichment_priority": enrichment_priority,
        "recommended_use_cases": _recommended_use_cases(input_type, missing_fields),
        "source_confidence": "medium" if "source_confidence" in present_fields else "unknown",
        "secrets_exposed": False,
    }


def _recommended_use_cases(input_type: str, missing_fields: list[str]) -> list[str]:
    use_cases = []
    if input_type in {"book_ip", "deal_ip_roster_item"}:
        use_cases.append("ip_scouting")
    if missing_fields:
        use_cases.append("title_enrichment")
    if input_type in {"paragraph", "treatment", "full_script", "title_metadata_record"}:
        use_cases.append("media_greenlight")
    use_cases.append("prediction_builder")
    return list(dict.fromkeys(use_cases))


def enrich_title_payload(payload: dict[str, Any]) -> dict[str, Any]:
    analysis = analyze_input(payload)
    title = str(payload.get("title") or payload.get("name") or "Untitled Asset")
    enriched_fields = {
        "title": title,
        "genre": payload.get("genre") or "Needs Enrichment",
        "audience": payload.get("audience") or payload.get("target_demo") or "Needs Enrichment",
        "rights_status": payload.get("rights_status") or "unknown",
        "comps": payload.get("comps") or [],
        "market_signals": payload.get("market_signals") or [],
        "source_confidence": payload.get("source_confidence") or "unknown",
    }
    return {
        "status": "enrichment_plan_ready",
        "analysis": analysis,
        "asset": enriched_fields,
        "metadata_gaps": analysis["missing_fields"],
        "recommended_enrichment_tools": ["source_registry", "nemo_data_designer_sdg", "market_signal_lookup"],
        "next_actions": [
            "Confirm rights status before high-confidence IP recommendations.",
            "Attach comparable titles or adaptation outcomes.",
            "Run SDG enrichment for sparse audience and market fields.",
        ],
        "secrets_exposed": False,
    }


def ip_scout_payload(payload: dict[str, Any]) -> dict[str, Any]:
    analysis = analyze_input(payload)
    return {
        "status": "ip_scout_plan_ready",
        "analysis": analysis,
        "scouting_focus": {
            "asset_type": analysis["input_type"],
            "trend_sources": ["book_trend_signals", "social_momentum_proxy", "market_comps"],
            "risk_checks": ["rights_status", "source_confidence", "adaptation_fit"],
        },
        "candidate_signals": [
            {"signal": "adaptation_fit", "status": "requires_enrichment"},
            {"signal": "trend_velocity", "status": "requires_external_source"},
            {"signal": "rights_risk", "status": "unknown" if "rights_status" in analysis["missing_fields"] else "available"},
        ],
        "recommended_use_case": "ip_scouting",
        "secrets_exposed": False,
    }
