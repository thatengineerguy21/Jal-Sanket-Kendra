# Jal Sanket Kendra (Unfinished)

A small FastAPI application to calculate water quality indices (Heavy Metal Pollution Index : HPI, and Degree of Contamination  Cd), store results in a local SQLite database, and provide a simple static frontend.

---

## Quick overview 

- API built with **FastAPI** (see `main.py`).
- Calculation logic in `app/calculator.py`.
- Data stored in a local **SQLite** DB (`water_quality.db` by default).
- Static frontend served from `frontend/static/` and mounted at `/app`.

---

## Prerequisites 

- Python 3.14 or newer
- Java Runtime (JRE/JDK) on PATH, required for parsing PDFs with `tabula`.
- Recommended: a virtual environment

---

## Install & run (pip users) 

Open PowerShell in the project root (this folder) and run:

```powershell
# Create & activate a virtual environment
python -m venv .venv
.\.venv\Scripts\Activate

# Install the package in editable mode and extra tools
pip install -e .
pip install "uvicorn[standard]"
```

Initialize the database tables (run from project root):

```powershell
python -c "from app import models; models.Base.metadata.create_all(models.engine)"
```

Start the server (run from the project root directory):

```powershell
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Visit:

- Frontend: http://127.0.0.1:8000/app/
- API docs (Swagger): http://127.0.0.1:8000/docs

---

## Install & run (uv users) 

This repository also supports workflows using the `uv` tool (used for dependency/manage/run in some environments). Example commands:

```powershell
# Initialize uv meta files (if not already present)
uv init

# Add required runtime deps (example)
uv add python-multipart
uv add "uvicorn[standard]"
uv add pandas
uv add tabula

# If `uv` exposes a run command you can use it, otherwise use the uvicorn command below this
# Example (if your `uv` supports `uv run`):
uv run python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Alternatively, run the same uvicorn command directly (after installing deps via `uv` or pip):
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Note: `uv` commands and flags depend on the `uv` implementation you have. The above shows common actions used in this project (init, add packages, run the server).

---

## Uploading data & endpoints 

- Upload & calculate: `POST /api/v1/upload-and-calculate/` (CSV/JSON/PDF/Excel)
- Predict hotspots: `POST /api/v1/predict-hotspots/`
- Summary: `GET /api/v1/indices/`
- Datasets: `GET /api/v1/datasets/`

Example curl (CSV upload):

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/upload-and-calculate/" -F "file=@data/test_data.csv;type=text/csv"
```

Required columns for upload: `latitude`, `longitude`, `arsenic`, `cadmium`, `lead`, `zinc`.

---

## Environment & extras 

- To enable alert sending via email or SMS, set these environment variables:
  - `SENDGRID_API_KEY`
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`

---
## Troubleshooting & tips 

- If PDF parsing fails, verify Java is installed and `java` is on your PATH.
- If you see parsing errors from `tabula`, try converting the PDF tables to CSV first and re-upload.
- Tests: `pytest -q`

---

## Helper scripts (RECOMMENDED)

Two helper scripts are included in `scripts/` to make getting started easier. Run them from the project root (this folder):

- PowerShell: `scripts/start.ps1` — creates/activates `.venv`, installs dependencies (unless `-NoInstall` is passed), initializes the DB, and starts the server.

  Example: `.\	ools\..\scripts\start.ps1` (or `.\ackslash\scripts\start.ps1`) — Note: run `.\	ools\..\scripts\start.ps1` from PowerShell in the project root.

  Usage: `.\	ools\..\scripts\start.ps1` or `.\scripts\start.ps1 -Port 8080 -NoInstall`

- Bash: `scripts/start.sh` — same behavior for Unix-like systems. Make it executable and run:

  ```bash
  chmod +x scripts/start.sh
  ./scripts/start.sh --port 8080 --no-install
  ```

Both scripts will:
- create a Python virtual environment (`.venv`) if missing
- install dependencies with `pip install -e .` (skippable)
- initialize the SQLite DB tables
- launch uvicorn: `python -m uvicorn main:app --reload --host 127.0.0.1 --port <port>`

---

## Test datasets & how to use them 

A sample test dataset is included at `data/test_data.csv`. It contains example water-sample rows used for manual testing and as a reference for automated tests.

Required attributes (columns) for any test dataset:

- `latitude` (float)
- `longitude` (float)
- `arsenic` (float)
- `cadmium` (float)
- `lead` (float)
- `zinc` (float)

Notes:
- Column headers are case-sensitive in the code but the upload endpoint strips surrounding spaces from headers; ensure the exact names above are present.
- Numeric values should be valid numbers. Missing values are treated as NaN and excluded from calculations for that metal.
- Supported file formats for uploads: CSV, JSON (array of objects), PDF (table), and Excel (`.xlsx`).

How to use the included CSV for a quick upload (curl):

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/upload-and-calculate/" -F "file=@data/test_data.csv;type=text/csv"
```

Use the dataset in tests:

- The test suite already includes examples in `tests/`.
- To run the tests locally:

```powershell
pytest -q
```

Programmatic example (Python requests):

```python
import requests
with open('data/test_data.csv', 'rb') as f:
    r = requests.post('http://127.0.0.1:8000/api/v1/upload-and-calculate/', files={'file': ('test_data.csv', f, 'text/csv')})
    print(r.status_code, r.json())
```
