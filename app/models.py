# app/models.py
"""
SQLAlchemy ORM models and database session management.

Changes from v1:
- Removed duplicate imports
- DATABASE_URL sourced from app.config
- Cascade delete on WaterSample → PollutionResult
- Removed dead User model (auth was removed)
- Added created_at / updated_at timestamps
- Added __repr__ methods
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    event,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session

from app.config import settings

# ── Engine & Session ────────────────────────────────────────────────────
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── Helpers ─────────────────────────────────────────────────────────────
def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Models ──────────────────────────────────────────────────────────────
class WaterSample(Base):
    """Raw data for a single water-quality sampling point."""

    __tablename__ = "water_samples"

    id: int = Column(Integer, primary_key=True, index=True)
    latitude: float = Column(Float, nullable=False)
    longitude: float = Column(Float, nullable=False)

    # Metal concentrations in µg/L
    arsenic: float = Column(Float, name="As")
    cadmium: float = Column(Float, name="Cd")
    lead: float = Column(Float, name="Pb")
    zinc: float = Column(Float, name="Zn")

    created_at: datetime = Column(DateTime, default=_utcnow)
    updated_at: datetime = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # cascade + delete-orphan so deleting a sample removes its result row.
    result = relationship(
        "PollutionResult",
        back_populates="sample",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<WaterSample id={self.id} lat={self.latitude} lon={self.longitude}>"
        )


class PollutionResult(Base):
    """Calculated pollution indices for a corresponding water sample."""

    __tablename__ = "pollution_results"

    id: int = Column(Integer, primary_key=True, index=True)
    sample_id: int = Column(Integer, ForeignKey("water_samples.id"), nullable=False)

    heavy_metal_pollution_index: float = Column(Float, name="HPI")
    hpi_category: str = Column(String)

    degree_of_contamination: float = Column(Float, name="Cd_value")
    cd_category: str = Column(String)

    created_at: datetime = Column(DateTime, default=_utcnow)
    updated_at: datetime = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    sample = relationship("WaterSample", back_populates="result")

    def __repr__(self) -> str:
        return (
            f"<PollutionResult id={self.id} sample_id={self.sample_id} "
            f"hpi={self.heavy_metal_pollution_index}>"
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


# ── Dependency ──────────────────────────────────────────────────────────
def get_db():
    """FastAPI dependency – yields a DB session and ensures cleanup."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()