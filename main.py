# main.py

from fastapi import FastAPI
from app import api
from fastapi.staticfiles import StaticFiles

# This line has been removed to prevent conflicts with the test database setup.
# models.Base.metadata.create_all(bind=engine)

# Initialize the FastAPI application
app = FastAPI(
    title="Heavy Metal Pollution Index API",
    description="An API to calculate HPI and other pollution indices from water quality data.",
    version="1.0.0",
)

# Include the router from app/api.py
app.include_router(api.router, prefix="/api/v1", tags=["Pollution Indices"])

# Mount static frontend at /app
app.mount("/app", StaticFiles(directory="frontend/static", html=True), name="frontend")

@app.get("/", tags=["Root"])
def read_root():
    """
    Root endpoint providing basic information about the API.
    """
    return {
        "message": "Welcome to the Heavy Metal Pollution Indices API",
        "docs_url": "/docs",
        "app_url": "/app/"
    }