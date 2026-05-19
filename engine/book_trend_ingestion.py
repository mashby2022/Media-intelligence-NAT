"""Ingest book-market trend datasets into IP scouting signals."""

from __future__ import annotations

import argparse
import zipfile
from dataclasses import dataclass
from pathlib import Path

import polars as pl


DEFAULT_ZIP_PATH = Path.home() / "Downloads" / "nyt-bestsellers-1931-2024-fictionnon-fiction.zip"
DEFAULT_OUT_DIR = Path("data")


@dataclass(frozen=True)
class BookTrendIngestionPaths:
    raw_dir: Path
    book_trends: Path


def _normalized_column_map(columns: list[str]) -> dict[str, str]:
    aliases = {
        "title": {"title", "book_title", "name"},
        "author": {"author", "contributor", "book_author"},
        "list_name": {"list_name", "list", "category", "bestseller_list", "genre"},
        "published_date": {"published_date", "date", "week", "week_date"},
        "rank": {"rank", "position"},
        "weeks_on_list": {
            "weeks_on_list",
            "weeks",
            "weeks_on_bestseller_list",
            "number_of_list_appearances_-_book",
            "number_of_list_appearances_book",
        },
        "description": {"description", "summary"},
        "publisher": {"publisher"},
        "isbn13": {"isbn13", "primary_isbn13", "isbn"},
    }
    normalized = {column.lower().strip().replace(" ", "_"): column for column in columns}
    result: dict[str, str] = {}
    for target, candidates in aliases.items():
        for candidate in candidates:
            if candidate in normalized:
                result[normalized[candidate]] = target
                break
    return result


def _read_first_tabular_file(extracted_dir: Path) -> pl.DataFrame:
    candidates = [
        path
        for path in extracted_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in {".csv", ".tsv"}
    ]
    if not candidates:
        raise FileNotFoundError(f"No CSV/TSV files found in {extracted_dir}")

    preferred_names = {
        "merged_genres.csv": 0,
        "fiction_all.csv": 1,
        "non_fiction_all.csv": 2,
        "book_appearances.csv": 3,
        "author_appearances.csv": 4,
    }
    path = sorted(
        [
            candidate
            for candidate in candidates
        ],
        key=lambda candidate: (preferred_names.get(candidate.name, 99), candidate.name),
    )[0]
    if path.suffix.lower() == ".tsv":
        return pl.read_csv(path, separator="\t", infer_schema_length=10_000, ignore_errors=True)
    return pl.read_csv(path, infer_schema_length=10_000, ignore_errors=True)


def _safe_text_expr(column: str, fallback: str = "") -> pl.Expr:
    return (
        pl.when(pl.col(column).is_not_null())
        .then(pl.col(column).cast(pl.Utf8))
        .otherwise(pl.lit(fallback))
    )


def ingest_nyt_bestsellers(zip_path: Path = DEFAULT_ZIP_PATH, out_dir: Path = DEFAULT_OUT_DIR) -> BookTrendIngestionPaths:
    if not zip_path.exists():
        raise FileNotFoundError(f"Dataset zip not found: {zip_path}")
    raw_dir = out_dir / "raw" / "kaggle_nyt_bestsellers"
    raw_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(raw_dir)

    raw = _read_first_tabular_file(raw_dir)
    rename_map = _normalized_column_map(raw.columns)
    df = raw.rename(rename_map)
    for column in ["title", "author", "list_name", "published_date", "rank", "weeks_on_list", "description", "publisher", "isbn13"]:
        if column not in df.columns:
            df = df.with_columns(pl.lit(None).alias(column))

    df = (
        df.with_columns(
            pl.col("rank").cast(pl.Int64, strict=False),
            pl.col("weeks_on_list").cast(pl.Int64, strict=False),
            _safe_text_expr("title", "Untitled").alias("title"),
            _safe_text_expr("author", "Unknown Author").alias("author"),
            _safe_text_expr("list_name", "NYT Bestseller").alias("list_name"),
            _safe_text_expr("published_date", "").alias("published_date"),
            _safe_text_expr("description", "").alias("description"),
            _safe_text_expr("publisher", "").alias("publisher"),
            _safe_text_expr("isbn13", "").alias("isbn13"),
        )
        .group_by("title", "author", "list_name")
        .agg(
            pl.col("published_date").drop_nulls().last().alias("published_date"),
            pl.col("rank").min().alias("rank"),
            pl.max_horizontal(pl.col("weeks_on_list").max(), pl.len()).alias("weeks_on_list"),
            pl.col("description").drop_nulls().first().alias("description"),
            pl.col("publisher").drop_nulls().first().alias("publisher"),
            pl.col("isbn13").drop_nulls().first().alias("isbn13"),
        )
        .with_columns(
            pl.when(pl.col("rank").is_not_null())
            .then(((pl.lit(101) - pl.col("rank").clip(1, 100)) / 100).clip(0.0, 1.0))
            .otherwise(0.5)
            .alias("rank_strength"),
            pl.when(pl.col("weeks_on_list").is_not_null())
            .then((pl.col("weeks_on_list").clip(0, 52) / 52).clip(0.0, 1.0))
            .otherwise(0.25)
            .alias("durability"),
        )
        .with_columns(
            ((pl.col("rank_strength") * 0.62) + (pl.col("durability") * 0.38)).round(4).alias("trend_velocity"),
            ((pl.col("rank_strength") * 0.45) + (pl.col("durability") * 0.35) + pl.lit(0.15)).clip(0.0, 1.0).round(4).alias("adaptation_fit"),
            pl.lit("nyt_bestseller_kaggle").alias("source_type"),
            pl.lit("unknown").alias("rights_status"),
            pl.lit("medium").alias("confidence"),
        )
        .sort(["adaptation_fit", "trend_velocity", "title"], descending=[True, True, False])
        .with_row_index("row_index")
        .select(
            (pl.lit("nyt_book_") + pl.col("row_index").cast(pl.Utf8).str.zfill(6)).alias("ip_id"),
            "title",
            "author",
            "source_type",
            pl.col("list_name").alias("genre"),
            pl.lit("bestseller_audience").alias("audience"),
            "trend_velocity",
            "adaptation_fit",
            "rights_status",
            pl.col("durability").round(4).alias("social_momentum"),
            pl.concat_list(["list_name", "publisher"]).alias("market_comps"),
            "confidence",
            "published_date",
            "rank",
            "weeks_on_list",
            "description",
            "isbn13",
        )
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "book_trend_signals.parquet"
    df.write_parquet(out_path)
    return BookTrendIngestionPaths(raw_dir=raw_dir, book_trends=out_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest NYT bestsellers Kaggle dataset into book trend signals.")
    parser.add_argument("--zip", type=Path, default=DEFAULT_ZIP_PATH)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    paths = ingest_nyt_bestsellers(zip_path=args.zip, out_dir=args.out)
    print("Book trend ingestion complete")
    print(f"  raw_dir: {paths.raw_dir}")
    print(f"  book_trends: {paths.book_trends}")


if __name__ == "__main__":
    main()
