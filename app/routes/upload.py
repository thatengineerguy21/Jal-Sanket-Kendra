# app/routes/upload.py
"""Upload-and-calculate endpoint with background task processing."""

from __future__ import annotations

import json
import logging
import math
import uuid
from typing import Any
import reverse_geocoder as rg

# Force initialization of the KDTree in the main thread to prevent
# C-extension segmentation faults on Windows when spawned in a background thread.
rg.search((28.6139, 77.2090), mode=1)

from fastapi import APIRouter, Depends, File, UploadFile, BackgroundTasks
from sqlalchemy.orm import Session

from app import models
from app.cache import invalidate_all as invalidate_cache
from app.schemas import TaskAcceptedResponse
from app.services import calculation_service, file_parser
from app.standards import RFD

logger = logging.getLogger(__name__)
router = APIRouter()

PARAM_COLUMN_MAP = {
    "parameters.pH": "pH",
    "parameters.EC": "EC",
    "parameters.CO3": "CO3",
    "parameters.HCO3": "HCO3",
    "parameters.Cl": "Cl",
    "parameters.F": "F",
    "parameters.SO4": "SO4",
    "parameters.NO3": "NO3",
    "parameters.PO4": "PO4",
    "parameters.total_hardness": "total_hardness",
    "parameters.Ca": "Ca",
    "parameters.Mg": "Mg",
    "parameters.Na": "Na",
    "parameters.K": "K",
    "parameters.TDS": "TDS",
    "parameters.SiO2": "SiO2",
    "parameters.Fe": "Fe",
    "parameters.Mn": "Mn",
    "parameters.Zn": "Zn",
    "parameters.Cu": "Cu",
    "parameters.U": "U",
    "parameters.As": "As",
    "parameters.Pb": "Pb",
    "parameters.Cd": "Cd",
    "parameters.Cr": "Cr",
    "parameters.Hg": "Hg",
    "parameters.Ni": "Ni",
}

def to_int_or_none(v):
    try:
        return int(v) if v not in ("", None) else None
    except (ValueError, TypeError):
        return None

def to_float_or_none(v):
    try:
        if v in ("", None):
            return None
        val = float(v)
        if math.isnan(val):
            return None
        return val
    except (ValueError, TypeError):
        return None

def normalize_str(v):
    if v is None:
        return ""
    if isinstance(v, float) and math.isnan(v):
        return ""
    return str(v).strip()


import os
from fastapi import HTTPException
from app.schemas import UploadResponse, CalculateResponse

UPLOAD_DIR = "data/uploads"

def _parse_save_and_finalize(task_id: str, file_id: str, contents: bytes, filename: str):
    """Background task: parse uploaded file bytes, save parsed rows to disk, and update task status."""
    logger.info("[BREADCRUMB] Starting background parse and save for task %s, file '%s'", task_id, filename)
    db_gen = models.get_db()
    db = next(db_gen)
    try:
        task = db.query(models.TaskStatus).filter_by(id=task_id).first()
        if not task:
            return

        task.status = "processing"
        task.progress = 20
        db.commit()

        def update_progress(pct: int):
            try:
                task.progress = pct
                db.commit()
            except Exception:
                pass

        # Parse raw bytes (runs in background threadpool with per-page progress updates)
        logger.info("[BREADCRUMB] Parsing bytes for '%s'", filename)
        rows = file_parser.parse_bytes_direct(
            contents, filename, validate_columns=True, progress_callback=update_progress
        )

        task.progress = 75
        db.commit()

        # Save parsed rows as JSON
        filepath = os.path.join(UPLOAD_DIR, f"{file_id}.json")
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        task.progress = 85
        db.commit()

        with open(filepath, "w") as f:
            json.dump(rows, f)

        logger.info(
            "[BREADCRUMB] Saved %d rows from '%s' for task %s",
            len(rows), filename, task_id,
        )

        task.status = "completed"
        task.progress = 100
        task.result = {"file_id": file_id, "filename": filename}
        db.commit()
    except Exception as e:
        logger.exception("[BREADCRUMB] Background parsing/save failed for task %s", task_id)
        task = db.query(models.TaskStatus).filter_by(id=task_id).first()
        if task:
            task.status = "failed"
            if hasattr(e, "detail"):
                task.error_message = str(e.detail)
            else:
                task.error_message = str(e)
            db.commit()
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass


@router.post("/upload/", response_model=TaskAcceptedResponse, status_code=202)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(models.get_db)
):
    """
    Accept a CSV, JSON, PDF, or Excel file and queue it for asynchronous parsing
    in the background worker thread pool. Returns immediately with 202 Accepted.
    """
    logger.info("[BREADCRUMB] Incoming POST /upload/ for file '%s'", file.filename)
    filename = file.filename or ""
    content_type = file.content_type or ""

    if content_type not in file_parser.ALLOWED_CONTENT_TYPES and not filename.endswith(('.csv', '.json', '.xls', '.xlsx', '.pdf')):
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Please upload a CSV, JSON, PDF, or Excel file.",
        )

    contents = await file.read()
    if len(contents) > file_parser.settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {file_parser.settings.MAX_UPLOAD_SIZE_BYTES} bytes.",
        )

    file_id = uuid.uuid4().hex
    task_id = uuid.uuid4().hex

    task = models.TaskStatus(
        id=task_id,
        status="pending",
        progress=0,
    )
    db.add(task)
    db.commit()

    logger.info("[BREADCRUMB] Created task %s for file '%s', queueing background parse", task_id, filename)
    background_tasks.add_task(
        _parse_save_and_finalize, task_id, file_id, contents, filename
    )

    return TaskAcceptedResponse(
        task_id=task_id,
        poll_url=f"/api/v1/tasks/{task_id}"
    )

@router.post("/calculate/{file_id}", response_model=CalculateResponse)
def calculate_file(
    file_id: str,
    db: Session = Depends(models.get_db),
):
    """
    Read the previously parsed JSON file, calculate indices, and insert into DB.
    Runs synchronously in FastAPI's external threadpool to avoid blocking the event loop.
    """
    filepath = os.path.join(UPLOAD_DIR, f"{file_id}.json")
            
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Uploaded file not found or expired.")
        
    with open(filepath, "r") as f:
        rows = json.load(f)
    
    # Pre-process coordinates for bulk reverse geocoding
    coords_to_geocode = []
    valid_indices = []
    for i, r in enumerate(rows):
        lon_val = to_float_or_none(r.get("coordinates.coordinates[0]"))
        lat_val = to_float_or_none(r.get("coordinates.coordinates[1]"))
        if lon_val is not None and lat_val is not None:
            if -180.0 <= lon_val <= 180.0 and -90.0 <= lat_val <= 90.0:
                coords_to_geocode.append((lat_val, lon_val))
                valid_indices.append(i)

    geocode_results = {}
    if coords_to_geocode:
        # use mode=1 to avoid multiprocessing spawn issues on Windows within threads
        # batch to avoid GIL starvation
        rg_results = []
        chunk_size = 500
        for i in range(0, len(coords_to_geocode), chunk_size):
            chunk = coords_to_geocode[i:i+chunk_size]
            rg_results.extend(rg.search(chunk, mode=1))

        for i, res in zip(valid_indices, rg_results, strict=True):
            geocode_results[i] = res

    samples_created = 0
    samples_list = []

    for idx, r in enumerate(rows):
        # Reverse fetch location names from coordinates if available
        geo_res = geocode_results.get(idx)
        if geo_res:
            state = normalize_str(geo_res.get("admin1")) or None
            district = normalize_str(geo_res.get("admin2")) or None
            location = normalize_str(geo_res.get("name")) or None
        else:
            state = normalize_str(r.get("state")) or None
            district = normalize_str(r.get("district")) or None
            location = normalize_str(r.get("location")) or None

        village_code = normalize_str(r.get("village_code")) or None
        source = normalize_str(r.get("source")) or "lab_A"
        year_val = to_int_or_none(r.get("year"))
        lon_val = to_float_or_none(r.get("coordinates.coordinates[0]"))
        lat_val = to_float_or_none(r.get("coordinates.coordinates[1]"))
        ph_val = to_float_or_none(r.get("parameters.pH"))

        issues: list[str] = []

        if not state:
            issues.append("state missing")
        if not district:
            issues.append("district missing")
        if not location:
            issues.append("location missing")

        if lon_val is None:
            issues.append("longitude missing/invalid")
        elif not (-180.0 <= lon_val <= 180.0):
            issues.append("longitude out of range (-180, 180)")
            lon_val = None

        if lat_val is None:
            issues.append("latitude missing/invalid")
        elif not (-90.0 <= lat_val <= 90.0):
            issues.append("latitude out of range (-90, 90)")
            lat_val = None

        if year_val is None:
            issues.append("year missing/invalid")
        elif not (1900 <= year_val <= 2100):
            issues.append("year out of range (1900-2100)")
        if ph_val is None:
            issues.append("pH missing/invalid")
        elif not (0.0 <= ph_val <= 14.0):
            issues.append("pH out of range (0-14)")

        parameters: dict[str, Any] = {}
        for col_name, param_key in PARAM_COLUMN_MAP.items():
            val = to_float_or_none(r.get(col_name))
            if val is not None:
                parameters[param_key] = val

        if (
            not state and not district and not location
            and lon_val is None and lat_val is None and year_val is None
            and not parameters
        ):
            continue

        metal_raw: dict[str, float] = {}
        for metal in ["Fe", "Mn", "Zn", "Cu", "U", "As", "Pb", "Cd", "Cr", "Hg", "Ni"]:
            if metal in parameters:
                metal_raw[metal] = parameters[metal]

        metals_mgL = calculation_service.convert_units_for_metals(metal_raw)

        standards: dict[str, Any] = {}
        if metals_mgL:
            # WHO
            ci_who = calculation_service.calc_ci(metals_mgL, calculation_service.WHO_LIMITS_METALS)
            standards["WHO"] = {
                "ci": ci_who,
                "ehci": calculation_service.calc_ehci(ci_who),
                "hei": calculation_service.calc_hei(ci_who),
                "pli": calculation_service.calc_pli(ci_who),
                "hmpi": calculation_service.calc_hmpi(metals_mgL, calculation_service.WHO_LIMITS_METALS),
                "hi": calculation_service.calc_hi(metals_mgL, RFD),
            }

            # BIS
            ci_bis = calculation_service.calc_ci(metals_mgL, calculation_service.BIS_LIMITS_METALS)
            standards["BIS"] = {
                "ci": ci_bis,
                "ehci": calculation_service.calc_ehci(ci_bis),
                "hei": calculation_service.calc_hei(ci_bis),
                "pli": calculation_service.calc_pli(ci_bis),
                "hmpi": calculation_service.calc_hmpi(metals_mgL, calculation_service.BIS_LIMITS_METALS),
                "hi": calculation_service.calc_hi(metals_mgL, RFD),
            }

            if standards["WHO"]["hmpi"] is not None:
                parameters["hmpi"] = standards["WHO"]["hmpi"]

        # ── Document Reduced Parameter Set ────────────────────────
        missing_metals = calculation_service.get_missing_metals(metals_mgL, calculation_service.BIS_LIMITS_METALS)
        if missing_metals:
            issues.append(f"Historical index was computed with a reduced parameter set (Missing: {', '.join(missing_metals)}).")

        sample = models.WaterSample(
            village_code=village_code,
            state=state,
            district=district,
            location=location,
            year=year_val,
            source=source,
            latitude=lat_val,
            longitude=lon_val,
            fe=parameters.get("Fe"),
            as_=parameters.get("As"),
            u=parameters.get("U"),
            hmpi_bis=standards.get("BIS", {}).get("hmpi") if standards.get("BIS") else None,
            hei_bis=standards.get("BIS", {}).get("hei") if standards.get("BIS") else None,
            pli_bis=standards.get("BIS", {}).get("pli") if standards.get("BIS") else None,
            parameters_json=json.dumps(parameters),
            standards_json=json.dumps(standards),
            validation_issues_json=json.dumps(issues),
        )

        samples_list.append(sample)
        samples_created += 1

    db.bulk_save_objects(samples_list)
    db.commit()

    # Invalidate caches after successful upload
    invalidate_cache()
    
    # Try to clean up the file
    try:
        os.remove(filepath)
    except Exception as e:
        logger.warning(f"Could not remove temporary file {filepath}: {e}")

    return CalculateResponse(
        message="Dataset INSERTED successfully with computed WHO/BIS indices.",
        rows_processed=len(rows),
        rows_inserted=samples_created,
    )
