import pandas as pd
import io
import os
import json
import hashlib
from typing import List, Optional

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import tabula  # Import the new library for PDF parsing

from . import models, calculator

# Create an APIRouter instance
router = APIRouter()


# --- Pydantic models for response data structuring (No changes here) ---
class CalculationResult(BaseModel):
    heavy_metal_pollution_index: float
    hpi_category: str
    degree_of_contamination: float
    cd_category: str


class SampleResponse(BaseModel):
    id: int
    latitude: float
    longitude: float
    arsenic: float
    cadmium: float
    lead: float
    zinc: float
    result: CalculationResult

    class Config:
        from_attributes = True


@router.post("/upload-and-calculate/", response_model=List[SampleResponse])
async def create_upload_file(
        file: UploadFile = File(...),
        db: Session = Depends(models.get_db)
):
    """
    Accepts a CSV, JSON, or PDF file with water quality data, calculates 
    pollution indices, stores the data and results in the database, 
    and returns the complete record.

    - CSV/JSON/PDF columns must include: latitude, longitude, arsenic, cadmium, lead, zinc
    """

    df = None
    contents = await file.read()

    # --- NEW: Logic to handle different file types ---
    # Check the content type to decide how to parse the file.

    # 1. Handle CSV files
    if file.content_type == 'text/csv':
        try:
            df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error processing CSV file: {e}")

    # 2. Handle JSON files
    elif file.content_type == 'application/json':
        try:
            df = pd.read_json(io.StringIO(contents.decode('utf-8')))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error processing JSON file: {e}")

    # 3. Handle PDF files
    elif file.content_type == 'application/pdf':
        try:
            # tabula-py reads a PDF and returns a list of DataFrames (one for each table found)
            pdf_tables = tabula.read_pdf(io.BytesIO(contents), pages='all', multiple_tables=True)
            if not pdf_tables:
                raise HTTPException(status_code=400, detail="No data tables found in the PDF.")
            # We assume the first table found in the PDF is the correct one.
            df = pdf_tables[0]
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error processing PDF file: {e}")

    # 4. Handle Excel files (.xlsx)
    elif file.content_type in [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ]:
        try:
            df = pd.read_excel(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error processing Excel file: {e}")

    # If the file type is not supported
    else:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Please upload a CSV, JSON, or PDF."
        )

    # --- The rest of the logic remains largely the same ---
    # It now operates on the DataFrame 'df' created from the uploaded file.

    # Validate required columns in the resulting DataFrame
    required_columns = {'latitude', 'longitude', 'arsenic', 'cadmium', 'lead', 'zinc'}
    # Column names in PDFs can sometimes have extra spaces, so we strip them.
    df.columns = df.columns.str.strip()

    if not required_columns.issubset(df.columns):
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns. Data must contain: {', '.join(required_columns)}"
        )

    processed_samples = []

    # Iterate over each row in the DataFrame to process each sample
    for index, row in df.iterrows():
        # 1. Create and save the WaterSample record
        db_sample = models.WaterSample(
            latitude=row['latitude'],
            longitude=row['longitude'],
            arsenic=row.get('arsenic'),
            cadmium=row.get('cadmium'),
            lead=row.get('lead'),
            zinc=row.get('zinc')
        )
        db.add(db_sample)
        db.flush()  # Flush to get the ID for the sample

        # 2. Perform calculations using the calculator module
        hpi_value, hpi_cat = calculator.calculate_hpi(row)
        cd_value, cd_cat = calculator.calculate_degree_of_contamination(row)

        # 3. Create and save the PollutionResult record
        db_result = models.PollutionResult(
            sample_id=db_sample.id,
            heavy_metal_pollution_index=hpi_value,
            hpi_category=hpi_cat,
            degree_of_contamination=cd_value,
            cd_category=cd_cat
        )
        db.add(db_result)

        processed_samples.append(db_sample)

    db.commit()

    # Refresh each sample to load the newly created result relationship
    for sample in processed_samples:
        db.refresh(sample)

    return processed_samples

# =====================
# Removed Authentication & Roles
# =====================
def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode("utf-8")).hexdigest()

# Authentication and role-based access removed

class IndicesSummary(BaseModel):
    count: int
    avg_hpi: float
    avg_cd: float

@router.get("/indices/", response_model=IndicesSummary)
async def indices_summary(db: Session = Depends(models.get_db)):
    samples = db.query(models.PollutionResult).all()
    if not samples:
        return IndicesSummary(count=0, avg_hpi=0.0, avg_cd=0.0)
    avg_hpi = sum([s.heavy_metal_pollution_index or 0 for s in samples]) / len(samples)
    avg_cd = sum([s.degree_of_contamination or 0 for s in samples]) / len(samples)
    return IndicesSummary(count=len(samples), avg_hpi=round(avg_hpi, 3), avg_cd=round(avg_cd, 3))


# =====================
# Datasets & Indices API
# =====================

@router.get("/datasets/", response_model=List[SampleResponse])
async def list_datasets(db: Session = Depends(models.get_db)):
    samples = db.query(models.WaterSample).all()
    for s in samples:
        _ = s.result
    return samples

# IndicesSummary moved above


# =====================
# Alerts: config and send
# =====================

class AlertConfigDTO(BaseModel):
    hpi_threshold: float
    cd_threshold: float
    email_recipients: str
    sms_recipients: str
    policy_json: str = "{}"

def _get_config(db: Session) -> models.AlertConfig:
    cfg = db.query(models.AlertConfig).first()
    if not cfg:
        cfg = models.AlertConfig(hpi_threshold=100.0, cd_threshold=3.0)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg

@router.get("/alerts/config", response_model=AlertConfigDTO)
async def get_alert_config(db: Session = Depends(models.get_db)):
    cfg = _get_config(db)
    return AlertConfigDTO(
        hpi_threshold=cfg.hpi_threshold,
        cd_threshold=cfg.cd_threshold,
        email_recipients=cfg.email_recipients or "",
        sms_recipients=cfg.sms_recipients or "",
        policy_json=cfg.policy_json or "{}",
    )

@router.put("/alerts/config", response_model=AlertConfigDTO)
async def update_alert_config(dto: AlertConfigDTO, db: Session = Depends(models.get_db)):
    cfg = _get_config(db)
    cfg.hpi_threshold = dto.hpi_threshold
    cfg.cd_threshold = dto.cd_threshold
    cfg.email_recipients = dto.email_recipients
    cfg.sms_recipients = dto.sms_recipients
    cfg.policy_json = dto.policy_json
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return dto

class AlertSendRequest(BaseModel):
    channel: str  # 'email' or 'sms'
    message: str

def _collect_hotspots(db: Session, hpi_thr: float, cd_thr: float):
    items = db.query(models.WaterSample).join(models.PollutionResult).all()
    flagged = []
    for s in items:
        r = s.result
        if not r:
            continue
        if (r.heavy_metal_pollution_index or 0) >= hpi_thr or (r.degree_of_contamination or 0) >= cd_thr:
            flagged.append({
                "latitude": s.latitude,
                "longitude": s.longitude,
                "hpi": r.heavy_metal_pollution_index,
                "cd": r.degree_of_contamination,
            })
    return flagged

@router.post("/alerts/send")
async def send_alerts(req: AlertSendRequest, db: Session = Depends(models.get_db)):
    cfg = _get_config(db)
    hotspots = _collect_hotspots(db, cfg.hpi_threshold, cfg.cd_threshold)
    sendgrid_key = os.getenv("SENDGRID_API_KEY")
    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
    if req.channel == "email":
        if not sendgrid_key:
            raise HTTPException(status_code=400, detail="Missing SENDGRID_API_KEY")
        return {"status": "queued", "channel": "email", "to": cfg.email_recipients, "count": len(hotspots)}
    elif req.channel == "sms":
        if not (twilio_sid and twilio_token):
            raise HTTPException(status_code=400, detail="Missing Twilio credentials")
        return {"status": "queued", "channel": "sms", "to": cfg.sms_recipients, "count": len(hotspots)}
    else:
        raise HTTPException(status_code=400, detail="Unsupported channel")


# =====================
# Predictive Hotspots
# =====================

class PredictionResult(BaseModel):
    latitude: float
    longitude: float
    risk_score: float
    risk_category: str

@router.post("/predict-hotspots/", response_model=List[PredictionResult])
async def predict_hotspots(
        file: UploadFile = File(...),
):
    contents = await file.read()
    df = None
    try:
        if file.content_type == 'text/csv':
            df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        elif file.content_type == 'application/json':
            df = pd.read_json(io.StringIO(contents.decode('utf-8')))
        else:
            raise HTTPException(status_code=415, detail="Unsupported file type for prediction. Use CSV, JSON, or Excel.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {e}")

    required = {'latitude', 'longitude', 'arsenic', 'cadmium', 'lead', 'zinc'}
    df.columns = df.columns.str.strip()
    if not required.issubset(df.columns):
        raise HTTPException(status_code=400, detail=f"Missing required columns. Data must contain: {', '.join(required)}")

    PERMISSIBLE = {'arsenic': 10, 'cadmium': 3, 'lead': 10, 'zinc': 5000}
    weights = {'arsenic': 0.35, 'cadmium': 0.25, 'lead': 0.3, 'zinc': 0.1}

    preds = []
    for _, row in df.iterrows():
        try:
            cf_as = (row['arsenic'] / PERMISSIBLE['arsenic']) if pd.notna(row['arsenic']) else 0
            cf_cd = (row['cadmium'] / PERMISSIBLE['cadmium']) if pd.notna(row['cadmium']) else 0
            cf_pb = (row['lead'] / PERMISSIBLE['lead']) if pd.notna(row['lead']) else 0
            cf_zn = (row['zinc'] / PERMISSIBLE['zinc']) if pd.notna(row['zinc']) else 0
            risk = (
                weights['arsenic'] * cf_as +
                weights['cadmium'] * cf_cd +
                weights['lead'] * cf_pb +
                weights['zinc'] * cf_zn
            )
            risk_score = float(round(1 - (1 / (1 + risk)), 3))
            if risk_score < 0.33:
                cat = 'Low risk'
            elif risk_score < 0.66:
                cat = 'Moderate risk'
            else:
                cat = 'High risk'
            preds.append({
                'latitude': float(row['latitude']),
                'longitude': float(row['longitude']),
                'risk_score': risk_score,
                'risk_category': cat,
            })
        except Exception:
            continue
    return preds