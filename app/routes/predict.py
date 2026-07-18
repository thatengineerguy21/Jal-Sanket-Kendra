# app/routes/predict.py
"""Predict-hotspots endpoint."""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, UploadFile

from app.schemas import PredictionResult
from app.services import calculation_service, file_parser

logger = logging.getLogger(__name__)
router = APIRouter()

# Prediction only supports CSV and JSON (no PDF/Excel) — matches original behaviour.
_PREDICT_TYPES = {"text/csv", "application/json"}


@router.post("/predict-hotspots/", response_model=list[PredictionResult])
async def predict_hotspots(
    file: UploadFile = File(...),
) -> list:
    """
    Accept a CSV or JSON file and return per-location risk predictions.
    """
    df = await file_parser.parse_upload(
        file,
        allowed_types=_PREDICT_TYPES,
        validate_columns=True,
    )
    predictions = calculation_service.predict_hotspots(df)
    logger.info("Generated %d hotspot predictions", len(predictions))
    return predictions
