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
    """Aggregate averages for indices across all stored results."""
    samples = db.query(models.WaterSample).all()
    if not samples:
        return IndicesSummary(
            count=0, avg_hmpi=0.0, avg_pli=0.0,
            avg_hei=0.0, avg_ehci=0.0, avg_hmi=0.0, avg_pmi=0.0,
        )

    n = len(samples)
    def get_index(s, index_name, default_std="BIS"):
        std_dict = s.standards.get(default_std)
        if isinstance(std_dict, dict):
            val = std_dict.get(index_name)
            if val is None:
                return 0.0
            if isinstance(val, dict):
                return sum(val.values()) if val else 0.0
            return float(val)
        return 0.0

    avg_hmpi = sum(get_index(s, 'hmpi') for s in samples) / n
    avg_hei = sum(get_index(s, 'hei') for s in samples) / n
    avg_pli = sum(get_index(s, 'pli') for s in samples) / n
    avg_ehci = sum(get_index(s, 'ehci') for s in samples) / n
    avg_hmi = sum(get_index(s, 'hmi') for s in samples) / n
    avg_pmi = sum(get_index(s, 'pmi') for s in samples) / n

    return IndicesSummary(
        count=n,
        avg_hmpi=round(avg_hmpi, 3),
        avg_pli=round(avg_pli, 3),
        avg_hei=round(avg_hei, 3),
        avg_ehci=round(avg_ehci, 3),
        avg_hmi=round(avg_hmi, 3),
        avg_pmi=round(avg_pmi, 3),
    )


@router.get("/datasets/", response_model=List[SampleResponse])
async def list_datasets(db: Session = Depends(models.get_db)) -> list:
    """Return all stored water-sample records."""
    samples = db.query(models.WaterSample).all()
    return samples
