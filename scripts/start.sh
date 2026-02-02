#!/usr/bin/env bash
# Start the Jal Sanket Kendra app (Bash)
# Creates a virtualenv, installs deps (unless --no-install), initializes the DB, and starts uvicorn.
# Run this from the project root (the folder containing this script).

set -euo pipefail

NO_INSTALL=0
PORT=8000

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-install)
      NO_INSTALL=1
      shift
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [[ ! -d ".venv" ]]; then
  python -m venv .venv
  echo "Created .venv virtual environment"
fi

# shellcheck disable=SC1091
source .venv/bin/activate

if [[ $NO_INSTALL -eq 0 ]]; then
  pip install -e .
  pip install "uvicorn[standard]"
fi

echo "Initializing database (creating tables if needed)..."
python -c "from app import models; models.Base.metadata.create_all(models.engine)"

echo "Starting server on port $PORT..."
python -m uvicorn main:app --reload --host 127.0.0.1 --port "$PORT"
