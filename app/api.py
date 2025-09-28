import pandas as pd
import io
from typing import List

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import tabula  # Import the new library for PDF parsing

from . import models, calculator

# Create an APIRouter instance
router = APIRouter()


# --- Pydantic models for response data structuring (No changes here) ---
class CalculationResult(BaseModel):
    heavy_metal_pollution_index: float
    hpi_category: str
    degree_of_contamination: float
    cd_category: str


class SampleResponse(BaseModel):
    id: int
    latitude: float
    longitude: float
    arsenic: float
    cadmium: float
    lead: float
    zinc: float
    result: CalculationResult

    class Config:
        orm_mode = True


@router.post("/upload-and-calculate/", response_model=List[SampleResponse])
async def create_upload_file(
        file: UploadFile = File(...),
        db: Session = Depends(models.get_db)
):
    """
    Accepts a CSV, JSON, or PDF file with water quality data, calculates 
    pollution indices, stores the data and results in the database, 
    and returns the complete record.

    - CSV/JSON/PDF columns must include: latitude, longitude, arsenic, cadmium, lead, zinc
    """

    df = None
    contents = await file.read()

    # --- NEW: Logic to handle different file types ---
    # Check the content type to decide how to parse the file.

    # 1. Handle CSV files
    if file.content_type == 'text/csv':
        try:
            df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error processing CSV file: {e}")

    # 2. Handle JSON files
    elif file.content_type == 'application/json':
        try:
            df = pd.read_json(io.StringIO(contents.decode('utf-8')))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error processing JSON file: {e}")

    # 3. Handle PDF files
    elif file.content_type == 'application/pdf':
        try:
            # tabula-py reads a PDF and returns a list of DataFrames (one for each table found)
            pdf_tables = tabula.read_pdf(io.BytesIO(contents), pages='all', multiple_tables=True)
            if not pdf_tables:
                raise HTTPException(status_code=400, detail="No data tables found in the PDF.")
            # We assume the first table found in the PDF is the correct one.
            df = pdf_tables[0]
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error processing PDF file: {e}")

    # If the file type is not supported
    else:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Please upload a CSV, JSON, or PDF."
        )

    # --- The rest of the logic remains largely the same ---
    # It now operates on the DataFrame 'df' created from the uploaded file.

    # Validate required columns in the resulting DataFrame
    required_columns = {'latitude', 'longitude', 'arsenic', 'cadmium', 'lead', 'zinc'}
    # Column names in PDFs can sometimes have extra spaces, so we strip them.
    df.columns = df.columns.str.strip()

    if not required_columns.issubset(df.columns):
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns. Data must contain: {', '.join(required_columns)}"
        )

    processed_samples = []

    # Iterate over each row in the DataFrame to process each sample
    for index, row in df.iterrows():
        # 1. Create and save the WaterSample record
        db_sample = models.WaterSample(
            latitude=row['latitude'],
            longitude=row['longitude'],
            arsenic=row.get('arsenic'),
            cadmium=row.get('cadmium'),
            lead=row.get('lead'),
            zinc=row.get('zinc')
        )
        db.add(db_sample)
        db.flush()  # Flush to get the ID for the sample

        # 2. Perform calculations using the calculator module
        hpi_value, hpi_cat = calculator.calculate_hpi(row)
        cd_value, cd_cat = calculator.calculate_degree_of_contamination(row)

        # 3. Create and save the PollutionResult record
        db_result = models.PollutionResult(
            sample_id=db_sample.id,
            heavy_metal_pollution_index=hpi_value,
            hpi_category=hpi_cat,
            degree_of_contamination=cd_value,
            cd_category=cd_cat
        )
        db.add(db_result)

        processed_samples.append(db_sample)

    db.commit()

    # Refresh each sample to load the newly created result relationship
    for sample in processed_samples:
        db.refresh(sample)

    return processed_samples
