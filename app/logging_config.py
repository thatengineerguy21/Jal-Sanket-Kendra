# app/logging_config.py
"""
Structured logging configuration using stdlib.

Produces JSON lines in production and human-readable lines in development.
Includes a ContextVar-based request_id for per-request tracing.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from contextvars import ContextVar
from datetime import UTC, datetime
from logging.handlers import RotatingFileHandler

from app.config import settings

# ContextVar set by the request-ID middleware.
request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


class _JSONFormatter(logging.Formatter):
    """Emit each log record as a single JSON line."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_ctx.get(),
        }
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry, default=str)


class _PlainDevFormatter(logging.Formatter):
    """Plain single-line output for log files."""

    fmt = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"

    def format(self, record: logging.LogRecord) -> str:
        rid = request_id_ctx.get()
        msg_prefix = f"[{rid[:8]}] " if rid else ""
        rec = logging.makeLogRecord(record.__dict__)
        rec.msg = f"{msg_prefix}{rec.msg}"
        return super().format(rec)


class _DevFormatter(logging.Formatter):
    """Coloured single-line ANSI output for terminal development."""

    LEVEL_COLORS = {
        "DEBUG": "\033[36m",  # Cyan
        "INFO": "\033[32m",  # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",  # Red
        "CRITICAL": "\033[1;\033[31m",  # Bold Red
    }
    RESET = "\033[0m"
    DIM = "\033[2m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    BRIGHT_CYAN = "\033[96m"

    def format(self, record: logging.LogRecord) -> str:
        rec = logging.makeLogRecord(record.__dict__)
        color = self.LEVEL_COLORS.get(rec.levelname, "")
        padded_level = f"{rec.levelname:<8}"
        colored_level = f"{color}{padded_level}{self.RESET}"

        rid = request_id_ctx.get()
        rid_str = f"{self.MAGENTA}[{rid[:8]}]{self.RESET} " if rid else ""

        msg = str(rec.msg)
        if "[BREADCRUMB]" in msg:
            msg = msg.replace("[BREADCRUMB]", f"{self.BRIGHT_CYAN}[BREADCRUMB]{self.RESET}")

        time_str = f"{self.DIM}{self.formatTime(rec, self.datefmt)}{self.RESET}"
        logger_str = f"{self.BLUE}{rec.name}{self.RESET}"

        return f"{time_str} | {colored_level} | {logger_str} | {rid_str}{msg}"


def setup_logging() -> None:
    """Call once at startup to wire formatters and handlers."""
    # Ensure logs directory exists
    os.makedirs("logs", exist_ok=True)

    console_handler = logging.StreamHandler(sys.stdout)
    file_handler = RotatingFileHandler("logs/app.log", maxBytes=10485760, backupCount=5, encoding="utf-8")

    if settings.APP_ENV == "production":
        console_formatter = _JSONFormatter()
        file_formatter = _JSONFormatter()
    else:
        console_formatter = _DevFormatter()
        file_formatter = _PlainDevFormatter()

    console_handler.setFormatter(console_formatter)
    file_handler.setFormatter(file_formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(console_handler)
    root.addHandler(file_handler)
    root.setLevel(settings.LOG_LEVEL.upper())

    # Ensure uvicorn logs propagate to our root logger
    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"):
        l = logging.getLogger(logger_name)
        l.handlers.clear()
        l.propagate = True

    # Silence noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
