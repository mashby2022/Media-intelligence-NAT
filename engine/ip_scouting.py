"""IP scouting and book-trend signal helpers."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import polars as pl


BOOK_TREND_SIGNALS: list[dict[str, Any]] = [
    {
        "ip_id": "ip_book_001",
        "title": "The Glass Orchard",
        "author": "Mara Vale",
        "source_type": "book_trend_proxy",
        "genre": "YA Fantasy",
        "audience": "YA / Gen Z",
        "trend_velocity": 0.88,
        "adaptation_fit": 0.84,
        "rights_status": "unknown",
        "social_momentum": 0.79,
        "market_comps": ["shadow academy fantasy", "female-led quest drama"],
        "confidence": "medium",
    },
    {
        "ip_id": "ip_book_002",
        "title": "Small Gods of Summer",
        "author": "Eli Noor",
        "source_type": "book_trend_proxy",
        "genre": "Contemporary Romance",
        "audience": "Female 18-34",
        "trend_velocity": 0.81,
        "adaptation_fit": 0.78,
        "rights_status": "needs_review",
        "social_momentum": 0.74,
        "market_comps": ["small-town romance", "prestige streaming romance"],
        "confidence": "medium",
    },
    {
        "ip_id": "ip_book_003",
        "title": "The Ninth Signal",
        "author": "Jon Bell",
        "source_type": "book_trend_proxy",
        "genre": "Sci-Fi Thriller",
        "audience": "Prestige Adult",
        "trend_velocity": 0.76,
        "adaptation_fit": 0.86,
        "rights_status": "unknown",
        "social_momentum": 0.68,
        "market_comps": ["grounded sci-fi", "contained conspiracy thriller"],
        "confidence": "medium",
    },
    {
        "ip_id": "ip_book_004",
        "title": "River Teeth",
        "author": "Lenox Shaw",
        "source_type": "book_trend_proxy",
        "genre": "Elevated Horror",
        "audience": "Millennial",
        "trend_velocity": 0.72,
        "adaptation_fit": 0.74,
        "rights_status": "available_unverified",
        "social_momentum": 0.7,
        "market_comps": ["regional horror", "family trauma thriller"],
        "confidence": "low",
    },
]


def _dataset_rows(data_dir: str | Path = "data") -> list[dict[str, Any]]:
    path = Path(data_dir) / "book_trend_signals.parquet"
    if not path.exists():
        return []
    rows = pl.read_parquet(path).head(500).to_dicts()
    normalized = []
    for row in rows:
        market_comps = row.get("market_comps") or []
        if not isinstance(market_comps, list):
            market_comps = [str(market_comps)]
        normalized.append(
            {
                "ip_id": str(row.get("ip_id") or f"book_{len(normalized) + 1:06d}"),
                "title": str(row.get("title") or "Untitled"),
                "author": str(row.get("author") or "Unknown Author"),
                "source_type": str(row.get("source_type") or "book_trend_dataset"),
                "genre": str(row.get("genre") or "Bestseller"),
                "audience": str(row.get("audience") or "bestseller_audience"),
                "trend_velocity": float(row.get("trend_velocity") or 0.5),
                "adaptation_fit": float(row.get("adaptation_fit") or 0.5),
                "rights_status": str(row.get("rights_status") or "unknown"),
                "social_momentum": float(row.get("social_momentum") or 0.25),
                "market_comps": market_comps,
                "confidence": str(row.get("confidence") or "medium"),
            }
        )
    return normalized


def ip_scouting_signals(
    limit: int = 10,
    genre: str | None = None,
    audience: str | None = None,
    data_dir: str | Path = "data",
) -> dict[str, Any]:
    dataset_rows = _dataset_rows(data_dir)
    rows = dataset_rows or BOOK_TREND_SIGNALS
    if genre:
        rows = [row for row in rows if genre.lower() in row["genre"].lower()]
    if audience:
        rows = [row for row in rows if audience.lower() in row["audience"].lower()]
    used_seed_fallback = False
    if dataset_rows and not rows:
        rows = BOOK_TREND_SIGNALS
        if genre:
            rows = [row for row in rows if genre.lower() in row["genre"].lower()]
        if audience:
            rows = [row for row in rows if audience.lower() in row["audience"].lower()]
        used_seed_fallback = True
    ranked = sorted(rows, key=lambda row: (row["adaptation_fit"], row["trend_velocity"], row["social_momentum"]), reverse=True)
    source_mode = "nyt_bestsellers_kaggle" if dataset_rows else "synthetic_seeded_proxy"
    if used_seed_fallback:
        source_mode = "nyt_bestsellers_kaggle_with_seed_fallback"
    return {
        "evidence_type": "ip_book_trend_signals",
        "source_mode": source_mode,
        "signals": ranked[: max(1, min(limit, 100))],
        "source_notes": [
            "NYT/Kaggle bestseller signals are used when data/book_trend_signals.parquet is present; synthetic proxy signals are fallback only.",
            "Rights status is treated as a required enrichment field before high-confidence recommendations.",
        ],
        "secrets_exposed": False,
    }


def analyze_ip_scout(payload: dict[str, Any]) -> dict[str, Any]:
    limit = int(payload.get("limit") or 5)
    genre = payload.get("genre")
    audience = payload.get("audience")
    signals_payload = ip_scouting_signals(
        limit=limit,
        genre=genre,
        audience=audience,
        data_dir=payload.get("data_dir") or "data",
    )
    signals = signals_payload["signals"]
    analyzed = []
    for row in signals:
        rights_penalty = 0.08 if row["rights_status"] in {"unknown", "needs_review"} else 0.0
        score = round((row["trend_velocity"] * 0.35) + (row["adaptation_fit"] * 0.45) + (row["social_momentum"] * 0.2) - rights_penalty, 3)
        analyzed.append(
            {
                **row,
                "ip_fit_score": score,
                "recommended_action": "track_and_validate_rights" if row["rights_status"] != "available_verified" else "package_for_development_review",
                "missing_data": _missing_data_for_ip(row),
            }
        )
    return {
        "analysis_type": "ip_scouting",
        "source_mode": signals_payload["source_mode"],
        "query": payload.get("query") or "rising adaptation candidates",
        "candidates": analyzed,
        "agent_notes": {
            "missing_data": sorted({item for row in analyzed for item in row["missing_data"]}),
            "recommended_refinements": [
                "Add real book-trend source feeds.",
                "Validate rights status before executive recommendation.",
                "Compare adaptation fit by audience segment.",
            ],
        },
        "publish_options": ["development_memo", "executive_summary", "legal_risk_view", "deck_outline", "api_object"],
        "secrets_exposed": False,
    }


def _missing_data_for_ip(row: dict[str, Any]) -> list[str]:
    missing = ["source_confidence"]
    if row.get("rights_status") in {"unknown", "needs_review", "available_unverified"}:
        missing.append("verified_rights_status")
    if not row.get("market_comps"):
        missing.append("market_comps")
    return missing
