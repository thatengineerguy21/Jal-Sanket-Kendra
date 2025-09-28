# app/calculator.py

import pandas as pd
import numpy as np

# --- Configuration Constants for Calculations ---
# These values are based on standards (e.g., WHO).
# In a real-world app, these might be configurable or stored in a separate file.

# Standard Permissible Values (S_i) in µg/L
PERMISSIBLE_VALUES = {
    'arsenic': 10,
    'cadmium': 3,
    'lead': 10,
    'zinc': 5000
}

# Unit Weightage (W_i), calculated as the inverse of the permissible value.
UNIT_WEIGHTAGE = {metal: 1 / value for metal, value in PERMISSIBLE_VALUES.items()}


def calculate_hpi(row: pd.Series) -> tuple[float, str]:
    """
    Calculates the Heavy Metal Pollution Index (HPI) for a single water sample.

    HPI is a weighted arithmetic mean of the ratios of metal concentrations
    to their standard permissible values.

    Args:
        row: A pandas Series representing a single sample's metal concentrations.

    Returns:
        A tuple containing the calculated HPI value and its quality category.
    """
    numerator = 0
    denominator = 0

    for metal, weight in UNIT_WEIGHTAGE.items():
        if metal in row and pd.notna(row[metal]):
            concentration = row[metal]
            standard_value = PERMISSIBLE_VALUES[metal]

            # Sub-index (Q_i) = (Concentration / Standard_Value) * 100
            sub_index = (concentration / standard_value) * 100

            numerator += sub_index * weight
            denominator += weight

    if denominator == 0:
        return 0.0, "No Data"

    hpi_value = numerator / denominator

    # Categorize the HPI value
    if hpi_value < 100:
        category = "Low pollution"
    elif 100 <= hpi_value < 150:
        category = "Moderate pollution"
    else:
        category = "High pollution"

    return round(hpi_value, 2), category


def calculate_degree_of_contamination(row: pd.Series) -> tuple[float, str]:
    """
    Calculates the Degree of Contamination (Cd) for a single water sample.

    Cd is the sum of the contamination factors (CF) for each metal, where
    CF is the ratio of the measured concentration to the permissible value.

    Args:
        row: A pandas Series representing a single sample's metal concentrations.

    Returns:
        A tuple containing the calculated Cd value and its quality category.
    """
    cd_value = 0

    for metal, standard_value in PERMISSIBLE_VALUES.items():
        if metal in row and pd.notna(row[metal]):
            concentration = row[metal]
            contamination_factor = concentration / standard_value
            cd_value += contamination_factor

    # Categorize the Cd value
    if cd_value < 1:
        category = "Low degree of contamination"
    elif 1 <= cd_value < 3:
        category = "Moderate degree of contamination"
    else:
        category = "High degree of contamination"

    return round(cd_value, 2), category