# Start the Jal Sanket Kendra app (PowerShell)
# Creates/activates a venv, installs dependencies (unless -NoInstall is provided), initializes the DB, and starts uvicorn.
# Run this from the project root (the folder containing this script).

param(
    [switch]$NoInstall,
    [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'

$VenvPath = Join-Path $PSScriptRoot '..\.venv'
$VenvPath = Resolve-Path -Path $VenvPath | ForEach-Object { $_.ProviderPath }

if (-not (Test-Path -Path ".\.venv")) {
    Write-Host "Creating virtual environment .venv..."
    python -m venv .venv
}

Write-Host "Activating virtual environment..."
# Activate the venv for the current PowerShell session
. .\.venv\Scripts\Activate

if (-not $NoInstall) {
    Write-Host "Installing Python dependencies..."
    pip install -e .
    pip install "uvicorn[standard]"
}

Write-Host "Initializing database (creating tables if needed)..."
python -c "from app import models; models.Base.metadata.create_all(models.engine)"

Write-Host "Starting server on port $Port..."
python -m uvicorn main:app --reload --host 127.0.0.1 --port $Port
