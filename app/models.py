# app/models.py
"""
SQLAlchemy ORM models and database session management.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _utcnow() -> datetime:
    return datetime.now(UTC)


class WaterSample(Base):
    """Raw data for a single water-quality sampling point (CGWB standard)."""

    __tablename__ = "water_samples"

    id: int = Column(Integer, primary_key=True, index=True)

    village_code: str = Column(String, index=True, nullable=True)
    state: str = Column(String, index=True, nullable=True)
    district: str = Column(String, index=True, nullable=True)
    location: str = Column(String, index=True, nullable=True)
    year: int = Column(Integer, index=True, nullable=True)
    source: str = Column(String, nullable=True)

    latitude: float = Column(Float, index=True, nullable=True)
    longitude: float = Column(Float, index=True, nullable=True)

    # High-priority extracted numeric fields for blazing fast API queries
    fe: float = Column(Float, nullable=True)
    as_: float = Column(Float, nullable=True)
    u: float = Column(Float, nullable=True)

    hmpi_bis: float = Column(Float, index=True, nullable=True)
    hei_bis: float = Column(Float, nullable=True)
    pli_bis: float = Column(Float, nullable=True)

    # JSON fallback for dynamic/unstructured payload parts
    parameters_json: str = Column(Text, default="{}")
    standards_json: str = Column(Text, default="{}")
    validation_issues_json: str = Column(Text, default="[]")

    created_at: datetime = Column(DateTime, default=_utcnow)
    updated_at: datetime = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    @property
    def parameters(self) -> dict:
        if not self.parameters_json:
            return {}
        return json.loads(self.parameters_json)

    @parameters.setter
    def parameters(self, value: dict):
        self.parameters_json = json.dumps(value)

    @property
    def standards(self) -> dict:
        if not self.standards_json:
            return {}
        return json.loads(self.standards_json)

    @standards.setter
    def standards(self, value: dict):
        self.standards_json = json.dumps(value)

    @property
    def validation_issues(self) -> list:
        if not self.validation_issues_json:
            return []
        return json.loads(self.validation_issues_json)

    @validation_issues.setter
    def validation_issues(self, value: list):
        self.validation_issues_json = json.dumps(value)

    def __repr__(self) -> str:
        return f"<WaterSample id={self.id} location={self.location} year={self.year}>"


class AlertConfig(Base):
    """Alert thresholds and routing policies. Provider secrets stay in env vars."""

    __tablename__ = "alert_configs"

    id: int = Column(Integer, primary_key=True, index=True)
    hpi_threshold: float = Column(Float, default=100.0)
    cd_threshold: float = Column(Float, default=3.0)
    email_recipients: str = Column(Text, default="")
    sms_recipients: str = Column(Text, default="")
    policy_json: str = Column(Text, default="{}")

    def __repr__(self) -> str:
        return f"<AlertConfig id={self.id} hpi_thr={self.hpi_threshold} cd_thr={self.cd_threshold}>"


class TaskStatus(Base):
    """Tracks the status of background upload-and-calculate jobs."""

    __tablename__ = "task_status"

    id = Column(String, primary_key=True)
    status = Column(String, nullable=False, default="pending")  # pending | processing | completed | failed
    progress = Column(Integer, default=0)  # 0–100
    result_json = Column(Text, default="{}")
    error_message = Column(String, nullable=True)

    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    @property
    def result(self) -> dict:
        if not self.result_json:
            return {}
        return json.loads(self.result_json)

    @result.setter
    def result(self, value: dict):
        self.result_json = json.dumps(value)

    def __repr__(self) -> str:
        return f"<TaskStatus id={self.id} status={self.status} progress={self.progress}>"


def get_db():
    """FastAPI dependency – yields a DB session and ensures cleanup."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
