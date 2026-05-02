export type ReasoningMode = "auto" | "deterministic" | "nim";
export type ReasoningModel = "nano" | "super";

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

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status}): ${body || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  return parseJson<T>(response);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
};
