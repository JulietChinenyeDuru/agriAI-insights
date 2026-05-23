# Grafana — AgriAI Insights

Pre-provisioned Grafana setup with the AgriAI dashboard auto-loaded on startup.

## Login

| | |
|---|---|
| URL | http://localhost:3000 |
| Username | admin |
| Password | admin (change on first login) |

## Files

| File | Purpose |
|---|---|
| `datasources.yml` | Auto-provisions Prometheus as the default datasource |
| `dashboards.yml` | Tells Grafana where to find dashboard JSON files |
| `dashboards/agriai-dashboard.json` | The AgriAI Insights overview dashboard |

## Dashboard panels

| Panel | Metric | Type |
|---|---|---|
| Request rate | `rate(http_requests_total[5m])` | Time series |
| p50 / p95 / p99 latency | `histogram_quantile(...)` | Time series |
| Error rate (5xx) | `rate(http_requests_total{status=~"5.."}[5m])` | Stat |
| Predictions per minute | `rate(agriai_predictions_total[1m]) * 60` | Time series |
| Top crops predicted | `increase(agriai_predictions_total[1h])` by crop | Bar chart |
| Yield distribution | `agriai_prediction_yield_t_ha_bucket` | Heatmap |
| Confidence distribution | `agriai_prediction_confidence_bucket` | Histogram |
| Lambda history buffer | `agriai_history_total` | Gauge |

## Running standalone

```bash
docker run -d \
  --name agriai-grafana \
  -p 3000:3000 \
  -v $(pwd)/datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml \
  -v $(pwd)/dashboards.yml:/etc/grafana/provisioning/dashboards/dashboards.yml \
  -v $(pwd)/dashboards:/var/lib/grafana/dashboards \
  grafana/grafana
```
