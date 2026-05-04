# Aura Frontend (Lovable) -> Media Intelligence Backend

This frontend is mapped to the Media Intelligence Engine backend.

## Environment

Set these in Lovable/Vite:

```bash
VITE_MIE_API_BASE_URL=https://flatterer-imitation-figurine.ngrok-free.dev
VITE_MIE_BRAND_NAME=Aura Intelligence
VITE_MIE_REASONING_MODE=auto
VITE_MIE_REASONING_MODEL=nano
```

For the hosted Lovable app at `https://aura-intelligence-flow.lovable.app`, set `VITE_MIE_API_BASE_URL` to the active HTTPS ngrok URL for the FastAPI backend.

## Backend Routes Used

- `GET /health`
- `GET /frontend-contract`
- `GET /orchestrator/tools`
- `POST /generate-brief`
- `POST /dispatch/executive-brief`
- `POST /interactive-workspace`
- `POST /network-graph/analyze`
- `POST /market-signals`

## Frontend Mapping

- `src/lib/mieClient.ts`:
  central API client and env mapping.

- `src/components/aura/ExecutiveSuite.tsx`:
  `Deconstruct Narrative` now calls `/generate-brief`.

- `src/components/aura/CommunicationLab.tsx`:
  `Dispatch to Client Inbox` now calls `/dispatch/executive-brief` and updates subject/body preview from backend response.

- `src/pages/AuraLayout.tsx`:
  footer backend/agent status now reads from backend health + reasoning env.

## CORS

If Lovable preview uses a hosted domain, backend must allow it:

```bash
MIE_CORS_ORIGINS="https://aura-intelligence-flow.lovable.app" python -m uvicorn server.api_server:app --host 127.0.0.1 --port 8000
```

## Quick Validation

1. Open app and trigger `Deconstruct Narrative`.
2. Confirm the brief headline and bullets update from backend.
3. Open Communication Lab and dispatch with a recipient email.
4. Confirm subject and preview update from backend dispatch payload.
