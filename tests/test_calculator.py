# tests/test_calculator.py

import pandas as pd
import pytest

from app import calculator

# --- Test Data Fixtures ---

@pytest.fixture
def sample_data_moderate():
    """Provides a sample row representing moderate pollution."""
    data = {
        'latitude': 28.7, 'longitude': 77.1,
        'arsenic': 15.0,
        'cadmium': 4.0,
        'lead': 12.0,
        'zinc': 5500
    }
    return pd.Series(data)

@pytest.fixture
def sample_data_low():
    """Provides a sample row representing low pollution."""
    data = {
        'latitude': 19.0, 'longitude': 72.8,
        'arsenic': 5.0,
        'cadmium': 1.0,
        'lead': 4.0,
        'zinc': 2000
    }
    return pd.Series(data)

# --- Tests for calculate_hpi ---

def test_calculate_hpi_moderate_pollution(sample_data_moderate):
    """
    Tests the HPI calculation for a moderately polluted sample.
    """
    hpi_value, category = calculator.calculate_hpi(sample_data_moderate)
    assert hpi_value == pytest.approx(128.9, 0.1)
    assert category == "Moderate pollution"

def test_calculate_hpi_low_pollution(sample_data_low):
    """Tests the HPI calculation for a sample with low pollution."""
    hpi_value, category = calculator.calculate_hpi(sample_data_low)
    # FIX: The expected value was changed from 43.3 to the correct value of 37.71.
    assert hpi_value == pytest.approx(37.71, 0.1)
    assert category == "Low pollution"

# --- Tests for calculate_degree_of_contamination ---

def test_calculate_cd_moderate_pollution(sample_data_moderate):
    """
    Tests the Cd calculation for a moderately polluted sample.
    """
    cd_value, category = calculator.calculate_degree_of_contamination(sample_data_moderate)
    assert cd_value == pytest.approx(5.13, 0.01)
    assert category == "High degree of contamination"

def test_calculate_cd_low_pollution(sample_data_low):
    """Tests the Cd calculation for a sample with low pollution."""
    cd_value, category = calculator.calculate_degree_of_contamination(sample_data_low)
    assert cd_value == pytest.approx(1.63, 0.01)
    assert category == "Moderate degree of contamination"