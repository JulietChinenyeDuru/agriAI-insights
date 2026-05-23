# UptimeRobot — AgriAI Insights

External uptime monitoring for the AgriAI API and Netlify web app, with webhook
alerts that feed back into the Grafana/Prometheus observability stack.

## What is monitored

| Monitor | URL | Type |
|---|---|---|
| AgriAI API (root) | `https://urr6s98icd.execute-api.eu-west-1.amazonaws.com/` | HTTPS |
| AgriAI API (/predict) | `https://urr6s98icd.execute-api.eu-west-1.amazonaws.com/predict` | HTTPS |
| AgriAI Web App | `https://agriai-insight.netlify.app` | HTTPS |

Check interval: **5 minutes** (free tier) · Alert threshold: **2 consecutive failures**

---

## Files

| File | Purpose |
|---|---|
| `webhook_handler.py` | FastAPI router that receives UptimeRobot up/down webhooks |

---

## Setting up UptimeRobot

1. Create a free account at [uptimerobot.com](https://uptimerobot.com)
2. **Add monitor** → HTTPS → paste the URL → set interval to 5 min
3. Go to **My Settings → Integrations → Add Integration → Webhook**
4. Set the webhook URL to your deployed handler endpoint:
   ```
   https://<your-api-domain>/webhooks/uptimerobot
   ```
5. Set a **Secret Key** — copy the value into the `UPTIMEROBOT_SECRET` env var
6. Enable **Send as JSON** and check **Alert when down** and **Alert when up**

---

## Integrating the webhook handler

### Option A — mount on the existing FastAPI backend

Add two lines to `backend/src/main.py`:

```python
from src.uptimerobot import router as uptimerobot_router
app.include_router(uptimerobot_router)
```

Install the extra dependency:

```bash
pip install httpx
```

The endpoint becomes available at `POST /webhooks/uptimerobot`.

### Option B — standalone service

```bash
cd monitoring/uptimerobot
pip install fastapi uvicorn httpx
uvicorn webhook_handler:app --host 0.0.0.0 --port 8001
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `UPTIMEROBOT_SECRET` | Yes | Shared secret from UptimeRobot integration settings |
| `PUSHGATEWAY_URL` | No | e.g. `http://localhost:9091` — pushes `agriai_monitor_up` metric to Grafana |

Set in Lambda via CloudFormation:

```yaml
Environment:
  Variables:
    UPTIMEROBOT_SECRET: !Sub "{{resolve:secretsmanager:agriai/uptimerobot:SecretString:secret}}"
    PUSHGATEWAY_URL: ""
```

---

## Webhook payload (UptimeRobot format)

```json
{
  "monitorID": 798541234,
  "monitorURL": "https://urr6s98icd.execute-api.eu-west-1.amazonaws.com/",
  "monitorFriendlyName": "AgriAI API",
  "alertType": 1,
  "alertTypeFriendlyName": "Down",
  "alertDetails": "Connection timed out",
  "alertDuration": null,
  "monitorAlertContacts": "durujulietchinenye@gmail.com"
}
```

`alertType` values: `1` = Down · `2` = Up · `3` = SSL expiry warning

---

## Grafana integration

When `PUSHGATEWAY_URL` is set, the handler pushes an `agriai_monitor_up` gauge
(1 = up, 0 = down) to the Pushgateway after every alert. Prometheus scrapes this
every 15 s, and the existing Grafana dashboard picks it up automatically.

Add this PromQL to a new Stat panel to display live monitor status:

```promql
agriai_monitor_up{job="uptimerobot"}
```

---

## Testing the handler locally

```bash
# Start the handler
uvicorn webhook_handler:app --port 8001

# Simulate a DOWN alert
curl -X POST http://localhost:8001/webhooks/uptimerobot \
  -H "Content-Type: application/json" \
  -H "X-Uptimerobot-Secret: your-secret" \
  -d '{
    "monitorID": 1,
    "monitorURL": "https://urr6s98icd.execute-api.eu-west-1.amazonaws.com/",
    "monitorFriendlyName": "AgriAI API",
    "alertType": 1,
    "alertTypeFriendlyName": "Down",
    "alertDetails": "Connection timed out"
  }'

# Simulate an UP alert
curl -X POST http://localhost:8001/webhooks/uptimerobot \
  -H "Content-Type: application/json" \
  -H "X-Uptimerobot-Secret: your-secret" \
  -d '{
    "monitorID": 1,
    "monitorURL": "https://urr6s98icd.execute-api.eu-west-1.amazonaws.com/",
    "monitorFriendlyName": "AgriAI API",
    "alertType": 2,
    "alertTypeFriendlyName": "Up",
    "alertDetails": "",
    "alertDuration": 300
  }'
```
