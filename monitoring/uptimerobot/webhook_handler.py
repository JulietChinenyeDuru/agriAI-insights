"""
UptimeRobot webhook handler for AgriAI Insights.

Receives up/down alerts from UptimeRobot and logs them. Optionally pushes
an availability metric to Prometheus Pushgateway so Grafana reflects
real-world uptime alongside internal API metrics.

Mount on the existing FastAPI app (backend/src/main.py):

    from src.uptimerobot import router as uptimerobot_router
    app.include_router(uptimerobot_router)

Or run as a standalone service:

    uvicorn monitoring.uptimerobot.webhook_handler:app --port 8001

Env vars:
    UPTIMEROBOT_SECRET     Shared secret configured in UptimeRobot → Integrations
                           Required — requests without it return 403.
    PUSHGATEWAY_URL        e.g. http://localhost:9091
                           Optional — omit to skip metric pushes.
"""
import logging
import os
from datetime import datetime, timezone
from enum import IntEnum
from typing import Optional

import httpx
from fastapi import APIRouter, FastAPI, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

logger = logging.getLogger("agriai.uptimerobot")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

_SECRET = os.getenv("UPTIMEROBOT_SECRET", "")
_PUSHGATEWAY_URL = os.getenv("PUSHGATEWAY_URL", "")

router = APIRouter(prefix="/webhooks/uptimerobot", tags=["monitoring"])


class AlertType(IntEnum):
    DOWN = 1
    UP = 2
    SSL_EXPIRY = 3


class UptimeRobotPayload(BaseModel):
    monitorID: int
    monitorURL: str
    monitorFriendlyName: str
    alertType: AlertType
    alertTypeFriendlyName: str
    alertDetails: str = ""
    alertDuration: Optional[int] = Field(None, description="Downtime duration in seconds (UP alerts only)")
    monitorAlertContacts: Optional[str] = None


def _verify_secret(x_uptimerobot_secret: Optional[str]) -> None:
    if not _SECRET:
        return
    if x_uptimerobot_secret != _SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid webhook secret")


async def _push_availability_metric(monitor_url: str, is_up: bool) -> None:
    if not _PUSHGATEWAY_URL:
        return
    value = 1 if is_up else 0
    job = "uptimerobot"
    label = monitor_url.replace("https://", "").replace("http://", "").rstrip("/")
    metric_text = (
        f"# HELP agriai_monitor_up 1 = monitor up, 0 = monitor down\n"
        f"# TYPE agriai_monitor_up gauge\n"
        f'agriai_monitor_up{{monitor="{label}"}} {value}\n'
    )
    push_url = f"{_PUSHGATEWAY_URL.rstrip('/')}/metrics/job/{job}/monitor/{label}"
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(push_url, content=metric_text,
                              headers={"Content-Type": "text/plain"})
    except Exception as exc:
        logger.warning("Pushgateway push failed: %s", exc)


@router.post("", status_code=status.HTTP_200_OK)
async def handle_alert(
    payload: UptimeRobotPayload,
    request: Request,
    x_uptimerobot_secret: Optional[str] = Header(None),
):
    """Receive an UptimeRobot up/down alert."""
    _verify_secret(x_uptimerobot_secret)

    is_up = payload.alertType == AlertType.UP
    ts = datetime.now(timezone.utc).isoformat()

    if is_up:
        downtime = f" (was down {payload.alertDuration}s)" if payload.alertDuration else ""
        logger.info("[UP]%s %s — %s at %s", downtime, payload.monitorFriendlyName, payload.monitorURL, ts)
    else:
        logger.warning("[DOWN] %s — %s | %s at %s",
                       payload.monitorFriendlyName, payload.monitorURL, payload.alertDetails, ts)

    await _push_availability_metric(payload.monitorURL, is_up)

    return {
        "received": True,
        "monitor": payload.monitorFriendlyName,
        "status": "up" if is_up else "down",
        "timestamp": ts,
    }


@router.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}


# Standalone entry point
app = FastAPI(title="AgriAI UptimeRobot Webhook", version="1.0.0")
app.include_router(router)
