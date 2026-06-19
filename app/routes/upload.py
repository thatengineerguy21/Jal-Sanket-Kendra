# app/routes/upload.py
"""Upload-and-calculate endpoint."""

from __future__ import annotations

import logging
from typing import List, Dict, Any
import math

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app import models
from app.schemas import SampleResponse
from app.services import file_parser, calculation_service

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
    "parameters.total_hardness": "total_hardness",
    "parameters.Ca": "Ca",
    "parameters.Mg": "Mg",
    "parameters.Na": "Na",
    "parameters.K": "K",
    "parameters.Fe": "Fe",
    "parameters.U": "U",
    "parameters.As": "As",
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

@router.post("/upload-and-calculate/", response_model=Dict[str, Any])
async def create_upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(models.get_db),
):
    """
    Accept a CSV, JSON, PDF, or Excel file with water-quality data,
    calculate pollution indices (WHO/BIS), persist everything, and return a summary.
    """
    rows = await file_parser.parse_upload(file, validate_columns=True)
    
    samples_created = 0
    now = datetime.now(timezone.utc)
    
    samples_list = []
    
    for r in rows:
        village_code = normalize_str(r.get("village_code")) or None
        state = normalize_str(r.get("state")) or None
        district = normalize_str(r.get("district")) or None
        location = normalize_str(r.get("location")) or None
        source = normalize_str(r.get("source")) or "lab_A"

        year_val = to_int_or_none(r.get("year"))
        lon_val = to_float_or_none(r.get("coordinates.coordinates[0]"))
        lat_val = to_float_or_none(r.get("coordinates.coordinates[1]"))
        ph_val = to_float_or_none(r.get("parameters.pH"))

        issues: List[str] = []

        if not state: issues.append("state missing")
        if not district: issues.append("district missing")
        if not location: issues.append("location missing")
        
        if lon_val is None: 
            issues.append("longitude missing/invalid")
            lon_val = 0.0
        elif not (-180.0 <= lon_val <= 180.0): 
            issues.append("longitude out of range (-180, 180)")
            lon_val = 0.0
            
        if lat_val is None: 
            issues.append("latitude missing/invalid")
            lat_val = 0.0
        elif not (-90.0 <= lat_val <= 90.0): 
            issues.append("latitude out of range (-90, 90)")
            lat_val = 0.0
            
        if year_val is None: issues.append("year missing/invalid")
        elif not (1900 <= year_val <= 2100): issues.append("year out of range (1900-2100)")
        if ph_val is None: issues.append("pH missing/invalid")
        elif not (0.0 <= ph_val <= 14.0): issues.append("pH out of range (0-14)")

        parameters: Dict[str, Any] = {}
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

        metal_raw: Dict[str, float] = {}
        if "Fe" in parameters: metal_raw["Fe"] = parameters["Fe"]
        if "As" in parameters: metal_raw["As"] = parameters["As"]
        if "U" in parameters: metal_raw["U"] = parameters["U"]

        metals_mgL = calculation_service.convert_units_for_metals(metal_raw)

        standards: Dict[str, Any] = {}
        if metals_mgL:
            # WHO
            ci_who = calculation_service.calc_ci(metals_mgL, calculation_service.WHO_LIMITS_METALS)
            standards["WHO"] = {
                "ci": ci_who,
                "ehci": calculation_service.calc_ehci(ci_who),
                "hei": calculation_service.calc_hei(ci_who),
                "pli": calculation_service.calc_pli(ci_who),
                "hmpi": calculation_service.calc_hmpi(metals_mgL, calculation_service.WHO_LIMITS_METALS),
                "hi": calculation_service.calc_hi(metals_mgL, calculation_service.RFD),
            }

            # BIS
            ci_bis = calculation_service.calc_ci(metals_mgL, calculation_service.BIS_LIMITS_METALS)
            standards["BIS"] = {
                "ci": ci_bis,
                "ehci": calculation_service.calc_ehci(ci_bis),
                "hei": calculation_service.calc_hei(ci_bis),
                "pli": calculation_service.calc_pli(ci_bis),
                "hmpi": calculation_service.calc_hmpi(metals_mgL, calculation_service.BIS_LIMITS_METALS),
                "hi": calculation_service.calc_hi(metals_mgL, calculation_service.RFD),
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
        )
        sample.parameters = parameters
        sample.standards = standards
        sample.validation_issues = issues
        
        samples_list.append(sample)
        samples_created += 1

    db.bulk_save_objects(samples_list)
    db.commit()
    logger.info("Processed %d samples from upload", samples_created)

    return {
        "message": "Dataset INSERTED successfully with computed WHO/BIS indices.",
        "rows_processed": len(rows),
        "rows_inserted": samples_created,
    }
