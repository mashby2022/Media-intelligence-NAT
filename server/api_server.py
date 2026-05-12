"""Async FastAPI routes for persona-driven media intelligence experiences."""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from html import escape

import polars as pl
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse


def _load_backend_env() -> None:
    """Load simple KEY=VALUE backend env files without adding a dependency."""

    for env_path in (Path(".env"), Path(".env.local")):
        if not env_path.exists():
            continue
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if not key or key in os.environ:
                continue
            os.environ[key] = value.strip().strip("'\"")


_load_backend_env()

from agent.tools import (
    TOOL_DEFINITIONS,
    analyze_cultural_signal_network,
    build_reasoning_trace,
    get_market_signal_evidence,
    get_portfolio_evidence,
    query_historical_memory,
    search_living_knowledge,
    synthesize_evidence,
)
from agent.reasoning import DEFAULT_MODELS, NIM_BASE_URL, NIM_TIMEOUT_SEC, chat_with_nim, nim_key_available
from engine.analytics import graph_engine_capabilities, workspace_evidence
from engine.gpu_demo import gpu_demo_status
from engine.visuals import accelerated_visual_capabilities, stand_up_cuxfilter_server, workspace_payload
from server.models import (
    BriefResponse,
    CulturalSignalNetworkRequest,
    EvidenceResponse,
    ExecutiveDispatchRequest,
    ExecutiveDispatchResponse,
    FrontendContractResponse,
    GenerateBriefRequest,
    HealthResponse,
    InteractiveWorkspaceRequest,
    KnowledgeSearchRequest,
    MirandaChatRequest,
    MirandaChatResponse,
    MarketSignalsRequest,
    ModelPreviewSwitchRequest,
    NetworkGraphResponse,
    WorkspaceResponse,
)


DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:8082",
    "https://aura-intelligence-flow.lovable.app",
]
DEFAULT_CORS_ORIGIN_REGEX = r"^https://([a-zA-Z0-9-]+\.)*(lovable\.app|lovableproject\.com)$"


def _cors_origins() -> list[str]:
    configured = os.getenv("MIE_CORS_ORIGINS", "")
    extra_origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
    return list(dict.fromkeys([*DEFAULT_CORS_ORIGINS, *extra_origins]))


def _cors_origin_regex() -> str:
    return os.getenv("MIE_CORS_ORIGIN_REGEX", DEFAULT_CORS_ORIGIN_REGEX)


def _public_routes() -> list[str]:
    return [
        "/health",
        "/config/public",
        "/datasets",
        "/datasets/{dataset_id}/download",
        "/models/adapters",
        "/models/preview-switch",
        "/demo/readiness",
        "/demo/workflow-run",
        "/generate-brief",
        "/interactive-workspace",
        "/knowledge/search",
        "/dispatch/executive-brief",
    ]


DATASET_DOWNLOAD_EXTENSIONS = {".parquet", ".csv", ".json"}
PUBLIC_MEDIA_DATASET_IDS = {
    "audience_behavior_profiles.parquet",
    "cultural_graph_edges.parquet",
    "market_signal_snapshot.parquet",
    "netflix_top10_movies.parquet",
    "scripts_150k.parquet",
    "spotify_daily_top200_signals.parquet",
    "spotify_top50_songs.parquet",
    "spotify_top_podcasts.parquet",
}


def _dataset_root(data_dir: str | Path = "data") -> Path:
    return Path(data_dir).resolve()


def _safe_dataset_files(data_dir: str | Path = "data") -> list[Path]:
    root = _dataset_root(data_dir)
    if not root.exists():
        return []
    return sorted(
        path
        for path in root.iterdir()
        if path.is_file()
        and path.name in PUBLIC_MEDIA_DATASET_IDS
        and path.suffix.lower() in DATASET_DOWNLOAD_EXTENSIONS
    )


def _dataset_download_formats(path: Path) -> list[str]:
    suffix = path.suffix.lower()
    if suffix == ".parquet":
        return ["parquet", "csv", "json"]
    if suffix == ".csv":
        return ["csv", "json"]
    if suffix == ".json":
        return ["json"]
    return []


def _dataset_frame(path: Path) -> pl.DataFrame:
    suffix = path.suffix.lower()
    if suffix == ".parquet":
        return pl.read_parquet(path)
    if suffix == ".csv":
        return pl.read_csv(path, infer_schema_length=10_000, ignore_errors=True)
    raise HTTPException(status_code=400, detail=f"{path.name} cannot be converted to a tabular export.")


def _json_cell(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "to_list"):
        value = value.to_list()
    return json.dumps(value, separators=(",", ":"), ensure_ascii=True, default=str)


def _csv_safe_frame(df: pl.DataFrame) -> pl.DataFrame:
    expressions = []
    for column, dtype in zip(df.columns, df.dtypes):
        if getattr(dtype, "is_nested", lambda: False)():
            expressions.append(
                pl.col(column)
                .map_elements(_json_cell, return_dtype=pl.Utf8)
                .alias(column)
            )
    return df.with_columns(expressions) if expressions else df


def _dataset_metadata(path: Path) -> dict:
    download_formats = _dataset_download_formats(path)
    meta = {
        "dataset_id": path.name,
        "name": path.stem,
        "filename": path.name,
        "format": path.suffix.lower().lstrip("."),
        "size_bytes": path.stat().st_size,
        "download_formats": download_formats,
        "downloads": {
            fmt: f"/datasets/{path.name}/download?format={fmt}"
            for fmt in download_formats
        },
    }
    try:
        if path.suffix.lower() == ".parquet":
            schema = pl.read_parquet_schema(path)
            meta["columns"] = list(schema.keys())
            meta["column_count"] = len(schema)
            meta["rows"] = int(pl.scan_parquet(path).select(pl.len()).collect().item())
        elif path.suffix.lower() == ".csv":
            sample = pl.scan_csv(path, infer_schema_length=1000, ignore_errors=True)
            schema = sample.collect_schema()
            meta["columns"] = list(schema.keys())
            meta["column_count"] = len(schema)
            meta["rows"] = int(sample.select(pl.len()).collect().item())
        elif path.suffix.lower() == ".json":
            payload = json.loads(path.read_text(encoding="utf-8"))
            meta["columns"] = list(payload.keys()) if isinstance(payload, dict) else []
            meta["column_count"] = len(meta["columns"])
            meta["rows"] = len(payload) if isinstance(payload, list) else 1
    except Exception as exc:  # pragma: no cover - defensive metadata fallback
        meta["metadata_error"] = str(exc)
    return meta


def _resolve_dataset(dataset_id: str, data_dir: str | Path = "data") -> Path:
    if "/" in dataset_id or "\\" in dataset_id or dataset_id.startswith("."):
        raise HTTPException(status_code=404, detail="Dataset not found.")
    matches = {path.name: path for path in _safe_dataset_files(data_dir)}
    path = matches.get(dataset_id)
    if not path:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    return path


def _curated_miranda_reply(prompt: str) -> str | None:
    normalized = " ".join(prompt.lower().split())
    if not normalized:
        return None

    if (
        ("genre" in normalized and "subculture" in normalized)
        or "6-12" in normalized
        or "big bet" in normalized
        or "bet on" in normalized
    ):
        return (
            "**Recommendation:** Bet on grounded, emotionally legible genre pieces rather than pure spectacle.\n\n"
            "**Top 3 bets:**\n"
            "1. **Grounded sci-fi with spiritual resilience** - strongest signal for prestige audiences that want optimism without losing stakes.\n"
            "2. **Small-town romance with prestige stakes** - low-risk, repeatable engine with durable cross-demo appeal.\n"
            "3. **Quiet rebellion coming-of-age** - culturally hot, but only worth developing with a distinctive world and sonic identity.\n\n"
            "**Evidence:** Portfolio viability is strongest where genre, audience identity, and historical memory reinforce each other. "
            "The operator view can show the ranked assets, narrative atoms, and market signals behind each bet.\n\n"
            "**Risk:** Avoid over-stylized versions of the same trend. The signal is real, but visual sameness will flatten differentiation.\n\n"
            "**Next action:** Generate the executive brief, then use the operator workspace only if the room asks for evidence."
        )

    if "underserved" in normalized or "emerging audience" in normalized or "market" in normalized:
        return (
            "**Recommendation:** Treat underserved markets as geo-language opportunities, not just audience segments. "
            "The strongest near-term bets are markets where local-language momentum is visible but the studio slate is still thin.\n\n"
            "**Best opportunities:**\n"
            "1. **Nollywood-adjacent prestige thrillers** - Nigerian and West African audiences over-index on fast-moving social drama, crime, faith, and family-duty stories, but premium international packaging is still underdeveloped.\n"
            "2. **Korean-language genre films beyond romance** - Korean thrillers, elevated horror, and workplace/family dramas have strong global familiarity, but there is room for mid-budget concepts built for both local and export audiences.\n"
            "3. **Indian regional-language youth stories** - Tamil, Telugu, Malayalam, and Hindi-adjacent younger audiences show high appetite for identity, class mobility, music, and sports-driven narratives that do not need Hollywood-scale budgets.\n\n"
            "**Evidence:** Miranda is looking for gaps between regional audience momentum, language-market growth, and the current portfolio. "
            "The opportunity is not simply 'international content'; it is local cultural specificity with a clear path to global packaging.\n\n"
            "**Risk:** Do not flatten these markets into generic global content. The risk is cultural sameness, weak local partners, or treating language as decoration instead of the core audience signal.\n\n"
            "**Next action:** Pick one geo-language lane, inspect the matching assets in the operator view, and generate a market-specific greenlight brief."
        )

    if "avoid" in normalized or "reconsider" in normalized or "not greenlight" in normalized:
        return (
            "**Recommendation:** Avoid greenlighting concepts where the trend is already peaking but the script lacks a proprietary angle.\n\n"
            "**Watch-outs:**\n"
            "1. High-risk concepts with elevated audience fatigue signals.\n"
            "2. Scripts that borrow the look of a trend without a clear audience behavior signal.\n"
            "3. Projects that require expensive worldbuilding before the emotional engine is proven.\n\n"
            "**Evidence:** The strongest negative signal is not genre alone. It is the mismatch between market momentum, risk level, "
            "and lack of a differentiated narrative atom.\n\n"
            "**Next action:** Move those projects into operator review instead of the executive greenlight brief."
        )

    return None


def _model_adapter_catalog() -> dict:
    return {
        "active_adapter": {
            "adapter_id": "nim:nemotron-nano",
            "provider": "nim",
            "model": DEFAULT_MODELS["nano"],
            "alias": "nano",
            "status": "active",
            "runtime_locked": True,
            "auth_mode": "env_secret",
            "reason": "Nemotron Nano 9B v2 is the live demo default for low-latency briefing workflows.",
        },
        "bring_your_own_model": {
            "preview_only": True,
            "supported_patterns": [
                {
                    "provider": "nim",
                    "example_model": "nvidia/nvidia-nemotron-nano-9b-v2",
                    "auth_mode": "env_secret",
                    "notes": "Same NIM adapter, alternate model name can be validated before activation.",
                },
                {
                    "provider": "openai-compatible",
                    "example_model": "customer-hosted-reasoner",
                    "auth_mode": "customer_managed",
                    "notes": "Any OpenAI-compatible chat-completions endpoint can sit behind the adapter boundary.",
                },
                {
                    "provider": "self-hosted",
                    "example_model": "customer-internal-model",
                    "auth_mode": "customer_managed",
                    "notes": "Private models remain outside this repo; NAT calls them through a configured adapter.",
                },
            ],
            "switch_steps": [
                "Register provider, base URL, model name, and auth mode.",
                "Map outputs to the brief schema: headline, three bullets, confidence.",
                "Run preview validation against a sample evidence package.",
                "Promote the adapter only after latency, safety, and output-shape checks pass.",
            ],
        },
        "secrets_exposed": False,
    }


def _preview_model_switch_payload(request: ModelPreviewSwitchRequest) -> dict:
    provider = request.provider.strip().lower()
    model = request.model.strip()
    warnings = []
    if request.auth_mode == "none" and provider not in {"local", "self-hosted"}:
        warnings.append("External providers usually require customer-managed credentials.")
    if not model or "/" not in model and provider in {"nim", "openai-compatible"}:
        warnings.append("Use a fully qualified model identifier for hosted providers.")
    accepted = bool(provider and model and not model.lower().startswith(("sk-", "nvapi-", "ngc_")))
    if not accepted:
        warnings.append("Model identifiers must not include API keys or secret-like prefixes.")
    return {
        "status": "preview_ready" if accepted else "needs_review",
        "preview_only": True,
        "active_runtime_unchanged": True,
        "current_active_model": DEFAULT_MODELS["nano"],
        "requested_adapter": {
            "provider": provider,
            "model": model,
            "auth_mode": request.auth_mode,
            "purpose": request.purpose,
        },
        "workflow_impact": {
            "nat_orchestration": "unchanged",
            "polars_rapids_evidence_layer": "unchanged",
            "reasoning_adapter": "would be swapped after validation",
            "output_contract": "must return headline, exactly three bullets, and confidence metadata",
        },
        "validation_checks": [
            {"name": "secret_like_model_id", "passed": not model.lower().startswith(("sk-", "nvapi-", "ngc_"))},
            {"name": "provider_present", "passed": bool(provider)},
            {"name": "model_present", "passed": bool(model)},
            {"name": "schema_contract_required", "passed": True},
        ],
        "warnings": warnings,
        "secrets_exposed": False,
    }


def _architecture_positioning() -> dict:
    return {
        "primary_story": "NAT-orchestrated executive briefing agent with Nemotron reasoning.",
        "secondary_story": "Polars processing with optional RAPIDS acceleration for high-volume evidence prep.",
        "demo_boundary": "This mimics Vault AI workflow mechanics without attempting to reproduce proprietary predictive models.",
        "components": {
            "nat": {
                "role": "Agentic workflow orchestration",
                "foreground": True,
                "demo_use": "Coordinates intake, memory retrieval, reasoning trace, operator handoff, and dispatch.",
            },
            "nemotron": {
                "role": "Reasoning and synthesis model family",
                "foreground": True,
                "demo_use": "Produces persona-specific briefing logic through NIM model aliases.",
                "aliases": DEFAULT_MODELS,
            },
            "polars": {
                "role": "Fast tabular processing layer",
                "foreground": False,
                "demo_use": "Ranks portfolio assets, filters operator views, and produces benchmark telemetry.",
            },
            "rapids": {
                "role": "Optional GPU acceleration layer",
                "foreground": False,
                "demo_use": "Accelerates graph and dataframe workflows when cuDF/cuGraph are available.",
            },
            "client_models": {
                "role": "Vault proprietary predictive models",
                "foreground": False,
                "demo_use": "Represented as an integration boundary; not reverse-engineered or simulated as secret IP.",
            },
        },
        "architect_note": (
            "Keep the demo intentionally narrow: show the might of an agentic workflow, "
            "not a full replacement for Vault AI's proprietary modeling stack."
        ),
    }


def _public_config_payload(data_dir: str = "data") -> dict:
    gpu_demo = gpu_demo_status(data_dir)
    origins = _cors_origins()
    return {
        "service": "Media Intelligence Engine",
        "status": "ok",
        "version": "0.1.0",
        "data_dir": data_dir,
        "api": {
            "public_routes": _public_routes(),
            "frontend_contract": "/frontend-contract",
            "readiness": "/demo/readiness",
            "workflow_run": "/demo/workflow-run",
        },
        "architecture_positioning": _architecture_positioning(),
        "model_adapters": _model_adapter_catalog(),
        "deployment": {
            "lovable_supported": True,
            "ngrok_supported": True,
            "cors_origin_count": len(origins),
            "explicit_origins": origins,
            "origin_regex": _cors_origin_regex(),
            "local_dev_ports": [3000, 5173, 8080, 8081, 8082],
        },
        "reasoning": {
            "nim_configured": nim_key_available(),
            "mode": "nim_reasoning" if nim_key_available() else "deterministic_fallback",
            "base_url": NIM_BASE_URL,
            "model_aliases": DEFAULT_MODELS,
            "timeout_sec": NIM_TIMEOUT_SEC,
        },
        "datasets": gpu_demo.get("datasets", {}),
        "missing": gpu_demo.get("missing", {}),
        "compute_source": gpu_demo.get("compute_source"),
        "secrets_exposed": False,
    }


def _normalize_bullets(brief: dict) -> list[str]:
    raw = brief.get("brief_bullets", [])
    bullets = [str(item).strip() for item in raw if str(item).strip()][:3]
    if len(bullets) >= 3:
        return bullets

    recommended = brief.get("recommended_candidates", [])[:3]
    for candidate in recommended:
        title = candidate.get("title") or candidate.get("script_id") or "Candidate"
        viability = candidate.get("viability_score")
        risk = candidate.get("risk_category")
        bullets.append(f"{title}: viability {viability}, risk {risk}.")
        if len(bullets) >= 3:
            break

    while len(bullets) < 3:
        bullets.append("No additional high-confidence signal available.")
    return bullets[:3]


def _template_variables(brief: dict, brand_name: str, recipients: list[str]) -> dict[str, str]:
    bullets = _normalize_bullets(brief)
    headline = str(brief.get("headline", "Executive Greenlight Brief")).strip()
    candidate = (brief.get("recommended_candidates") or [{}])[0]
    avg_viability = (
        brief.get("source_evidence", {})
        .get("summary", {})
        .get("avg_viability")
    )
    index = round(float(avg_viability) * 100) if isinstance(avg_viability, (float, int)) else round(float(candidate.get("viability_score", 0.87)) * 100)
    risk = str(candidate.get("risk_category", "MODERATE"))
    verdict = "Reconsider" if risk in {"HIGH", "ELEVATED"} else "Greenlight" if index >= 80 else "Develop"
    today = "4 May 2026"
    recipient = ", ".join(recipients) if recipients else "client stakeholder"
    return {
        "brand_name": brand_name,
        "date": today,
        "headline": headline,
        "subject": f"{brand_name} Greenlight Brief | {headline[:92]}",
        "verdict": verdict,
        "index": str(index),
        "tagline": str(candidate.get("emergent_trend") or headline),
        "bullet_one": bullets[0],
        "bullet_two": bullets[1],
        "bullet_three": bullets[2],
        "recipient": recipient,
        "asset_title": str(candidate.get("title") or candidate.get("script_id") or "Lead asset"),
        "style_tribe": str(candidate.get("genre_primary") or "Portfolio"),
        "platform": str(candidate.get("platform_fit") or "Distribution"),
    }


def _render_template(template: str, variables: dict[str, str]) -> str:
    rendered = template
    for key, value in variables.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", escape(value))
        rendered = rendered.replace(f"{{{{ {key} }}}}", escape(value))
    return rendered


def _generated_artifacts(formats: list[str], variables: dict[str, str], auto_verify: bool) -> list[dict[str, str | bool]]:
    artifacts = []
    safe_date = variables["date"].replace(" ", "-").lower()
    for fmt in formats:
        if fmt == "html":
            artifacts.append({"format": "html", "filename": f"aura-brief-{safe_date}.html", "status": "rendered", "auto_generated": auto_verify})
        elif fmt == "markdown":
            artifacts.append({"format": "markdown", "filename": f"aura-brief-{safe_date}.md", "status": "rendered", "auto_generated": auto_verify})
        elif fmt == "pdf":
            artifacts.append({"format": "pdf", "filename": f"aura-brief-{safe_date}-memo.pdf", "status": "queued_for_generation", "auto_generated": auto_verify})
        elif fmt == "slides":
            artifacts.append({"format": "slides", "filename": f"aura-brief-{safe_date}-slide-pack.pdf", "status": "queued_for_generation", "auto_generated": auto_verify})
    return artifacts


def _dispatch_payload(
    brief: dict,
    brand_name: str,
    recipients: list[str],
    template: str | None = None,
    output_formats: list[str] | None = None,
    auto_verify: bool = False,
) -> dict:
    bullets = _normalize_bullets(brief)
    headline = str(brief.get("headline", "Executive Greenlight Brief")).strip()
    variables = _template_variables(brief, brand_name, recipients)
    subject = f"{brand_name} Greenlight Brief | {headline[:92]}"
    markdown_body = (
        f"# {brand_name} Executive Greenlight Brief\n\n"
        f"**Headline:** {headline}\n\n"
        "## Why This Works Now\n"
        f"- {bullets[0]}\n"
        f"- {bullets[1]}\n"
        f"- {bullets[2]}\n"
    )
    html_body = (
        f"<h1>{escape(brand_name)} Executive Greenlight Brief</h1>"
        f"<p><strong>Headline:</strong> {escape(headline)}</p>"
        "<h2>Why This Works Now</h2>"
        "<ul>"
        f"<li>{escape(bullets[0])}</li>"
        f"<li>{escape(bullets[1])}</li>"
        f"<li>{escape(bullets[2])}</li>"
        "</ul>"
    )
    rendered_template = _render_template(template, variables) if template else None
    if rendered_template:
        html_body = rendered_template
    requested_formats = output_formats or ["html"]
    return {
        "persona": "executive",
        "recipients": recipients,
        "subject": subject,
        "bullets": bullets,
        "markdown_body": markdown_body,
        "html_body": html_body,
        "dispatch_ready": True,
        "dispatch_status": "sent" if auto_verify else "draft_ready",
        "auto_verified": auto_verify,
        "rendered_template": rendered_template,
        "generated_artifacts": _generated_artifacts(requested_formats, variables, auto_verify),
        "source_brief": brief,
    }


def _demo_workflow_payload(data_dir: str = "data") -> dict:
    portfolio = get_portfolio_evidence(data_dir=data_dir, limit=5)
    seed_asset = (portfolio.get("top_candidates") or [{}])[0]
    asset_id = str(seed_asset.get("script_id") or seed_asset.get("asset_id") or "script_demo")
    memory = query_historical_memory(data_dir=data_dir, seed_asset=seed_asset, limit=3)
    brief = synthesize_evidence(
        evidence=portfolio,
        role="executive",
        reasoning_mode="deterministic",
        reasoning_model="nano",
    )
    brief["memory_matches"] = memory.get("matches", [])
    brief["reasoning_trace"] = build_reasoning_trace(evidence=portfolio, memory=memory, synthesis=brief)
    workspace = workspace_payload(data_dir=Path(data_dir), filters={}, limit=25)["streams"]["workspace"]
    portfolio_assets = workspace.get("portfolio_assets", [])
    operator_asset = next((asset for asset in portfolio_assets if asset.get("asset_id") == asset_id), portfolio_assets[0] if portfolio_assets else seed_asset)
    knowledge = search_living_knowledge(
        data_dir=data_dir,
        query=str(seed_asset.get("emergent_trend") or seed_asset.get("title") or "Momentum"),
        limit=5,
    )
    dispatch = _dispatch_payload(
        brief=brief,
        brand_name="Aura Intelligence",
        recipients=["client@example.com"],
        template=(
            "<h1>{{brand_name}} Greenlight Brief</h1>"
            "<p>{{headline}}</p>"
            "<ol><li>{{bullet_one}}</li><li>{{bullet_two}}</li><li>{{bullet_three}}</li></ol>"
        ),
        output_formats=["html", "pdf", "slides"],
        auto_verify=True,
    )
    trace = brief.get("reasoning_trace", [])
    timeline = [
        {
            "step_id": "intake",
            "time": "03:00 AM",
            "actor": "Studio Drive Watcher",
            "status": "complete",
            "label": "Asset auto-detected",
            "detail": f"{seed_asset.get('title') or asset_id} was pulled into the intake queue.",
        },
        {
            "step_id": "deconstruction",
            "time": "03:01 AM",
            "actor": "Miranda",
            "status": "complete",
            "label": "Narrative atom deconstruction",
            "detail": trace[0].get("message") if trace else "Miranda built a structured asset profile.",
        },
        {
            "step_id": "memory",
            "time": "03:03 AM",
            "actor": "Living Knowledge Base",
            "status": "complete",
            "label": "Lookalike memory retrieved",
            "detail": f"{len(memory.get('matches', []))} historical matches were attached to the insight package.",
        },
        {
            "step_id": "operator",
            "time": "03:05 AM",
            "actor": "Operator Workspace",
            "status": "complete",
            "label": "Evidence package published",
            "detail": f"{len(operator_asset.get('narrative_atoms', []))} narrative atoms and {len(workspace.get('clusters', []))} clusters are available for inspection.",
        },
        {
            "step_id": "dispatch",
            "time": "03:07 AM",
            "actor": "Communication Lab",
            "status": dispatch.get("dispatch_status"),
            "label": "Executive brief dispatched",
            "detail": f"{dispatch.get('subject')} sent to {', '.join(dispatch.get('recipients', []))}.",
        },
    ]
    return {
        "run_id": f"vault_demo_{asset_id}",
        "status": "complete",
        "mode": "autonomous_workflow_simulation",
        "data_dir": data_dir,
        "architecture_positioning": _architecture_positioning(),
        "shared_asset_id": asset_id,
        "intake": {
            "event_id": "studio_drive_0300",
            "source": "Studio Drive",
            "detected_at": "03:00 AM",
            "status": "auto_analyzed",
            "action": "brief_ready",
            "asset": seed_asset,
        },
        "shared_insight_package": {
            "asset_id": asset_id,
            "headline": brief.get("headline"),
            "bullets": _normalize_bullets(brief),
            "reasoning_trace": trace,
            "memory_matches": memory.get("matches", []),
            "knowledge_items": knowledge.get("items", []),
        },
        "surfaces": {
            "executive_email": {
                "status": dispatch.get("dispatch_status"),
                "subject": dispatch.get("subject"),
                "recipients": dispatch.get("recipients", []),
                "artifacts": dispatch.get("generated_artifacts", []),
            },
            "operator_workspace": {
                "status": "published",
                "portfolio_asset": operator_asset,
                "clusters": workspace.get("clusters", []),
                "benchmark": workspace.get("benchmark", {}),
            },
            "communication_lab": {
                "status": "auto_verified",
                "rendered_template": dispatch.get("rendered_template"),
                "html_body": dispatch.get("html_body"),
            },
        },
        "timeline": timeline,
        "secrets_exposed": False,
    }


def _ops_status(data_dir: str, graph_engine: dict, gpu_demo: dict) -> dict:
    try:
        workspace_benchmark = workspace_evidence(data_dir=Path(data_dir), limit=1).get("benchmark", {})
    except (FileNotFoundError, OSError):
        workspace_benchmark = {}
    cuda = gpu_demo.get("cuda", {})
    vram_total_mb = None
    device = cuda.get("gpu")
    if device:
        for field in str(device).split(","):
            field = field.strip()
            if field.lower().endswith("mib"):
                try:
                    vram_total_mb = int(float(field.split()[0]))
                except (ValueError, IndexError):
                    vram_total_mb = None
                break
    return {
        "nim": {
            "configured": nim_key_available(),
            "mode": "nim_reasoning" if nim_key_available() else "deterministic_fallback",
            "base_url": NIM_BASE_URL,
            "model_aliases": DEFAULT_MODELS,
        },
        "polars": {
            "latency_ms": workspace_benchmark.get("latency_ms"),
            "throughput": workspace_benchmark.get("throughput"),
            "compute_source": workspace_benchmark.get("compute_source"),
        },
        "graph": {
            "active_engine": graph_engine.get("active_engine"),
            "compute_source": graph_engine.get("compute_source"),
            "packages": graph_engine.get("packages", {}),
            "accelerated_available": graph_engine.get("accelerated_available", False),
            "standard_available": graph_engine.get("standard_available", False),
        },
        "gpu": {
            "available": bool(cuda.get("available")),
            "nvidia_smi": cuda.get("nvidia_smi"),
            "device": device,
            "vram_total_mb": vram_total_mb,
        },
    }


app = FastAPI(title="Media Intelligence Engine")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_origin_regex=_cors_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    data_dir = os.getenv("MIE_DATA_DIR", "data")
    graph_engine = graph_engine_capabilities()
    gpu_demo = gpu_demo_status(data_dir)
    return HealthResponse(
        service="Media Intelligence Engine",
        status="ok",
        version="0.1.0",
        data_dir=data_dir,
        graph_engine=graph_engine,
        accelerated_visuals=accelerated_visual_capabilities(),
        gpu_demo=gpu_demo,
        ops=_ops_status(data_dir, graph_engine, gpu_demo),
    )


@app.get("/config/public")
async def public_config(data_dir: str = "data") -> dict:
    return _public_config_payload(data_dir=data_dir)


@app.get("/models/adapters")
async def model_adapters() -> dict:
    return _model_adapter_catalog()


@app.post("/models/preview-switch")
async def model_preview_switch(request: ModelPreviewSwitchRequest) -> dict:
    return _preview_model_switch_payload(request)


@app.get("/demo/readiness")
async def demo_readiness(data_dir: str = "data") -> dict:
    graph_engine = graph_engine_capabilities()
    gpu_demo = gpu_demo_status(data_dir)
    ops = _ops_status(data_dir, graph_engine, gpu_demo)
    portfolio = get_portfolio_evidence(data_dir=data_dir, limit=3)
    seed_asset = (portfolio.get("top_candidates") or [{}])[0]
    memory = query_historical_memory(data_dir=data_dir, seed_asset=seed_asset, limit=3)
    brief = synthesize_evidence(
        evidence=portfolio,
        role="executive",
        reasoning_mode="deterministic",
        reasoning_model="nano",
    )
    brief["memory_matches"] = memory.get("matches", [])
    brief["reasoning_trace"] = build_reasoning_trace(evidence=portfolio, memory=memory, synthesis=brief)
    workspace = workspace_payload(data_dir=Path(data_dir), filters={"status": "rising"}, limit=3)["streams"]["workspace"]
    knowledge = search_living_knowledge(data_dir=data_dir, query="Momentum", verdict="Greenlight", limit=3)
    dispatch = _dispatch_payload(
        brief=brief,
        brand_name="Aura Intelligence",
        recipients=["client@example.com"],
        template="<h1>{{brand_name}}</h1><p>{{headline}}</p><ol><li>{{bullet_one}}</li><li>{{bullet_two}}</li><li>{{bullet_three}}</li></ol>",
        output_formats=["html", "pdf", "slides"],
        auto_verify=True,
    )
    phases = {
        "phase_1_operational_trust": {
            "ready": bool(ops.get("nim") and ops.get("polars") and workspace.get("portfolio_assets")),
            "polars_latency_ms": ops.get("polars", {}).get("latency_ms"),
            "graph_engine": ops.get("graph", {}).get("active_engine"),
        },
        "phase_2_agentic_orchestration": {
            "ready": bool(brief.get("reasoning_trace") and brief.get("memory_matches")),
            "trace_events": len(brief.get("reasoning_trace", [])),
            "memory_matches": len(brief.get("memory_matches", [])),
        },
        "phase_3_dynamic_knowledge": {
            "ready": bool(knowledge.get("items") and workspace.get("clusters")),
            "knowledge_items": len(knowledge.get("items", [])),
            "clusters": len(workspace.get("clusters", [])),
        },
        "phase_4_dispatch_loop": {
            "ready": bool(dispatch.get("dispatch_ready") and dispatch.get("rendered_template") and dispatch.get("generated_artifacts")),
            "dispatch_status": dispatch.get("dispatch_status"),
            "artifacts": dispatch.get("generated_artifacts", []),
        },
    }
    return {
        "service": "Media Intelligence Engine",
        "status": "ready" if all(phase["ready"] for phase in phases.values()) else "degraded",
        "data_dir": data_dir,
        "phases": phases,
        "secrets_exposed": False,
    }


@app.get("/demo/workflow-run")
async def demo_workflow_run(data_dir: str = "data") -> dict:
    return _demo_workflow_payload(data_dir=data_dir)


@app.post("/generate-brief", response_model=BriefResponse)
async def generate_brief(request: GenerateBriefRequest) -> BriefResponse:
    evidence = get_portfolio_evidence(data_dir=request.data_dir, limit=request.candidate_limit)
    seed_asset = (evidence.get("top_candidates") or [{}])[0]
    memory = query_historical_memory(data_dir=request.data_dir, seed_asset=seed_asset, limit=5)
    synthesized = synthesize_evidence(
        evidence=evidence,
        role=request.role,
        reasoning_mode=request.reasoning_mode,
        reasoning_model=request.reasoning_model,
    )
    synthesized["memory_matches"] = memory.get("matches", [])
    synthesized["reasoning_trace"] = build_reasoning_trace(
        evidence=evidence,
        memory=memory,
        synthesis=synthesized,
    )
    return BriefResponse(white_label=request.white_label, result=synthesized)


@app.post("/dispatch/executive-brief", response_model=ExecutiveDispatchResponse)
async def dispatch_executive_brief(request: ExecutiveDispatchRequest) -> ExecutiveDispatchResponse:
    evidence = get_portfolio_evidence(data_dir=request.data_dir, limit=request.candidate_limit)
    seed_asset = (evidence.get("top_candidates") or [{}])[0]
    memory = query_historical_memory(data_dir=request.data_dir, seed_asset=seed_asset, limit=5)
    brief = synthesize_evidence(
        evidence=evidence,
        role=request.role,
        reasoning_mode=request.reasoning_mode,
        reasoning_model=request.reasoning_model,
    )
    brief["memory_matches"] = memory.get("matches", [])
    brief["reasoning_trace"] = build_reasoning_trace(
        evidence=evidence,
        memory=memory,
        synthesis=brief,
    )
    payload = _dispatch_payload(
        brief=brief,
        brand_name=request.white_label.brand_name,
        recipients=request.recipients,
        template=request.template,
        output_formats=request.output_formats,
        auto_verify=request.auto_verify,
    )
    return ExecutiveDispatchResponse(white_label=request.white_label, result=payload)


@app.get("/autonomous-intake/feed")
async def autonomous_intake_feed(limit: int = 6, data_dir: str = "data") -> dict:
    evidence = get_portfolio_evidence(data_dir=data_dir, limit=max(1, min(limit, 25)))
    feed = []
    for idx, candidate in enumerate(evidence.get("top_candidates", [])[:limit], start=1):
        feed.append(
            {
                "event_id": f"drive_watch_{idx:03d}",
                "source": "Studio Drive",
                "detected_at": f"03:{idx + 11:02d} AM",
                "status": "auto_analyzed",
                "action": "brief_ready",
                "asset": candidate,
            }
        )
    return {
        "feed_type": "autonomous_intake",
        "mode": "drive_watcher_simulation",
        "items": feed,
        "benchmark": evidence.get("benchmark", {}),
    }


@app.get("/insight-runs/stream")
async def insight_run_stream(
    candidate_limit: int = 5,
    data_dir: str = "data",
    reasoning_mode: str = "deterministic",
    reasoning_model: str = "nano",
) -> StreamingResponse:
    async def event_stream():
        yield "event: trace\ndata: " + json.dumps(
            {
                "event_type": "thought",
                "actor": "miranda",
                "message": "Insight run accepted. Preparing portfolio, memory, and synthesis tools.",
                "status": "running",
                "offset_ms": 0,
            }
        ) + "\n\n"
        evidence = get_portfolio_evidence(data_dir=data_dir, limit=candidate_limit)
        seed_asset = (evidence.get("top_candidates") or [{}])[0]
        memory = query_historical_memory(data_dir=data_dir, seed_asset=seed_asset, limit=5)
        synthesized = synthesize_evidence(
            evidence=evidence,
            role="executive",
            reasoning_mode=reasoning_mode,
            reasoning_model=reasoning_model,
        )
        synthesized["memory_matches"] = memory.get("matches", [])
        synthesized["reasoning_trace"] = build_reasoning_trace(
            evidence=evidence,
            memory=memory,
            synthesis=synthesized,
        )
        for event in synthesized["reasoning_trace"]:
            yield f"event: trace\ndata: {json.dumps(event)}\n\n"
            await asyncio.sleep(0.08)
        yield "event: result\ndata: " + json.dumps(
            {
                "headline": synthesized.get("headline"),
                "brief_bullets": synthesized.get("brief_bullets", []),
                "memory_matches": synthesized.get("memory_matches", []),
            }
        ) + "\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/miranda/chat", response_model=MirandaChatResponse)
async def miranda_chat(request: MirandaChatRequest) -> MirandaChatResponse:
    sanitized_messages = [
        {"role": message.role, "content": message.content}
        for message in request.messages
        if message.content.strip()
    ]
    latest_user = ""
    for message in reversed(sanitized_messages):
        if message["role"] == "user":
            latest_user = str(message["content"]).strip()
            break

    deterministic_reply = (
        "Miranda online. I can synthesize your narrative against portfolio evidence now.\n\n"
        f"- Input captured: {latest_user or 'No user prompt supplied.'}\n"
        "- Next: run `Generate Brief` for ranked candidates and then use `Executive Dispatch` for inbox output."
    )

    curated_reply = _curated_miranda_reply(latest_user)
    if curated_reply:
        return MirandaChatResponse(
            white_label=request.white_label,
            result={
                "reply": curated_reply,
                "mode": "curated_demo_response",
            },
        )

    should_try_nim = (
        request.reasoning_mode == "nim"
        or (request.reasoning_mode == "auto" and nim_key_available())
    )
    if not should_try_nim:
        return MirandaChatResponse(
            white_label=request.white_label,
            result={
                "reply": deterministic_reply,
                "mode": "deterministic",
            },
        )

    nim_result = chat_with_nim(
        messages=sanitized_messages,
        model_alias=request.reasoning_model,
    )
    if nim_result.get("ok"):
        return MirandaChatResponse(
            white_label=request.white_label,
            result={
                "reply": str(nim_result.get("content", "")).strip() or deterministic_reply,
                "mode": "nim_reasoning",
                "model": nim_result.get("model"),
                "latency_ms": nim_result.get("latency_ms"),
            },
        )

    return MirandaChatResponse(
        white_label=request.white_label,
        result={
            "reply": deterministic_reply,
            "mode": "deterministic_fallback",
            "error": str(nim_result.get("error", "nim_request_failed")),
        },
    )


@app.post("/interactive-workspace", response_model=WorkspaceResponse)
async def interactive_workspace(request: InteractiveWorkspaceRequest) -> WorkspaceResponse:
    payload = workspace_payload(
        data_dir=Path(request.data_dir),
        theme=request.white_label.theme,
        filters=request.filters,
        limit=request.limit,
    )
    return WorkspaceResponse(white_label=request.white_label, result=payload)


@app.post("/network-graph/analyze", response_model=NetworkGraphResponse)
async def network_graph_analyze(request: CulturalSignalNetworkRequest) -> NetworkGraphResponse:
    evidence = analyze_cultural_signal_network(
        signal_id=request.signal_id,
        data_dir=request.data_dir,
        limit=request.limit,
    )
    return NetworkGraphResponse(white_label=request.white_label, result=evidence)


@app.post("/market-signals", response_model=EvidenceResponse)
async def market_signals(request: MarketSignalsRequest) -> EvidenceResponse:
    evidence = get_market_signal_evidence(data_dir=request.data_dir, limit=request.limit)
    return EvidenceResponse(white_label=request.white_label, result=evidence)


@app.post("/knowledge/search", response_model=EvidenceResponse)
async def knowledge_search(request: KnowledgeSearchRequest) -> EvidenceResponse:
    evidence = search_living_knowledge(
        data_dir=request.data_dir,
        query=request.query,
        style_tribe=request.style_tribe,
        verdict=request.verdict,
        limit=request.limit,
    )
    return EvidenceResponse(white_label=request.white_label, result=evidence)


@app.get("/datasets")
async def datasets(data_dir: str = "data") -> dict:
    items = [_dataset_metadata(path) for path in _safe_dataset_files(data_dir)]
    return {
        "data_dir": str(Path(data_dir)),
        "count": len(items),
        "items": items,
        "secrets_exposed": False,
    }


@app.get("/datasets/{dataset_id}/download")
async def dataset_download(
    dataset_id: str,
    format: str = Query(default="csv", pattern="^(csv|json|parquet)$"),
    data_dir: str = "data",
) -> Response:
    path = _resolve_dataset(dataset_id, data_dir)
    export_format = format.lower()
    allowed = _dataset_download_formats(path)
    if export_format not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"{path.name} supports downloads as: {', '.join(allowed)}.",
        )

    filename = f"{path.stem}.{export_format}"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

    if export_format == path.suffix.lower().lstrip("."):
        media_type = {
            "parquet": "application/octet-stream",
            "csv": "text/csv; charset=utf-8",
            "json": "application/json; charset=utf-8",
        }[export_format]
        return FileResponse(path, media_type=media_type, filename=filename)

    df = _dataset_frame(path)
    if export_format == "csv":
        body = _csv_safe_frame(df).write_csv()
        return Response(content=body, media_type="text/csv; charset=utf-8", headers=headers)
    if export_format == "json":
        body = df.write_json()
        return Response(content=body, media_type="application/json; charset=utf-8", headers=headers)

    raise HTTPException(status_code=400, detail="Unsupported export format.")


@app.post("/omni-station/network-graph", response_model=NetworkGraphResponse)
async def omni_station_network_graph(request: CulturalSignalNetworkRequest) -> NetworkGraphResponse:
    return await network_graph_analyze(request)


@app.get("/operator-workspace")
async def operator_workspace() -> FileResponse:
    return FileResponse(Path(__file__).parent / "static" / "operator_workspace.html")


@app.get("/omni-station/status")
async def omni_station_status() -> dict:
    demo_status = gpu_demo_status(os.getenv("MIE_DATA_DIR", "data"))
    return {
        "station": "omni",
        "service": "Media Intelligence Engine",
        "status": "connected",
        "graph_engine": graph_engine_capabilities(),
        "gpu_demo": demo_status,
        "routes": [
            "/config/public",
            "/models/adapters",
            "/models/preview-switch",
            "/demo/readiness",
            "/demo/workflow-run",
            "/generate-brief",
            "/interactive-workspace",
            "/market-signals",
            "/network-graph/analyze",
            "/omni-station/network-graph",
            "/operator-workspace",
            "/gpu-demo/status",
            "/dispatch/executive-brief",
            "/orchestrator/tools",
        ],
    }


@app.get("/orchestrator/tools")
async def orchestrator_tools() -> dict:
    return {
        "orchestrator_profile": "miranda-compatible",
        "liaison_core": {
            "workflow_name": "media_intelligence_liaison_core",
            "tool_schema": "multi-standard-json",
            "tools": TOOL_DEFINITIONS,
        },
    }


@app.get("/frontend-contract", response_model=FrontendContractResponse)
async def frontend_contract() -> FrontendContractResponse:
    return FrontendContractResponse(
        service="Media Intelligence Engine",
        consumers=["Lovable Frontend", "Omni Station"],
        routes={
            "generate_brief": {
                "method": "POST",
                "path": "/generate-brief",
                "request_model": "GenerateBriefRequest",
                "response_model": "BriefResponse",
            },
            "demo_readiness": {
                "method": "GET",
                "path": "/demo/readiness",
                "request_model": None,
                "response_model": "dict",
            },
            "datasets": {
                "method": "GET",
                "path": "/datasets",
                "request_model": None,
                "response_model": "dict",
            },
            "dataset_download": {
                "method": "GET",
                "path": "/datasets/{dataset_id}/download?format=csv",
                "request_model": None,
                "response_model": "file",
            },
            "public_config": {
                "method": "GET",
                "path": "/config/public",
                "request_model": None,
                "response_model": "dict",
            },
            "model_adapters": {
                "method": "GET",
                "path": "/models/adapters",
                "request_model": None,
                "response_model": "dict",
            },
            "model_preview_switch": {
                "method": "POST",
                "path": "/models/preview-switch",
                "request_model": "ModelPreviewSwitchRequest",
                "response_model": "dict",
            },
            "demo_workflow_run": {
                "method": "GET",
                "path": "/demo/workflow-run",
                "request_model": None,
                "response_model": "dict",
            },
            "interactive_workspace": {
                "method": "POST",
                "path": "/interactive-workspace",
                "request_model": "InteractiveWorkspaceRequest",
                "response_model": "WorkspaceResponse",
            },
            "network_graph": {
                "method": "POST",
                "path": "/network-graph/analyze",
                "request_model": "CulturalSignalNetworkRequest",
                "response_model": "NetworkGraphResponse",
            },
            "market_signals": {
                "method": "POST",
                "path": "/market-signals",
                "request_model": "MarketSignalsRequest",
                "response_model": "EvidenceResponse",
            },
            "knowledge_search": {
                "method": "POST",
                "path": "/knowledge/search",
                "request_model": "KnowledgeSearchRequest",
                "response_model": "EvidenceResponse",
            },
            "omni_network_graph": {
                "method": "POST",
                "path": "/omni-station/network-graph",
                "request_model": "CulturalSignalNetworkRequest",
                "response_model": "NetworkGraphResponse",
            },
            "dispatch_executive_brief": {
                "method": "POST",
                "path": "/dispatch/executive-brief",
                "request_model": "ExecutiveDispatchRequest",
                "response_model": "ExecutiveDispatchResponse",
            },
            "orchestrator_tools": {
                "method": "GET",
                "path": "/orchestrator/tools",
                "request_model": None,
                "response_model": "dict",
            },
            "autonomous_intake": {
                "method": "GET",
                "path": "/autonomous-intake/feed",
                "request_model": None,
                "response_model": "dict",
            },
            "insight_run_stream": {
                "method": "GET",
                "path": "/insight-runs/stream",
                "request_model": None,
                "response_model": "text/event-stream",
            },
            "gpu_demo_status": {
                "method": "GET",
                "path": "/gpu-demo/status",
                "request_model": None,
                "response_model": "dict",
            },
        },
        examples={
            "generate_brief": {
                "role": "executive",
                "candidate_limit": 5,
                "reasoning_mode": "auto",
                "reasoning_model": "nano",
                "white_label": {"brand_name": "Media Intelligence Engine", "theme": {}},
            },
            "demo_readiness": {"method": "GET", "path": "/demo/readiness"},
            "public_config": {"method": "GET", "path": "/config/public"},
            "model_adapters": {"method": "GET", "path": "/models/adapters"},
            "model_preview_switch": {
                "provider": "openai-compatible",
                "model": "customer-hosted-reasoner",
                "auth_mode": "customer_managed",
                "purpose": "executive_brief",
            },
            "demo_workflow_run": {"method": "GET", "path": "/demo/workflow-run"},
            "dispatch_executive_brief": {
                "role": "executive",
                "candidate_limit": 5,
                "reasoning_mode": "auto",
                "reasoning_model": "nano",
                "recipients": ["client@example.com"],
                "template": "<h1>{{brand_name}} Brief</h1><p>{{headline}}</p><ol><li>{{bullet_one}}</li><li>{{bullet_two}}</li><li>{{bullet_three}}</li></ol>",
                "output_formats": ["html", "pdf", "slides"],
                "auto_verify": True,
                "white_label": {"brand_name": "Media Intelligence Engine", "theme": {}},
            },
            "interactive_workspace": {
                "limit": 100,
                "filters": {"genre": "Drama", "min_viability": 0.75},
                "white_label": {"brand_name": "Media Intelligence Engine", "theme": {"--mie-accent": "#0f766e"}},
            },
            "network_graph": {
                "signal_id": "spotify_00001",
                "limit": 5,
                "white_label": {"brand_name": "Media Intelligence Engine", "theme": {}},
            },
            "market_signals": {
                "limit": 10,
                "white_label": {"brand_name": "Media Intelligence Engine", "theme": {}},
            },
            "knowledge_search": {
                "query": "Momentum Breakout",
                "style_tribe": "The Etherealists",
                "verdict": "Greenlight",
                "limit": 12,
                "white_label": {"brand_name": "Media Intelligence Engine", "theme": {}},
            },
            "orchestrator_tools": {"method": "GET", "path": "/orchestrator/tools"},
            "autonomous_intake": {"method": "GET", "path": "/autonomous-intake/feed?limit=6"},
            "insight_run_stream": {"method": "GET", "path": "/insight-runs/stream?candidate_limit=5"},
            "gpu_demo_status": {"method": "GET", "path": "/gpu-demo/status"},
        },
    )


@app.get("/gpu-demo/status")
async def gpu_demo_readiness() -> dict:
    return gpu_demo_status(os.getenv("MIE_DATA_DIR", "data"))


@app.get("/accelerated-workspace/status")
async def accelerated_workspace_status() -> dict:
    return accelerated_visual_capabilities()


@app.post("/accelerated-workspace/start")
async def accelerated_workspace_start() -> dict:
    result = stand_up_cuxfilter_server(start=True)
    return {key: value for key, value in result.items() if key != "dashboard"}
