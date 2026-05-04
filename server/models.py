"""Pydantic schemas for the Media Intelligence Engine API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class BenchmarkMeta(BaseModel):
    latency_ms: float | None = None
    throughput: float | None = None
    compute_source: str


class GraphEngineMeta(BaseModel):
    accelerated_available: bool
    standard_available: bool
    packages: dict[str, bool]
    active_engine: str
    compute_source: str


class WhiteLabelConfig(BaseModel):
    brand_name: str = "Media Intelligence Engine"
    theme: dict[str, str] = Field(default_factory=dict)


class GenerateBriefRequest(BaseModel):
    role: str = "executive"
    data_dir: str = "data"
    candidate_limit: int = Field(default=10, ge=1, le=100)
    reasoning_mode: Literal["auto", "deterministic", "nim"] = "auto"
    reasoning_model: Literal["nano"] = "nano"
    white_label: WhiteLabelConfig = Field(default_factory=WhiteLabelConfig)


class InteractiveWorkspaceRequest(BaseModel):
    data_dir: str = "data"
    filters: dict[str, Any] = Field(default_factory=dict)
    limit: int = Field(default=250, ge=1, le=1000)
    white_label: WhiteLabelConfig = Field(default_factory=WhiteLabelConfig)


class CulturalSignalNetworkRequest(BaseModel):
    signal_id: str
    data_dir: str = "data"
    limit: int = Field(default=10, ge=1, le=100)
    white_label: WhiteLabelConfig = Field(default_factory=WhiteLabelConfig)


class MarketSignalsRequest(BaseModel):
    data_dir: str = "data"
    limit: int = Field(default=10, ge=1, le=100)
    white_label: WhiteLabelConfig = Field(default_factory=WhiteLabelConfig)


class KnowledgeSearchRequest(BaseModel):
    data_dir: str = "data"
    query: str = ""
    style_tribe: str | None = None
    verdict: Literal["Greenlight", "Develop", "Reconsider"] | None = None
    limit: int = Field(default=24, ge=1, le=100)
    white_label: WhiteLabelConfig = Field(default_factory=WhiteLabelConfig)


class ExecutiveDispatchRequest(BaseModel):
    role: Literal["executive"] = "executive"
    data_dir: str = "data"
    candidate_limit: int = Field(default=10, ge=1, le=100)
    reasoning_mode: Literal["auto", "deterministic", "nim"] = "auto"
    reasoning_model: Literal["nano"] = "nano"
    recipients: list[str] = Field(default_factory=list)
    template: str | None = None
    output_formats: list[Literal["html", "markdown", "pdf", "slides"]] = Field(default_factory=lambda: ["html"])
    auto_verify: bool = False
    white_label: WhiteLabelConfig = Field(default_factory=WhiteLabelConfig)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class MirandaChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    reasoning_mode: Literal["auto", "deterministic", "nim"] = "auto"
    reasoning_model: Literal["nano"] = "nano"
    white_label: WhiteLabelConfig = Field(default_factory=WhiteLabelConfig)


class ModelPreviewSwitchRequest(BaseModel):
    provider: str = Field(default="nim", min_length=2, max_length=48)
    model: str = Field(default="nvidia/nvidia-nemotron-nano-9b-v2", min_length=3, max_length=160)
    auth_mode: Literal["env_secret", "customer_managed", "none"] = "env_secret"
    purpose: Literal["executive_brief", "operator_analysis", "chat"] = "executive_brief"


class CandidateRow(BaseModel):
    script_id: str
    title: str
    genre_primary: str
    platform_fit: str
    target_demo: str
    market: str | None = None
    budget_tier: str | None = None
    emergent_trend: str | None = None
    viability_score: float
    completion_prediction: float
    cultural_risk_score: float | None = None
    risk_category: str
    music_momentum_score: float | None = None
    structural_boost_score: float | None = None
    structural_vulnerability_score: float | None = None


class BriefResult(BaseModel):
    role: str
    headline: str
    brief_bullets: list[str] = Field(default_factory=list)
    recommended_candidates: list[dict[str, Any]] = Field(default_factory=list)
    boosted_scripts: list[dict[str, Any]] = Field(default_factory=list)
    vulnerable_scripts: list[dict[str, Any]] = Field(default_factory=list)
    memory_matches: list[dict[str, Any]] = Field(default_factory=list)
    reasoning_trace: list[dict[str, Any]] = Field(default_factory=list)
    benchmark: dict[str, Any] | None = None
    source_evidence: dict[str, Any]


class BriefResponse(BaseModel):
    white_label: WhiteLabelConfig
    result: BriefResult


class WorkspacePayload(BaseModel):
    workspace_type: Literal["interactive_media_intelligence"]
    theme: dict[str, str]
    accelerated_visuals: dict[str, Any]
    streams: dict[str, Any]


class WorkspaceResponse(BaseModel):
    white_label: WhiteLabelConfig
    result: WorkspacePayload


class NetworkGraphResult(BaseModel):
    evidence_type: Literal["cultural_signal_network"]
    signal_id: str
    summary: dict[str, Any]
    boosted_scripts: list[CandidateRow]
    vulnerable_scripts: list[CandidateRow]
    related_signals: list[dict[str, Any]]
    communities: list[dict[str, Any]]
    graph_engine: GraphEngineMeta
    benchmark: BenchmarkMeta


class NetworkGraphResponse(BaseModel):
    white_label: WhiteLabelConfig
    result: NetworkGraphResult


class EvidenceResponse(BaseModel):
    white_label: WhiteLabelConfig
    result: dict[str, Any]


class FrontendContractResponse(BaseModel):
    service: str
    consumers: list[str]
    routes: dict[str, dict[str, Any]]
    examples: dict[str, dict[str, Any]]


class ExecutiveDispatchResult(BaseModel):
    persona: Literal["executive"]
    recipients: list[str]
    subject: str
    bullets: list[str]
    markdown_body: str
    html_body: str
    dispatch_ready: bool
    dispatch_status: str = "draft_ready"
    auto_verified: bool = False
    rendered_template: str | None = None
    generated_artifacts: list[dict[str, Any]] = Field(default_factory=list)
    source_brief: BriefResult


class ExecutiveDispatchResponse(BaseModel):
    white_label: WhiteLabelConfig
    result: ExecutiveDispatchResult


class HealthResponse(BaseModel):
    service: str
    status: Literal["ok"]
    version: str
    data_dir: str
    graph_engine: GraphEngineMeta
    accelerated_visuals: dict[str, Any]
    gpu_demo: dict[str, Any]
    ops: dict[str, Any] = Field(default_factory=dict)


class MirandaChatResult(BaseModel):
    reply: str
    mode: str
    model: str | None = None
    latency_ms: float | None = None
    error: str | None = None


class MirandaChatResponse(BaseModel):
    white_label: WhiteLabelConfig
    result: MirandaChatResult
