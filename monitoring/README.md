# AgriAI Insights — Monitoring

Observability stack for the AgriAI backend API (FastAPI on AWS Lambda).

| Tool | Purpose | Default port |
|---|---|---|
| **Prometheus** | Metrics scrape & alerting | 9090 |
| **Grafana** | Dashboards & visualisation | 3000 |
| **Zipkin** | Distributed request tracing | 9411 |
| **UptimeRobot** | External uptime monitoring & webhook alerts | — (cloud) |

---

## Quick start (Docker)

```bash
cd monitoring/docker
docker compose up -d
```

Then open:
- Grafana → http://localhost:3000 (admin / admin)
- Prometheus → http://localhost:9090
- Zipkin → http://localhost:9411

---

## Directory layout

```
monitoring/
├── prometheus/
│   ├── prometheus.yml   # scrape config
│   ├── alerts.yml       # alerting rules
│   └── metrics.py       # FastAPI middleware — instrument the backend
├── grafana/
│   ├── datasources.yml  # auto-provision Prometheus datasource
│   ├── dashboards.yml   # dashboard provider config
│   └── dashboards/
│       └── agriai-dashboard.json   # pre-built AgriAI dashboard
├── zipkin/
│   └── tracing.py       # OpenTelemetry → Zipkin exporter for FastAPI
├── uptimerobot/
│   ├── README.md        # UptimeRobot setup guide
│   └── webhook_handler.py  # FastAPI router — receives up/down alerts
└── docker/
    └── docker-compose.yml
```

---

## Instrumenting the backend

### 1 — Add Prometheus metrics

Copy `prometheus/metrics.py` into `backend/src/` and add two lines to `main.py`:

```python
from src.metrics import instrument_app
instrument_app(app)          # call before the first route
```

Install the dependency:

```bash
pip install prometheus-fastapi-instrumentator
```

The `/metrics` endpoint will then be available on the running server.

### 2 — Add Zipkin tracing

Copy `zipkin/tracing.py` into `backend/src/` and add to `main.py`:

```python
from src.tracing import setup_tracing
setup_tracing(app, service_name="agriai-backend")
```

Install dependencies:

```bash
pip install opentelemetry-sdk opentelemetry-instrumentation-fastapi opentelemetry-exporter-zipkin
```

### 3 — Expose metrics from Lambda

AWS Lambda does not expose a persistent HTTP port for Prometheus to scrape.
Use the **Prometheus Pushgateway** pattern instead:

```bash
pip install prometheus-client
```

Push from the Lambda handler after each request, or use a scheduled EventBridge rule
to flush aggregated metrics every minute.

---

## UptimeRobot (external uptime monitoring)

UptimeRobot checks the API and Netlify web app every 5 minutes from outside AWS
and fires a webhook when a monitor goes down or recovers.

| Monitor | URL |
|---|---|
| AgriAI API | `https://urr6s98icd.execute-api.eu-west-1.amazonaws.com/` |
| AgriAI Web App | `https://agriai-insight.netlify.app` |

### 3 — Add UptimeRobot webhook handler

Mount the router on the existing backend (`main.py`):

```python
from src.uptimerobot import router as uptimerobot_router
app.include_router(uptimerobot_router)
```

Set the env vars:

```bash
UPTIMEROBOT_SECRET=<secret-from-uptimerobot-settings>
PUSHGATEWAY_URL=http://localhost:9091   # optional — pushes agriai_monitor_up to Grafana
```

See `uptimerobot/README.md` for the full UptimeRobot dashboard setup and `curl` test commands.

---

## Alerts

See `prometheus/alerts.yml` for pre-configured alert rules:

| Alert | Condition | Severity |
|---|---|---|
| `AgriAIHighErrorRate` | 5xx rate > 5 % over 5 min | critical |
| `AgriAISlowResponses` | p95 latency > 2 s over 5 min | warning |
| `AgriAIHighPredictionVolume` | > 100 predictions / min | info |
| `AgriAILambdaColdStarts` | history resets detected | warning |
