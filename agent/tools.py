"""Liaison Core tools that return persona-agnostic evidence."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from agent.reasoning import nim_key_available, synthesize_with_nim
from engine.analytics import cultural_signal_network_evidence, graph_evidence, market_signal_evidence, portfolio_evidence


TOOL_DEFINITIONS = [
    {
        "name": "get_portfolio_evidence",
        "description": "Return structured evidence about generated media records and top candidates.",
        "input_schema": {
            "type": "object",
            "properties": {
                "data_dir": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 100},
            },
        },
    },
    {
        "name": "get_graph_evidence",
        "description": "Return structured evidence about cultural graph edges.",
        "input_schema": {
            "type": "object",
            "properties": {
                "data_dir": {"type": "string"},
            },
        },
    },
    {
        "name": "analyze_cultural_signal_network",
        "description": "Run PageRank/community-style network analysis for scripts connected to a cultural signal.",
        "input_schema": {
            "type": "object",
            "properties": {
                "signal_id": {"type": "string"},
                "data_dir": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 100},
            },
            "required": ["signal_id"],
        },
    },
    {
        "name": "get_market_signal_evidence",
        "description": "Return normalized evidence from ingested Netflix, Spotify song, and Spotify podcast snapshots.",
        "input_schema": {
            "type": "object",
            "properties": {
                "data_dir": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 100},
            },
        },
    },
]


def get_portfolio_evidence(data_dir: str = "data", limit: int = 10) -> dict[str, Any]:
    return portfolio_evidence(data_dir=Path(data_dir), limit=limit)


def get_graph_evidence(data_dir: str = "data") -> dict[str, Any]:
    return graph_evidence(data_dir=Path(data_dir))


def analyze_cultural_signal_network(signal_id: str, data_dir: str = "data", limit: int = 10) -> dict[str, Any]:
    return cultural_signal_network_evidence(signal_id=signal_id, data_dir=Path(data_dir), limit=limit)


def get_market_signal_evidence(data_dir: str = "data", limit: int = 10) -> dict[str, Any]:
    return market_signal_evidence(data_dir=Path(data_dir), limit=limit)


def _deterministic_synthesis(evidence: dict[str, Any], role: str = "executive") -> dict[str, Any]:
    """Format structured evidence for a role without changing the source facts."""

    if evidence.get("evidence_type") == "portfolio_summary":
        summary = evidence["summary"]
        top = evidence.get("top_candidates", [])[:3]
        headline = (
            f"{summary['records']} records analyzed with average viability "
            f"{summary['avg_viability']} and average risk {summary['avg_cultural_risk']}."
        )
        return {
            "role": role,
            "headline": headline,
            "brief_bullets": [],
            "recommended_candidates": top,
            "benchmark": evidence["benchmark"],
            "source_evidence": evidence,
        }
    if evidence.get("evidence_type") == "graph_summary":
        return {
            "role": role,
            "headline": f"{evidence['summary']['edges']} cultural graph edges available for exploration.",
            "brief_bullets": [],
            "edge_counts": evidence.get("edge_counts", []),
            "benchmark": evidence["benchmark"],
            "source_evidence": evidence,
        }
    if evidence.get("evidence_type") == "cultural_signal_network":
        summary = evidence["summary"]
        return {
            "role": role,
            "headline": (
                f"{evidence['signal_id']} connects to {summary['connected_scripts']} scripts "
                f"with boost index {summary['structural_boost_index']} and vulnerability index "
                f"{summary['structural_vulnerability_index']}."
            ),
            "brief_bullets": [],
            "boosted_scripts": evidence.get("boosted_scripts", [])[:3],
            "vulnerable_scripts": evidence.get("vulnerable_scripts", [])[:3],
            "benchmark": evidence["benchmark"],
            "source_evidence": evidence,
        }
    if evidence.get("evidence_type") == "market_signal_snapshot":
        summary = evidence["summary"]
        top = evidence.get("top_signals", [])[:3]
        return {
            "role": role,
            "headline": f"{summary['signals']} market signals ingested across streaming movies, songs, and podcasts.",
            "brief_bullets": [],
            "market_signals": top,
            "benchmark": evidence["benchmark"],
            "source_evidence": evidence,
        }
    return {"role": role, "headline": "No supported evidence supplied.", "brief_bullets": [], "source_evidence": evidence}


def synthesize_evidence(
    evidence: dict[str, Any],
    role: str = "executive",
    reasoning_mode: str = "auto",
    reasoning_model: str = "nano",
) -> dict[str, Any]:
    """Synthesize evidence with NIM reasoning when available, fallback deterministically."""

    result = _deterministic_synthesis(evidence=evidence, role=role)
    should_try_nim = (
        reasoning_mode == "nim"
        or (reasoning_mode == "auto" and nim_key_available())
    )
    if not should_try_nim:
        source = result.setdefault("source_evidence", evidence)
        source["liaison_core"] = {
            "mode": "deterministic",
            "reasoning_mode": reasoning_mode,
            "reasoning_model": reasoning_model,
        }
        return result

    nim_result = synthesize_with_nim(
        evidence=evidence,
        role=role,
        model_alias=reasoning_model,
    )
    source = result.setdefault("source_evidence", evidence)
    if not nim_result.get("ok"):
        source["liaison_core"] = {
            "mode": "deterministic_fallback",
            "reasoning_mode": reasoning_mode,
            "reasoning_model": reasoning_model,
            "nim_error": nim_result.get("error"),
            "nim_details": nim_result.get("details"),
        }
        return result

    if nim_result.get("headline"):
        result["headline"] = nim_result["headline"]
    result["brief_bullets"] = nim_result.get("brief_bullets", [])
    source["liaison_core"] = {
        "mode": "nim_reasoning",
        "reasoning_mode": reasoning_mode,
        "reasoning_model": reasoning_model,
        "nim_model": nim_result.get("model"),
        "latency_ms": nim_result.get("latency_ms"),
        "confidence": nim_result.get("confidence"),
        "brief_bullets": nim_result.get("brief_bullets", []),
    }
    return result
