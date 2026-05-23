# Prometheus — AgriAI Insights

Prometheus collects metrics from the AgriAI FastAPI backend and fires alerts
when error rates or latencies exceed acceptable thresholds.

## Files

| File | Purpose |
|---|---|
| `prometheus.yml` | Scrape configuration |
| `alerts.yml` | Alerting rules |
| `metrics.py` | FastAPI instrumentation middleware |

## Running standalone

```bash
docker run -d \
  --name agriai-prometheus \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  -v $(pwd)/alerts.yml:/etc/prometheus/alerts.yml \
  prom/prometheus
```

Open http://localhost:9090

## Useful queries

```promql
# Request rate per endpoint (last 5 min)
rate(http_requests_total{job="agriai-backend"}[5m])

# 95th-percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate (5xx)
rate(http_requests_total{status=~"5.."}[5m])
  / rate(http_requests_total[5m])

# Predictions by crop (last hour)
increase(agriai_predictions_total[1h])
```

## Lambda note

Lambda doesn't expose a persistent scrape endpoint. Either:
1. Run the backend locally with `uvicorn` during development — Prometheus scrapes `localhost:8000/metrics`
2. Use Pushgateway in production — push metrics from the Lambda handler on each invocation
