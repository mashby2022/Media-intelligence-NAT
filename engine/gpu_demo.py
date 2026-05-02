"""Readiness checks for the GPU/RAPIDS/NAT demo runtime."""

from __future__ import annotations

import importlib.util
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any


DEFAULT_REQUIRED_DATASETS = [
    "scripts_150k.parquet",
    "cultural_graph_edges.parquet",
    "market_signal_snapshot.parquet",
]


def _module_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def _cuda_status() -> dict[str, Any]:
    nvidia_smi = shutil.which("nvidia-smi")
    if not nvidia_smi:
        return {"available": False, "nvidia_smi": None, "gpu": None}

    try:
        result = subprocess.run(
            [nvidia_smi, "--query-gpu=name,memory.total,driver_version", "--format=csv,noheader"],
            check=False,
            capture_output=True,
            text=True,
            timeout=3,
        )
    except (OSError, subprocess.TimeoutExpired):
        return {"available": False, "nvidia_smi": nvidia_smi, "gpu": None}

    gpu_line = result.stdout.strip().splitlines()[0] if result.returncode == 0 and result.stdout.strip() else None
    return {
        "available": gpu_line is not None,
        "nvidia_smi": nvidia_smi,
        "gpu": gpu_line,
    }


def gpu_demo_status(data_dir: str | Path = "data") -> dict[str, Any]:
    """Return a persona-agnostic status payload for the required demo stack."""

    data_path = Path(data_dir)
    packages = {
        "cudf": _module_available("cudf"),
        "cugraph": _module_available("cugraph"),
        "cuml": _module_available("cuml"),
        "cuxfilter": _module_available("cuxfilter"),
        "hdbscan": _module_available("hdbscan"),
        "nat": _module_available("nat"),
        "aiq": _module_available("aiq"),
        "nvidia_nat": _module_available("nvidia_nat"),
    }
    required_runtime = ["cudf", "cugraph", "cuml", "cuxfilter", "hdbscan"]
    missing_runtime = [name for name in required_runtime if not packages[name]]
    nat_available = packages["nat"] or packages["aiq"] or packages["nvidia_nat"]
    dataset_status = {name: (data_path / name).exists() for name in DEFAULT_REQUIRED_DATASETS}
    missing_datasets = [name for name, exists in dataset_status.items() if not exists]
    key_configured = bool(os.getenv("NVIDIA_API_KEY") or os.getenv("NGC_API_KEY"))
    cuda = _cuda_status()

    return {
        "service": "Media Intelligence Engine",
        "demo_profile": "GPU/RAPIDS/NAT",
        "demo_ready": cuda["available"] and not missing_runtime and nat_available and key_configured and not missing_datasets,
        "compute_source": "High-Performance Compute Cluster" if cuda["available"] and packages["cudf"] else "Standard Edge Node",
        "cuda": cuda,
        "packages": packages,
        "nat_available": nat_available,
        "nvidia_api_key_configured": key_configured,
        "data_dir": str(data_path),
        "datasets": dataset_status,
        "missing": {
            "runtime": missing_runtime,
            "nat": [] if nat_available else ["nat or aiq or nvidia_nat"],
            "datasets": missing_datasets,
            "credentials": [] if key_configured else ["NVIDIA_API_KEY or NGC_API_KEY"],
        },
    }
