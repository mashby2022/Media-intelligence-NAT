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

def _get_api_key() -> str | None:
    return os.getenv("NVIDIA_API_KEY") or os.getenv("NGC_API_KEY")

def nim_key_available() -> bool:
    return bool(_get_api_key())

NIM_TIMEOUT_SEC = float(os.getenv("NIM_TIMEOUT_SEC", "25.0"))

def _resolve_model_name(model_alias: str) -> str:
    return DEFAULT_MODELS.get(model_alias, model_alias)


def _extract_json_blob(text: str) -> dict[str, Any] | None:
    text = text.strip()
    if not text: 
        return None

    try:
        if isinstance(parsed := json.loads(text), dict):
            return parsed
    except json.JSONDecodeError:
        pass
    if fence_match := re.search(r"```json\s*(\{.*?\})\s*```", text,flags= re.DOTALL | re.IGNORECASE):
        try: 
            if isinstance(parsed := json.loads(fence_match.group(1)), dict):
                return parsed
        except json.JSONDecodeError:
            pass

    return None


def _system_prompt_for_role(role: str) -> str:
    normalized_role = role.strip().lower()
    focus = (
        "analytical depth and operator decisions"
        if normalized_role in {"analyst", "operator"}
        else "executive clarity and immediate actionability"
    )
    return f"You are a top-tier media intelligence assistant focused on {focus}. Synthesize the provided evidence into a concise strategic brief with a clear headline, 3 brief bullets, and an overall confidence level (low, medium, high). Prioritize actionable insights and avoid filler. No markdown"
def _miranda_system_prompt() -> str:
    return (
        "You are Miranda, the executive media-intelligence orchestrator. "
        "The demo audience is a media executive deciding what to greenlight next. "
        "Respond with concise, direct markdown in this order when possible: Recommendation, Top bets, Evidence, Risk, Next action. "
        "Avoid filler. Ground recommendations in observable signals and uncertainty when needed."
    )

def _call_nim_api(payload: dict[str, Any], timeout_sec: float) -> dict[str, Any]:
    """Helper to call NIM API and handle errors and track latency."""
    if not (api_key := _get_api_key()):
        return {"ok": False, "error": "missing_nim_key"}
    model_name = payload["model"]
    request_timeout = timeout_sec if timeout_sec is not None else NIM_TIMEOUT_SEC

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
        return {"ok": True, "body": json.loads(raw), "model": model_name, "latency_ms": latency_ms}
    except json.JSONDecodeError:
        return {"ok": False, "error": "nim_invalid_json", "model": model_name, "latency_ms": latency_ms}
    
def synthesize_with_nim(
    *,
    evidence: dict[str, Any],
    role: str,
    model_alias: str = DEFAULT_MODEL_ALIAS,
    timeout_sec: float | None = None,
) -> dict[str, Any]:
    """Attempt NIM reasoning synthesis and return persona-agnostic metadata."""
    payload = {
        "model": _resolve_model_name(model_alias),
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

    res = _call_nim_api(payload, timeout_sec)
    if not res.get("ok"):
        return res  # Propagate error details

    message = res["body"].get("choices", [{}])[0].get("message", {}).get("content", "")
    if not (parsed := _extract_json_blob(message)):
        return {
            "ok": False,
            "error": "nim_unparseable_response",
            "model": res["model"],
            "latency_ms": res["latency_ms"],
            "raw_message": message[:1200],
        }

    bullets = parsed.get("brief_bullets", [])
    bullets = [str(item).strip() for item in bullets if str(item).strip()][:3] if isinstance(bullets, list) else []

    return {
        "ok": True,
        "headline": str(parsed.get("headline", "")).strip(),
        "brief_bullets": bullets,
        "confidence": str(parsed.get("confidence", "")).strip() or "medium",
        "model": res["model"],
        "latency_ms": res["latency_ms"],
    }


def chat_with_nim(*, messages: list[dict[str, str]], model_alias: str = DEFAULT_MODEL_ALIAS, timeout_sec: float | None = None) -> dict[str, Any]:
    """Run a direct NIM chat completion for Miranda-style conversation."""
    chat_messages = [{"role": "system", "content": _miranda_system_prompt()}]
    
    for msg in messages:
        role, content = str(msg.get("role", "")).strip(), str(msg.get("content", "")).strip()
        if role in {"user", "assistant"} and content:
            chat_messages.append({"role": role, "content": content})
            
    if len(chat_messages) == 1:
        chat_messages.append({"role": "user", "content": "Provide a concise strategic media brief."})

    payload = {
        "model": _resolve_model_name(model_alias),
        "messages": chat_messages,
        "temperature": 0.6,
        "top_p": 0.95,
        "max_tokens": 700,
        "stream": False,
    }
    
    res = _call_nim_api(payload, timeout_sec)
    if not res.get("ok"):
        return res

    content = str(res["body"].get("choices", [{}])[0].get("message", {}).get("content", "")).strip()
    if not content:
        return {"ok": False, "error": "nim_empty_response", "model": res["model"], "latency_ms": res["latency_ms"]}
        
    return {"ok": True, "content": content, "model": res["model"], "latency_ms": res["latency_ms"]}
