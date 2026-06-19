# main.py
"""
Application entry-point.

Wires up:
  - Structured logging
  - CORS middleware
  - Security headers, request-ID, and rate-limit middleware
  - TrustedHostMiddleware
  - Global exception handler (no stack-trace leaks)
  - All API routers under /api/v1
  - Static frontend mount
  - Startup / shutdown lifecycle events
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app import api
from app.config import settings
from app.logging_config import setup_logging
from app.middleware import (
    RateLimitMiddleware,
    RequestIDMiddleware,
    SecurityHeadersMiddleware,
)
from app.models import Base, engine

# ── Logging ─────────────────────────────────────────────────────────────
setup_logging()
logger = logging.getLogger(__name__)

# ── Paths ───────────────────────────────────────────────────────────────
cwd = Path(__file__).parent


# ── Lightweight Migration ───────────────────────────────────────────────
def _migrate_add_missing_columns() -> None:
    """
    Add columns that exist in ORM models but are missing from the on-disk
    SQLite database.  ``create_all()`` only creates *new* tables — it won't
    ALTER existing ones.  This closes the gap for pre-existing databases.

    Safe to run repeatedly (idempotent).
    """
    from sqlalchemy import inspect as sa_inspect, text

    inspector = sa_inspect(engine)
    for table in Base.metadata.sorted_tables:
        if not inspector.has_table(table.name):
            continue  # table doesn't exist yet; create_all will handle it

        existing = {col["name"] for col in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name not in existing:
                col_type = column.type.compile(dialect=engine.dialect)
                stmt = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type}'
                logger.info("Migrating: %s", stmt)
                with engine.connect() as conn:
                    conn.execute(text(stmt))
                    conn.commit()


# ── Lifecycle ───────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create DB tables on startup (safe for SQLite / dev)."""
    logger.info("Creating database tables (if not exist) …")
    Base.metadata.create_all(bind=engine)
    _migrate_add_missing_columns()
    yield
    logger.info("Application shutting down.")


# ── App ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Heavy Metal Pollution Index API",
    description="An API to calculate HPI and other pollution indices from water quality data.",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    # Hide schemas from docs in production
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# ── Middleware (order matters: outermost first) ─────────────────────────
# 1. Trusted hosts
if "*" not in settings.TRUSTED_HOSTS:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.TRUSTED_HOSTS)

# 2. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Security headers
app.add_middleware(SecurityHeadersMiddleware)

# 4. Request-ID
app.add_middleware(RequestIDMiddleware)

# 5. Rate limiting
app.add_middleware(
    RateLimitMiddleware,
    max_requests=settings.RATE_LIMIT_PER_MINUTE,
    window_seconds=60,
)


from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all so that unexpected errors never leak tracebacks to clients.
    The real exception is logged server-side.
    """
    if isinstance(exc, StarletteHTTPException):
        raise exc
        
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again later."},
    )


# ── Routers ─────────────────────────────────────────────────────────────
app.include_router(api.router, prefix="/api/v1", tags=["Pollution Indices"])


# ── Static frontend ────────────────────────────────────────────────────
static = cwd / "frontend" / "static"
if static.exists():
    app.mount("/app", StaticFiles(directory=static, html=True), name="frontend")


# ── Root ────────────────────────────────────────────────────────────────
@app.get("/", tags=["Root"])
def read_root():
    """Root endpoint providing basic information about the API."""
    return {
        "message": "Welcome to the Heavy Metal Pollution Indices API",
        "docs_url": "/docs",
        "app_url": "/app/",
    }