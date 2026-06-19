# app/models.py
"""
SQLAlchemy ORM models and database session management.
"""

from __future__ import annotations
import json
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class WaterSample(Base):
    """Raw data for a single water-quality sampling point (CGWB standard)."""

    __tablename__ = "water_samples"

    id: int = Column(Integer, primary_key=True, index=True)
    
    village_code: str = Column(String, nullable=True)
    state: str = Column(String, nullable=True)
    district: str = Column(String, nullable=True)
    location: str = Column(String, nullable=True)
    year: int = Column(Integer, nullable=True)
    source: str = Column(String, nullable=True)

    latitude: float = Column(Float, nullable=True)
    longitude: float = Column(Float, nullable=True)

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
        return (
            f"<WaterSample id={self.id} location={self.location} "
            f"year={self.year}>"
        )


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
        return (
            f"<AlertConfig id={self.id} hpi_thr={self.hpi_threshold} "
            f"cd_thr={self.cd_threshold}>"
        )


def get_db():
    """FastAPI dependency – yields a DB session and ensures cleanup."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()