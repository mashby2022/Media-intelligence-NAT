"""Async FastAPI routes for persona-driven media intelligence experiences."""

from __future__ import annotations

import os
from pathlib import Path
from html import escape

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from agent.tools import TOOL_DEFINITIONS, analyze_cultural_signal_network, get_market_signal_evidence, get_portfolio_evidence, synthesize_evidence
from agent.reasoning import chat_with_nim, nim_key_available
from engine.analytics import graph_engine_capabilities
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
    MirandaChatRequest,
    MirandaChatResponse,
    MarketSignalsRequest,
    NetworkGraphResponse,
    WorkspaceResponse,
)


DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]
DEFAULT_CORS_ORIGIN_REGEX = r"^https://([a-zA-Z0-9-]+\.)*(lovable\.app|lovableproject\.com)$"


def _cors_origins() -> list[str]:
    configured = os.getenv("MIE_CORS_ORIGINS", "")
    extra_origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
    return [*DEFAULT_CORS_ORIGINS, *extra_origins]


def _cors_origin_regex() -> str:
    return os.getenv("MIE_CORS_ORIGIN_REGEX", DEFAULT_CORS_ORIGIN_REGEX)


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


def _dispatch_payload(brief: dict, brand_name: str, recipients: list[str]) -> dict:
    bullets = _normalize_bullets(brief)
    headline = str(brief.get("headline", "Executive Greenlight Brief")).strip()
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
    return {
        "persona": "executive",
        "recipients": recipients,
        "subject": subject,
        "bullets": bullets,
        "markdown_body": markdown_body,
        "html_body": html_body,
        "dispatch_ready": True,
        "source_brief": brief,
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
    return HealthResponse(
        service="Media Intelligence Engine",
        status="ok",
        version="0.1.0",
        data_dir=os.getenv("MIE_DATA_DIR", "data"),
        graph_engine=graph_engine_capabilities(),
        accelerated_visuals=accelerated_visual_capabilities(),
        gpu_demo=gpu_demo_status(os.getenv("MIE_DATA_DIR", "data")),
    )


@app.post("/generate-brief", response_model=BriefResponse)
async def generate_brief(request: GenerateBriefRequest) -> BriefResponse:
    evidence = get_portfolio_evidence(data_dir=request.data_dir, limit=request.candidate_limit)
    synthesized = synthesize_evidence(
        evidence=evidence,
        role=request.role,
        reasoning_mode=request.reasoning_mode,
        reasoning_model=request.reasoning_model,
    )
    return BriefResponse(white_label=request.white_label, result=synthesized)


@app.post("/dispatch/executive-brief", response_model=ExecutiveDispatchResponse)
async def dispatch_executive_brief(request: ExecutiveDispatchRequest) -> ExecutiveDispatchResponse:
    evidence = get_portfolio_evidence(data_dir=request.data_dir, limit=request.candidate_limit)
    brief = synthesize_evidence(
        evidence=evidence,
        role=request.role,
        reasoning_mode=request.reasoning_mode,
        reasoning_model=request.reasoning_model,
    )
    payload = _dispatch_payload(
        brief=brief,
        brand_name=request.white_label.brand_name,
        recipients=request.recipients,
    )
    return ExecutiveDispatchResponse(white_label=request.white_label, result=payload)


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
            "dispatch_executive_brief": {
                "role": "executive",
                "candidate_limit": 5,
                "reasoning_mode": "auto",
                "reasoning_model": "nano",
                "recipients": ["client@example.com"],
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
            "orchestrator_tools": {"method": "GET", "path": "/orchestrator/tools"},
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
