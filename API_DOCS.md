# Jal Sanket Kendra - API Documentation

The Jal Sanket Kendra backend is powered by FastAPI, providing high-performance RESTful endpoints for ingesting water quality data, retrieving spatial datasets, and calculating WHO/BIS pollution indices.

## Interactive Documentation

FastAPI automatically generates interactive OpenAPI documentation. When your Uvicorn server is running locally, you can explore, test, and interact with all endpoints directly from your browser:

- **Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 1. Health & Status

### `GET /api/v1/health`
Returns the operational status, version, and environment of the API.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "environment": "development"
}
```

---

## 2. Data Ingestion

### `POST /api/v1/upload-and-calculate/`
Accepts a data file (CSV, JSON, PDF, or Excel) containing water-quality measurements. It automatically parses the contents, resolves column heuristics, calculates 6 different pollution indices against WHO/BIS limits, and persists the records to the database.

**Request:**
- **Content-Type:** `multipart/form-data`
- **Body:** `file` (Binary File)

**Response (200 OK):**
```json
{
  "message": "Dataset INSERTED successfully with computed WHO/BIS indices.",
  "rows_processed": 100,
  "rows_inserted": 100
}
```

---

## 3. Data Retrieval

### `GET /api/v1/datasets/`
Retrieves a paginated list of all stored water sample records. Records are sorted such that fully complete datasets (without missing mandatory coordinates or metals) are prioritized at the top.

**Query Parameters:**
- `limit` (int, default=100) - Number of records to return.
- `offset` (int, default=0) - Number of records to skip.

**Response (200 OK):**
```json
{
  "total": 16776,
  "items": [
    {
      "id": 1,
      "village_code": "V123",
      "state": "Maharashtra",
      "district": "Pune",
      "location": "Alandi",
      "latitude": 18.67,
      "longitude": 73.89,
      "fe": 0.45,
      "as_": 0.015,
      "u": 0.012,
      "hmpi_bis": 65.4,
      "hei_bis": 12.3,
      "pli_bis": 0.8,
      "parameters": { ... },
      "standards": { ... },
      "validation_issues": []
    }
  ]
}
```

### `GET /api/v1/datasets/map`
Retrieves a lightweight, high-performance spatial payload for rendering Map visuals. Can be filtered by a bounding box to only return records visible on the user's screen.

**Query Parameters:**
- `bbox` (string, optional) - Geographic bounding box in format `southWestLat,southWestLng,northEastLat,northEastLng`

**Response (200 OK):**
```json
{
  "points": [
    {
      "id": 1,
      "latitude": 18.67,
      "longitude": 73.89,
      "hmpi_bis": 65.4
    }
  ]
}
```

---

## 4. Analytics & Calculations

### `GET /api/v1/indices/`
Calculates and returns database-wide aggregated averages of all 6 pollution indices. Computed natively at the database level for maximum performance.

**Response (200 OK):**
```json
{
  "count": 16776,
  "invalid_count": 204,
  "avg_hmpi": 45.2,
  "avg_hei": 11.5,
  "avg_pli": 0.9,
  "avg_ehci": 15.2,
  "avg_hmi": 2.1,
  "avg_pmi": 0.4
}
```

### `POST /api/v1/quickcalc/`
A stateless endpoint that instantly computes indices for a provided list of trace metal concentrations without touching the database. Useful for single-record evaluations or standalone calculator UIs.

**Request Body (`application/json`):**
```json
{
  "metals": {
    "Fe": 0.45,
    "As": 0.015,
    "U": 0.012
  },
  "standard": "BIS"
}
```

### `POST /api/v1/predict-hotspots/`
Evaluates a provided list of records and classifies their overall Heavy Metal Pollution Index into categorized risk scores (Low, Moderate, High, Critical).

---

## 5. Alerts & Configuration

### `GET /api/v1/alerts/config`
Retrieves the current thresholds and notification recipients for automated pollution alerts.

### `PUT /api/v1/alerts/config`
Updates the global alert configuration.

### `POST /api/v1/alerts/send`
Manually triggers an alert dispatch to configured recipients.

---

## 6. Standards

### `GET /api/v1/standards/`
Returns the full JSON dictionary of WHO and BIS acceptable limits (`Ii`) and permissible limits (`Si`) for all 11 trace metals, along with reference dose values (`RFD`).
