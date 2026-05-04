export type ReasoningMode = "auto" | "deterministic" | "nim";
export type ReasoningModel = "nano" | "super";
export type WorkspaceFilters = {
  genre?: string;
  platform?: string;
  demo?: string;
  market?: string;
  risk_category?: string;
  budget_tier?: string;
  emergent_trend?: string;
  min_viability?: number;
  max_risk?: number;
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
      };
      graph?: {
        summary?: { edges?: number; unique_scripts?: number; unique_signals?: number };
        edge_counts?: Array<{ signal_type?: string; edges?: number }>;
      };
    };
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
const REASONING_MODE = (import.meta.env.VITE_MIE_REASONING_MODE || "auto") as ReasoningMode;
const REASONING_MODEL = (import.meta.env.VITE_MIE_REASONING_MODEL || "nano") as ReasoningModel;
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
    reasoningMode: REASONING_MODE,
    reasoningModel: REASONING_MODEL,
  },
  health: () => get<{ graph_engine?: { compute_source?: string } }>("/health"),
  frontendContract: () => get<{ routes?: Record<string, unknown> }>("/frontend-contract"),
  orchestratorTools: () => get<{ liaison_core?: { tools?: unknown[] } }>("/orchestrator/tools"),
  generateBrief: (candidateLimit = 5) =>
    post<{
      result: {
        headline?: string;
        brief_bullets?: string[];
        recommended_candidates?: Array<{ viability_score?: number }>;
        source_evidence?: { summary?: { avg_viability?: number } };
      };
    }>("/generate-brief", {
      role: "executive",
      candidate_limit: candidateLimit,
      reasoning_mode: REASONING_MODE,
      reasoning_model: REASONING_MODEL,
      white_label: { brand_name: BRAND, theme: {} },
    }),
  dispatchExecutiveBrief: (recipients: string[], candidateLimit = 5) =>
    post<{
      result: {
        subject: string;
        bullets: string[];
        markdown_body: string;
        html_body: string;
        dispatch_ready: boolean;
      };
    }>("/dispatch/executive-brief", {
      role: "executive",
      candidate_limit: candidateLimit,
      reasoning_mode: REASONING_MODE,
      reasoning_model: REASONING_MODEL,
      recipients,
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
