# app/api.py
"""
Backward-compatibility shim.

The monolithic router has been split into app.routes.*.  This module
re-exports a single ``router`` that aggregates them all so that any
code that does ``from app import api; api.router`` keeps working
(including main.py and the test suite).
"""

from __future__ import annotations

from fastapi import APIRouter

from app.routes import upload, predict, indices, alerts, health, quickcalc

# Re-export schemas that tests or external code may have imported from here.
from app.schemas import (  # noqa: F401
    SampleResponse,
    IndicesSummary,
    PredictionResult,
    AlertConfigDTO,
    AlertSendRequest,
    QuickCalcRequest,
    QuickCalcResponse,
)

router = APIRouter()
router.include_router(upload.router)
router.include_router(predict.router)
router.include_router(indices.router)
router.include_router(alerts.router)
router.include_router(health.router)
router.include_router(quickcalc.router)