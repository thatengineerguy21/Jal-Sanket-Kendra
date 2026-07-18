# app/standards.py
"""
WHO and BIS drinking water quality standards for heavy metals.

All concentration values are in mg/L.

Sources:
  - BIS IS 10500:2012 (Reaffirmed 2020, with Amendments 1, 2, & 3)
  - WHO Drinking Water Guidelines (Based on CPCB 2019 Data)

Each entry contains:
  Si — Permissible limit (Maximum Permissible Limit)
  Ii — Ideal/desirable limit (Acceptable Limit)
"""

from __future__ import annotations

# ── Drinking Water Standards ───────────────────────────────────────────
STANDARDS: dict[str, dict[str, dict[str, float]]] = {
    # ----------------------------------------------------------
    # BIS IS 10500:2012 (Reaffirmed 2020, with Amendments 1, 2, & 3)
    # Ii = Acceptable Limit (Desirable Limit)
    # Si = Permissible Limit in the Absence of Alternate Source
    # Note: "No Relaxation" implies Si should theoretically equal Ii.
    # ----------------------------------------------------------
    "BIS": {
        # Toxic metals
        "Pb": {"Si": 0.01, "Ii": 0.01},    # Lead (No Relaxation)
        "Cd": {"Si": 0.003, "Ii": 0.003},   # Cadmium (No Relaxation)
        "Cr": {"Si": 0.05, "Ii": 0.05},     # Total Chromium (No Relaxation)
        "As": {"Si": 0.01, "Ii": 0.01},     # Arsenic (No Relaxation)
        "Hg": {"Si": 0.001, "Ii": 0.001},   # Mercury (No Relaxation)
        "Ni": {"Si": 0.02, "Ii": 0.02},     # Nickel (No Relaxation)
        "U":  {"Si": 0.03, "Ii": 0.03},     # Uranium (No Relaxation)

        # Aesthetic/Essential metals
        "Fe": {"Si": 0.3, "Ii": 0.3},       # Iron (No Relaxation)
        "Mn": {"Si": 0.3, "Ii": 0.1},       # Manganese
        "Zn": {"Si": 15.0, "Ii": 5.0},      # Zinc
        "Cu": {"Si": 1.5, "Ii": 0.05},      # Copper
    },

    # ----------------------------------------------------------
    # WHO Drinking Water Guidelines (Based on CPCB 2019 Data)
    # Si = Standard Limit (Guideline Value)
    # Ii = 0.0 (WHO does not use a secondary acceptable limit)
    # ----------------------------------------------------------
    "WHO": {
        "Pb": {"Si": 0.01, "Ii": 0.0},      # Lead
        "Cd": {"Si": 0.003, "Ii": 0.0},     # Cadmium
        "Cr": {"Si": 0.05, "Ii": 0.0},      # Chromium
        "As": {"Si": 0.01, "Ii": 0.0},      # Arsenic
        "Hg": {"Si": 0.006, "Ii": 0.0},     # Mercury
        "Ni": {"Si": 0.07, "Ii": 0.0},      # Nickel
        "U":  {"Si": 0.015, "Ii": 0.0},     # Uranium

        # Aesthetic / Health Guidelines
        "Fe": {"Si": 0.3, "Ii": 0.0},       # Iron
        "Mn": {"Si": 0.4, "Ii": 0.0},       # Manganese
        "Zn": {"Si": 3.0, "Ii": 0.0},       # Zinc
        "Cu": {"Si": 2.0, "Ii": 0.0},       # Copper
    },
}


# ── Toxicity-Based Weights ─────────────────────────────────────────────
# Entropy-based Heavy Metal Contamination Index weights
EHCI_WEIGHTS: dict[str, float] = {
    "As": 0.179,
    "Hg": 0.179,
    "Cd": 0.143,
    "Pb": 0.125,
    "Ni": 0.107,
    "Cr": 0.089,
    "Cu": 0.054,
    "U":  0.054,
    "Mn": 0.036,
    "Zn": 0.018,
    "Fe": 0.018,
}

# Heavy Metal Index toxicity weights
HMI_WEIGHTS: dict[str, float] = {
    "As": 0.17,
    "Hg": 0.17,
    "Cd": 0.14,
    "Pb": 0.13,
    "Ni": 0.10,
    "Cr": 0.08,
    "Cu": 0.06,
    "U":  0.05,
    "Mn": 0.04,
    "Zn": 0.03,
    "Fe": 0.03,
}

# PCA-based Metal Index factor scores
PMI_FACTOR_SCORES: dict[str, float] = {
    "As": 0.16,
    "Hg": 0.16,
    "Cd": 0.13,
    "Pb": 0.12,
    "Ni": 0.10,
    "Cr": 0.09,
    "Cu": 0.07,
    "U":  0.06,
    "Mn": 0.05,
    "Zn": 0.03,
    "Fe": 0.03,
}

# Normalization bounds for PMI
NSPMI_MIN: float = 0.03
NSPMI_MAX: float = 0.16


# ── Reference Dose Values (mg/kg/day) ─────────────────────────────────
# Used for health-risk assessment (Hazard Quotient / Chronic Daily Intake)
RFD: dict[str, float] = {
    "As": 0.0003,
    "Cd": 0.0005,
    "Pb": 0.0036,
    "Zn": 0.3,
    "Fe": 0.7,
    "Mn": 0.046,
    "Cu": 0.04,
    "Cr": 0.003,
    "Ni": 0.02,
    "Hg": 0.0003,
    "U":  0.0006,
}
