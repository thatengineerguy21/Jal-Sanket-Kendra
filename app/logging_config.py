# app/logging_config.py
"""
Structured logging configuration using stdlib.

Produces JSON lines in production and human-readable lines in development.
Includes a ContextVar-based request_id for per-request tracing.
"""

from __future__ import annotations

import json
import logging
import sys
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Optional

from app.config import settings

# ContextVar set by the request-ID middleware.
request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


class _JSONFormatter(logging.Formatter):
    """Emit each log record as a single JSON line."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_ctx.get(),
        }
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry, default=str)


class _DevFormatter(logging.Formatter):
    """Coloured single-line output for local development."""

    fmt = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"

    def format(self, record: logging.LogRecord) -> str:
        rid = request_id_ctx.get()
        if rid:
            record.msg = f"[{rid[:8]}] {record.msg}"
        return super().format(record)


def setup_logging() -> None:
    """Call once at startup to wire formatters and handlers."""
    handler = logging.StreamHandler(sys.stdout)
    if settings.APP_ENV == "production":
        handler.setFormatter(_JSONFormatter())
    else:
        handler.setFormatter(_DevFormatter(fmt=_DevFormatter.fmt))

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(settings.LOG_LEVEL.upper())

    # Silence noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
