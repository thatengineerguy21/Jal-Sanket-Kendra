# 🌊 Jal Sanket Kendra — जल संकेत केंद्र

> High-Performance Water Quality Monitoring & Heavy Metal Pollution Index Dashboard

A full-stack web application built to ingest, calculate, and visualize water quality indices and heavy metal contamination at scale. Featuring an advanced PDF heuristics engine, local SQLite persistence, and an interactive spatial dashboard for hotspot detection.

---

## ✨ Key Features

- **Robust Data Ingestion** — Intelligent parser that accurately extracts tables from CGWB lab PDFs, JSONs, CSVs, and Excel files. Safely handles missing data, Decimal/DMS coordinate translations, and lab shorthand (e.g. `BDL`, `Nil`).
- **Comprehensive Indices Calculation** — Automatically computes 6 distinct indices against **WHO** and **BIS** standards: 
  - Heavy Metal Pollution Index (HMPI)
  - Heavy Metal Evaluation Index (HEI)
  - Pollution Load Index (PLI)
  - Contamination Index (CD)
  - Entropy-Based HMCI (EHCI)
  - Toxicity-Weighted HMI
- **High-Performance Spatial Dashboard** — Visualize massive datasets on a dark-themed Leaflet map utilizing dynamic `bbox` (bounding box) filtering and server-side table pagination.
- **Hotspot Prediction** — Risk scoring and categorization for uploaded locations.
- **Alert System** — Configure index thresholds and dispatch email/SMS notifications.
- **Modern UI** — Glassmorphic dark design with micro-animations, stat cards, and toast notifications.

---

## 🏗️ Architecture

```
Jal-Sanket-Kendra/
├── API_DOCS.md                # Detailed REST API Endpoint Documentation
├── main.py                    # FastAPI entry point + middleware stack
├── app/
│   ├── config.py              # Centralized env-based settings
│   ├── models.py              # Optimized SQLAlchemy ORM (Indexed floats over JSON)
│   ├── schemas.py             # Pydantic validation schemas
│   ├── calculator.py          # Pollution index calculation formulas
│   ├── standards.py           # Single source of truth for WHO/BIS metal limits
│   ├── routes/                # FastAPI Routers (upload, predict, indices, etc)
│   └── services/
│       ├── file_parser.py     # Shared file validation & ingest gateway
│       ├── pdf_parser.py      # Advanced Tabula heuristics & multi-page table extraction
│       └── calculation_service.py # Core business logic & database operations
├── frontend/
│   ├── web/                   # React + Vite + Tailwind v4 source
│   │   ├── src/
│   │   │   ├── App.jsx        # Layout, navbar, toast system, routing
│   │   │   ├── index.css      # 600+ line design system (CSS custom properties)
│   │   │   └── pages/         # Dashboard, Data, Map, Alerts views
│   └── static/                # Built frontend (served at /app)
├── Dockerfile                 # Multi-stage build (Node + Python)
└── docker-compose.yml         # Production deployment
```

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
docker compose up --build
```
Open http://localhost:8000/app/ — that's it.

### Option 2: Manual Setup

**Prerequisites:** Python 3.14+, Node.js 18+ (for frontend build), Java 8+ on PATH (for PDF parsing).

```powershell
# 1. Create & activate virtual environment
uv venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Install Python dependencies
uv pip install -e .

# 3. Build the frontend
cd frontend/web
npm install
npm run build
cd ../..

# 4. Start the backend server
python -m uvicorn main:app --reload
```

Visit:
- **Dashboard:** http://127.0.0.1:8000/app/
- **Interactive API Docs:** http://127.0.0.1:8000/docs
- **Health Check:** http://127.0.0.1:8000/api/v1/health

---

## 📡 API Endpoints

All endpoints are prefixed with `/api/v1`. 

For full technical details, schemas, and payloads, please refer to the [**API Documentation (API_DOCS.md)**](API_DOCS.md).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload-and-calculate/` | Ingests data, resolves limits, calculates indices, and stores results |
| `GET` | `/datasets/` | Paginated retrieval of all stored water samples |
| `GET` | `/datasets/map` | Lightweight spatial query filtered by map viewport `bbox` |
| `GET` | `/indices/` | Database-level aggregate summary of all pollution indices |
| `POST` | `/quickcalc/` | Stateless index calculations for trace metals |
| `GET` | `/standards/` | Fetch raw WHO/BIS limits and Reference Doses |
| `GET` | `/alerts/config` | Get alert threshold configuration |

---

## ⚙️ Configuration

All settings are configurable via environment variables (see `app/config.py`):

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `development` | `development` or `production` |
| `DATABASE_URL` | `sqlite:///./water_quality.db` | Database connection string |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:8000` | Comma-separated allowed origins |
| `MAX_UPLOAD_SIZE_BYTES` | `10485760` (10 MB) | Maximum upload file size |

---

## 🧪 Data Ingestion & Supported Parameters

The system evaluates uploaded tabular data to find a "minimum acceptable signal" consisting of locations, coordinates, or water chemistry parameters. It will safely ignore unrecognized columns.

**Supported Trace Metals (Automatically converted from ppb → mg/L if applicable):**
Lead (Pb), Cadmium (Cd), Chromium (Cr), Arsenic (As), Mercury (Hg), Nickel (Ni), Uranium (U), Iron (Fe), Manganese (Mn), Zinc (Zn), Copper (Cu).

**Supported Chemistry & Identifiers:**
pH, EC, CO3, HCO3, Cl, F, SO4, NO3, PO4, Total Hardness, Ca, Mg, Na, K, TDS, SiO2, `latitude`, `longitude`, `location`, `district`, `state`, `village_code`.

---

## Screenshot

### Dashboard View

![Dashboard View](https://github.com/thatengineerguy21/Jal-Sanket-Kendra/blob/main/docs/images/dashboard.png)

### Map View(Zoomed Out)

![Map View](https://github.com/thatengineerguy21/Jal-Sanket-Kendra/blob/main/docs/images/map.png)

In zoomed out mode, hovering will show number of datapoints in the region.

---

## 📝 Troubleshooting

- **PDF extraction silently fails** — Verify Java is installed and `java` is on your PATH. The `tabula-py` engine relies on a Java subprocess fallback.
- **Database column errors after upgrade** — If changing top-level DB models, delete the local `water_quality.db` SQLite file and restart Uvicorn to automatically provision the updated schema.
- **Frontend changes not reflecting** — Make sure to run `npm run build` inside `frontend/web` so FastAPI can serve the newly bundled assets from `/static`.

---

## 📜 License

This project is for educational and research purposes.
