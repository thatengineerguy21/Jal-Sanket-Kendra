# app/routes/upload.py
"""Upload-and-calculate endpoint with background task processing."""

from __future__ import annotations

import json
import logging
import math
import threading
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, UploadFile
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


def _process_upload_sync(task_id: str, rows: list[dict]) -> None:
    """
    Heavy processing in a background thread.

    Creates its own DB session (thread-local) so we don't share sessions
    across threads.  Updates the TaskStatus row as it progresses.
    """
    db: Session = models.SessionLocal()
    try:
        # Mark task as processing
        task = db.query(models.TaskStatus).filter(models.TaskStatus.id == task_id).first()
        if not task:
            return
        task.status = "processing"
        task.progress = 0
        db.commit()

        samples_created = 0
        samples_list = []
        total_rows = len(rows)

        for idx, r in enumerate(rows):
            village_code = normalize_str(r.get("village_code")) or None
            state = normalize_str(r.get("state")) or None
            district = normalize_str(r.get("district")) or None
            location = normalize_str(r.get("location")) or None
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

            # Update progress every 50 rows
            if idx % 50 == 0:
                task.progress = int((idx / total_rows) * 90)  # Reserve 10% for DB commit
                db.commit()

        db.bulk_save_objects(samples_list)
        db.commit()

        # Invalidate caches after successful upload
        invalidate_cache()

        # Mark task as completed
        task.status = "completed"
        task.progress = 100
        task.result_json = json.dumps({
            "message": "Dataset INSERTED successfully with computed WHO/BIS indices.",
            "rows_processed": len(rows),
            "rows_inserted": samples_created,
        })
        db.commit()
        logger.info("Background task %s completed: %d samples from upload", task_id, samples_created)

    except Exception as exc:
        logger.exception("Background task %s failed", task_id)
        try:
            task = db.query(models.TaskStatus).filter(models.TaskStatus.id == task_id).first()
            if task:
                task.status = "failed"
                task.error_message = str(exc)[:500]
                db.commit()
        except Exception:
            logger.exception("Failed to update task status for %s", task_id)
    finally:
        db.close()


@router.post("/upload-and-calculate/", response_model=TaskAcceptedResponse, status_code=202)
async def create_upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(models.get_db),
):
    """
    Accept a CSV, JSON, PDF, or Excel file with water-quality data.

    Returns a 202 Accepted response immediately with a task ID.
    The heavy parsing and index calculation runs in a background thread.
    Poll ``GET /api/v1/tasks/{task_id}`` for progress and results.
    """
    # Parse the file synchronously (fast — just reads bytes and converts to dicts)
    rows = await file_parser.parse_upload(file, validate_columns=True)

    # Create a task tracking record
    task_id = uuid.uuid4().hex
    task = models.TaskStatus(id=task_id, status="pending", progress=0)
    db.add(task)
    db.commit()

    # Offload heavy processing to a background thread
    thread = threading.Thread(
        target=_process_upload_sync,
        args=(task_id, rows),
        daemon=True,
    )
    thread.start()

    logger.info("Upload accepted, background task %s started for %d rows", task_id, len(rows))

    return TaskAcceptedResponse(
        task_id=task_id,
        status="pending",
        poll_url=f"/api/v1/tasks/{task_id}",
    )
