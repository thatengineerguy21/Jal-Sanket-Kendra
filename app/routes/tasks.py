# app/routes/tasks.py
"""Background task status polling endpoint."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.schemas import TaskStatusResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse, tags=["Tasks"])
async def get_task_status(
    task_id: str,
    db: Session = Depends(models.get_db),
) -> TaskStatusResponse:
    """
    Poll the status of a background upload-and-calculate task.

    Returns the current status, progress percentage, and result
    (when completed) or error message (when failed).
    """
    task = db.query(models.TaskStatus).filter(models.TaskStatus.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    return TaskStatusResponse(
        task_id=task.id,
        status=task.status,
        progress=task.progress,
        result=task.result,
        error_message=task.error_message,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )
