import glob
import logging
import os

import pandas as pd
import tabula

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

PDF_DIR = "cgwb-pdf"
OUTPUT_CSV = "data/cgwb_parsed_output.csv"

# Target columns for the final CSV
TARGET_COLUMNS = [
    "village_code",
    "state",
    "district",
    "location",
    "year",
    "coordinates.coordinates[0]",
    "coordinates.coordinates[1]",
    "parameters.pH",
    "parameters.EC",
    "parameters.CO3",
    "parameters.HCO3",
    "parameters.Cl",
    "parameters.F",
    "parameters.SO4",
    "parameters.NO3",
    "parameters.total_hardness",
    "parameters.Ca",
    "parameters.Mg",
    "parameters.Na",
    "parameters.K",
    "parameters.Fe",
    "parameters.U",
    "parameters.As",
    "source",
]

# Heuristics for matching PDF columns to target columns
# We prioritize coordinates (lat/lon) and metals (Fe, U, As), as well as standard params.
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


def map_column(col_name: str) -> str:
    """Return the target column name if a heuristic matches, else None."""
    col_lower = str(col_name).lower().strip()
    for target_col, keywords in COLUMN_HEURISTICS.items():
        if any(kw == col_lower or kw in col_lower.split() or col_lower.startswith(kw) for kw in keywords):
            return target_col
    return None


def extract_year_from_filename(filename: str) -> int:
    """Attempt to extract year from filename, defaulting to 2023 if not found."""
    import re

    match = re.search(r"(20\d{2})", filename)
    if match:
        return int(match.group(1))
    return 2023


def process_pdfs():
    all_records = []

    pdf_files = glob.glob(os.path.join(PDF_DIR, "*.pdf"))
    if not pdf_files:
        logging.warning("No PDF files found in %s", PDF_DIR)
        return

    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)

    for pdf_file in pdf_files:
        logging.info("Processing %s...", pdf_file)
        default_year = extract_year_from_filename(pdf_file)

        try:
            # multiple_tables=True extracts all tables
            # guess=True tries to guess column boundaries
            tables = tabula.read_pdf(pdf_file, pages="all", multiple_tables=True, guess=True, encoding="cp1252")
            for i, df in enumerate(tables):
                if df.empty:
                    continue

                # Standardize columns based on heuristics
                mapped_columns = {}
                for col in df.columns:
                    mapped = map_column(col)
                    if mapped:
                        mapped_columns[col] = mapped

                # Rename columns that we matched
                df = df.rename(columns=mapped_columns)

                # Drop duplicate columns
                df = df.loc[:, ~df.columns.duplicated()]

                # Keep only mapped columns
                available_targets = [c for c in df.columns if c in TARGET_COLUMNS]
                if not available_targets:
                    # No recognizable columns in this table, skip
                    continue

                df_filtered = df[available_targets].copy()

                # Assign default values for required columns if missing
                if "year" not in df_filtered.columns:
                    df_filtered["year"] = default_year
                if "source" not in df_filtered.columns:
                    df_filtered["source"] = f"pdf_import_{os.path.basename(pdf_file)}"

                all_records.append(df_filtered)

        except Exception as e:
            logging.error("Failed to parse %s: %s", pdf_file, e)

    if not all_records:
        logging.warning("No tabular data could be extracted and mapped from the PDFs.")
        return

    # Combine all DataFrames
    combined_df = pd.concat(all_records, ignore_index=True)

    # Ensure all target columns exist
    for col in TARGET_COLUMNS:
        if col not in combined_df.columns:
            combined_df[col] = None

    # Reorder columns
    combined_df = combined_df[TARGET_COLUMNS]

    # Export to CSV
    combined_df.to_csv(OUTPUT_CSV, index=False)
    logging.info("Successfully exported parsed data to %s (Rows: %d)", OUTPUT_CSV, len(combined_df))


if __name__ == "__main__":
    process_pdfs()
