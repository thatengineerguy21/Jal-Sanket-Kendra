# app/services/calculation_service.py
"""
Service layer wrapping calculator functions based on CGWB standard.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Mapping, Tuple
import pandas as pd
from sqlalchemy.orm import Session
from datetime import datetime

from app import models

logger = logging.getLogger(__name__)

from app.standards import STANDARDS, RFD

# Constants for Heavy Metals dynamically loaded from standards
WHO_LIMITS_METALS = {k: v["Si"] for k, v in STANDARDS.get("WHO", {}).items() if "Si" in v}
BIS_LIMITS_METALS = {k: v["Si"] for k, v in STANDARDS.get("BIS", {}).items() if "Si" in v}

def safe_div(a: float, b: float):
    try:
        return a / b if b else None
    except Exception:
        return None

def calc_ci(params: Dict[str, float], limits: Dict[str, float]) -> Dict[str, float]:
    ci: Dict[str, float] = {}
    for metal, std in limits.items():
        if metal in params and params[metal] is not None:
            val = safe_div(params[metal], std)
            if val is not None:
                ci[metal] = val
    return ci

def calc_ehci(ci: Dict[str, float]) -> Dict[str, float]:
    return {m: v ** 2 for m, v in ci.items()}

def calc_hei(ci: Dict[str, float]):
    if not ci:
        return None
    return sum(ci.values())

def calc_pli(ci: Dict[str, float]):
    if not ci:
        return None
    vals = [v for v in ci.values() if v >= 0]
    if not vals:
        return None
    product = 1.0
    for v in vals:
        product *= v
    if product == 0:
        return 0.0
    return product ** (1.0 / len(vals))

def calc_hmpi(params: Dict[str, float], limits: Dict[str, float]):
    numerator = 0.0
    denominator = 0.0
    for metal, std in limits.items():
        if metal in params and params[metal] is not None and std:
            C = params[metal]
            Q = (C / std) * 100.0
            W = 1.0 / std
            numerator += W * Q
            denominator += W
    if denominator == 0:
        return None
    return numerator / denominator

def calc_hi(params: Dict[str, float], rfd: Dict[str, float]):
    total = 0.0
    count = 0
    for metal, R in rfd.items():
        if metal in params and params[metal] is not None and R:
            total += params[metal] / R
            count += 1
    return total if count else None

def convert_units_for_metals(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert ppb → mg/L for trace metals commonly reported in ppb.
    Fe, Mn, Zn, Cu are assumed to be mg/L (ppm) and kept as is.
    """
    converted = dict(params)
    trace_metals_in_ppb = ["As", "U", "Pb", "Cd", "Cr", "Hg", "Ni"]

    for metal in trace_metals_in_ppb:
        if metal in converted and converted[metal] is not None:
            converted[metal] = converted[metal] / 1000.0  # ppb → mg/L

    return converted


def get_missing_metals(params: Dict[str, Any], limits: Dict[str, float]) -> List[str]:
    """Return a list of expected metals that are missing or None in the params."""
    missing = []
    for metal in limits.keys():
        if metal not in params or params[metal] is None:
            missing.append(metal)
    return missing


def predict_hotspots(rows: List[Mapping]) -> List[Dict[str, Any]]:
    """
    Compute per-location pollution risk predictions from uploaded data.

    For each row, extracts lat/lon and metal concentrations (Fe, As, U),
    computes HMPI against BIS standards, and classifies the risk level.

    Returns a list of dicts matching the ``PredictionResult`` schema:
    ``{latitude, longitude, risk_score, risk_category}``.
    """
    results: List[Dict[str, Any]] = []

    for row in rows:
        # ── Extract coordinates ────────────────────────────────────
        raw_lon = row.get("coordinates.coordinates[0]")
        raw_lat = row.get("coordinates.coordinates[1]")

        if raw_lat is None or raw_lon is None:
            continue

        try:
            lat = float(raw_lat)
            lon = float(raw_lon)
        except (ValueError, TypeError):
            logger.warning("Skipping row with invalid coordinates: lat=%s, lon=%s", raw_lat, raw_lon)
            continue

        # ── Extract metal concentrations ───────────────────────────
        metal_raw: Dict[str, float] = {}
        for key in ("Fe", "As", "U"):
            param_key = f"parameters.{key}"
            val = row.get(param_key)
            if val is not None:
                try:
                    metal_raw[key] = float(val)
                except (ValueError, TypeError):
                    pass

        metals_mgL = convert_units_for_metals(metal_raw)

        if not metals_mgL:
            results.append({
                "latitude": lat,
                "longitude": lon,
                "risk_score": 0.0,
                "risk_category": "Unknown",
            })
            continue

        # ── Compute risk score via HMPI ────────────────────────────
        hmpi = calc_hmpi(metals_mgL, BIS_LIMITS_METALS)
        risk_score = round(hmpi, 2) if hmpi is not None else 0.0

        if risk_score < 25:
            category = "Low"
        elif risk_score < 50:
            category = "Moderate"
        elif risk_score < 75:
            category = "High"
        else:
            category = "Critical"

        results.append({
            "latitude": lat,
            "longitude": lon,
            "risk_score": risk_score,
            "risk_category": category,
        })

    logger.info("Predicted %d hotspots from %d rows", len(results), len(rows))
    return results
