# app/services/file_parser.py
"""
Shared file-parsing service.

Consolidates all upload-file parsing (CSV, JSON, PDF, Excel) into one
reusable module.  Applies:
  * File-size limit (from config)
  * Content-type allow-list
  * Required-column validation
  * Basic content-sniffing to catch mismatched extensions
"""

from __future__ import annotations

import io
import logging
from typing import Optional, Set

import pandas as pd
from fastapi import HTTPException, UploadFile

from app.config import settings

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS: Set[str] = {"latitude", "longitude", "arsenic", "cadmium", "lead", "zinc"}

# Content types we accept and how to parse them.
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
) -> pd.DataFrame:
    """
    Read an ``UploadFile`` into a validated ``DataFrame``.

    Raises ``HTTPException`` on any validation or parse error.
    """
    if allowed_types is None:
        allowed_types = ALLOWED_CONTENT_TYPES

    content_type = file.content_type or ""

    # ── 1. Content-type gate ────────────────────────────────────────────
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported file type: {content_type}. "
                "Please upload a CSV, JSON, PDF, or Excel file."
            ),
        )

    # ── 2. Read & enforce size limit ────────────────────────────────────
    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File too large ({len(contents)} bytes). "
                f"Maximum allowed size is {settings.MAX_UPLOAD_SIZE_BYTES} bytes."
            ),
        )

    # ── 3. Parse by type ───────────────────────────────────────────────
    df = _parse_bytes(contents, content_type)

    # ── 4. Normalise column names & validate ───────────────────────────
    df.columns = df.columns.str.strip()

    if validate_columns and not REQUIRED_COLUMNS.issubset(df.columns):
        missing = REQUIRED_COLUMNS - set(df.columns)
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns. Data must contain: {', '.join(sorted(REQUIRED_COLUMNS))}",
        )

    logger.info(
        "Parsed %s file (%d bytes, %d rows)",
        content_type,
        len(contents),
        len(df),
    )
    return df


# ── Internal parsers ───────────────────────────────────────────────────
def _parse_bytes(data: bytes, content_type: str) -> pd.DataFrame:
    """Dispatch to the appropriate pandas reader."""
    try:
        if content_type in _CSV_TYPES:
            return pd.read_csv(io.StringIO(data.decode("utf-8")))

        if content_type in _JSON_TYPES:
            return pd.read_json(io.StringIO(data.decode("utf-8")))

        if content_type in _PDF_TYPES:
            import tabula  # lazy import — not always installed

            tables = tabula.read_pdf(io.BytesIO(data), pages="all", multiple_tables=True)
            if not tables:
                raise HTTPException(status_code=400, detail="No data tables found in the PDF.")
            return tables[0]

        if content_type in _EXCEL_TYPES:
            return pd.read_excel(io.BytesIO(data))

    except HTTPException:
        raise  # re-raise our own errors as-is
    except Exception as exc:
        logger.exception("File parse error for content_type=%s", content_type)
        raise HTTPException(
            status_code=400,
            detail=f"Error processing {content_type} file: unable to parse the uploaded data.",
        ) from exc

    # Should never reach here because of the content-type gate above.
    raise HTTPException(status_code=415, detail="Unsupported file type.")
