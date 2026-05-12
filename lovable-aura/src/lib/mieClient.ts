export type ReasoningMode = "auto" | "deterministic" | "nim";
export type ReasoningModel = "nano";
export type AssetStatus = "rising" | "peaking" | "fading";
export type WorkspaceFilters = {
  genre?: string;
  platform?: string;
  demo?: string;
  market?: string;
  risk_category?: string;
  budget_tier?: string;
  emergent_trend?: string;
  status?: AssetStatus;
  min_viability?: number;
  max_risk?: number;
};

export type NarrativeAtom = {
  atom_id: string;
  atom_type: string;
  label: string;
  source_field: string;
  role: string;
};

export type WorkspaceRow = {
  script_id: string;
  title: string;
  genre_primary: string;
  platform_fit: string;
  target_demo: string;
  market?: string;
  budget_tier?: string;
  emergent_trend?: string;
  viability_score: number;
  completion_prediction: number;
  cultural_risk_score?: number;
  risk_category: string;
  music_momentum_score?: number;
  structural_boost_score?: number;
  structural_vulnerability_score?: number;
  status?: AssetStatus;
  narrative_atoms?: NarrativeAtom[];
};

export type PortfolioAsset = WorkspaceRow & {
  asset_id: string;
  asset_type: "script";
  status: AssetStatus;
  narrative_atoms: NarrativeAtom[];
};

export type MapCluster = {
  cluster_id: string;
  label: string;
  style_tribe: string;
  records: number;
  share: number;
  avg_viability?: number;
  avg_cultural_risk?: number;
  dominant_verdict: "Greenlight" | "Develop" | "Reconsider" | string;
  dominant_trend?: string;
  x: number;
  y: number;
  depth: number;
  node_count: number;
  color: string;
};

export type WorkspaceResult = {
  result: {
    accelerated_visuals?: {
      capabilities?: { compute_source?: string; available?: boolean; packages?: Record<string, boolean> };
    };
    streams?: {
      workspace?: {
        kpis?: {
          records?: number;
          avg_viability?: number;
          avg_completion_prediction?: number;
          avg_cultural_risk?: number;
          high_viability_records?: number;
        };
        filter_options?: Record<string, string[]>;
        scatter_points?: WorkspaceRow[];
        table_rows?: WorkspaceRow[];
        portfolio_assets?: PortfolioAsset[];
        clusters?: MapCluster[];
        benchmark?: { latency_ms?: number; throughput?: number; compute_source?: string };
      };
      graph?: {
        summary?: { edges?: number; unique_scripts?: number; unique_signals?: number };
        edge_counts?: Array<{ signal_type?: string; edges?: number }>;
      };
    };
  };
};

export type HealthResult = {
  service?: string;
  status?: "ok";
  version?: string;
  data_dir?: string;
  graph_engine?: { compute_source?: string; active_engine?: string; packages?: Record<string, boolean> };
  ops?: {
    nim?: {
      configured?: boolean;
      mode?: string;
      base_url?: string;
      model_aliases?: Record<string, string>;
    };
    polars?: {
      latency_ms?: number | null;
      throughput?: number | null;
      compute_source?: string | null;
    };
    graph?: {
      active_engine?: string;
      compute_source?: string;
      packages?: Record<string, boolean>;
      accelerated_available?: boolean;
      standard_available?: boolean;
    };
    gpu?: {
      available?: boolean;
      nvidia_smi?: string | null;
      device?: string | null;
      vram_total_mb?: number | null;
    };
  };
};

export type DemoReadinessResult = {
  service?: string;
  status?: "ready" | "degraded";
  data_dir?: string;
  secrets_exposed?: boolean;
  phases?: Record<
    string,
    {
      ready?: boolean;
      polars_latency_ms?: number | null;
      graph_engine?: string;
      trace_events?: number;
      memory_matches?: number;
      knowledge_items?: number;
      clusters?: number;
      dispatch_status?: string;
      artifacts?: Array<{ format?: string; filename?: string; status?: string; auto_generated?: boolean }>;
    }
  >;
};

export type DemoWorkflowRunResult = {
  run_id: string;
  status: "complete" | "running" | "failed" | string;
  mode: string;
  data_dir?: string;
  shared_asset_id: string;
  intake?: {
    event_id?: string;
    source?: string;
    detected_at?: string;
    status?: string;
    action?: string;
    asset?: WorkspaceRow;
  };
  shared_insight_package?: {
    asset_id?: string;
    headline?: string;
    bullets?: string[];
    reasoning_trace?: AgentTraceEvent[];
    memory_matches?: MemoryMatch[];
    knowledge_items?: KnowledgeItem[];
  };
  surfaces?: {
    executive_email?: {
      status?: string;
      subject?: string;
      recipients?: string[];
      artifacts?: Array<{ format?: string; filename?: string; status?: string; auto_generated?: boolean }>;
    };
    operator_workspace?: {
      status?: string;
      portfolio_asset?: PortfolioAsset | WorkspaceRow;
      clusters?: MapCluster[];
      benchmark?: { latency_ms?: number; throughput?: number; compute_source?: string };
    };
    communication_lab?: {
      status?: string;
      rendered_template?: string | null;
      html_body?: string;
    };
  };
  timeline?: Array<{
    step_id?: string;
    time?: string;
    actor?: string;
    status?: string;
    label?: string;
    detail?: string;
  }>;
  secrets_exposed?: boolean;
};

export type PublicConfigResult = {
  service?: string;
  status?: "ok" | string;
  version?: string;
  data_dir?: string;
  api?: {
    public_routes?: string[];
    frontend_contract?: string;
    readiness?: string;
    workflow_run?: string;
  };
  architecture_positioning?: {
    primary_story?: string;
    secondary_story?: string;
    demo_boundary?: string;
    architect_note?: string;
    components?: Record<
      string,
      {
        role?: string;
        foreground?: boolean;
        demo_use?: string;
        aliases?: Record<string, string>;
      }
    >;
  };
  model_adapters?: ModelAdaptersResult;
  deployment?: {
    lovable_supported?: boolean;
    ngrok_supported?: boolean;
    cors_origin_count?: number;
    explicit_origins?: string[];
    origin_regex?: string;
    local_dev_ports?: number[];
  };
  reasoning?: {
    nim_configured?: boolean;
    mode?: string;
    base_url?: string;
    model_aliases?: Record<string, string>;
    timeout_sec?: number;
  };
  datasets?: Record<string, boolean>;
  missing?: Record<string, string[]>;
  compute_source?: string;
  secrets_exposed?: boolean;
};

export type DatasetInventoryItem = {
  dataset_id: string;
  name: string;
  filename: string;
  format: string;
  size_bytes: number;
  rows?: number;
  columns?: string[];
  column_count?: number;
  download_formats: string[];
  downloads: Record<string, string>;
  metadata_error?: string;
};

export type DatasetInventoryResult = {
  data_dir: string;
  count: number;
  items: DatasetInventoryItem[];
  secrets_exposed: boolean;
};

export type ModelAdaptersResult = {
  active_adapter?: {
    adapter_id?: string;
    provider?: string;
    model?: string;
    alias?: string;
    status?: string;
    runtime_locked?: boolean;
    auth_mode?: string;
    reason?: string;
  };
  bring_your_own_model?: {
    preview_only?: boolean;
    supported_patterns?: Array<{
      provider?: string;
      example_model?: string;
      auth_mode?: string;
      notes?: string;
    }>;
    switch_steps?: string[];
  };
  secrets_exposed?: boolean;
};

export type ModelPreviewSwitchResult = {
  status?: "preview_ready" | "needs_review" | string;
  preview_only?: boolean;
  active_runtime_unchanged?: boolean;
  current_active_model?: string;
  requested_adapter?: {
    provider?: string;
    model?: string;
    auth_mode?: string;
    purpose?: string;
  };
  workflow_impact?: Record<string, string>;
  validation_checks?: Array<{ name?: string; passed?: boolean }>;
  warnings?: string[];
  secrets_exposed?: boolean;
};

export type AgentTraceEvent = {
  event_type: "thought" | "tool" | "output" | string;
  actor: string;
  message: string;
  status?: string;
  offset_ms?: number;
};

export type MemoryMatch = {
  memory_id?: string;
  memory_period?: string;
  title?: string;
  script_id?: string;
  genre_primary?: string;
  platform_fit?: string;
  target_demo?: string;
  emergent_trend?: string;
  memory_similarity?: number;
  reason?: string;
};

export type AutonomousIntakeItem = {
  event_id: string;
  source: string;
  detected_at: string;
  status: string;
  action: string;
  asset: WorkspaceRow;
};

export type KnowledgeVerdict = "Greenlight" | "Develop" | "Reconsider";
export type KnowledgeSearchFilters = {
  query?: string;
  style_tribe?: string;
  verdict?: KnowledgeVerdict;
  limit?: number;
};

export type KnowledgeItem = WorkspaceRow & {
  knowledge_id: string;
  style_tribe: string;
  verdict: KnowledgeVerdict;
  published_date: string;
  tag: string;
  narrative_atoms?: NarrativeAtom[];
};

export type KnowledgeSearchResult = {
  result: {
    evidence_type: "living_knowledge_search";
    query: string;
    filters?: { style_tribe?: string | null; verdict?: string | null };
    filter_options?: { style_tribes?: string[]; verdicts?: KnowledgeVerdict[] };
    items: KnowledgeItem[];
    benchmark?: { latency_ms?: number; throughput?: number; compute_source?: string };
  };
};

export type MarketSignal = {
  signal_id: string;
  signal_name: string;
  signal_category: string;
  rank?: number;
  signal_strength?: number;
  primary_metric?: number;
  primary_metric_name?: string;
};

export type NetworkResult = {
  result: {
    signal_id: string;
    summary?: {
      connected_scripts?: number;
      avg_viability?: number;
      avg_cultural_risk?: number;
      structural_boost_index?: number;
      structural_vulnerability_index?: number;
      related_signals?: number;
    };
    boosted_scripts?: WorkspaceRow[];
    vulnerable_scripts?: WorkspaceRow[];
  };
};

function normalizeApiBaseUrl(raw: string | undefined): string {
  const fallback = "http://127.0.0.1:8000";
  const input = (raw || fallback).trim();
  const dequoted = input.replace(/^['"]|['"]$/g, "").trim();
  return dequoted.replace(/\/+$/, "");
}

const API_BASE = normalizeApiBaseUrl(import.meta.env.VITE_MIE_API_BASE_URL);
const BRAND = import.meta.env.VITE_MIE_BRAND_NAME || "Aura Intelligence";
const CUSTOMER_NAME = import.meta.env.VITE_MIE_CUSTOMER_NAME || "Customer Studio";
const REASONING_MODE = (import.meta.env.VITE_MIE_REASONING_MODE || "auto") as ReasoningMode;
const REASONING_MODEL: ReasoningModel = "nano";
const IS_NGROK_BACKEND = API_BASE.includes(".ngrok-free.");

function requestHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    ...(IS_NGROK_BACKEND ? { "ngrok-skip-browser-warning": "true" } : {}),
    ...extra,
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status}): ${body || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: requestHeaders(),
  });
  return parseJson<T>(response);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: requestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  return parseJson<T>(response);
}

export const mieClient = {
  config: {
    apiBase: API_BASE,
    brand: BRAND,
    customerName: CUSTOMER_NAME,
    reasoningMode: REASONING_MODE,
    reasoningModel: REASONING_MODEL,
  },
  health: () => get<HealthResult>("/health"),
  publicConfig: () => get<PublicConfigResult>("/config/public"),
  modelAdapters: () => get<ModelAdaptersResult>("/models/adapters"),
  previewModelSwitch: (payload: { provider: string; model: string; authMode?: "env_secret" | "customer_managed" | "none"; purpose?: "executive_brief" | "operator_analysis" | "chat" }) =>
    post<ModelPreviewSwitchResult>("/models/preview-switch", {
      provider: payload.provider,
      model: payload.model,
      auth_mode: payload.authMode || "customer_managed",
      purpose: payload.purpose || "executive_brief",
    }),
  demoReadiness: () => get<DemoReadinessResult>("/demo/readiness"),
  demoWorkflowRun: () => get<DemoWorkflowRunResult>("/demo/workflow-run"),
  datasets: () => get<DatasetInventoryResult>("/datasets"),
  datasetDownloadUrl: (datasetId: string, format: string) =>
    `${API_BASE}/datasets/${encodeURIComponent(datasetId)}/download?format=${encodeURIComponent(format)}`,
  frontendContract: () => get<{ routes?: Record<string, unknown> }>("/frontend-contract"),
  orchestratorTools: () => get<{ liaison_core?: { tools?: unknown[] } }>("/orchestrator/tools"),
  generateBrief: (candidateLimit = 5) =>
    post<{
      result: {
        headline?: string;
        brief_bullets?: string[];
        recommended_candidates?: Array<{ viability_score?: number }>;
        memory_matches?: MemoryMatch[];
        reasoning_trace?: AgentTraceEvent[];
        source_evidence?: { summary?: { avg_viability?: number } };
      };
    }>("/generate-brief", {
      role: "executive",
      candidate_limit: candidateLimit,
      reasoning_mode: REASONING_MODE,
      reasoning_model: REASONING_MODEL,
      white_label: { brand_name: BRAND, theme: {} },
    }),
  autonomousIntakeFeed: (limit = 6) =>
    get<{
      feed_type: string;
      mode: string;
      items: AutonomousIntakeItem[];
      benchmark?: { latency_ms?: number; compute_source?: string };
    }>(`/autonomous-intake/feed?limit=${limit}`),
  knowledgeSearch: (filters: KnowledgeSearchFilters = {}) =>
    post<KnowledgeSearchResult>("/knowledge/search", {
      query: filters.query || "",
      style_tribe: filters.style_tribe || null,
      verdict: filters.verdict || null,
      limit: filters.limit || 24,
      white_label: { brand_name: BRAND, theme: {} },
    }),
  dispatchExecutiveBrief: (
    recipients: string[],
    candidateLimit = 5,
    options: {
      template?: string;
      outputFormats?: Array<"html" | "markdown" | "pdf" | "slides">;
      autoVerify?: boolean;
    } = {},
  ) =>
    post<{
      result: {
        subject: string;
        bullets: string[];
        markdown_body: string;
        html_body: string;
        dispatch_ready: boolean;
        dispatch_status?: string;
        auto_verified?: boolean;
        rendered_template?: string | null;
        generated_artifacts?: Array<{ format?: string; filename?: string; status?: string; auto_generated?: boolean }>;
      };
    }>("/dispatch/executive-brief", {
      role: "executive",
      candidate_limit: candidateLimit,
      reasoning_mode: REASONING_MODE,
      reasoning_model: REASONING_MODEL,
      recipients,
      template: options.template,
      output_formats: options.outputFormats || ["html"],
      auto_verify: options.autoVerify || false,
      white_label: { brand_name: BRAND, theme: {} },
    }),
  mirandaChat: (messages: Array<{ role: "user" | "assistant"; content: string }>) =>
    post<{
      result: {
        reply: string;
        mode: string;
        model?: string | null;
        latency_ms?: number | null;
        error?: string | null;
      };
    }>("/miranda/chat", {
      messages,
      reasoning_mode: REASONING_MODE,
      reasoning_model: REASONING_MODEL,
      white_label: { brand_name: BRAND, theme: {} },
    }),
  workspace: (filters: WorkspaceFilters = {}, limit = 250) =>
    post<WorkspaceResult>("/interactive-workspace", {
      limit,
      filters,
      white_label: { brand_name: BRAND, theme: {} },
    }),
  network: (signalId: string, limit = 10) =>
    post<NetworkResult>("/network-graph/analyze", {
      signal_id: signalId,
      limit,
      white_label: { brand_name: BRAND, theme: {} },
    }),
  marketSignals: (limit = 10) =>
    post<{
      result: {
        summary?: { signals?: number };
        category_counts?: Array<{ signal_category?: string; signals?: number; avg_signal_strength?: number }>;
        top_signals?: MarketSignal[];
        benchmark?: { latency_ms?: number; compute_source?: string };
      };
    }>("/market-signals", {
      limit,
      white_label: { brand_name: BRAND, theme: {} },
    }),
};
