# app/services/calculation_service.py
"""
Service layer wrapping calculator functions.

Handles per-row error isolation and structured logging so that route
handlers stay thin.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Mapping, Tuple

import pandas as pd
from sqlalchemy.orm import Session

from app import calculator, models

logger = logging.getLogger(__name__)


def process_samples(df: pd.DataFrame, db: Session) -> List[models.WaterSample]:
    """
    Iterate over *df*, compute indices, persist rows, return hydrated samples.

    Each row is processed in the same DB transaction.  Any per-row failure
    is logged and skipped (fail-open per row, not per file).
    """
    processed: List[models.WaterSample] = []

    for _idx, row in df.iterrows():
        try:
            sample = _persist_sample(row, db)
            processed.append(sample)
        except Exception:
            logger.exception("Failed to process row %s", _idx)
            continue

    db.commit()

    for sample in processed:
        db.refresh(sample)

    return processed


def predict_hotspots(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Pure-computation prediction — no DB needed.

    Returns a list of dicts compatible with ``PredictionResult``.
    """
    permissible = calculator.PERMISSIBLE_VALUES
    weights: Dict[str, float] = {
        "arsenic": 0.35,
        "cadmium": 0.25,
        "lead": 0.30,
        "zinc": 0.10,
    }

    predictions: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        try:
            risk = _compute_risk(row, permissible, weights)
            risk_score = float(round(1 - (1 / (1 + risk)), 3))
            category = _risk_category(risk_score)
            predictions.append(
                {
                    "latitude": float(row["latitude"]),
                    "longitude": float(row["longitude"]),
                    "risk_score": risk_score,
                    "risk_category": category,
                }
            )
        except Exception:
            logger.warning("Skipping unparseable prediction row", exc_info=True)
            continue

    return predictions


# ── Internal helpers ────────────────────────────────────────────────────
def _persist_sample(row: Mapping[str, Any], db: Session) -> models.WaterSample:
    """Create WaterSample + PollutionResult for a single row."""
    sample = models.WaterSample(
        latitude=row["latitude"],
        longitude=row["longitude"],
        arsenic=row.get("arsenic"),
        cadmium=row.get("cadmium"),
        lead=row.get("lead"),
        zinc=row.get("zinc"),
    )
    db.add(sample)
    db.flush()

    hpi_value, hpi_cat = calculator.calculate_hpi(row)
    cd_value, cd_cat = calculator.calculate_degree_of_contamination(row)

    result = models.PollutionResult(
        sample_id=sample.id,
        heavy_metal_pollution_index=hpi_value,
        hpi_category=hpi_cat,
        degree_of_contamination=cd_value,
        cd_category=cd_cat,
    )
    db.add(result)
    return sample


def _compute_risk(
    row: Mapping[str, Any],
    permissible: Dict[str, int],
    weights: Dict[str, float],
) -> float:
    """Weighted contamination-factor sum (sigmoid input)."""
    risk: float = 0.0
    for metal, perm in permissible.items():
        val = row.get(metal)
        if val is not None and pd.notna(val):
            risk += weights.get(metal, 0) * (float(val) / perm)
    return risk


def _risk_category(score: float) -> str:
    if score < 0.33:
        return "Low risk"
    elif score < 0.66:
        return "Moderate risk"
    return "High risk"
