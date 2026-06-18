# 🌊 Jal Sanket Kendra — जल संकेत केंद्र

> Water Quality Monitoring & Heavy Metal Pollution Index Dashboard

A full-stack web application to calculate water quality indices (**Heavy Metal Pollution Index** and **Degree of Contamination**), store results in a local SQLite database, and visualize them through a modern, interactive dashboard.

---

## ✨ Features

- **Upload & Analyze** — Upload water sample data (CSV, JSON, PDF, Excel) and compute HPI & Cd indices automatically
- **Interactive Map** — Visualize sample locations and pollution hotspots on a dark-themed Leaflet map
- **Hotspot Prediction** — Risk scoring and categorization for uploaded locations
- **Alert System** — Configure HPI/Cd thresholds and send email/SMS notifications
- **Modern Dashboard** — Glassmorphic dark UI with stat cards, drag-and-drop uploads, color-coded badges, and toast notifications
- **Dockerized** — Single-command deployment with `docker compose up`

---

## 🏗️ Architecture

```
Jal-Sanket-Kendra/
├── main.py                    # FastAPI entry point + middleware stack
├── app/
│   ├── config.py              # Centralized env-based settings
│   ├── logging_config.py      # Structured JSON / dev logging
│   ├── middleware.py           # Security headers, rate limiting, request ID
│   ├── models.py              # SQLAlchemy ORM (WaterSample, PollutionResult, AlertConfig)
│   ├── schemas.py             # Pydantic request/response schemas
│   ├── calculator.py          # HPI & Cd calculation functions
│   ├── api.py                 # Backward-compat router aggregator
│   ├── routes/
│   │   ├── upload.py          # POST /upload-and-calculate/
│   │   ├── predict.py         # POST /predict-hotspots/
│   │   ├── indices.py         # GET  /indices/, /datasets/
│   │   ├── alerts.py          # GET/PUT /alerts/config, POST /alerts/send
│   │   └── health.py          # GET  /health
│   └── services/
│       ├── file_parser.py     # Shared file parsing + validation
│       └── calculation_service.py  # Business logic + DB operations
├── frontend/
│   ├── web/                   # React + Vite + Tailwind v4 source
│   │   ├── src/
│   │   │   ├── App.jsx        # Layout, navbar, toast system, routing
│   │   │   ├── index.css      # 600+ line design system (CSS custom properties)
│   │   │   └── pages/
│   │   │       ├── DataView.jsx     # Dashboard + data table
│   │   │       ├── MapView.jsx      # Leaflet map + legend
│   │   │       ├── PredictView.jsx  # Hotspot predictions
│   │   │       └── AlertsView.jsx   # Alert configuration
│   │   └── vite.config.js
│   └── static/                # Built frontend (served at /app)
├── tests/                     # Pytest test suite
├── Dockerfile                 # Multi-stage build (Node + Python)
├── docker-compose.yml         # Production deployment
└── docker-compose.dev.yml     # Development with hot-reload
```

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
docker compose up --build
```

Open http://localhost:8000/app/ — that's it.

### Option 2: Manual Setup

**Prerequisites:** Python 3.14+, Node.js 18+ (for frontend build), Java on PATH (for PDF parsing)

```powershell
# 1. Create & activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Install Python dependencies
pip install -e .

# 3. Build the frontend
cd frontend/web
npm install
npm run build
cd ../..

# 4. Start the server
python -m uvicorn main:app --reload
```

Visit:
- **Dashboard:** http://127.0.0.1:8000/app/
- **API Docs:** http://127.0.0.1:8000/docs
- **Health Check:** http://127.0.0.1:8000/api/v1/health

### Option 3: uv users

```powershell
uv sync
.\.venv\Scripts\Activate.ps1
cd frontend/web && npm install && npm run build && cd ../..
python -m uvicorn main:app --reload
```

### Option 4: Helper scripts

```powershell
# PowerShell
.\scripts\start.ps1

# Bash
chmod +x scripts/start.sh && ./scripts/start.sh
```

---

## 📡 API Endpoints

All endpoints are prefixed with `/api/v1`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload-and-calculate/` | Upload CSV/JSON/PDF/Excel, compute indices, store results |
| `POST` | `/predict-hotspots/` | Upload data, get risk predictions per location |
| `GET` | `/indices/` | Aggregate summary (count, avg HPI, avg Cd) |
| `GET` | `/datasets/` | All stored water samples with results |
| `GET` | `/alerts/config` | Get alert threshold configuration |
| `PUT` | `/alerts/config` | Update alert thresholds and recipients |
| `POST` | `/alerts/send` | Send email/SMS alert for hotspots |
| `GET` | `/health` | Liveness probe (status, version, environment) |

**Required columns** for upload files: `latitude`, `longitude`, `arsenic`, `cadmium`, `lead`, `zinc`

**Example:**

```bash
curl -X POST "http://localhost:8000/api/v1/upload-and-calculate/" \
  -F "file=@data/test_data.csv;type=text/csv"
```

---

## ⚙️ Configuration

All settings are configurable via environment variables (see `app/config.py`):

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `development` | `development` or `production` |
| `DATABASE_URL` | `sqlite:///./water_quality.db` | Database connection string |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:8000` | Comma-separated allowed origins |
| `MAX_UPLOAD_SIZE_BYTES` | `10485760` (10 MB) | Maximum upload file size |
| `RATE_LIMIT_PER_MINUTE` | `60` | Requests per minute per IP |
| `LOG_LEVEL` | `INFO` | Logging level |
| `SENDGRID_API_KEY` | — | For email alerts |
| `TWILIO_ACCOUNT_SID` | — | For SMS alerts |
| `TWILIO_AUTH_TOKEN` | — | For SMS alerts |

---

## 🐳 Docker

### Production

```bash
docker compose up --build
```

- App available at http://localhost:8000/app/
- SQLite data persisted in a Docker volume (`app-data`)
- Health checks, resource limits, and auto-restart included

### Development

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

- Backend source mounted for live changes (restart container to apply)
- Separate Vite dev server with hot-reload on http://localhost:5173

---

## 🔒 Security

The API includes multiple security hardening layers:

- **CORS middleware** — Configurable origin allow-list
- **Rate limiting** — In-memory token-bucket limiter (60 req/min/IP)
- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, HSTS (production)
- **Request ID tracking** — `X-Request-ID` header on every response
- **File size limits** — 10 MB max upload (configurable)
- **Input validation** — Pydantic schemas with constraints on all inputs
- **Global exception handler** — No stack traces leaked to clients
- **Non-root container** — Docker runs as `appuser:1001`

---

## 🧪 Testing

```powershell
pytest -q
```

Tests use an in-memory SQLite database for isolation and speed.

---

## 📁 Test Datasets

A sample dataset is included at `data/test_data.csv`.

**Required columns:** `latitude`, `longitude`, `arsenic`, `cadmium`, `lead`, `zinc`

**Supported formats:** CSV, JSON (array of objects), PDF (tabular), Excel (`.xlsx`)

```python
import requests
with open('data/test_data.csv', 'rb') as f:
    r = requests.post(
        'http://localhost:8000/api/v1/upload-and-calculate/',
        files={'file': ('test_data.csv', f, 'text/csv')}
    )
    print(r.status_code, r.json())
```

---

## 📝 Troubleshooting

- **`ModuleNotFoundError: No module named 'sqlalchemy'`** — Make sure `.venv` is activated
- **PDF parsing fails** — Verify Java is installed and `java` is on your PATH
- **`pip install -e .` fails with flat-layout error** — The `pyproject.toml` already includes `[tool.setuptools.packages.find]` to fix this
- **Database column errors after upgrade** — The app auto-migrates missing columns on startup. If issues persist, delete `water_quality.db` and restart

---

## 📜 License

This project is for educational and research purposes.
