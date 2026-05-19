# Local Demo Runbook

Use this for the local demo. Keep the story narrow: this is a NAT-compatible workflow boundary, Nemotron Nano reasons over the evidence package when configured, and Polars/RAPIDS support the data path.

## Start

Backend:

```bash
python -m uvicorn server.api_server:app --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd lovable-aura
npm run dev -- --host 127.0.0.1 --port 8080
```

If Vite says 8080 is busy, use the next printed local URL.

## Preflight

```bash
curl http://127.0.0.1:8000/demo/readiness
curl http://127.0.0.1:8000/launch/readiness
curl http://127.0.0.1:8000/miranda/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Which emerging audience markets are underserved?"}],"reasoning_mode":"auto","reasoning_model":"nano"}'
```

Expected:

- `/demo/readiness` returns `status: ready` or a readable degraded state.
- `/launch/readiness` shows whether Brev, Render/Vercel, and the book/IP data path are ready.
- The Miranda response mode is `curated_demo_response`.
- The underserved-market answer mentions Nollywood and Korean-language films.

## Five-Minute Path

1. Open `/demo`.
   Say: "This is a narrow agentic briefing workflow, not a replacement for proprietary predictive models."

2. Open `/`.
   Say: "Miranda is the executive surface. The workflow is NAT-compatible today; Nemotron Nano reasons over the evidence package when NIM is configured."

3. Click the three executive questions.
   Say: "These are tuned demo questions so the executive gets recommendation, bets, evidence, risk, and next action."

4. Click **Validate evidence** or open `/operator`.
   Say: "This is the operator evidence layer. It proves traceability without making the executive live in a dashboard."

5. Open `/communication`.
   Say: "The same insight package becomes an inbox-ready brief."

## Guardrails

- Do not claim the demo reproduces a customer's proprietary predictive models.
- Say this is a workflow possibility and integration pattern.
- Keep the NAT-compatible workflow boundary and Nemotron in the foreground.
- Mention Polars/RAPIDS as the fast evidence-processing layer, not the headline.
- Use the operator view only when asked to show evidence.

## Fallback Lines

- If NIM is unavailable: "The adapter boundary is still visible; the demo falls back deterministically so the workflow remains testable."
- If a live answer stalls: "The canonical executive questions are curated for demo reliability; the operator view shows the supporting evidence layer."
- If asked about a vector database: "This local demo uses structured evidence and curated canonical flows. A production version would add embeddings/vector search over scripts, reports, and prior briefs."
- If asked about book data: "The demo uses the NYT bestsellers Kaggle dataset when `data/book_trend_signals.parquet` is present; Goodreads should be treated as a future licensed/source-compliant adapter rather than a direct crawler."
