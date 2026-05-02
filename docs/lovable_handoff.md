# Lovable Frontend Handoff

## Backend Base URL

Use the local backend while developing on the same machine:

```text
http://127.0.0.1:8000
```

If the Lovable preview is cloud-hosted, expose the local backend with a public tunnel such as ngrok and use the HTTPS tunnel URL as the base URL.

For hosted Lovable preview domains, add the preview origin to CORS:

```bash
MIE_CORS_ORIGINS="https://your-lovable-preview.example" python -m uvicorn server.api_server:app --host 127.0.0.1 --port 8000
```

## Discovery Endpoints

Lovable should inspect these first:

```text
GET /health
GET /frontend-contract
GET /openapi.json
GET /omni-station/status
GET /accelerated-workspace/status
GET /orchestrator/tools
```

`/frontend-contract` is the compact product contract. `/openapi.json` is the complete schema contract.

## Primary API Calls

### Executive Brief

```http
POST /generate-brief
Content-Type: application/json
```

```json
{
  "role": "executive",
  "candidate_limit": 5,
  "white_label": {
    "brand_name": "Media Intelligence Engine",
    "theme": {}
  }
}
```

Use for the Executive Brief page. Render `result.headline`, `result.recommended_candidates`, and `result.benchmark`.

For live model-backed summaries, include:

```json
{
  "reasoning_mode": "nim",
  "reasoning_model": "nano"
}
```

Accepted values:

- `reasoning_mode`: `auto` | `deterministic` | `nim`
- `reasoning_model`: `nano` | `super`

### Executive Inbox Dispatch

```http
POST /dispatch/executive-brief
Content-Type: application/json
```

```json
{
  "role": "executive",
  "candidate_limit": 5,
  "reasoning_mode": "nim",
  "reasoning_model": "nano",
  "recipients": ["client@example.com"],
  "white_label": {
    "brand_name": "Aura Intelligence",
    "theme": {}
  }
}
```

Use for one-click executive delivery. Render or send:

- `result.subject`
- `result.bullets` (3 bullet summary)
- `result.markdown_body`
- `result.html_body`
- `result.dispatch_ready`

### Operator Workspace

```http
POST /interactive-workspace
Content-Type: application/json
```

```json
{
  "limit": 250,
  "filters": {
    "genre": "Drama",
    "min_viability": 0.75,
    "budget_tier": "Premium"
  },
  "white_label": {
    "brand_name": "Media Intelligence Engine",
    "theme": {
      "--mie-accent": "#0f766e"
    }
  }
}
```

Use for the Operator Workspace page. Render:

- `result.streams.workspace.kpis`
- `result.streams.workspace.filter_options`
- `result.streams.workspace.scatter_points`
- `result.streams.workspace.table_rows`
- `result.streams.graph.edge_counts`
- `result.accelerated_visuals.capabilities`

### Network Graph

```http
POST /network-graph/analyze
Content-Type: application/json
```

```json
{
  "signal_id": "spotify_00001",
  "limit": 10,
  "white_label": {
    "brand_name": "Media Intelligence Engine",
    "theme": {}
  }
}
```

Use for the Zeitgeist / Network Graph page. Render:

- `result.summary`
- `result.boosted_scripts`
- `result.vulnerable_scripts`
- `result.related_signals`
- `result.communities`
- `result.graph_engine`

Omni Station can call the equivalent alias:

```text
POST /omni-station/network-graph
```

### Market Signals

```http
POST /market-signals
Content-Type: application/json
```

```json
{
  "limit": 10,
  "white_label": {
    "brand_name": "Media Intelligence Engine",
    "theme": {}
  }
}
```

Use for current cross-platform demand signals. Render:

- `result.summary.signals`
- `result.category_counts`
- `result.top_signals`
- `result.benchmark`

## Lovable Page Map

Build five app views:

1. **Executive Brief**
   - Calls `/generate-brief`
   - Shows headline, recommended candidates, benchmark metadata

2. **Operator Workspace**
   - Calls `/interactive-workspace`
   - Filters: genre, platform, demo, market, risk category, budget tier, emergent trend, min viability, max risk
   - Shows KPI cards, scatter plot, graph edge bars, and candidate table

3. **Network Graph / Zeitgeist**
   - Calls `/network-graph/analyze`
   - Input: `signal_id`
   - Shows boosted scripts, vulnerable scripts, related signals, communities

4. **System Status**
   - Calls `/health`, `/omni-station/status`, and `/accelerated-workspace/status`
   - Shows active compute source and missing/available accelerated packages

5. **Market Signals**
   - Calls `/market-signals`
   - Shows Netflix movie demand, Spotify song demand, and Spotify podcast attention
   - Uses `signal_id` values as candidates for Network Graph exploration when relevant

6. **Executive Dispatch**
   - Calls `/dispatch/executive-brief`
   - Shows subject preview + markdown/html preview
   - Uses recipient list from UI and passes brand name

7. **Orchestrator / Miranda Tools**
   - Calls `/orchestrator/tools`
   - Uses `liaison_core.tools` for orchestrator tool discovery and schema sync

## Frontend State

Recommended state keys:

```ts
type AppState = {
  backendBaseUrl: string;
  whiteLabel: {
    brand_name: string;
    theme: Record<string, string>;
  };
  briefRole: string;
  workspaceFilters: {
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
  selectedSignalId: string;
  marketSignalLimit: number;
  recipients: string[];
  reasoningMode: "auto" | "deterministic" | "nim";
  reasoningModel: "nano" | "super";
  loading: boolean;
  error?: string;
};
```

## Lovable Environment Mapping

Create Lovable environment variables:

```bash
VITE_MIE_API_BASE_URL=http://127.0.0.1:8000
VITE_MIE_BRAND_NAME=Aura Intelligence
VITE_MIE_REASONING_MODE=auto
VITE_MIE_REASONING_MODEL=nano
```

If using Brev/ngrok/public backend, set `VITE_MIE_API_BASE_URL` to that HTTPS URL.

## Frontend API Client Mapping

```ts
// src/lib/mieClient.ts
const API_BASE = import.meta.env.VITE_MIE_API_BASE_URL;
const BRAND = import.meta.env.VITE_MIE_BRAND_NAME ?? "Aura Intelligence";
const REASONING_MODE = import.meta.env.VITE_MIE_REASONING_MODE ?? "auto";
const REASONING_MODEL = import.meta.env.VITE_MIE_REASONING_MODEL ?? "nano";

async function post(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export const mieClient = {
  health: () => fetch(`${API_BASE}/health`).then((r) => r.json()),
  frontendContract: () => fetch(`${API_BASE}/frontend-contract`).then((r) => r.json()),
  orchestratorTools: () => fetch(`${API_BASE}/orchestrator/tools`).then((r) => r.json()),
  generateBrief: (candidateLimit = 5) =>
    post("/generate-brief", {
      role: "executive",
      candidate_limit: candidateLimit,
      reasoning_mode: REASONING_MODE,
      reasoning_model: REASONING_MODEL,
      white_label: { brand_name: BRAND, theme: {} },
    }),
  dispatchExecutiveBrief: (recipients: string[], candidateLimit = 5) =>
    post("/dispatch/executive-brief", {
      role: "executive",
      candidate_limit: candidateLimit,
      reasoning_mode: REASONING_MODE,
      reasoning_model: REASONING_MODEL,
      recipients,
      white_label: { brand_name: BRAND, theme: {} },
    }),
  workspace: (filters: Record<string, unknown>) =>
    post("/interactive-workspace", {
      limit: 250,
      filters,
      white_label: { brand_name: BRAND, theme: {} },
    }),
  network: (signalId: string) =>
    post("/network-graph/analyze", {
      signal_id: signalId,
      limit: 10,
      white_label: { brand_name: BRAND, theme: {} },
    }),
  marketSignals: (limit = 10) =>
    post("/market-signals", {
      limit,
      white_label: { brand_name: BRAND, theme: {} },
    }),
};
```

## Acceptance Criteria

Phase 5 is complete when Lovable can:

- Read `GET /frontend-contract`
- Read `GET /openapi.json`
- Render the Executive Brief from `/generate-brief`
- Render the Executive Dispatch preview from `/dispatch/executive-brief`
- Render the Operator Workspace from `/interactive-workspace`
- Render the Network Graph page from `/network-graph/analyze`
- Render the Market Signals page from `/market-signals`
- Render Miranda/orchestrator tool discovery from `/orchestrator/tools`
- Render system status from `/health` and `/omni-station/status`
- Apply white-label theme values from the API response
- Use a configurable backend base URL for local or ngrok-backed development
