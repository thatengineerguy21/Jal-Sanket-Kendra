# ══════════════════════════════════════════════════════════════════════════
#  Jal Sanket Kendra — Multi-Stage Dockerfile
#  Stage 1: Build frontend (Node/Vite)
#  Stage 2: Production runtime (Python/FastAPI serving static + API)
# ══════════════════════════════════════════════════════════════════════════

# ── Stage 1: Frontend Build ─────────────────────────────────────────────
FROM node:22-alpine AS frontend-build

WORKDIR /build

# Copy dependency files first for layer caching
COPY frontend/web/package.json frontend/web/package-lock.json ./

# Install all deps (including devDependencies for Vite/Tailwind)
RUN npm ci && npm cache clean --force

# Copy frontend source
COPY frontend/web/ ./

# Build — outputs to ../static (relative to frontend/web), but inside
# the container we redirect to /build/static for easy copying later
RUN npx vite build --outDir /build/static


# ── Stage 2: Python Production Runtime ──────────────────────────────────
FROM python:3.14-slim AS runtime

# Security: create non-root user
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -m -s /bin/bash appuser

# System deps for pandas/tabula (Java for tabula-py PDF parsing)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer caching — deps change rarely)
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# Copy application code
COPY pyproject.toml pytest.ini main.py ./
COPY app/ ./app/
COPY tests/ ./tests/

# Copy built frontend from Stage 1
COPY --from=frontend-build /build/static ./frontend/static/

# Create data directory for SQLite (writable by appuser)
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data

# Set ownership of app files
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Environment defaults
ENV APP_ENV=production \
    DATABASE_URL=sqlite:///./data/water_quality.db \
    CORS_ORIGINS=* \
    LOG_LEVEL=INFO \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# Health check using the /api/v1/health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Run with uvicorn — single worker for SQLite safety
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
