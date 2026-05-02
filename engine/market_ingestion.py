"""Ingest manually supplied market snapshot datasets into Parquet signals."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import polars as pl


DEFAULT_RAW_MANUAL_DIR = Path("data/raw/manual")
DEFAULT_OUT_DIR = Path("data")
MANUAL_SOURCE_NAME = "Manual Market Snapshot"
MANUAL_SOURCE_URL = "local:data/raw/manual"


@dataclass(frozen=True)
class MarketIngestionPaths:
    netflix_movies: Path
    spotify_songs: Path
    spotify_podcasts: Path
    market_signals: Path


def _duration_to_seconds(value: str | None) -> int | None:
    if value is None:
        return None
    pieces = [piece.strip() for piece in str(value).split(":")]
    if len(pieces) != 2:
        return None
    try:
        first = int(pieces[0])
        second = int(pieces[1])
    except ValueError:
        return None
    if first >= 1 and second < 60:
        return (first * 60) + second
    return None


def _runtime_to_minutes(value: str | None) -> int | None:
    if value is None:
        return None
    pieces = [piece.strip() for piece in str(value).split(":")]
    if len(pieces) != 2:
        return None
    try:
        hours = int(pieces[0])
        minutes = int(pieces[1])
    except ValueError:
        return None
    return (hours * 60) + minutes


def _score_expr(metric: str, rank_col: str = "rank", max_rank: int = 50) -> pl.Expr:
    max_metric = pl.col(metric).max()
    metric_component = pl.when(max_metric > 0).then(pl.col(metric) / max_metric).otherwise(0.0)
    rank_component = (pl.lit(max_rank + 1) - pl.col(rank_col)) / max_rank
    return ((metric_component * 0.7) + (rank_component * 0.3)).clip(0.0, 1.0).round(4)


def ingest_netflix_movies(raw_dir: Path = DEFAULT_RAW_MANUAL_DIR, out_dir: Path = DEFAULT_OUT_DIR) -> pl.DataFrame:
    path = raw_dir / "netflix_top10_movies.csv"
    df = (
        pl.read_csv(path)
        .rename(
            {
                "Rank": "rank",
                "Title": "title",
                "Weeks_In_Top_10": "weeks_in_top_10",
                "Views": "views",
                "Runtime": "runtime",
                "Hours_Viewed": "hours_viewed",
            }
        )
        .with_columns(
            pl.col("rank").cast(pl.Int64),
            pl.col("weeks_in_top_10").cast(pl.Int64),
            pl.col("views").cast(pl.Int64),
            pl.col("hours_viewed").cast(pl.Int64),
            pl.col("runtime")
            .map_elements(_runtime_to_minutes, return_dtype=pl.Int64)
            .alias("runtime_minutes"),
            (pl.col("hours_viewed") / pl.col("views")).round(4).alias("hours_per_view"),
            pl.lit("netflix_top10_movie").alias("market_category"),
            pl.lit(MANUAL_SOURCE_NAME).alias("source_name"),
            pl.lit(f"{MANUAL_SOURCE_URL}/netflix_top10_movies.csv").alias("source_url"),
        )
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    df.write_parquet(out_dir / "netflix_top10_movies.parquet")
    return df


def ingest_spotify_songs(raw_dir: Path = DEFAULT_RAW_MANUAL_DIR, out_dir: Path = DEFAULT_OUT_DIR) -> pl.DataFrame:
    path = raw_dir / "spotify_top50_songs.csv"
    df = (
        pl.read_csv(path)
        .rename(
            {
                "Rank": "rank",
                "Title": "title",
                "Artist": "artist",
                "Streams": "streams",
                "Album": "album",
                "Duration": "duration",
            }
        )
        .with_columns(
            pl.col("rank").cast(pl.Int64),
            pl.col("streams").cast(pl.Int64),
            pl.col("duration")
            .map_elements(_duration_to_seconds, return_dtype=pl.Int64)
            .alias("duration_seconds"),
            pl.lit("spotify_top50_song").alias("market_category"),
            pl.lit(MANUAL_SOURCE_NAME).alias("source_name"),
            pl.lit(f"{MANUAL_SOURCE_URL}/spotify_top50_songs.csv").alias("source_url"),
        )
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    df.write_parquet(out_dir / "spotify_top50_songs.parquet")
    return df


def ingest_spotify_podcasts(raw_dir: Path = DEFAULT_RAW_MANUAL_DIR, out_dir: Path = DEFAULT_OUT_DIR) -> pl.DataFrame:
    path = raw_dir / "spotify_top_podcasts.csv"
    df = (
        pl.read_csv(path)
        .rename({"Rank": "rank", "Show_Title": "show_title", "Publisher": "publisher"})
        .with_columns(
            pl.col("rank").cast(pl.Int64),
            pl.lit("spotify_top_podcast").alias("market_category"),
            pl.lit(MANUAL_SOURCE_NAME).alias("source_name"),
            pl.lit(f"{MANUAL_SOURCE_URL}/spotify_top_podcasts.csv").alias("source_url"),
        )
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    df.write_parquet(out_dir / "spotify_top_podcasts.parquet")
    return df


def _metadata(values: dict[str, Any]) -> str:
    return json.dumps(values, separators=(",", ":"), ensure_ascii=True)


def build_market_signal_snapshot(
    netflix: pl.DataFrame,
    songs: pl.DataFrame,
    podcasts: pl.DataFrame,
    out_dir: Path = DEFAULT_OUT_DIR,
) -> pl.DataFrame:
    netflix_signals = (
        netflix.with_columns(_score_expr("views", max_rank=10).alias("signal_strength"))
        .select(
            (pl.lit("netflix_movie_") + pl.col("rank").cast(pl.String).str.zfill(2)).alias("signal_id"),
            pl.col("title").alias("signal_name"),
            pl.lit("movie_streaming_demand").alias("signal_category"),
            pl.col("rank"),
            pl.col("signal_strength"),
            pl.col("views").alias("primary_metric"),
            pl.lit("views").alias("primary_metric_name"),
            pl.struct(["weeks_in_top_10", "runtime_minutes", "hours_viewed", "hours_per_view"])
            .map_elements(lambda row: _metadata(dict(row)), return_dtype=pl.String)
            .alias("metadata"),
            pl.col("source_name"),
            pl.col("source_url"),
        )
    )
    song_signals = (
        songs.with_columns(_score_expr("streams").alias("signal_strength"))
        .select(
            (pl.lit("spotify_song_") + pl.col("rank").cast(pl.String).str.zfill(2)).alias("signal_id"),
            (pl.col("title") + pl.lit(" - ") + pl.col("artist")).alias("signal_name"),
            pl.lit("music_streaming_demand").alias("signal_category"),
            pl.col("rank"),
            pl.col("signal_strength"),
            pl.col("streams").alias("primary_metric"),
            pl.lit("streams").alias("primary_metric_name"),
            pl.struct(["artist", "album", "duration_seconds"])
            .map_elements(lambda row: _metadata(dict(row)), return_dtype=pl.String)
            .alias("metadata"),
            pl.col("source_name"),
            pl.col("source_url"),
        )
    )
    podcast_signals = (
        podcasts.with_columns(((pl.lit(51) - pl.col("rank")) / 50).clip(0.0, 1.0).round(4).alias("signal_strength"))
        .select(
            (pl.lit("spotify_podcast_") + pl.col("rank").cast(pl.String).str.zfill(2)).alias("signal_id"),
            pl.col("show_title").alias("signal_name"),
            pl.lit("podcast_attention").alias("signal_category"),
            pl.col("rank"),
            pl.col("signal_strength"),
            (pl.lit(51) - pl.col("rank")).alias("primary_metric"),
            pl.lit("rank_inverse").alias("primary_metric_name"),
            pl.struct(["publisher"]).map_elements(lambda row: _metadata(dict(row)), return_dtype=pl.String).alias("metadata"),
            pl.col("source_name"),
            pl.col("source_url"),
        )
    )
    signals = pl.concat([netflix_signals, song_signals, podcast_signals], how="vertical").sort(
        ["signal_category", "rank"]
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    signals.write_parquet(out_dir / "market_signal_snapshot.parquet")
    return signals


def run(raw_dir: Path = DEFAULT_RAW_MANUAL_DIR, out_dir: Path = DEFAULT_OUT_DIR) -> MarketIngestionPaths:
    netflix = ingest_netflix_movies(raw_dir=raw_dir, out_dir=out_dir)
    songs = ingest_spotify_songs(raw_dir=raw_dir, out_dir=out_dir)
    podcasts = ingest_spotify_podcasts(raw_dir=raw_dir, out_dir=out_dir)
    build_market_signal_snapshot(netflix=netflix, songs=songs, podcasts=podcasts, out_dir=out_dir)
    return MarketIngestionPaths(
        netflix_movies=out_dir / "netflix_top10_movies.parquet",
        spotify_songs=out_dir / "spotify_top50_songs.parquet",
        spotify_podcasts=out_dir / "spotify_top_podcasts.parquet",
        market_signals=out_dir / "market_signal_snapshot.parquet",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest manual market snapshots into Parquet signal datasets.")
    parser.add_argument("--raw-dir", type=Path, default=DEFAULT_RAW_MANUAL_DIR)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    paths = run(raw_dir=args.raw_dir, out_dir=args.out)
    print("Market snapshot ingestion complete")
    print(f"  netflix_movies: {paths.netflix_movies}")
    print(f"  spotify_songs: {paths.spotify_songs}")
    print(f"  spotify_podcasts: {paths.spotify_podcasts}")
    print(f"  market_signals: {paths.market_signals}")


if __name__ == "__main__":
    main()
