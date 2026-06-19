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
    "parameters.total_hardness",
    "parameters.Ca",
    "parameters.Mg",
    "parameters.Na",
    "parameters.K",
    "parameters.Fe",
    "parameters.U",
    "parameters.As",
    "source",
]

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
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns. Extra columns and any order are allowed. Missing: {', '.join(missing)}",
            )

    # Replace nan with None
    df = df.where(pd.notnull(df), None)
    
    return df.to_dict(orient="records")

def _parse_bytes(data: bytes, filename: str, content_type: str) -> pd.DataFrame:
    try:
        if filename.endswith(".csv") or content_type in _CSV_TYPES:
            return pd.read_csv(io.StringIO(data.decode("utf-8")))

        if filename.endswith(".json") or content_type in _JSON_TYPES:
            return pd.read_json(io.StringIO(data.decode("utf-8")))

        if filename.endswith(".pdf") or content_type in _PDF_TYPES:
            import tabula
            tables = tabula.read_pdf(io.BytesIO(data), pages="all", multiple_tables=True)
            if not tables:
                raise HTTPException(status_code=400, detail="No data tables found in the PDF.")
            return tables[0]

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
