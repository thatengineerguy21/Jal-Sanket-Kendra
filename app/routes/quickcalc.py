# app/routes/quickcalc.py
"""Quick calculator endpoint — pure computation, no DB persistence."""

from __future__ import annotations

import logging

from fastapi import APIRouter

from app import calculator
from app.schemas import QuickCalcRequest, QuickCalcResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/quickcalc/", response_model=QuickCalcResponse)
async def quick_calculate(request: QuickCalcRequest) -> QuickCalcResponse:
    """
    Compute all 6 water quality indices from metal concentrations.

    Accepts metal concentrations as a dict (keyed by chemical symbol or
    lowercase name) and an optional standard ('BIS' or 'WHO').
    No data is persisted — pure computation.
    """
    indices = calculator.calculate_all_indices(request.metals, request.standard)

    return QuickCalcResponse(
        indices=indices,
        standard=request.standard,
    )
