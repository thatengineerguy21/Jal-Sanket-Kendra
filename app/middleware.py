# app/middleware.py
"""
Custom middleware for security hardening.

All middleware here uses the stdlib / Starlette base so we don't need
extra pip packages (no slowapi, etc.).
"""

from __future__ import annotations

import logging
import time
import uuid
from collections import defaultdict
from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import settings
from app.logging_config import request_id_ctx

logger = logging.getLogger(__name__)


# ── Request-ID Middleware ───────────────────────────────────────────────
class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Inject a unique ``X-Request-ID`` header into every response and store
    it in a ContextVar for structured logging.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        request_id_ctx.set(rid)
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response


# ── Security Headers Middleware ─────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add defensive HTTP headers to every response."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
        if settings.APP_ENV == "production":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response


# ── Simple In-Memory Rate Limiter ───────────────────────────────────────
class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Token-bucket rate limiter keyed by client IP.

    Uses stdlib only.  Not suitable for multi-process deployments (use
    Redis-backed limiters in production).  Good enough for single-process
    or development.
    """

    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60) -> None:  # type: ignore[override]
        super().__init__(app)
        self._max = max_requests
        self._window = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window_start = now - self._window

        # Prune old entries
        self._hits[client_ip] = [t for t in self._hits[client_ip] if t > window_start]

        if len(self._hits[client_ip]) >= self._max:
            logger.warning("Rate limit exceeded for %s", client_ip)
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."},
                headers={"Retry-After": str(self._window)},
            )

        self._hits[client_ip].append(now)
        return await call_next(request)
