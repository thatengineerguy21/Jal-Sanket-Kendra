# app/schemas.py
"""
Pydantic schemas shared across route modules.

Kept in one place so multiple routers can import them without circular deps.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field
from typing import List


# ── Upload / Sample ────────────────────────────────────────────────────
class CalculationResult(BaseModel):
    heavy_metal_pollution_index: float
    hpi_category: str
    degree_of_contamination: float
    cd_category: str


class SampleResponse(BaseModel):
    id: int
    latitude: float
    longitude: float
    arsenic: float
    cadmium: float
    lead: float
    zinc: float
    result: CalculationResult

    model_config = ConfigDict(from_attributes=True)


# ── Indices ─────────────────────────────────────────────────────────────
class IndicesSummary(BaseModel):
    count: int
    avg_hpi: float
    avg_cd: float


# ── Predictions ─────────────────────────────────────────────────────────
class PredictionResult(BaseModel):
    latitude: float
    longitude: float
    risk_score: float
    risk_category: str


# ── Alerts ──────────────────────────────────────────────────────────────
class AlertConfigDTO(BaseModel):
    hpi_threshold: float = Field(..., gt=0, description="Must be positive")
    cd_threshold: float = Field(..., gt=0, description="Must be positive")
    email_recipients: str = ""
    sms_recipients: str = ""
    policy_json: str = "{}"


class AlertSendRequest(BaseModel):
    channel: str = Field(..., pattern=r"^(email|sms)$")
    message: str = Field(..., min_length=1, max_length=2000)


# ── Health ──────────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
