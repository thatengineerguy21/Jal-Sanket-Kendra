# app/routes/upload.py
"""Upload-and-calculate endpoint."""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app import models
from app.schemas import SampleResponse
from app.services import file_parser, calculation_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/upload-and-calculate/", response_model=List[SampleResponse])
async def create_upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(models.get_db),
) -> list:
    """
    Accept a CSV, JSON, PDF, or Excel file with water-quality data,
    calculate pollution indices, persist everything, and return the records.
    """
    df = await file_parser.parse_upload(file, validate_columns=True)
    samples = calculation_service.process_samples(df, db)
    logger.info("Processed %d samples from upload", len(samples))
    return samples
