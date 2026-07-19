# app/config.py
"""
Centralized configuration management.

All application settings are read from environment variables with sensible
defaults.  The Settings class is a plain dataclass so we avoid adding a
pydantic-settings dependency.  Values are read once at import time and
cached in the module-level `settings` singleton.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _csv_list(env_key: str, default: str) -> list[str]:
    """Read a comma-separated env var into a list of stripped strings."""
    raw = os.getenv(env_key, default)
    return [v.strip() for v in raw.split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    """Immutable application settings – one source of truth."""

    # --- Application ---
    APP_NAME: str = "Jal Sanket Kendra — Heavy Metal Pollution Index API"
    APP_VERSION: str = "2.0.0"
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DEBUG: bool = APP_ENV == "development"

    # --- Database ---
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./water_quality.db")

    # --- CORS ---
    CORS_ORIGINS: list[str] = field(
        default_factory=lambda: _csv_list(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:8000",
        )
    )

    # --- Upload limits ---
    MAX_UPLOAD_SIZE_BYTES: int = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", str(10 * 1024 * 1024)))  # 10 MB

    # --- Rate limiting (requests per minute per client IP) ---
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))

    # --- Trusted hosts (empty = allow all) ---
    TRUSTED_HOSTS: list[str] = field(default_factory=lambda: _csv_list("TRUSTED_HOSTS", "*"))

    # --- Third-party integrations (secrets via env only) ---
    SENDGRID_API_KEY: str = os.getenv("SENDGRID_API_KEY", "")
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")

    # --- Logging ---
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")


# Module-level singleton – import this everywhere.
settings = Settings()
