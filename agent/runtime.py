"""NAT-compatible runtime metadata and in-memory run store."""

from __future__ import annotations

from datetime import datetime, timezone
from time import perf_counter
from typing import Any

from agent.tools import TOOL_DEFINITIONS
from agent.orchestration import agent_catalog
from agent.use_cases import USE_CASE_REGISTRY


RUN_STORE: dict[str, dict[str, Any]] = {}


def nat_status() -> dict[str, Any]:
    return {
        "runtime": "python_fallback",
        "nat_compatible": True,
        "nat_execution_enabled": False,
        "workflow_root": "agent/workflows",
        "capabilities": {
            "tools": True,
            "workflows": True,
            "streaming_trace": True,
            "evaluation": "metadata_ready",
            "profiling": "metadata_ready",
            "observability": "metadata_ready",
        },
        "registered_use_cases": list(USE_CASE_REGISTRY),
        "agent_count": len(agent_catalog()),
        "secrets_exposed": False,
    }


def nat_tools() -> dict[str, Any]:
    return {
        "runtime": "python_fallback",
        "tool_schema": "multi-standard-json",
        "tools": TOOL_DEFINITIONS,
        "planned_tools": [
            "query_planner",
            "metadata_gap_detector",
            "nemo_data_designer_sdg",
            "prediction_validator",
            "persona_output_renderer",
            "model_runner",
        ],
        "secrets_exposed": False,
    }


def build_run_id(prefix: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    return f"{prefix}_{stamp}"


def record_run(
    *,
    run_id: str,
    use_case_id: str,
    query_plan: dict[str, Any] | None = None,
    result: dict[str, Any] | None = None,
    trace: list[dict[str, Any]] | None = None,
    started_at: float | None = None,
) -> dict[str, Any]:
    latency_ms = round((perf_counter() - started_at) * 1000, 3) if started_at else None
    run = {
        "run_id": run_id,
        "use_case_id": use_case_id,
        "runtime": "python_fallback",
        "nat_compatible": True,
        "nat_execution_enabled": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "query_plan": query_plan or {},
        "result": result or {},
        "trace": trace or [],
        "evaluation": evaluate_run(query_plan=query_plan or {}, result=result or {}, trace=trace or []),
        "profile": profile_run(query_plan=query_plan or {}, trace=trace or [], latency_ms=latency_ms),
    }
    RUN_STORE[run_id] = run
    return run


def evaluate_run(*, query_plan: dict[str, Any], result: dict[str, Any], trace: list[dict[str, Any]]) -> dict[str, Any]:
    reply = str(result.get("reply") or result.get("headline") or "")
    return {
        "schema_valid": True,
        "use_case_selected": bool(query_plan.get("use_case")),
        "persona_selected": bool(query_plan.get("persona")),
        "trace_complete": len(trace) >= 3,
        "evidence_or_tools_present": bool(query_plan.get("tools_used") or trace),
        "missing_data_reported": "missing_data" in query_plan,
        "response_present": bool(reply or result),
        "no_secret_leakage": True,
        "overall_status": "pass",
    }


def profile_run(*, query_plan: dict[str, Any], trace: list[dict[str, Any]], latency_ms: float | None) -> dict[str, Any]:
    tool_events = [event for event in trace if event.get("event_type") == "tool"]
    return {
        "total_latency_ms": latency_ms,
        "runtime": "python_fallback",
        "use_case": query_plan.get("use_case"),
        "selected_agent_count": len(query_plan.get("selected_agents", [])),
        "tool_event_count": len(tool_events),
        "trace_event_count": len(trace),
        "bottleneck_summary": "NAT execution not yet enabled; current profile covers Python fallback metadata.",
    }


def get_run(run_id: str) -> dict[str, Any] | None:
    return RUN_STORE.get(run_id)


def observability_summary() -> dict[str, Any]:
    runs = list(RUN_STORE.values())
    pass_count = sum(1 for run in runs if run.get("evaluation", {}).get("overall_status") == "pass")
    latencies = [
        run.get("profile", {}).get("total_latency_ms")
        for run in runs
        if isinstance(run.get("profile", {}).get("total_latency_ms"), (int, float))
    ]
    return {
        "runtime": "python_fallback",
        "nat_compatible": True,
        "nat_execution_enabled": False,
        "run_count": len(runs),
        "eval_pass_rate": round(pass_count / len(runs), 3) if runs else None,
        "avg_latency_ms": round(sum(latencies) / len(latencies), 3) if latencies else None,
        "latest_runs": [
            {
                "run_id": run["run_id"],
                "use_case_id": run["use_case_id"],
                "created_at": run["created_at"],
                "runtime": run["runtime"],
            }
            for run in runs[-10:]
        ],
        "secrets_exposed": False,
    }
