# app/services/file_parser.py
"""
Shared file-parsing service.

Consolidates all upload-file parsing (CSV, JSON, PDF, Excel) into one
reusable module.
"""

from __future__ import annotations

import io
import logging
from typing import Optional, Set, List

import pandas as pd
from fastapi import HTTPException, UploadFile

from app.config import settings

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS: List[str] = [
    "village_code",
    "state",
    "district",
    "location",
    "year",
    "coordinates.coordinates[0]",
    "coordinates.coordinates[1]",
    "parameters.pH",
    "parameters.EC",
    "parameters.CO3",
    "parameters.HCO3",
    "parameters.Cl",
    "parameters.F",
    "parameters.SO4",
    "parameters.NO3",
    "parameters.PO4",
    "parameters.total_hardness",
    "parameters.Ca",
    "parameters.Mg",
    "parameters.Na",
    "parameters.K",
    "parameters.TDS",
    "parameters.SiO2",
    # Heavy metals — kept in sync with app.standards.STANDARDS so that
    # anything the index calculators know how to score can also be
    # extracted from an upload.
    "parameters.Fe",
    "parameters.Mn",
    "parameters.Zn",
    "parameters.Cu",
    "parameters.U",
    "parameters.As",
    "parameters.Pb",
    "parameters.Cd",
    "parameters.Cr",
    "parameters.Hg",
    "parameters.Ni",
    "source",
]

# Columns that, if present, indicate the file actually carries data this
# app is built to ingest (a place, a coordinate, or a measured parameter).
# We use this — rather than requiring every single column above — to
# decide whether to accept a file. Real-world lab/CGWB exports (CSV,
# Excel, or text scraped from a PDF) almost never contain all ~30 fields
# at once: a given report might skip village_code (no such field exists
# in many state datasets), skip "source", or only test for a subset of
# heavy metals. Rejecting the whole file over an absent optional column
# throws away coordinates and heavy-metal readings that *did* parse
# correctly — which is the behavior this change is meant to fix.
_LOCATION_COLUMNS: Set[str] = {"village_code", "state", "district", "location"}
_COORDINATE_COLUMNS: Set[str] = {
    "coordinates.coordinates[0]",
    "coordinates.coordinates[1]",
}
_PARAMETER_COLUMNS: Set[str] = {
    c for c in REQUIRED_COLUMNS if c.startswith("parameters.")
}

_CSV_TYPES = {"text/csv"}
_JSON_TYPES = {"application/json"}
_PDF_TYPES = {"application/pdf"}
_EXCEL_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}

ALLOWED_CONTENT_TYPES = _CSV_TYPES | _JSON_TYPES | _PDF_TYPES | _EXCEL_TYPES

async def parse_upload(
    file: UploadFile,
    *,
    allowed_types: Optional[Set[str]] = None,
    validate_columns: bool = True,
) -> List[dict]:
    """
    Read an ``UploadFile`` into a validated list of dicts.
    Raises ``HTTPException`` on any validation or parse error.
    """
    if allowed_types is None:
        allowed_types = ALLOWED_CONTENT_TYPES

    content_type = file.content_type or ""

    if content_type not in allowed_types and not file.filename.endswith(('.csv', '.json', '.xls', '.xlsx', '.pdf')):
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Please upload a CSV, JSON, PDF, or Excel file.",
        )

    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {settings.MAX_UPLOAD_SIZE_BYTES} bytes.",
        )

    df = _parse_bytes(contents, file.filename, content_type)
    df.columns = df.columns.str.strip()

    if validate_columns:
        df_cols = set(df.columns)
        missing = set(REQUIRED_COLUMNS) - df_cols

        if not _has_minimum_signal(df_cols):
            # Nothing we recognize at all — this almost certainly means
            # the wrong file was uploaded, or extraction failed entirely,
            # rather than "a few optional fields are missing". This is
            # the only case worth a hard rejection.
            raise HTTPException(
                status_code=400,
                detail=(
                    "Could not find any recognizable location, coordinate, "
                    "or water-quality columns in this file. Detected "
                    f"columns: {', '.join(sorted(df_cols)) or '(none)'}."
                ),
            )

        if missing:
            # Partial data is still useful — log it for diagnostics and
            # let the row-level validation (see app/routes/upload.py)
            # flag specific gaps per-record instead of rejecting the
            # whole upload outright.
            logger.info(
                "Upload '%s' is missing %d optional column(s); proceeding "
                "anyway. Missing: %s",
                file.filename,
                len(missing),
                ", ".join(sorted(missing)),
            )

    # Replace nan with None
    df = df.where(pd.notnull(df), None)
    
    return df.to_dict(orient="records")


def _has_minimum_signal(columns: Set[str]) -> bool:
    """True if *columns* contains at least one location, coordinate, or
    measured-parameter field — i.e. there's something worth ingesting."""
    return bool(
        (columns & _LOCATION_COLUMNS)
        or (columns & _COORDINATE_COLUMNS)
        or (columns & _PARAMETER_COLUMNS)
    )

def _parse_bytes(data: bytes, filename: str, content_type: str) -> pd.DataFrame:
    try:
        if filename.endswith(".csv") or content_type in _CSV_TYPES:
            return pd.read_csv(io.StringIO(data.decode("utf-8")))

        if filename.endswith(".json") or content_type in _JSON_TYPES:
            return pd.read_json(io.StringIO(data.decode("utf-8")))

        if filename.endswith(".pdf") or content_type in _PDF_TYPES:
            from app.services.pdf_parser import parse_pdf_bytes
            return parse_pdf_bytes(data, filename)

        if filename.endswith((".xls", ".xlsx")) or content_type in _EXCEL_TYPES:
            return pd.read_excel(io.BytesIO(data))

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("File parse error")
        raise HTTPException(
            status_code=400,
            detail="Error processing file: unable to parse the uploaded data.",
        ) from exc

    raise HTTPException(status_code=415, detail="Unsupported file type.")
