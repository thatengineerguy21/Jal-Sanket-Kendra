# app/services/pdf_parser.py
"""
Service layer for parsing CGWB-style groundwater-quality PDFs using
heuristics, since these reports come from many different states/labs
and never share one fixed layout.

This module intentionally does a lot of defensive cleanup, because real
PDF exports of lab tables are messy in predictable ways:

  * Column headers carry units inline ("Fe(ppm)", "EC in µS/cm",
    "F (mg/L)") and abbreviations collide with each other if matched
    carelessly (e.g. naively treating any header that *starts with* "f"
    as Fluoride also swallows "Fe" / Iron).
  * Cells routinely contain lab shorthand instead of numbers: "BDL"
    (below detection limit), "Nil", "ND", or a bare "-" for "not
    tested" — none of which `float()` can parse.
  * Coordinates are sometimes plain decimals (31.1594) and sometimes
    degrees-minutes-seconds strings (23°22'12").
  * Multi-page tables can lose their header row on continuation pages,
    so naive per-page extraction silently drops every row after page 1.

The matching/cleaning logic below is built to survive all of that
rather than discard the row.
"""

from __future__ import annotations

import io
import logging
import re
from typing import Dict, List, Optional

import pandas as pd
import tabula
from fastapi import HTTPException

from app.services.file_parser import REQUIRED_COLUMNS as TARGET_COLUMNS

logger = logging.getLogger(__name__)

# ── Column heuristics ───────────────────────────────────────────────────
# Keep keyword lists alongside the matching algorithm below — see
# `map_column()` for exactly how short vs. long keywords are treated
# differently (this is what fixes the Fe/F and "X as CaCO3"/Arsenic
# collisions).
COLUMN_HEURISTICS: Dict[str, List[str]] = {
    "village_code": ["village code", "vill code", "village id", "vill id"],
    "state": ["state"],
    "district": ["district", "dist"],
    "location": ["location", "site", "village", "loc"],
    "year": ["year", "yr"],
    "coordinates.coordinates[0]": ["lon", "longitude", "long"],
    "coordinates.coordinates[1]": ["lat", "latitude"],
    "parameters.pH": ["ph"],
    "parameters.EC": ["ec", "conductivity", "electrical conductivity"],
    "parameters.CO3": ["co3", "carbonate"],
    "parameters.HCO3": ["hco3", "bicarbonate"],
    "parameters.Cl": ["cl", "chloride"],
    "parameters.F": ["f", "fluoride", "fl"],
    "parameters.SO4": ["so4", "sulphate", "sulfate"],
    "parameters.NO3": ["no3", "nitrate"],
    "parameters.PO4": ["po4", "phosphate"],
    "parameters.total_hardness": ["th", "hardness", "total hardness"],
    "parameters.Ca": ["ca", "calcium"],
    "parameters.Mg": ["mg", "magnesium"],
    "parameters.Na": ["na", "sodium"],
    "parameters.K": ["k", "potassium"],
    "parameters.TDS": ["tds", "total dissolved solids"],
    "parameters.SiO2": ["sio2", "silica"],
    "parameters.Fe": ["fe", "iron"],
    "parameters.Mn": ["mn", "manganese"],
    "parameters.Zn": ["zn", "zinc"],
    "parameters.Cu": ["cu", "copper"],
    "parameters.U": ["u", "uranium"],
    "parameters.As": ["as", "arsenic"],
    "parameters.Pb": ["pb", "lead"],
    "parameters.Cd": ["cd", "cadmium"],
    "parameters.Cr": ["cr", "chromium"],
    "parameters.Hg": ["hg", "mercury"],
    "parameters.Ni": ["ni", "nickel"],
}

# Headers that are nothing but a stray unit label (an artifact of tables
# whose header was split across two rows, e.g. "Parameter" / "mg/L").
# These should never be treated as a parameter name in their own right.
_BARE_UNIT_HEADERS = {
    "mg/l", "mgl", "ppm", "ppb", "ug/l", "ugl", "µg/l", "meq/l",
    "mmhos/cm", "µmhos/cm", "umhos/cm", "us/cm", "µs/cm", "ds/m",
}

_HEADER_WS_RE = re.compile(r"\s+")
_LEADING_TOKEN_RE = re.compile(r"[a-z]+")


def _normalize_header(col_name) -> str:
    s = str(col_name).lower().replace("\r", " ").replace("\n", " ")
    return _HEADER_WS_RE.sub(" ", s).strip()


def _leading_token(header: str) -> str:
    m = _LEADING_TOKEN_RE.match(header)
    return m.group(0) if m else ""


def map_column(col_name) -> Optional[str]:
    """
    Return the target column name a PDF table header should map to, or
    None if nothing matches.

    Two different matching strategies are used depending on keyword
    length, on purpose:

    * Short keywords (<=3 chars) are chemical symbols / abbreviations
      ("f", "fe", "as", "u", "cl", "co3", ...). These are only trusted
      against the *leading* token of the header — i.e. the header has
      to actually start with that symbol as a whole word. This is what
      stops "Fe(ppm)" from being read as Fluoride (old code used
      `startswith`, so "fe(ppm)".startswith("f") matched Fluoride
      before Iron ever got a chance), and stops "Total Hardness (mg/l
      as CaCO3)" from being read as Arsenic just because "as" shows up
      as a stand-alone word later in the header.
    * Longer keywords (full element/parameter names, or multi-word
      phrases like "village code") are safe to match anywhere in the
      header, since they're specific enough not to collide.
    """
    header = _normalize_header(col_name)
    if not header or header.replace(" ", "") in _BARE_UNIT_HEADERS:
        return None

    tokens = header.split()
    leading = _leading_token(header)

    for target_col, keywords in COLUMN_HEURISTICS.items():
        for kw in keywords:
            if " " in kw:
                if kw in header:
                    return target_col
            elif len(kw) <= 3:
                if leading == kw:
                    return target_col
            else:
                if kw == header or kw in tokens:
                    return target_col
    return None


# ── Value cleaning ──────────────────────────────────────────────────────
# Lab-report shorthand seen in real exports. "Tested, result below the
# detection limit" is meaningfully different from "not tested" — the
# former is a real, near-zero measurement (and is the conventional way
# to record it for index calculations); the latter should stay blank
# rather than being silently coerced to zero or dropped.
_ZERO_TOKENS = {
    "bdl", "nd", "n.d", "n.d.", "nil", "below detection limit",
    "below detectable limit", "not detected", "<dl", "below dl",
}
_BLANK_TOKENS = {"-", "--", "na", "n/a", "not available", "not tested", "nt"}

_NUMBER_RE = re.compile(r"-?\d+(?:\.\d+)?")
_RANGE_PREFIX_RE = re.compile(r"^[<>≤≥~]\s*")
_DMS_MARK_RE = re.compile(r"[°ºd′'\"″]")
_HEMI_NEG_RE = re.compile(r"[SsWw]\s*$")


def clean_numeric_cell(val):
    """
    Coerce a single PDF table cell into a float, or None.

    Handles "BDL"/"Nil"/"ND" (-> 0.0, see note above), "-"/"NA"
    (-> None), detection-limit markers like "<0.01" (-> 0.01), and
    plain numbers — without raising on anything it can't parse.
    """
    if val is None:
        return None
    if isinstance(val, (int, float)):
        try:
            if pd.isna(val):
                return None
        except (TypeError, ValueError):
            pass
        return float(val)

    s = str(val).strip()
    if not s:
        return None

    low = s.lower().strip(" .")
    if low in _BLANK_TOKENS:
        return None
    if low in _ZERO_TOKENS:
        return 0.0

    s = _RANGE_PREFIX_RE.sub("", s)
    m = _NUMBER_RE.search(s)
    if not m:
        return None
    try:
        return float(m.group(0))
    except ValueError:
        return None


def clean_coordinate_cell(val):
    """
    Coerce a latitude/longitude cell into decimal degrees.

    Accepts plain decimals ("31.1594") as well as degrees-minutes-
    seconds strings ("23°22'12\"", optionally with a trailing N/S/E/W
    hemisphere letter).
    """
    if val is None:
        return None
    if isinstance(val, (int, float)):
        try:
            if pd.isna(val):
                return None
        except (TypeError, ValueError):
            pass
        return float(val)

    s = str(val).strip()
    if not s:
        return None
    low = s.lower().strip(" .")
    if low in _BLANK_TOKENS or low in _ZERO_TOKENS:
        return None

    if _DMS_MARK_RE.search(s):
        nums = _NUMBER_RE.findall(s)
        if not nums:
            return None
        degrees = float(nums[0])
        minutes = float(nums[1]) if len(nums) > 1 else 0.0
        seconds = float(nums[2]) if len(nums) > 2 else 0.0
        value = abs(degrees) + minutes / 60.0 + seconds / 3600.0
        if degrees < 0 or _HEMI_NEG_RE.search(s):
            value = -value
        return value

    s_clean = _RANGE_PREFIX_RE.sub("", s)
    try:
        return float(s_clean)
    except ValueError:
        pass

    neg = bool(_HEMI_NEG_RE.search(s_clean))
    m = _NUMBER_RE.search(s_clean)
    if not m:
        return None
    try:
        value = float(m.group(0))
    except ValueError:
        return None
    return -value if neg else value


_COORDINATE_COLUMNS = {
    "coordinates.coordinates[0]",
    "coordinates.coordinates[1]",
}
_IDENTIFIER_COLUMNS = {"village_code", "state", "district", "location", "source"}


def _clean_table_values(df: pd.DataFrame) -> pd.DataFrame:
    """Apply the appropriate cleaner to every recognized column in *df*."""
    for col in df.columns:
        if col in _COORDINATE_COLUMNS:
            df[col] = df[col].map(clean_coordinate_cell)
        elif col in _IDENTIFIER_COLUMNS or col == "year":
            continue
        elif col.startswith("parameters."):
            df[col] = df[col].map(clean_numeric_cell)
    return df


def extract_year_from_filename(filename: str) -> int:
    match = re.search(r'(20\d{2})', filename)
    if match:
        return int(match.group(1))
    return 2023


def _read_tables_with_tabula(data: bytes) -> List[pd.DataFrame]:
    """
    Try a couple of tabula extraction strategies, since a single mode
    doesn't reliably handle every PDF layout: ``guess=True`` (lattice/
    stream auto-detection) works for most well-formed tables, but some
    reports need an explicit ``stream=True`` to find columns that
    aren't ruled off with visible borders.
    """
    attempts = [
        {"guess": True},
        {"guess": False, "stream": True},
        {"guess": False, "lattice": True},
    ]
    last_exc: Optional[Exception] = None
    for opts in attempts:
        try:
            tables = tabula.read_pdf(
                io.BytesIO(data),
                pages="all",
                multiple_tables=True,
                pandas_options={"dtype": str},
                encoding="cp1252",
                java_options=["-Xmx1024m"],
                **opts,
            )
        except Exception as exc:  # noqa: BLE001 - tabula raises a variety of types
            last_exc = exc
            continue
        if tables:
            return tables
    if last_exc is not None:
        logger.warning("All tabula extraction strategies failed: %s", last_exc)
    return []


def parse_pdf_bytes(data: bytes, filename: str) -> pd.DataFrame:
    """
    Extract all tables from a PDF byte stream, apply heuristics to map
    the varying headers into the standard format, clean lab-report
    shorthand out of the values, and return a concatenated DataFrame.
    """
    default_year = extract_year_from_filename(filename)
    all_records = []

    try:
        tables = _read_tables_with_tabula(data)
    except Exception as exc:
        logger.exception("Failed to parse PDF bytes using tabula.")
        raise HTTPException(status_code=400, detail="Error reading PDF file structure.") from exc

    if not tables:
        raise HTTPException(status_code=400, detail="No data tables found in the PDF.")

    # Tracks the raw (pre-rename) column layout of the last table that
    # produced at least one recognized column, so a later continuation
    # page that lost its header row (a common tabula artifact when the
    # header text isn't repeated on every page) can reuse it instead of
    # being silently dropped.
    last_good_raw_columns: Optional[List[str]] = None

    for df in tables:
        if df.empty:
            continue

        original_columns = list(df.columns)
        mapped_columns = {col: map_column(col) for col in original_columns}
        mapped_columns = {k: v for k, v in mapped_columns.items() if v}

        if not mapped_columns and last_good_raw_columns is not None \
                and len(original_columns) == len(last_good_raw_columns):
            # Likely a continuation page: tabula mistook the first data
            # row for a header because this page never repeated the
            # column titles. Re-apply the previous page's layout and
            # treat tabula's "header" row as real data.
            header_row = pd.DataFrame([original_columns], columns=last_good_raw_columns)
            df.columns = last_good_raw_columns
            df = pd.concat([header_row, df], ignore_index=True)
            mapped_columns = {col: map_column(col) for col in df.columns}
            mapped_columns = {k: v for k, v in mapped_columns.items() if v}
            if mapped_columns:
                logger.info(
                    "Recovered %d column(s) on a likely continuation page "
                    "in '%s' by reusing the previous table's header.",
                    len(mapped_columns), filename,
                )

        if not mapped_columns:
            logger.info(
                "Skipping a table in '%s' with no recognizable columns: %s",
                filename, original_columns,
            )
            continue

        df = df.rename(columns=mapped_columns)

        # Drop duplicate columns (can happen if multiple source columns
        # map to the same target — e.g. a stray repeated header cell).
        df = df.loc[:, ~df.columns.duplicated()]

        available_targets = [c for c in df.columns if c in TARGET_COLUMNS]
        if not available_targets:
            continue

        df_filtered = df[available_targets].copy()
        df_filtered = _clean_table_values(df_filtered)

        if "year" not in df_filtered.columns:
            df_filtered["year"] = default_year
        if "source" not in df_filtered.columns:
            df_filtered["source"] = f"api_pdf_import_{filename}"

        all_records.append(df_filtered)
        last_good_raw_columns = original_columns

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
