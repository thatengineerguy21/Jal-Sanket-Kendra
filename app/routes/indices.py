# app/routes/indices.py
"""Indices summary and datasets endpoints with caching."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.cache import cached_indices, cached_map
from app.schemas import IndicesSummary, MapResponse, PaginatedSampleResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/indices/", response_model=IndicesSummary)
@cached_indices
async def indices_summary(db: Session = Depends(models.get_db)) -> IndicesSummary:
    """Aggregate averages for indices across all stored results using native DB functions."""
    count = db.query(models.WaterSample).count()

    # Count how many records have validation issues
    invalid_count = db.query(models.WaterSample).filter(
        models.WaterSample.validation_issues_json != '[]'
    ).count()

    if count == 0:
        return IndicesSummary(
            count=0, invalid_count=0, avg_hmpi=0.0, avg_pli=0.0,
            avg_hei=0.0, avg_ehci=0.0, avg_hmi=0.0, avg_pmi=0.0,
        )

    # Use extremely fast DB-level aggregations
    avg_hmpi, avg_hei, avg_pli = db.query(
        func.avg(models.WaterSample.hmpi_bis),
        func.avg(models.WaterSample.hei_bis),
        func.avg(models.WaterSample.pli_bis),
    ).first()

    return IndicesSummary(
        count=count,
        invalid_count=invalid_count,
        avg_hmpi=round(avg_hmpi, 3) if avg_hmpi else 0.0,
        avg_pli=round(avg_pli, 3) if avg_pli else 0.0,
        avg_hei=round(avg_hei, 3) if avg_hei else 0.0,
        avg_ehci=0.0, # These are not migrated to Float columns currently
        avg_hmi=0.0,
        avg_pmi=0.0,
    )


@router.get("/datasets/", response_model=PaginatedSampleResponse)
async def list_datasets(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(models.get_db)
) -> dict:
    """Return stored water-sample records with server-side pagination, prioritizing complete ones."""
    total = db.query(models.WaterSample).count()
    # Order by length of validation issues so complete records ("[]") show up first
    samples = db.query(models.WaterSample).order_by(
        func.length(models.WaterSample.validation_issues_json),
        models.WaterSample.id
    ).limit(limit).offset(offset).all()

    return {
        "total": total,
        "items": samples
    }


@router.get("/datasets/map", response_model=MapResponse)
@cached_map
async def get_map_points(
    bbox: str | None = Query(None, description="minLng,minLat,maxLng,maxLat"),
    db: Session = Depends(models.get_db)
) -> dict:
    """Lightweight endpoint for map rendering. Supports viewport bounds filtering."""
    query = db.query(
        models.WaterSample.id,
        models.WaterSample.latitude,
        models.WaterSample.longitude,
        models.WaterSample.hmpi_bis,
        models.WaterSample.state,
        models.WaterSample.district,
        models.WaterSample.location,
    ).filter(models.WaterSample.latitude.isnot(None), models.WaterSample.longitude.isnot(None))

    if bbox:
        try:
            min_lng, min_lat, max_lng, max_lat = map(float, bbox.split(','))
            query = query.filter(
                models.WaterSample.longitude >= min_lng,
                models.WaterSample.longitude <= max_lng,
                models.WaterSample.latitude >= min_lat,
                models.WaterSample.latitude <= max_lat
            )
        except ValueError:
            pass # Ignore invalid bbox and return all points

    # Limit to max 50,000 points to prevent accidental overwhelming
    results = query.limit(50000).all()

    points = [
        {
            "id": r[0],
            "latitude": r[1],
            "longitude": r[2],
            "hmpi_bis": r[3],
            "state": r[4],
            "district": r[5],
            "location": r[6]
        }
        for r in results
    ]

    return {"points": points}
