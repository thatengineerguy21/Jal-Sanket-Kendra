# app/schemas.py
"""
Pydantic schemas shared across route modules.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ── Upload / Sample ────────────────────────────────────────────────────
class IndicesSet(BaseModel):
    ci: dict[str, float] = {}
    ehci: dict[str, float] = {}
    hei: float | None = None
    pli: float | None = None
    hmpi: float | None = None
    hi: float | None = None


class SampleResponse(BaseModel):
    id: int
    village_code: str | None = None
    state: str | None = None
    district: str | None = None
    location: str | None = None
    year: int | None = None
    source: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    # New dedicated DB columns
    fe: float | None = None
    as_: float | None = None
    u: float | None = None
    hmpi_bis: float | None = None
    hei_bis: float | None = None
    pli_bis: float | None = None

    parameters: dict[str, Any] = Field(default_factory=dict)
    standards: dict[str, Any] = Field(default_factory=dict)
    validation_issues: list[str] = Field(default_factory=list)

    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedSampleResponse(BaseModel):
    total: int
    items: list[SampleResponse]


class UploadResponse(BaseModel):
    file_id: str
    filename: str

class CalculateResponse(BaseModel):
    message: str
    rows_processed: int
    rows_inserted: int

class MapPointResponse(BaseModel):
    id: int
    latitude: float
    longitude: float
    hmpi_bis: float | None = None
    state: str | None = None
    district: str | None = None
    location: str | None = None


class MapResponse(BaseModel):
    points: list[MapPointResponse]


# ── Indices ─────────────────────────────────────────────────────────────
class IndicesSummary(BaseModel):
    count: int
    invalid_count: int = 0
    avg_hmpi: float = 0.0
    avg_hei: float = 0.0
    avg_pli: float = 0.0
    avg_ehci: float = 0.0
    avg_hmi: float = 0.0
    avg_pmi: float = 0.0


# ── Quick Calculator ───────────────────────────────────────────────────
class QuickCalcRequest(BaseModel):
    """Request body for the quick calculator endpoint."""
    metals: dict[str, float]
    standard: str = "BIS"


class QuickCalcResponse(BaseModel):
    """Response from the quick calculator endpoint."""
    indices: dict[str, Any]
    standard: str
    reduced_parameter_set: bool = False
    missing_parameters: list[str] = Field(default_factory=list)


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


# ── Background Tasks ───────────────────────────────────────────────────
class TaskAcceptedResponse(BaseModel):
    """Returned immediately when an upload is accepted for background processing."""
    task_id: str
    status: str = "pending"
    poll_url: str


class TaskStatusResponse(BaseModel):
    """Full status of a background task, returned by the polling endpoint."""
    task_id: str
    status: str  # pending | processing | completed | failed
    progress: int = 0
    result: dict[str, Any] | None = None
    error_message: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)

