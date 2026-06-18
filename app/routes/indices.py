# app/routes/indices.py
"""Indices summary and datasets endpoints."""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models
from app.schemas import IndicesSummary, SampleResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/indices/", response_model=IndicesSummary)
async def indices_summary(db: Session = Depends(models.get_db)) -> IndicesSummary:
    """Aggregate HPI and Cd averages across all stored results."""
    samples = db.query(models.PollutionResult).all()
    if not samples:
        return IndicesSummary(count=0, avg_hpi=0.0, avg_cd=0.0)
    avg_hpi = sum(s.heavy_metal_pollution_index or 0 for s in samples) / len(samples)
    avg_cd = sum(s.degree_of_contamination or 0 for s in samples) / len(samples)
    return IndicesSummary(
        count=len(samples),
        avg_hpi=round(avg_hpi, 3),
        avg_cd=round(avg_cd, 3),
    )


@router.get("/datasets/", response_model=List[SampleResponse])
async def list_datasets(db: Session = Depends(models.get_db)) -> list:
    """Return all stored water-sample records with their pollution results."""
    samples = db.query(models.WaterSample).all()
    for s in samples:
        _ = s.result  # force-load the lazy relationship
    return samples
