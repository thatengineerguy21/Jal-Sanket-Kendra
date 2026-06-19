# app/services/pdf_parser.py
"""
Service layer for parsing CGWB PDFs using heuristics.
"""

from __future__ import annotations

import io
import logging
import pandas as pd
import tabula
from typing import List
from fastapi import HTTPException

logger = logging.getLogger(__name__)

TARGET_COLUMNS = [
    "village_code", "state", "district", "location", "year",
    "coordinates.coordinates[0]", "coordinates.coordinates[1]",
    "parameters.pH", "parameters.EC", "parameters.CO3", "parameters.HCO3",
    "parameters.Cl", "parameters.F", "parameters.SO4", "parameters.NO3",
    "parameters.total_hardness", "parameters.Ca", "parameters.Mg",
    "parameters.Na", "parameters.K", "parameters.Fe", "parameters.U",
    "parameters.As", "source"
]

COLUMN_HEURISTICS = {
    "village_code": ["village", "vill", "village code"],
    "state": ["state"],
    "district": ["district", "dist"],
    "location": ["location", "loc", "site"],
    "year": ["year", "yr"],
    "coordinates.coordinates[0]": ["lon", "longitude", "long"],
    "coordinates.coordinates[1]": ["lat", "latitude"],
    "parameters.pH": ["ph", "p_h"],
    "parameters.EC": ["ec", "conductivity", "electrical conductivity"],
    "parameters.CO3": ["co3", "carbonate"],
    "parameters.HCO3": ["hco3", "bicarbonate"],
    "parameters.Cl": ["cl", "chloride"],
    "parameters.F": ["f", "fluoride", "fl"],
    "parameters.SO4": ["so4", "sulphate", "sulfate"],
    "parameters.NO3": ["no3", "nitrate"],
    "parameters.total_hardness": ["th", "hardness", "total hardness"],
    "parameters.Ca": ["ca", "calcium"],
    "parameters.Mg": ["mg", "magnesium"],
    "parameters.Na": ["na", "sodium"],
    "parameters.K": ["k", "potassium"],
    "parameters.Fe": ["fe", "iron"],
    "parameters.U": ["u", "uranium"],
    "parameters.As": ["as", "arsenic"],
}


def map_column(col_name: str) -> str | None:
    """Return the target column name if a heuristic matches, else None."""
    col_lower = str(col_name).lower().strip()
    for target_col, keywords in COLUMN_HEURISTICS.items():
        if any(kw == col_lower or kw in col_lower.split() or col_lower.startswith(kw) for kw in keywords):
            return target_col
    return None


def extract_year_from_filename(filename: str) -> int:
    import re
    match = re.search(r'(20\d{2})', filename)
    if match:
        return int(match.group(1))
    return 2023


def parse_pdf_bytes(data: bytes, filename: str) -> pd.DataFrame:
    """
    Extract all tables from a PDF byte stream, apply heuristics to map 
    the varying headers into the standard CSV format, and return a concatenated DataFrame.
    """
    default_year = extract_year_from_filename(filename)
    all_records = []
    
    try:
        tables = tabula.read_pdf(
            io.BytesIO(data), 
            pages="all", 
            multiple_tables=True, 
            guess=True,
            encoding="cp1252"
        )
    except Exception as exc:
        logger.exception("Failed to parse PDF bytes using tabula.")
        raise HTTPException(status_code=400, detail="Error reading PDF file structure.") from exc

    if not tables:
        raise HTTPException(status_code=400, detail="No data tables found in the PDF.")
    
    for df in tables:
        if df.empty:
            continue
            
        mapped_columns = {}
        for col in df.columns:
            mapped = map_column(col)
            if mapped:
                mapped_columns[col] = mapped
        
        df = df.rename(columns=mapped_columns)
        
        # Drop duplicate columns (can happen if multiple columns map to the same target)
        df = df.loc[:, ~df.columns.duplicated()]
        
        available_targets = [c for c in df.columns if c in TARGET_COLUMNS]
        
        if not available_targets:
            continue
        
        df_filtered = df[available_targets].copy()
        
        if "year" not in df_filtered.columns:
            df_filtered["year"] = default_year
        if "source" not in df_filtered.columns:
            df_filtered["source"] = f"api_pdf_import_{filename}"
            
        all_records.append(df_filtered)
        
    if not all_records:
        raise HTTPException(
            status_code=400, 
            detail="No tabular data matching required fields (e.g., location, lat, lon, Fe, As, U) could be extracted."
        )

    combined_df = pd.concat(all_records, ignore_index=True)
    
    for col in TARGET_COLUMNS:
        if col not in combined_df.columns:
            combined_df[col] = None
            
    combined_df = combined_df[TARGET_COLUMNS]
    return combined_df
