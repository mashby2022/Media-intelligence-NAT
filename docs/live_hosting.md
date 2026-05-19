# Live Hosting

This repo is best hosted as two services:

- FastAPI backend from the repo root.
- Vite frontend from `lovable-aura/`.

## Backend: Render

1. Push the repo to GitHub.
2. In Render, create a Blueprint or Web Service from the repo.
3. Use the included `render.yaml`, or configure manually:

   ```bash
   python -m pip install --upgrade pip && python -m pip install -e ".[server]"
   python -m uvicorn server.api_server:app --host 0.0.0.0 --port $PORT
   ```

4. Add environment variables:

   ```text
   MIE_CORS_ORIGINS=https://your-frontend-domain.vercel.app
   NVIDIA_API_KEY=...
   NIM_BASE_URL=https://integrate.api.nvidia.com/v1
   ```

   `NVIDIA_API_KEY` is optional. Without it, the API uses deterministic demo responses.

5. Check the deployed backend:

   ```bash
   curl https://your-backend.onrender.com/health
   curl https://your-backend.onrender.com/demo/readiness
   ```

## Frontend: Vercel

1. Import the same GitHub repo in Vercel.
2. Set the project root directory to:

   ```text
   lovable-aura
   ```

3. Use the included `lovable-aura/vercel.json`, or configure manually:

   ```bash
   npm ci
   npm run build
   ```

   Output directory:

   ```text
   dist
   ```

4. Add environment variables:

   ```text
   VITE_MIE_API_BASE_URL=https://your-backend.onrender.com
   VITE_MIE_BRAND_NAME=Aura Intelligence
   VITE_MIE_REASONING_MODE=auto
   ```

5. Redeploy the frontend after the backend URL is known.

## CORS

After Vercel gives you the live frontend URL, add it to the backend `MIE_CORS_ORIGINS` value and redeploy the backend.

For multiple frontend URLs, use a comma-separated list:

```text
MIE_CORS_ORIGINS=https://your-app.vercel.app,https://your-preview.vercel.app
```

## Editable Live Option

For an editable cloud workspace, use Brev with the same GitHub repo and expose ports `8000` and `8080`. For a public live demo URL, use Render plus Vercel.

Check the launch surface first:

```bash
curl http://127.0.0.1:8000/launch/readiness
```

## Brev Editable Workspace

Use Brev when the audience is technical and you want NVIDIA/GPU validation, NAT execution testing, NeMo Data Designer integration, or an editable cloud workspace.

1. Log in to Brev.
2. Create or open a GPU instance.
3. Clone this repo or copy the working tree.
4. Start the backend and frontend:

   ```bash
   python -m pip install -e ".[server,nat]"
   python -m uvicorn server.api_server:app --host 0.0.0.0 --port 8000
   cd lovable-aura && npm ci && npm run dev -- --host 0.0.0.0 --port 8080
   ```

5. Expose/forward ports `8000` and `8080`.

Keep the customer wording precise: the local repo is NAT-compatible now; Brev is the place to validate real NAT execution, GPU profiling, NIM/Nemotron settings, and NeMo Data Designer connectivity.

## Book/IP Data

The IP scouting demo uses `data/book_trend_signals.parquet` when present. Build it from the Kaggle NYT bestsellers archive with:

```bash
python -m engine.book_trend_ingestion \
  --zip ~/Downloads/nyt-bestsellers-1931-2024-fictionnon-fiction.zip \
  --out data
```

The API route is also available:

```bash
curl -X POST http://127.0.0.1:8000/ip-scouting/ingest/nyt-bestsellers \
  -H 'Content-Type: application/json' \
  -d '{"zip_path":"~/Downloads/nyt-bestsellers-1931-2024-fictionnon-fiction.zip","out_dir":"data"}'
```
