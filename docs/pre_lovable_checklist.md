# Pre-Lovable Demo Checklist

Use this before reconnecting the Lovable workspace. The goal is to keep the demo narrow: NAT orchestrates the workflow, Nemotron reasons over the evidence package, and Polars/RAPIDS support the data path.

## Model Inventory

Active frontend defaults:

- `VITE_MIE_REASONING_MODE=auto`
- `VITE_MIE_REASONING_MODEL=nano`

Backend model aliases:

- `nano`: `nvidia/nvidia-nemotron-nano-9b-v2`

Runtime behavior:

- `auto`: uses NIM/Nemotron when an NVIDIA or NGC key is configured, otherwise deterministic fallback.
- `deterministic`: uses local deterministic synthesis only.
- `nim`: requires NIM credentials and calls the configured Nemotron alias.

Bring-your-own-model behavior:

- The live demo runtime remains locked to Nemotron Nano 9B v2.
- `/models/adapters` explains the active adapter and supported BYOM patterns.
- `/models/preview-switch` validates a proposed provider/model without calling it, storing secrets, or changing runtime.
- The demo point is portability: NAT can swap the reasoning adapter after validation while Polars/RAPIDS and output schemas stay unchanged.

Supporting stack:

- NAT: agentic workflow orchestration boundary.
- Polars: tabular processing and workspace filtering.
- RAPIDS: optional GPU acceleration when cuDF/cuGraph/cuML/cuxfilter are available.
- Vault proprietary predictive models: integration boundary only. This demo does not reproduce them.

## Local Servers

Backend:

```bash
python -m uvicorn server.api_server:app --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd lovable-aura
npm run dev -- --host 127.0.0.1 --port 8081
```

If `8081` is occupied, Vite may use `8082`; both origins are allowed by backend CORS.

## Required Local Checks

```bash
curl http://127.0.0.1:8000/config/public
curl http://127.0.0.1:8000/demo/readiness
curl http://127.0.0.1:8000/demo/workflow-run
curl -I http://127.0.0.1:8081/demo
```

Expected:

- `/config/public`: `status` is `ok`, `secrets_exposed` is `false`.
- `/demo/readiness`: `status` is `ready`.
- `/demo/workflow-run`: `status` is `complete`, trace includes `nemotron`.
- `/demo`: returns `200 OK`.

## ngrok Prep

Start the tunnel against the backend port:

```bash
ngrok http 8000
```

Then verify the public URL:

```bash
curl https://YOUR-NGROK-URL.ngrok-free.dev/config/public
curl https://YOUR-NGROK-URL.ngrok-free.dev/demo/readiness
curl https://YOUR-NGROK-URL.ngrok-free.dev/demo/workflow-run
```

Set Lovable environment variables:

```bash
VITE_MIE_API_BASE_URL=https://YOUR-NGROK-URL.ngrok-free.dev
VITE_MIE_BRAND_NAME=Aura Intelligence
VITE_MIE_REASONING_MODE=auto
VITE_MIE_REASONING_MODEL=nano
```

## Demo Talk Track

1. Start at `/demo`.
2. Lead with the architecture frame: NAT orchestration and Nemotron reasoning are the foreground story.
3. Call out the boundary: Vault AI's secret predictive models are not recreated; they would plug into this orchestration layer.
4. Click `Run` in Vault AI Workflow Run.
5. Show the timeline: intake, reasoning trace, memory lookup, operator handoff, dispatch.
6. Open `/operator` to show the evidence surface.
7. Open `/communication` to show the executive brief dispatch surface.

## QA Gate

Before reconnecting Lovable:

- Tests pass: `python -m pytest`.
- Frontend builds: `npm run build` inside `lovable-aura`.
- No real API key appears outside local env files.
- No stale `NeMo-3-Nano`, `0.02ms`, or inflated signal-count claims remain in the UI.
