# app/routes/alerts.py
"""Alert configuration and dispatch endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.config import settings
from app.schemas import AlertConfigDTO, AlertSendRequest

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helpers ─────────────────────────────────────────────────────────────
def _get_config(db: Session) -> models.AlertConfig:
    """Return the singleton AlertConfig row, creating it if absent."""
    cfg = db.query(models.AlertConfig).first()
    if not cfg:
        cfg = models.AlertConfig(hpi_threshold=100.0, cd_threshold=3.0)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def _collect_hotspots(db: Session, hpi_thr: float, cd_thr: float) -> list:
    items = db.query(models.WaterSample).join(models.PollutionResult).all()
    flagged = []
    for s in items:
        r = s.result
        if not r:
            continue
        if (r.heavy_metal_pollution_index or 0) >= hpi_thr or (r.degree_of_contamination or 0) >= cd_thr:
            flagged.append(
                {
                    "latitude": s.latitude,
                    "longitude": s.longitude,
                    "hpi": r.heavy_metal_pollution_index,
                    "cd": r.degree_of_contamination,
                }
            )
    return flagged


# ── Routes ──────────────────────────────────────────────────────────────
@router.get("/alerts/config", response_model=AlertConfigDTO)
async def get_alert_config(db: Session = Depends(models.get_db)):
    cfg = _get_config(db)
    return AlertConfigDTO(
        hpi_threshold=cfg.hpi_threshold,
        cd_threshold=cfg.cd_threshold,
        email_recipients=cfg.email_recipients or "",
        sms_recipients=cfg.sms_recipients or "",
        policy_json=cfg.policy_json or "{}",
    )


@router.put("/alerts/config", response_model=AlertConfigDTO)
async def update_alert_config(
    dto: AlertConfigDTO,
    db: Session = Depends(models.get_db),
):
    cfg = _get_config(db)
    cfg.hpi_threshold = dto.hpi_threshold
    cfg.cd_threshold = dto.cd_threshold
    cfg.email_recipients = dto.email_recipients
    cfg.sms_recipients = dto.sms_recipients
    cfg.policy_json = dto.policy_json
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    logger.info("Alert config updated: hpi_thr=%.2f cd_thr=%.2f", dto.hpi_threshold, dto.cd_threshold)
    return dto


@router.post("/alerts/send")
async def send_alerts(
    req: AlertSendRequest,
    db: Session = Depends(models.get_db),
):
    cfg = _get_config(db)
    hotspots = _collect_hotspots(db, cfg.hpi_threshold, cfg.cd_threshold)

    if req.channel == "email":
        if not settings.SENDGRID_API_KEY:
            raise HTTPException(status_code=400, detail="Missing SENDGRID_API_KEY")
        return {
            "status": "queued",
            "channel": "email",
            "to": cfg.email_recipients,
            "count": len(hotspots),
        }

    if req.channel == "sms":
        if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN):
            raise HTTPException(status_code=400, detail="Missing Twilio credentials")
        return {
            "status": "queued",
            "channel": "sms",
            "to": cfg.sms_recipients,
            "count": len(hotspots),
        }

    # Pydantic pattern validation on AlertSendRequest.channel should already
    # block this, but defence-in-depth:
    raise HTTPException(status_code=400, detail="Unsupported channel")
