# app/schemas.py
"""
Pydantic schemas shared across route modules.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field
from typing import Dict, List, Optional, Any
from datetime import datetime


# ── Upload / Sample ────────────────────────────────────────────────────
class IndicesSet(BaseModel):
    ci: Dict[str, float] = {}
    ehci: Dict[str, float] = {}
    hei: Optional[float] = None
    pli: Optional[float] = None
    hmpi: Optional[float] = None
    hi: Optional[float] = None


class SampleResponse(BaseModel):
    id: int
    village_code: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    location: Optional[str] = None
    year: Optional[int] = None
    source: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    parameters: Dict[str, Any] = Field(default_factory=dict)
    standards: Dict[str, Any] = Field(default_factory=dict)
    validation_issues: List[str] = Field(default_factory=list)
    
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # coordinates mapped for the frontend
    coordinates: Optional[Dict[str, List[float]]] = None

    model_config = ConfigDict(from_attributes=True)


# ── Indices ─────────────────────────────────────────────────────────────
class IndicesSummary(BaseModel):
    count: int
    avg_hmpi: float = 0.0
    avg_hei: float = 0.0
    avg_pli: float = 0.0
    avg_ehci: float = 0.0
    avg_hmi: float = 0.0
    avg_pmi: float = 0.0


# ── Quick Calculator ───────────────────────────────────────────────────
class QuickCalcRequest(BaseModel):
    """Request body for the quick calculator endpoint."""
    metals: Dict[str, float]
    standard: str = "BIS"


class QuickCalcResponse(BaseModel):
    """Response from the quick calculator endpoint."""
    indices: Dict[str, Any]
    standard: str


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
