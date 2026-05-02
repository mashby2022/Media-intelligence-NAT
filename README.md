# Media Intelligence Engine

Partner-agnostic backend for strategic media intelligence. The system turns script, graph, music, podcast, and streaming market signals into persona-ready evidence for executive briefs and operator dashboards.

The current white-label presentation layer can speak as **Aura Intelligence**, but the core package remains neutral so the same backend can support Lovable, Omni Station, or another frontend without renaming imports.

## What It Does

- Generates and analyzes 150,000 synthetic narrative records.
- Builds a 1.6M-edge cultural graph from script-to-signal and CMU movie-summary relationships.
- Ingests manual market pulses from Netflix Top 10, Spotify songs, and Spotify podcasts.
- Exposes FastAPI routes for executive summaries, operator workspaces, network graph analysis, market signals, and GPU demo readiness.
- Supports standard CPU execution with Polars and accelerated GPU execution with NVIDIA RAPIDS.

## Architecture

```text
Media-intelligence-NAT/
├── agent/                  # Liaison Core tool wrappers and workflow config
├── data/                   # Generated Parquet datasets and smoke fixtures
├── docs/                   # Lovable and frontend handoff notes
├── engine/                 # Data generation, analytics, visuals, GPU checks
├── server/                 # FastAPI app, schemas, static operator workspace
└── tests/                  # Regression tests for data, tools, and API contracts
```

## Core Stack

- Python 3.11+
- FastAPI
- Polars + PyArrow
- NetworkX CPU fallback
- NVIDIA RAPIDS: cuDF, cuGraph, cuML, cuxfilter
- NVIDIA NeMo Agent Toolkit / NAT
- NVIDIA NIM credentials for live model synthesis

## Datasets

Primary generated outputs:

- `data/scripts_150k.parquet`
- `data/cultural_graph_edges.parquet`
- `data/spotify_daily_top200_signals.parquet`
- `data/audience_behavior_profiles.parquet`
- `data/market_signal_snapshot.parquet`

Manual signal snapshots:

- `data/netflix_top10_movies.parquet`
- `data/spotify_top50_songs.parquet`
- `data/spotify_top_podcasts.parquet`

Smoke-test fixtures live under `data/smoke/`.

## Local Setup

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[server,test]"
```

Run tests:

```bash
python -m pytest
```

Start the API:

```bash
python -m uvicorn server.api_server:app --host 127.0.0.1 --port 8000
```

## GPU Demo Setup

On a Brev.dev GPU instance or similar CUDA host:

```bash
python -m pip install -e ".[server,test,accelerated,nat]"
python -m pip install --extra-index-url=https://pypi.nvidia.com \
  cudf-cu13 cugraph-cu13 cuml-cu13 cuxfilter-cu13
```

Use `cu12` packages instead of `cu13` if the instance is on CUDA 12.

Set NIM/NVIDIA credentials only in the environment:

```bash
export NVIDIA_API_KEY="..."
```

Never commit API keys.

## API Routes

- `GET /health`
- `GET /gpu-demo/status`
- `POST /generate-brief`
- `POST /interactive-workspace`
- `POST /network-graph/analyze`
- `POST /market-signals`
- `POST /omni-station/network-graph`
- `GET /omni-station/status`
- `GET /frontend-contract`
- `GET /operator-workspace`
- `GET /accelerated-workspace/status`
- `POST /accelerated-workspace/start`

## Lovable / Omni Station

Lovable should consume `/frontend-contract` first, then wire UI surfaces to:

- Executive view: `/generate-brief`
- Operator dashboard: `/interactive-workspace`
- Market pulse view: `/market-signals`
- Graph view: `/network-graph/analyze`
- Runtime readiness: `/gpu-demo/status`

See `docs/lovable_handoff.md` for the frontend contract.

`/generate-brief` now supports runtime reasoning controls:

- `reasoning_mode`: `auto` | `deterministic` | `nim`
- `reasoning_model`: `nano` | `super`

In `auto`, the API uses deterministic synthesis unless `NVIDIA_API_KEY`/`NGC_API_KEY` is configured.

## Product Voice

Default backend identity: **Media Intelligence Engine**.

White-label presentation identity: **Aura Intelligence**.

Aura output should stay editorial, concise, and evidence-backed:

- Never hallucinate scores.
- If a value is missing, label it `Low Confidence` or `Market Outlier`.
- Keep executive outputs one-click dispatchable.
- Keep operator outputs granular and adjustable.

## Current Verification

Local verification:

```bash
python -m pytest
```

Expected result:

```text
9 passed
```
