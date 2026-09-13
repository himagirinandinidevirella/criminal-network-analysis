"""
Local LLM engine (llama-cpp-python + GGUF).

Free-form fallback for the chatbot: when no rule-based intent matches, the
question is answered by a small local model (Qwen2.5-1.5B-Instruct Q4_K_M,
chosen for CPU-only hosts with ~16 GB RAM). The model loads lazily on first
use so backend startup stays fast; any failure returns None and the caller
keeps its existing behaviour.

Environment overrides (all optional):
    LLM_ENABLED     "true"/"false"   (default true)
    LLM_MODEL_DIR   directory with *.gguf   (default backend/data/models/llm)
    LLM_MODEL_PATH  explicit .gguf path (wins over LLM_MODEL_DIR)
    LLM_MAX_TOKENS  reply budget        (default 220)
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from threading import Lock
from typing import Optional

logger = logging.getLogger("crimenet.llm")

_BACKEND_DIR = Path(__file__).resolve().parents[2]           # backend/
_DEFAULT_MODEL_DIR = _BACKEND_DIR / "data" / "models" / "llm"

SYSTEM_PROMPT = (
    "You are CrimeNet Assistant, an AI analyst on a criminal-network "
    "intelligence platform used by police investigators. Answer briefly, "
    "factually and professionally. If you don't know something, say so — "
    "never invent case data, names or numbers.\n"
    "The platform's pages (left sidebar): Dashboard, Network Analysis "
    "(graph, Path Finder, gangs, what-if), Investigation (FIR analysis), "
    "Crime Map, Alerts, Reports, Blockchain Integrity Lab, AI Assistant. "
    "If the user asks to open or view a page, tell them which sidebar item "
    "to use — you cannot open pages yourself."
)

_model = None
_load_failed = False
_lock = Lock()


def _model_path() -> Optional[Path]:
    override = os.getenv("LLM_MODEL_PATH")
    if override:
        path = Path(override)
        return path if path.is_file() else None
    directory = Path(os.getenv("LLM_MODEL_DIR", _DEFAULT_MODEL_DIR))
    if directory.is_dir():
        ggufs = sorted(directory.glob("*.gguf"))
        return ggufs[0] if ggufs else None
    return None


def _load():
    """Load the model once; returns None when disabled, missing or broken."""
    global _model, _load_failed
    with _lock:
        if _model is not None or _load_failed:
            return _model
        if os.getenv("LLM_ENABLED", "true").lower() != "true":
            _load_failed = True
            return None
        path = _model_path()
        if path is None:
            _load_failed = True
            return None
        try:
            from llama_cpp import Llama

            logger.info("Loading local LLM: %s", path.name)
            _model = Llama(
                model_path=str(path),
                n_ctx=4096,
                n_threads=max(1, (os.cpu_count() or 4) - 2),
                verbose=False,
            )
            logger.info("Local LLM ready: %s", path.name)
        except Exception as exc:  # noqa: BLE001 - chatbot must not break ops
            logger.warning("Local LLM failed to load: %s", exc)
            _model = None
            _load_failed = True
        return _model


def is_ready() -> bool:
    """True when a model file is present and enabled (loads on first use)."""
    return os.getenv("LLM_ENABLED", "true").lower() == "true" and _model_path() is not None


def generate(question: str, graph_context: str = "") -> Optional[str]:
    """Answer a free-form question with the local model; None if unavailable."""
    llm = _load()
    if llm is None:
        return None
    try:
        user_content = question
        if graph_context:
            user_content = f"Known database context:\n{graph_context}\n\nQuestion: {question}"
        out = llm.create_chat_completion(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_tokens=int(os.getenv("LLM_MAX_TOKENS", "220")),
            temperature=0.4,
        )
        reply = (out["choices"][0]["message"]["content"] or "").strip()
        return reply or None
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM generation failed: %s", exc)
        return None
