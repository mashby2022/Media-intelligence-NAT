"""Liaison Core reasoning helpers backed by NVIDIA NIM chat-completions."""

from __future__ import annotations

import json
import os
import re
from time import perf_counter
from typing import Any
from urllib import error as urlerror
from urllib import request as urlrequest


NIM_BASE_URL = os.getenv("NIM_BASE_URL", "https://integrate.api.nvidia.com/v1").rstrip("/")
DEFAULT_MODEL_ALIAS = "nano"
DEFAULT_MODELS = {
    "nano": os.getenv("NEMOTRON_NANO_MODEL", "nvidia/nvidia-nemotron-nano-9b-v2"),
}


def _float_env(name: str, fallback: float) -> float:
    try:
        return float(os.getenv(name, str(fallback)))
    except ValueError:
        return fallback


NIM_TIMEOUT_SEC = _float_env("MIE_NIM_TIMEOUT_SEC", 25.0)


def nim_key_available() -> bool:
    return bool(os.getenv("NVIDIA_API_KEY") or os.getenv("NGC_API_KEY"))


def _resolve_model_name(model_alias: str) -> str:
    if model_alias in DEFAULT_MODELS:
        return DEFAULT_MODELS[model_alias]
    return model_alias


def _extract_json_blob(text: str) -> dict[str, Any] | None:
    text = text.strip()
    if not text:
        return None
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.DOTALL)
    if fence_match:
        try:
            parsed = json.loads(fence_match.group(1))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return None
    return None


def _system_prompt_for_role(role: str) -> str:
    if role.lower() == "operator":
        return (
            "You are the Liaison Core synthesis model. Return strictly valid JSON with keys: "
            'headline (string), brief_bullets (array of exactly 3 strings), confidence (string). '
            "Focus on analytical depth and operator decisions. No markdown."
        )
    return (
        "You are the Liaison Core synthesis model. Return strictly valid JSON with keys: "
        'headline (string), brief_bullets (array of exactly 3 strings), confidence (string). '
        "Focus on executive clarity and immediate actionability. No markdown."
    )


def _miranda_system_prompt() -> str:
    return (
        "You are Miranda, the executive media-intelligence orchestrator. "
        "The demo audience is a Head of Scripted deciding what to greenlight next. "
        "Respond with concise, direct markdown in this order when possible: Recommendation, Top bets, Evidence, Risk, Next action. "
        "Avoid filler. Ground recommendations in observable signals and uncertainty when needed."
    )


def synthesize_with_nim(
    *,
    evidence: dict[str, Any],
    role: str,
    model_alias: str = DEFAULT_MODEL_ALIAS,
    timeout_sec: float | None = None,
) -> dict[str, Any]:
    """Attempt NIM reasoning synthesis and return persona-agnostic metadata."""

    api_key = os.getenv("NVIDIA_API_KEY") or os.getenv("NGC_API_KEY")
    if not api_key:
        return {"ok": False, "error": "missing_nim_key"}

    model_name = _resolve_model_name(model_alias)
    request_timeout = timeout_sec if timeout_sec is not None else NIM_TIMEOUT_SEC
    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": _system_prompt_for_role(role)},
            {
                "role": "user",
                "content": (
                    "Synthesize this media-intelligence evidence into a concise strategic brief.\n"
                    "Evidence JSON:\n"
                    f"{json.dumps(evidence, ensure_ascii=True)}"
                ),
            },
        ],
        "temperature": 0.6,
        "top_p": 0.95,
        "max_tokens": 700,
        "stream": False,
    }
    req = urlrequest.Request(
        f"{NIM_BASE_URL}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    started = perf_counter()
    try:
        with urlrequest.urlopen(req, timeout=request_timeout) as response:
            raw = response.read().decode("utf-8")
    except (urlerror.HTTPError, urlerror.URLError, TimeoutError) as exc:
        return {
            "ok": False,
            "error": "nim_request_failed",
            "details": str(exc),
            "model": model_name,
            "timeout_sec": request_timeout,
        }

    latency_ms = round((perf_counter() - started) * 1000, 2)
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        return {"ok": False, "error": "nim_invalid_json", "model": model_name, "latency_ms": latency_ms}

    message = body.get("choices", [{}])[0].get("message", {}).get("content", "")
    parsed = _extract_json_blob(message)
    if not parsed:
        return {
            "ok": False,
            "error": "nim_unparseable_response",
            "model": model_name,
            "latency_ms": latency_ms,
            "raw_message": message[:1200],
        }

    bullets = parsed.get("brief_bullets", [])
    if not isinstance(bullets, list):
        bullets = []
    bullets = [str(item).strip() for item in bullets if str(item).strip()][:3]

    return {
        "ok": True,
        "headline": str(parsed.get("headline", "")).strip(),
        "brief_bullets": bullets,
        "confidence": str(parsed.get("confidence", "")).strip() or "medium",
        "model": model_name,
        "latency_ms": latency_ms,
    }


def chat_with_nim(
    *,
    messages: list[dict[str, str]],
    model_alias: str = DEFAULT_MODEL_ALIAS,
    timeout_sec: float | None = None,
) -> dict[str, Any]:
    """Run a direct NIM chat completion for Miranda-style conversation."""

    api_key = os.getenv("NVIDIA_API_KEY") or os.getenv("NGC_API_KEY")
    if not api_key:
        return {"ok": False, "error": "missing_nim_key"}

    model_name = _resolve_model_name(model_alias)
    request_timeout = timeout_sec if timeout_sec is not None else NIM_TIMEOUT_SEC
    chat_messages: list[dict[str, str]] = [{"role": "system", "content": _miranda_system_prompt()}]
    for message in messages:
        role = str(message.get("role", "")).strip()
        content = str(message.get("content", "")).strip()
        if role not in {"user", "assistant"} or not content:
            continue
        chat_messages.append({"role": role, "content": content})
    if len(chat_messages) == 1:
        chat_messages.append({"role": "user", "content": "Provide a concise strategic media brief."})

    payload = {
        "model": model_name,
        "messages": chat_messages,
        "temperature": 0.6,
        "top_p": 0.95,
        "max_tokens": 700,
        "stream": False,
    }
    req = urlrequest.Request(
        f"{NIM_BASE_URL}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    started = perf_counter()
    try:
        with urlrequest.urlopen(req, timeout=request_timeout) as response:
            raw = response.read().decode("utf-8")
    except (urlerror.HTTPError, urlerror.URLError, TimeoutError) as exc:
        return {
            "ok": False,
            "error": "nim_request_failed",
            "details": str(exc),
            "model": model_name,
            "timeout_sec": request_timeout,
        }

    latency_ms = round((perf_counter() - started) * 1000, 2)
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        return {"ok": False, "error": "nim_invalid_json", "model": model_name, "latency_ms": latency_ms}

    content = str(body.get("choices", [{}])[0].get("message", {}).get("content", "")).strip()
    if not content:
        return {"ok": False, "error": "nim_empty_response", "model": model_name, "latency_ms": latency_ms}
    return {
        "ok": True,
        "content": content,
        "model": model_name,
        "latency_ms": latency_ms,
    }
