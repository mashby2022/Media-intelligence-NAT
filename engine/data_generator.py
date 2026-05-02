"""
Media Intelligence Engine Phase 1 data generator.

Creates a synthetic, provenance-aware script corpus as Parquet using Polars
only. If the Spotify Daily Top 200 Kaggle export is present, it is ingested as
the first public-enrichment source and converted into music trend signals.

Run:
    python -m engine.data_generator --rows 150000
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import random
import zipfile
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

try:
    import polars as pl
except ImportError as exc:  # pragma: no cover - exercised before tests can run
    raise SystemExit(
        "Media Intelligence Engine Phase 1a requires Polars and does not fall back to pandas. "
        "Install dependencies with: python -m pip install -r requirements.txt"
    ) from exc


DEFAULT_RAW_DIR = Path("data/raw")
DEFAULT_OUT_DIR = Path("data")
DEFAULT_SPOTIFY_ZIP = DEFAULT_RAW_DIR / "top-spotify-songs-in-73-countries-daily-updated.zip"
DEFAULT_SPOTIFY_CSV = DEFAULT_RAW_DIR / "universal_top_spotify_songs.csv"
DEFAULT_RUNWAY_ENGAGEMENT = DEFAULT_RAW_DIR / "runway-agent/engagement_logs.parquet"
DEFAULT_CMU_DIR = DEFAULT_RAW_DIR / "cmu/MovieSummaries"
CMU_SOURCE_NAME = "CMU Movie Summary Corpus"
CMU_SOURCE_URL = "https://www.cs.cmu.edu/~ark/personas/"

PUBLIC_SOURCE_REGISTRY: list[dict[str, str]] = [
    {
        "source_name": "Spotify Daily Top 200 Kaggle Mirror",
        "source_url": "https://www.kaggle.com/datasets/asaniczka/top-spotify-songs-in-73-countries-daily-updated",
        "source_tier": "public_enrichment",
    },
    {
        "source_name": "IMDb Non-Commercial Datasets",
        "source_url": "https://developer.imdb.com/non-commercial-datasets/",
        "source_tier": "planned_public_enrichment",
    },
    {
        "source_name": "TMDb API",
        "source_url": "https://www.themoviedb.org/api-terms-of-use",
        "source_tier": "planned_public_enrichment",
    },
    {
        "source_name": "CMU Movie Summary Corpus",
        "source_url": "https://www.cs.cmu.edu/~ark/personas/",
        "source_tier": "planned_public_enrichment",
    },
    {
        "source_name": "Cornell Movie-Dialogs Corpus",
        "source_url": "https://www.cs.cornell.edu/~cristian/Cornell_Movie-Dialogs_Corpus.html",
        "source_tier": "planned_public_enrichment",
    },
    {
        "source_name": "GDELT Project",
        "source_url": "https://www.gdeltproject.org/",
        "source_tier": "planned_public_enrichment",
    },
    {
        "source_name": "Media Cloud",
        "source_url": "https://www.mediacloud.org/documentation",
        "source_tier": "planned_public_enrichment",
    },
    {
        "source_name": "Wikimedia Generated Data Platform",
        "source_url": "https://doc.wikimedia.org/generated-data-platform/",
        "source_tier": "planned_public_enrichment",
    },
    {
        "source_name": "Nielsen The Gauge",
        "source_url": "https://www.nielsen.com/data-center/the-gauge/",
        "source_tier": "planned_public_benchmark",
    },
    {
        "source_name": "Runway Agent Engagement Logs",
        "source_url": "local:data/raw/runway-agent/engagement_logs.parquet",
        "source_tier": "local_audience_behavior_substitute",
    },
]

GENRES = [
    "Drama",
    "Comedy",
    "Thriller",
    "Romance",
    "Sci-Fi",
    "Fantasy",
    "Documentary",
    "Action",
    "Mystery",
    "Historical",
]
PLATFORMS = ["Streaming", "Broadcast", "Cable", "AVOD", "FAST", "Theatrical"]
DEMOS = ["Gen Z", "Millennial", "Gen X", "Family", "Female 18-34", "LGBTQ+", "Prestige Adult"]
MARKETS = [
    "United States",
    "United Kingdom",
    "Canada",
    "Brazil",
    "Mexico",
    "Germany",
    "France",
    "India",
    "Japan",
    "South Korea",
    "Global",
]
RISK_CATEGORIES = ["LOW", "MODERATE", "ELEVATED", "HIGH"]
TONE_TAGS = [
    "redemption",
    "ambition",
    "betrayal",
    "identity",
    "family",
    "friendship",
    "grief",
    "revenge",
    "romantic tension",
    "coming of age",
    "power",
    "class mobility",
    "social pressure",
    "personal growth",
    "creative obsession",
    "cultural memory",
    "public scandal",
    "moral compromise",
    "chosen family",
    "tech anxiety",
]
TITLE_NOUNS = [
    "Archive",
    "Signal",
    "House",
    "City",
    "Summer",
    "Inheritance",
    "Witness",
    "Mirror",
    "Daughter",
    "Season",
    "Contract",
    "Pulse",
    "Afterparty",
    "Runway",
    "Garden",
    "Distance",
]
TITLE_MODIFIERS = [
    "Velvet",
    "Electric",
    "Ordinary",
    "Last",
    "Hidden",
    "Golden",
    "Private",
    "Northern",
    "Second",
    "Unwritten",
    "Neon",
    "Quiet",
    "Famous",
    "Midnight",
]


@dataclass(frozen=True)
class GeneratedPaths:
    scripts: Path
    spotify_signals: Path
    audience_profiles: Path
    graph_edges: Path
    source_registry: Path
    manifest: Path


def _detect_effective_mode() -> str:
    """Detect compute posture without importing pandas or requiring RAPIDS."""

    if importlib.util.find_spec("cudf") is None:
        return "OFFLINE"
    return "ONLINE"


def _bounded(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return round(max(low, min(high, value)), 4)


def _risk_category(score: float) -> str:
    if score < 0.25:
        return "LOW"
    if score < 0.5:
        return "MODERATE"
    if score < 0.75:
        return "ELEVATED"
    return "HIGH"


def _weighted_choice(rng: random.Random, values: list[str], weights: list[float]) -> str:
    return rng.choices(values, weights=weights, k=1)[0]


def _resolve_spotify_csv(raw_dir: Path, spotify_zip: Path | None, spotify_csv: Path | None) -> Path | None:
    """Return an extracted Spotify CSV path when present."""

    if spotify_csv and spotify_csv.exists():
        return spotify_csv

    fallback_csv = raw_dir / DEFAULT_SPOTIFY_CSV.name
    if fallback_csv.exists():
        return fallback_csv

    candidate_zip = spotify_zip or raw_dir / DEFAULT_SPOTIFY_ZIP.name
    if not candidate_zip.exists():
        return None

    with zipfile.ZipFile(candidate_zip) as archive:
        members = [name for name in archive.namelist() if name.lower().endswith(".csv")]
        if not members:
            return None
        member = members[0]
        target = raw_dir / Path(member).name
        raw_dir.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            with archive.open(member) as src, target.open("wb") as dst:
                dst.write(src.read())
        return target


def build_spotify_signals(raw_dir: Path, out_dir: Path, spotify_zip: Path | None, spotify_csv: Path | None) -> pl.DataFrame:
    """Convert Spotify Top 200 rows into compact public-enrichment signals."""

    csv_path = _resolve_spotify_csv(raw_dir, spotify_zip, spotify_csv)
    if csv_path is None:
        return pl.DataFrame(
            {
                "signal_id": [],
                "signal_name": [],
                "signal_category": [],
                "country": [],
                "snapshot_date": [],
                "trend_strength": [],
                "trend_delta": [],
                "confidence": [],
                "source_name": [],
                "source_url": [],
            },
            schema={
                "signal_id": pl.String,
                "signal_name": pl.String,
                "signal_category": pl.String,
                "country": pl.String,
                "snapshot_date": pl.Date,
                "trend_strength": pl.Float64,
                "trend_delta": pl.Float64,
                "confidence": pl.Float64,
                "source_name": pl.String,
                "source_url": pl.String,
            },
        )

    source_name = "Spotify Daily Top 200 Kaggle Mirror"
    source_url = PUBLIC_SOURCE_REGISTRY[0]["source_url"]

    lazy = (
        pl.scan_csv(csv_path, infer_schema_length=10_000, ignore_errors=True)
        .select(
            pl.col("spotify_id").cast(pl.String),
            pl.col("name").cast(pl.String),
            pl.col("artists").cast(pl.String),
            pl.col("daily_rank").cast(pl.Int64, strict=False),
            pl.col("daily_movement").cast(pl.Int64, strict=False).fill_null(0),
            pl.col("weekly_movement").cast(pl.Int64, strict=False).fill_null(0),
            pl.when(pl.col("country").cast(pl.String).str.len_chars() == 0)
            .then(pl.lit("GLOBAL"))
            .otherwise(pl.col("country").cast(pl.String))
            .alias("country"),
            pl.col("snapshot_date").str.strptime(pl.Date, "%Y-%m-%d", strict=False),
            pl.col("popularity").cast(pl.Float64, strict=False).fill_null(50.0),
            pl.col("danceability").cast(pl.Float64, strict=False).fill_null(0.5),
            pl.col("energy").cast(pl.Float64, strict=False).fill_null(0.5),
            pl.col("valence").cast(pl.Float64, strict=False).fill_null(0.5),
        )
        .filter(pl.col("daily_rank").is_between(1, 200))
        .with_columns(
            (
                (((201 - pl.col("daily_rank")) / 200) * 0.45)
                + ((pl.col("popularity") / 100) * 0.30)
                + (((pl.col("daily_movement").clip(-25, 25) + 25) / 50) * 0.10)
                + (((pl.col("weekly_movement").clip(-75, 75) + 75) / 150) * 0.05)
                + (((pl.col("danceability") + pl.col("energy") + pl.col("valence")) / 3) * 0.10)
            )
            .round(4)
            .alias("trend_strength"),
            (((pl.col("daily_movement") * 0.6) + (pl.col("weekly_movement") * 0.4)) / 100)
            .round(4)
            .alias("trend_delta"),
        )
        .group_by("spotify_id", "name", "artists", "country")
        .agg(
            pl.col("snapshot_date").max().alias("snapshot_date"),
            pl.col("trend_strength").mean().round(4).alias("trend_strength"),
            pl.col("trend_delta").mean().round(4).alias("trend_delta"),
            pl.col("daily_rank").min().alias("best_rank"),
        )
        .sort(["trend_strength", "best_rank"], descending=[True, False])
        .head(5_000)
        .with_row_index("idx", offset=1)
        .with_columns(
            (pl.lit("spotify_") + pl.col("idx").cast(pl.String).str.zfill(5)).alias("signal_id"),
            (pl.col("name") + pl.lit(" - ") + pl.col("artists")).alias("signal_name"),
            pl.lit("music_trend").alias("signal_category"),
            pl.lit(source_name).alias("source_name"),
            pl.lit(source_url).alias("source_url"),
            (pl.lit(0.70) + (pl.col("trend_strength") * 0.25)).round(4).alias("confidence"),
        )
        .select(
            "signal_id",
            "signal_name",
            "signal_category",
            "country",
            "snapshot_date",
            "trend_strength",
            "trend_delta",
            "confidence",
            "source_name",
            "source_url",
        )
    )

    signals = lazy.collect(engine="streaming")
    out_dir.mkdir(parents=True, exist_ok=True)
    signals.write_parquet(out_dir / "spotify_daily_top200_signals.parquet")
    return signals


def _fallback_music_signals() -> pl.DataFrame:
    today = date.today()
    rows = [
        {
            "signal_id": f"synthetic_music_{idx:03d}",
            "signal_name": name,
            "signal_category": "music_trend",
            "country": "GLOBAL",
            "snapshot_date": today,
            "trend_strength": strength,
            "trend_delta": delta,
            "confidence": 0.55,
            "source_name": "synthetic_fallback",
            "source_url": "",
        }
        for idx, (name, strength, delta) in enumerate(
            [
                ("melancholy pop momentum", 0.78, 0.11),
                ("high-energy dance crossover", 0.74, 0.08),
                ("nostalgic duet resurgence", 0.69, 0.04),
                ("confessional singer-songwriter signal", 0.66, 0.06),
            ],
            start=1,
        )
    ]
    return pl.DataFrame(rows)


def _normalize_demo(value: str | None) -> str:
    cleaned = (value or "").strip().replace("_", " ").lower()
    if "gen z" in cleaned or "18" in cleaned:
        return "Gen Z"
    if "millennial" in cleaned or "25" in cleaned:
        return "Millennial"
    if "gen x" in cleaned or "35" in cleaned or "45" in cleaned:
        return "Gen X"
    if "silver" in cleaned or "50" in cleaned:
        return "Prestige Adult"
    if "female" in cleaned:
        return "Female 18-34"
    if "lgbt" in cleaned:
        return "LGBTQ+"
    return "Millennial"


def build_audience_behavior_profiles(engagement_path: Path, out_dir: Path) -> pl.DataFrame:
    """Aggregate Runway engagement logs into MovieLens-style audience profiles."""

    schema = {
        "audience_profile_id": pl.String,
        "platform_fit": pl.String,
        "target_demo": pl.String,
        "market": pl.String,
        "density_tier": pl.String,
        "observed_completion_rate": pl.Float64,
        "engagement_sessions": pl.Int64,
        "prime_time_rate": pl.Float64,
        "audience_signal_tags": pl.List(pl.String),
        "source_name": pl.String,
        "source_url": pl.String,
    }
    if not engagement_path.exists():
        return pl.DataFrame({name: [] for name in schema}, schema=schema)

    profiles = (
        pl.scan_parquet(engagement_path)
        .select(
            pl.col("platform_category").cast(pl.String).alias("platform_fit"),
            pl.col("primary_demographic").cast(pl.String).alias("raw_demo"),
            pl.col("target_age").cast(pl.String).alias("target_age"),
            pl.col("market").cast(pl.String).fill_null("Global").alias("market"),
            pl.col("density_tier").cast(pl.String).fill_null("Unknown").alias("density_tier"),
            pl.col("completion_rate").cast(pl.Float64, strict=False).fill_null(0.65),
            pl.col("is_prime_time").cast(pl.Boolean).fill_null(False).alias("is_prime_time"),
            pl.col("cultural_signals").cast(pl.List(pl.String)).alias("cultural_signals"),
        )
        .with_columns(
            pl.struct(["raw_demo", "target_age"])
            .map_elements(
                lambda row: _normalize_demo(row["raw_demo"] or row["target_age"]),
                return_dtype=pl.String,
            )
            .alias("target_demo")
        )
        .group_by("platform_fit", "target_demo", "market", "density_tier")
        .agg(
            pl.col("completion_rate").mean().round(4).alias("observed_completion_rate"),
            pl.len().alias("engagement_sessions"),
            pl.col("is_prime_time").mean().round(4).alias("prime_time_rate"),
            pl.col("cultural_signals").explode().drop_nulls().unique().alias("audience_signal_tags"),
        )
        .sort(["engagement_sessions", "observed_completion_rate"], descending=[True, True])
        .with_row_index("idx", offset=1)
        .with_columns(
            (pl.lit("audience_") + pl.col("idx").cast(pl.String).str.zfill(5)).alias("audience_profile_id"),
            pl.lit("Runway Agent Engagement Logs").alias("source_name"),
            pl.lit("local:data/raw/runway-agent/engagement_logs.parquet").alias("source_url"),
        )
        .select(
            "audience_profile_id",
            "platform_fit",
            "target_demo",
            "market",
            "density_tier",
            "observed_completion_rate",
            "engagement_sessions",
            "prime_time_rate",
            "audience_signal_tags",
            "source_name",
            "source_url",
        )
        .collect(engine="streaming")
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    profiles.write_parquet(out_dir / "audience_behavior_profiles.parquet")
    return profiles


def _fallback_audience_profiles() -> pl.DataFrame:
    return pl.DataFrame(
        [
            {
                "audience_profile_id": "synthetic_audience_001",
                "platform_fit": "Streaming",
                "target_demo": "Millennial",
                "market": "Global",
                "density_tier": "Unknown",
                "observed_completion_rate": 0.72,
                "engagement_sessions": 1,
                "prime_time_rate": 0.5,
                "audience_signal_tags": ["broad appeal", "streaming baseline"],
                "source_name": "synthetic_fallback",
                "source_url": "",
            }
        ]
    )


def generate_scripts(
    rows: int,
    seed: int,
    spotify_signals: pl.DataFrame,
    audience_profiles: pl.DataFrame | None = None,
) -> pl.DataFrame:
    """Generate the Phase 1a synthetic script corpus with public-enrichment hooks."""

    rng = random.Random(seed)
    signals = spotify_signals if spotify_signals.height else _fallback_music_signals()
    signal_rows = signals.to_dicts()
    profiles = audience_profiles if audience_profiles is not None and audience_profiles.height else _fallback_audience_profiles()
    profile_rows = profiles.to_dicts()
    records: list[dict[str, Any]] = []
    start_date = datetime(2023, 1, 1, tzinfo=timezone.utc)

    genre_weights = [0.20, 0.13, 0.12, 0.11, 0.09, 0.08, 0.08, 0.08, 0.06, 0.05]
    platform_weights = [0.38, 0.13, 0.09, 0.15, 0.15, 0.10]
    demo_weights = [0.16, 0.19, 0.12, 0.10, 0.18, 0.13, 0.12]

    for idx in range(1, rows + 1):
        audience_profile = rng.choice(profile_rows)
        genre_primary = _weighted_choice(rng, GENRES, genre_weights)
        genre_secondary = rng.choice([g for g in GENRES if g != genre_primary])
        platform_fit = audience_profile.get("platform_fit") or _weighted_choice(rng, PLATFORMS, platform_weights)
        if platform_fit not in PLATFORMS:
            platform_fit = _weighted_choice(rng, PLATFORMS, platform_weights)
        target_demo = audience_profile.get("target_demo") or _weighted_choice(rng, DEMOS, demo_weights)
        if target_demo not in DEMOS:
            target_demo = _weighted_choice(rng, DEMOS, demo_weights)
        market = audience_profile.get("market") or rng.choice(MARKETS)
        selected_signals = rng.sample(signal_rows, k=min(len(signal_rows), rng.randint(1, 3)))
        signal_ids = [row["signal_id"] for row in selected_signals]
        signal_strength = sum(float(row["trend_strength"]) for row in selected_signals) / len(selected_signals)
        observed_completion = float(audience_profile.get("observed_completion_rate") or 0.65)
        prime_time_rate = float(audience_profile.get("prime_time_rate") or 0.0)

        base_viability = rng.gauss(0.62, 0.14)
        genre_lift = {
            "Drama": 0.04,
            "Thriller": 0.03,
            "Romance": 0.02,
            "Comedy": 0.01,
            "Documentary": -0.01,
        }.get(genre_primary, 0.0)
        music_lift = (signal_strength - 0.5) * 0.18
        audience_lift = (observed_completion - 0.65) * 0.22
        prime_lift = (prime_time_rate - 0.5) * 0.04
        viability = _bounded(base_viability + genre_lift + music_lift + audience_lift + prime_lift)
        completion_prediction = _bounded(rng.gauss((observed_completion * 0.65) + (viability * 0.25), 0.07))
        cultural_risk = _bounded(rng.betavariate(2.0, 5.5) + (0.08 if genre_primary in {"Thriller", "Documentary"} else 0.0))
        title = f"{rng.choice(TITLE_MODIFIERS)} {rng.choice(TITLE_NOUNS)}"
        release_year = rng.randint(1990, 2028)
        tags = rng.sample(TONE_TAGS, k=rng.randint(4, 8))
        logline = (
            f"A {genre_primary.lower()} about {tags[0]} and {tags[1]} as a "
            f"{target_demo.lower()} audience confronts {tags[2]}."
        )
        generated_at = start_date + timedelta(hours=idx % 20_000)
        source_refs = [
            {
                "source_name": row["source_name"],
                "source_url": row["source_url"],
                "signal_id": row["signal_id"],
                "signal_name": row["signal_name"],
            }
            for row in selected_signals
        ]
        source_refs.append(
            {
                "source_name": audience_profile.get("source_name", "Runway Agent Engagement Logs"),
                "source_url": audience_profile.get("source_url", "local:data/raw/runway-agent/engagement_logs.parquet"),
                "audience_profile_id": audience_profile.get("audience_profile_id"),
            }
        )

        records.append(
            {
                "script_id": f"script_{idx:06d}",
                "title": f"{title} {idx:06d}",
                "logline": logline,
                "genre_primary": genre_primary,
                "genre_secondary": genre_secondary,
                "platform_fit": platform_fit,
                "target_demo": target_demo,
                "market": market,
                "release_year": release_year,
                "runtime_minutes": max(22, min(180, int(rng.gauss(92, 22)))),
                "viability_score": viability,
                "completion_prediction": completion_prediction,
                "cultural_risk_score": cultural_risk,
                "risk_category": _risk_category(cultural_risk),
                "story_tags": tags,
                "cultural_signal_ids": signal_ids,
                "music_momentum_score": round(signal_strength, 4),
                "audience_profile_id": audience_profile.get("audience_profile_id"),
                "audience_behavior_score": round(observed_completion, 4),
                "prime_time_affinity": round(prime_time_rate, 4),
                "density_tier": audience_profile.get("density_tier"),
                "audience_signal_tags": audience_profile.get("audience_signal_tags") or [],
                "source_tier": "synthetic_public_enriched",
                "source_refs": json.dumps(source_refs, separators=(",", ":")),
                "generated_at": generated_at.isoformat(),
            }
        )

    return pl.DataFrame(records)


def _load_freebase_map(value: str) -> dict[str, str]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return {str(key): str(name) for key, name in parsed.items()}


def _safe_node_id(prefix: str, value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "_" for ch in value.strip())
    cleaned = "_".join(part for part in cleaned.split("_") if part)
    return f"{prefix}:{cleaned or 'unknown'}"


def _edge(
    source_id: str,
    source_type: str,
    target_id: str,
    target_type: str,
    edge_type: str,
    weight: float,
    source_name: str,
    source_url: str,
) -> dict[str, Any]:
    return {
        "source_id": source_id,
        "source_type": source_type,
        "target_id": target_id,
        "target_type": target_type,
        "edge_type": edge_type,
        "weight": round(weight, 4),
        "source_name": source_name,
        "source_url": source_url,
    }


def _empty_graph_edges() -> pl.DataFrame:
    return pl.DataFrame(
        {
            "source_id": [],
            "source_type": [],
            "target_id": [],
            "target_type": [],
            "edge_type": [],
            "weight": [],
            "source_name": [],
            "source_url": [],
        },
        schema={
            "source_id": pl.String,
            "source_type": pl.String,
            "target_id": pl.String,
            "target_type": pl.String,
            "edge_type": pl.String,
            "weight": pl.Float64,
            "source_name": pl.String,
            "source_url": pl.String,
        },
    )


def build_cultural_graph_edges(scripts: pl.DataFrame, cmu_dir: Path, out_dir: Path) -> pl.DataFrame:
    """Build Phase 1b graph edges from generated scripts and the CMU corpus."""

    rows: list[dict[str, Any]] = []
    if "cultural_signal_ids" in scripts.columns:
        for record in scripts.select("script_id", "cultural_signal_ids", "music_momentum_score").iter_rows(named=True):
            for signal_id in record["cultural_signal_ids"] or []:
                rows.append(
                    _edge(
                        source_id=record["script_id"],
                        source_type="generated_script",
                        target_id=str(signal_id),
                        target_type="cultural_signal",
                        edge_type="script_cultural_signal",
                        weight=float(record["music_momentum_score"] or 0.5),
                        source_name="Media Intelligence Engine Synthetic Corpus",
                        source_url="local:data/scripts_150k.parquet",
                    )
                )

    movie_path = cmu_dir / "movie.metadata.tsv"
    if movie_path.exists():
        movies = pl.read_csv(
            movie_path,
            separator="\t",
            quote_char=None,
            has_header=False,
            new_columns=[
                "wiki_movie_id",
                "freebase_movie_id",
                "movie_name",
                "release_date",
                "box_office",
                "runtime",
                "languages",
                "countries",
                "genres",
            ],
            infer_schema_length=0,
            ignore_errors=True,
            truncate_ragged_lines=True,
        ).select("wiki_movie_id", "languages", "countries", "genres")
        for record in movies.iter_rows(named=True):
            movie_id = f"cmu_movie:{record['wiki_movie_id']}"
            for field, target_type, edge_type in [
                ("genres", "genre", "movie_genre"),
                ("countries", "country", "movie_country"),
                ("languages", "language", "movie_language"),
            ]:
                for _, label in _load_freebase_map(record[field] or "").items():
                    rows.append(
                        _edge(
                            source_id=movie_id,
                            source_type="cmu_movie",
                            target_id=_safe_node_id(target_type, label),
                            target_type=target_type,
                            edge_type=edge_type,
                            weight=1.0,
                            source_name=CMU_SOURCE_NAME,
                            source_url=CMU_SOURCE_URL,
                        )
                    )

    character_path = cmu_dir / "character.metadata.tsv"
    if character_path.exists():
        characters = pl.read_csv(
            character_path,
            separator="\t",
            quote_char=None,
            has_header=False,
            new_columns=[
                "wiki_movie_id",
                "freebase_movie_id",
                "movie_release_date",
                "character_name",
                "actor_birth_date",
                "actor_gender",
                "actor_height",
                "actor_ethnicity",
                "actor_name",
                "actor_age",
                "char_actor_map_id",
                "character_id",
                "actor_id",
            ],
            infer_schema_length=0,
            ignore_errors=True,
            truncate_ragged_lines=True,
        ).select("wiki_movie_id", "char_actor_map_id", "character_id", "actor_id")
        for record in characters.iter_rows(named=True):
            movie_id = f"cmu_movie:{record['wiki_movie_id']}"
            character_id = record["character_id"] or record["char_actor_map_id"]
            actor_id = record["actor_id"]
            if character_id:
                rows.append(
                    _edge(
                        source_id=movie_id,
                        source_type="cmu_movie",
                        target_id=f"cmu_character:{character_id}",
                        target_type="character",
                        edge_type="movie_character",
                        weight=1.0,
                        source_name=CMU_SOURCE_NAME,
                        source_url=CMU_SOURCE_URL,
                    )
                )
            if character_id and actor_id:
                rows.append(
                    _edge(
                        source_id=f"cmu_character:{character_id}",
                        source_type="character",
                        target_id=f"cmu_actor:{actor_id}",
                        target_type="actor",
                        edge_type="character_actor",
                        weight=1.0,
                        source_name=CMU_SOURCE_NAME,
                        source_url=CMU_SOURCE_URL,
                    )
                )

    trope_path = cmu_dir / "tvtropes.clusters.txt"
    if trope_path.exists():
        with trope_path.open() as file:
            for line in file:
                trope, payload = line.rstrip("\n").split("\t", maxsplit=1)
                try:
                    record = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                character_map_id = record.get("id")
                if not character_map_id:
                    continue
                rows.append(
                    _edge(
                        source_id=f"cmu_character_map:{character_map_id}",
                        source_type="character",
                        target_id=_safe_node_id("trope", trope),
                        target_type="trope",
                        edge_type="character_trope",
                        weight=1.0,
                        source_name=CMU_SOURCE_NAME,
                        source_url=CMU_SOURCE_URL,
                    )
                )

    edges = pl.DataFrame(rows) if rows else _empty_graph_edges()
    out_dir.mkdir(parents=True, exist_ok=True)
    edges.write_parquet(out_dir / "cultural_graph_edges.parquet")
    return edges


def write_source_registry(out_dir: Path) -> Path:
    registry = pl.DataFrame(PUBLIC_SOURCE_REGISTRY)
    path = out_dir / "source_registry.parquet"
    registry.write_parquet(path)
    return path


def write_manifest(
    out_dir: Path,
    rows: int,
    seed: int,
    mode: str,
    spotify_count: int,
    audience_profile_count: int,
    graph_edge_count: int,
    paths: GeneratedPaths,
) -> Path:
    manifest = {
        "project": "Media Intelligence Engine",
        "phase": "1b",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "rows": rows,
        "seed": seed,
        "effective_mode": mode,
        "dataframe_engine": "polars",
        "pandas_used": False,
        "spotify_signals": spotify_count,
        "audience_behavior_substitute": "Runway Agent Engagement Logs",
        "audience_profiles": audience_profile_count,
        "graph_edges": graph_edge_count,
        "outputs": {
            "scripts": str(paths.scripts),
            "spotify_signals": str(paths.spotify_signals),
            "audience_profiles": str(paths.audience_profiles),
            "graph_edges": str(paths.graph_edges),
            "source_registry": str(paths.source_registry),
        },
    }
    path = out_dir / "phase1_manifest.json"
    path.write_text(json.dumps(manifest, indent=2) + "\n")
    return path


def run(
    rows: int,
    seed: int,
    out_dir: Path,
    raw_dir: Path,
    spotify_zip: Path | None,
    spotify_csv: Path | None,
    engagement_path: Path,
    cmu_dir: Path,
) -> GeneratedPaths:
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)

    mode = _detect_effective_mode()
    spotify = build_spotify_signals(raw_dir, out_dir, spotify_zip, spotify_csv)
    audience_profiles = build_audience_behavior_profiles(engagement_path, out_dir)
    scripts = generate_scripts(
        rows=rows,
        seed=seed,
        spotify_signals=spotify,
        audience_profiles=audience_profiles,
    )

    scripts_path = out_dir / "scripts_150k.parquet"
    spotify_path = out_dir / "spotify_daily_top200_signals.parquet"
    audience_path = out_dir / "audience_behavior_profiles.parquet"
    graph_path = out_dir / "cultural_graph_edges.parquet"
    registry_path = write_source_registry(out_dir)
    placeholder_paths = GeneratedPaths(
        scripts=scripts_path,
        spotify_signals=spotify_path,
        audience_profiles=audience_path,
        graph_edges=graph_path,
        source_registry=registry_path,
        manifest=out_dir / "phase1_manifest.json",
    )

    scripts.write_parquet(scripts_path)
    graph_edges = build_cultural_graph_edges(scripts=scripts, cmu_dir=cmu_dir, out_dir=out_dir)
    manifest_path = write_manifest(
        out_dir=out_dir,
        rows=rows,
        seed=seed,
        mode=mode,
        spotify_count=spotify.height,
        audience_profile_count=audience_profiles.height,
        graph_edge_count=graph_edges.height,
        paths=placeholder_paths,
    )

    return GeneratedPaths(
        scripts=scripts_path,
        spotify_signals=spotify_path,
        audience_profiles=audience_path,
        graph_edges=graph_path,
        source_registry=registry_path,
        manifest=manifest_path,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate Media Intelligence Engine Phase 1 Parquet and graph data using Polars only."
    )
    parser.add_argument("--rows", type=int, default=150_000, help="Number of synthetic script rows to generate.")
    parser.add_argument("--seed", type=int, default=42, help="Deterministic random seed.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR, help="Output directory for Parquet files.")
    parser.add_argument("--raw-dir", type=Path, default=DEFAULT_RAW_DIR, help="Raw input data directory.")
    parser.add_argument("--spotify-zip", type=Path, default=DEFAULT_SPOTIFY_ZIP, help="Spotify Kaggle ZIP path.")
    parser.add_argument("--spotify-csv", type=Path, default=None, help="Optional pre-extracted Spotify CSV path.")
    parser.add_argument(
        "--engagement-path",
        type=Path,
        default=DEFAULT_RUNWAY_ENGAGEMENT,
        help="Runway engagement Parquet path used as the audience-behavior substitute.",
    )
    parser.add_argument(
        "--cmu-dir",
        type=Path,
        default=DEFAULT_CMU_DIR,
        help="CMU Movie Summary Corpus directory used to build graph edges.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.rows <= 0:
        raise SystemExit("--rows must be greater than zero")

    paths = run(
        rows=args.rows,
        seed=args.seed,
        out_dir=args.out,
        raw_dir=args.raw_dir,
        spotify_zip=args.spotify_zip,
        spotify_csv=args.spotify_csv,
        engagement_path=args.engagement_path,
        cmu_dir=args.cmu_dir,
    )
    print("Media Intelligence Engine Phase 1 complete")
    print(f"  scripts: {paths.scripts}")
    print(f"  spotify_signals: {paths.spotify_signals}")
    print(f"  audience_profiles: {paths.audience_profiles}")
    print(f"  graph_edges: {paths.graph_edges}")
    print(f"  source_registry: {paths.source_registry}")
    print(f"  manifest: {paths.manifest}")


if __name__ == "__main__":
    main()
