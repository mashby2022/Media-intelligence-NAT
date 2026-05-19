"""Launch readiness helpers for local, Brev, and hosted demo paths."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any


def _file_exists(path: str | Path) -> bool:
    return Path(path).exists()


def launch_readiness(data_dir: str | Path = "data") -> dict[str, Any]:
    data_path = Path(data_dir)
    book_trends = data_path / "book_trend_signals.parquet"
    scripts = data_path / "scripts_150k.parquet"
    market_snapshot = data_path / "market_signal_snapshot.parquet"
    audience_profiles = data_path / "audience_behavior_profiles.parquet"

    data_checks = {
        "scripts_150k": _file_exists(scripts),
        "market_signal_snapshot": _file_exists(market_snapshot),
        "audience_behavior_profiles": _file_exists(audience_profiles),
        "book_trend_signals": _file_exists(book_trends),
    }
    env_checks = {
        "nvidia_api_key_configured": bool(os.getenv("NVIDIA_API_KEY")),
        "nemo_data_designer_configured": bool(os.getenv("NEMO_DATA_DESIGNER_BASE_URL")),
        "cors_origins_configured": bool(os.getenv("MIE_CORS_ORIGINS")),
    }

    options = {
        "brev_editable_workspace": {
            "best_for": "Fast technical prototype and GPU-backed customer/NVIDIA working session.",
            "status": "ready_for_login" if all(data_checks.values()) else "needs_data_sync",
            "requires_login": True,
            "ports": [8000, 8080],
            "startup_commands": [
                "python -m pip install -e '.[server,nat]'",
                "python -m uvicorn server.api_server:app --host 0.0.0.0 --port 8000",
                "cd lovable-aura && npm ci && npm run dev -- --host 0.0.0.0 --port 8080",
            ],
            "gpu_use": [
                "NAT execution validation",
                "Nemotron/NIM calls when keys are configured",
                "NeMo Data Designer integration tests",
                "RAPIDS/CUDA performance profiling",
            ],
        },
        "render_vercel_public_demo": {
            "best_for": "Stable public URL for customer sharing.",
            "status": "ready_to_configure",
            "backend": "Render FastAPI service from render.yaml",
            "frontend": "Vercel Vite app from lovable-aura/vercel.json",
            "required_env": ["cors_origins", "frontend_api_base_url"],
            "optional_env": ["nvidia_service_credential", "nim_base_url", "nemo_data_designer_base_url"],
        },
        "hugging_face_space": {
            "best_for": "Shareable interactive demo if you want one self-contained AI demo surface.",
            "status": "planned_adapter",
            "recommended_sdk": "Docker Space for FastAPI plus Vite, or a thin Gradio wrapper over the API.",
            "note": "Use after the API story is stable; Brev is better for editable GPU work.",
        },
    }

    blockers = []
    if not book_trends.exists():
        blockers.append("Run /ip-scouting/ingest/nyt-bestsellers or python -m engine.book_trend_ingestion to build book trend signals.")
    if not scripts.exists():
        blockers.append("Generate or sync scripts_150k.parquet before a full portfolio demo.")
    if not env_checks["cors_origins_configured"]:
        blockers.append("Set MIE_CORS_ORIGINS before sharing a hosted frontend.")

    return {
        "phase": "launch_readiness",
        "recommended_next_step": "Log in to Brev for editable GPU workspace validation; use Render + Vercel for the public customer URL.",
        "data_dir": str(data_path),
        "data_checks": data_checks,
        "env_checks": env_checks,
        "deployment_options": options,
        "customer_demo_boundary": {
            "nat": "NAT-compatible controller layer is implemented; real NAT execution remains a GPU/Brev validation step.",
            "sdg": "NeMo Data Designer + Nemotron path is scaffolded; local mode remains deterministic unless configured.",
            "book_data": "IP scouting uses the NYT bestsellers Kaggle dataset when data/book_trend_signals.parquet exists.",
        },
        "blockers": blockers,
        "ready": len([item for item in blockers if not item.startswith("Set MIE_CORS_ORIGINS")]) == 0,
        "secrets_exposed": False,
    }
