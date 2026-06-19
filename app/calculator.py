# app/calculator.py
"""
Pollution-index calculation functions.

Computes 6 water quality indices:
  1. HPI  — Heavy Metal Pollution Index
  2. CD   — Contamination Index (Degree of Contamination)
  3. HEI  — Heavy Metal Evaluation Index
  4. EHCI — Entropy-Based Heavy Metal Contamination Index
  5. HMI  — Heavy Metal Index (toxicity-weighted)
  6. PMI  — PCA-Based Metal Index

Changes from v2:
- Uses app.standards for WHO/BIS limits
- Supports selectable standard ('BIS' or 'WHO')
- 6 indices instead of 2
- Metal name-to-symbol mapping for flexible input
- Backward-compatible function signatures
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, Mapping, Optional, Tuple

import pandas as pd

from app.standards import (
    STANDARDS,
    EHCI_WEIGHTS,
    HMI_WEIGHTS,
    PMI_FACTOR_SCORES,
    NSPMI_MIN,
    NSPMI_MAX,
)

logger = logging.getLogger(__name__)

# ── Metal Name ↔ Symbol Mapping ────────────────────────────────────────
# Our CSV/data columns use lowercase names; standards use chemical symbols.
METAL_NAME_TO_SYMBOL: Dict[str, str] = {
    "arsenic": "As",
    "cadmium": "Cd",
    "lead": "Pb",
    "zinc": "Zn",
}

METAL_SYMBOL_TO_NAME: Dict[str, str] = {v: k for k, v in METAL_NAME_TO_SYMBOL.items()}

# ── Backward-Compatibility Constants ──────────────────────────────────
# Legacy permissible values in µg/L (kept for external code that imports them).
PERMISSIBLE_VALUES: Dict[str, int] = {
    "arsenic": 10,
    "cadmium": 3,
    "lead": 10,
    "zinc": 5000,
}

UNIT_WEIGHTAGE: Dict[str, float] = {
    metal: 1.0 / value for metal, value in PERMISSIBLE_VALUES.items()
}


# ── Helpers ─────────────────────────────────────────────────────────────
def _safe_value(row: Mapping[str, Any], key: str) -> float | None:
    """Return a valid non-negative finite float, or None."""
    if key not in row:
        return None
    val = row[key]
    # pandas NaN check (works for plain floats too)
    if val is None or (isinstance(val, float) and (math.isnan(val) or math.isinf(val))):
        return None
    # Also handle pandas NA-likes
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    val = float(val)
    if val < 0:
        logger.warning("Negative %s value (%.4f) clamped to 0", key, val)
        return 0.0
    return val


def _resolve_metals(row: Mapping[str, Any]) -> Dict[str, float]:
    """
    Extract metal concentrations from *row*, returning a dict keyed by
    chemical symbol (e.g. ``'As'``, ``'Pb'``).

    Accepts rows with either lowercase names (``'arsenic'``) or chemical
    symbols (``'As'``).  Symbol-keyed values take precedence when both are
    present.
    """
    metals: Dict[str, float] = {}

    # First pass: lowercase names → symbols
    for name, symbol in METAL_NAME_TO_SYMBOL.items():
        val = _safe_value(row, name)
        if val is not None:
            metals[symbol] = val / 1000.0  # Convert µg/L to mg/L

    # Second pass: direct symbol keys (override names if both present)
    for symbol in STANDARDS.get("BIS", {}):
        val = _safe_value(row, symbol)
        if val is not None:
            # Assume direct symbols might be mg/L or µg/L?
            # If the user uploads CSV with 'As', 'Cd' it's probably µg/L too.
            metals[symbol] = val / 1000.0  # Convert µg/L to mg/L

    return metals


# ── Index Calculations ─────────────────────────────────────────────────
def calculate_hpi(row: Mapping[str, Any], standard: str = "BIS") -> Tuple[float, str]:
    """
    Heavy Metal Pollution Index (HPI).

    Uses the standard HPI formula:
        Wi = 1 / Si
        Qi = 100 * (Oi - Ii) / (Si - Ii), clamped >= 0
    Fallback when Si == Ii (No Relaxation):
        Qi = 100 * max(0, Oi/Si - 1)

    Returns ``(hpi_value, category_string)`` with 5-level classification.
    """
    std = STANDARDS.get(standard, STANDARDS["BIS"])
    metals = _resolve_metals(row)

    if not metals:
        return 0.0, "No Data"

    wi_sum: float = 0.0
    wiqi_sum: float = 0.0

    for symbol, oi in metals.items():
        if symbol not in std:
            continue

        si = std[symbol]["Si"]
        ii = std[symbol]["Ii"]

        if si is None or ii is None or not si:
            continue

        wi = 1.0 / si

        if si == ii:
            # No Relaxation fallback
            qi = 100.0 * ((oi / si) - 1.0) if oi > si else 0.0
        else:
            qi = max(0.0, 100.0 * (oi - ii) / (si - ii))

        wi_sum += wi
        wiqi_sum += wi * qi

    if wi_sum == 0:
        return 0.0, "No Data"

    hpi_value = round(wiqi_sum / wi_sum, 2)

    # 5-level HPI classification
    if hpi_value < 25:
        category = "Excellent"
    elif hpi_value < 50:
        category = "Good"
    elif hpi_value < 75:
        category = "Poor"
    elif hpi_value < 100:
        category = "Very Poor"
    else:
        category = "Unsuitable"

    return hpi_value, category


def calculate_cd(row: Mapping[str, Any], standard: str = "BIS") -> Tuple[float, str]:
    """
    Contamination Index (CI / Degree of Contamination).

    CI = Σ max((Oi / Si) - 1, 0) for each metal.

    Returns ``(cd_value, category_string)`` with 3-level classification.
    """
    std = STANDARDS.get(standard, STANDARDS["BIS"])
    metals = _resolve_metals(row)

    cd_value: float = 0.0

    for symbol, oi in metals.items():
        if symbol not in std:
            continue
        si = std[symbol]["Si"]
        if si is None or not si:
            continue
        cd_value += max((oi / si) - 1.0, 0.0)

    if cd_value < 1:
        category = "Low degree of contamination"
    elif cd_value < 3:
        category = "Moderate degree of contamination"
    else:
        category = "High degree of contamination"

    return round(cd_value, 2), category


# Backward-compatible alias
calculate_degree_of_contamination = calculate_cd


def calculate_hei(row: Mapping[str, Any], standard: str = "BIS") -> float:
    """
    Heavy Metal Evaluation Index (HEI).

    HEI = Σ (Oi / Si) for each metal.
    """
    std = STANDARDS.get(standard, STANDARDS["BIS"])
    metals = _resolve_metals(row)

    hei: float = 0.0

    for symbol, oi in metals.items():
        if symbol not in std:
            continue
        si = std[symbol]["Si"]
        if si is None or not si:
            continue
        hei += oi / si

    return round(hei, 4)


def calculate_ehci(row: Mapping[str, Any], standard: str = "BIS") -> float:
    """
    Entropy-Based Heavy Metal Contamination Index (EHCI).

    Weighted sum of Qi values using entropy-derived weights.
    Skips metals with Si == Ii (No Relaxation).
    """
    std = STANDARDS.get(standard, STANDARDS["BIS"])
    metals = _resolve_metals(row)

    ehci: float = 0.0

    for symbol, oi in metals.items():
        if symbol not in std or symbol not in EHCI_WEIGHTS:
            continue

        si = std[symbol]["Si"]
        ii = std[symbol]["Ii"]

        if si is None or ii is None or si == ii:
            continue

        qi = max(0.0, 100.0 * (oi - ii) / (si - ii))
        ehci += EHCI_WEIGHTS[symbol] * qi

    return round(ehci, 4)


def calculate_hmi(row: Mapping[str, Any], standard: str = "BIS") -> float:
    """
    Heavy Metal Index (HMI) — toxicity-weighted.

    HMI = Σ Wi * (Oi / Si) for each metal (using toxicity weights).
    """
    std = STANDARDS.get(standard, STANDARDS["BIS"])
    metals = _resolve_metals(row)

    hmi: float = 0.0

    for symbol, oi in metals.items():
        if symbol not in std or symbol not in HMI_WEIGHTS:
            continue

        si = std[symbol]["Si"]
        if si is None or not si:
            continue

        hmi += HMI_WEIGHTS[symbol] * (oi / si)

    return round(hmi, 4)


def calculate_pmi(row: Mapping[str, Any], standard: str = "BIS") -> float:
    """
    PCA-Based Metal Index (PMI) — normalized factor-score weighted.

    Uses PCA factor scores to weight each metal's contribution,
    then normalizes to [0, 1] range.
    """
    metals = _resolve_metals(row)

    vt = sum(metals.values())

    if vt == 0:
        return 0.0

    nspmi = sum(
        PMI_FACTOR_SCORES.get(symbol, 0.0) * (oi / vt)
        for symbol, oi in metals.items()
    )

    pmi = (nspmi - NSPMI_MIN) / (NSPMI_MAX - NSPMI_MIN)
    pmi = max(0.0, pmi)

    return round(pmi, 4)


def calculate_all_indices(
    row: Mapping[str, Any],
    standard: str = "BIS",
) -> Dict[str, Any]:
    """
    Compute all 6 indices and return a dict with values and categories.

    Returns::

        {
            "hpi": float, "hpi_category": str,
            "cd": float, "cd_category": str,
            "hei": float, "ehci": float,
            "hmi": float, "pmi": float,
            "reduced_parameter_set": bool,
            "missing_parameters": list,
        }
    """
    std = STANDARDS.get(standard, STANDARDS["BIS"])
    metals = _resolve_metals(row)
    
    expected_metals = set(std.keys())
    provided_metals = set(metals.keys())
    missing_metals = list(expected_metals - provided_metals)
    reduced_parameter_set = len(missing_metals) > 0

    if reduced_parameter_set:
        logger.warning("Historical index was computed with a reduced parameter set. Missing: %s", missing_metals)

    hpi_value, hpi_cat = calculate_hpi(row, standard)
    cd_value, cd_cat = calculate_cd(row, standard)

    return {
        "hpi": hpi_value,
        "hpi_category": hpi_cat,
        "cd": cd_value,
        "cd_category": cd_cat,
        "hei": calculate_hei(row, standard),
        "ehci": calculate_ehci(row, standard),
        "hmi": calculate_hmi(row, standard),
        "pmi": calculate_pmi(row, standard),
        "reduced_parameter_set": reduced_parameter_set,
        "missing_parameters": missing_metals,
    }