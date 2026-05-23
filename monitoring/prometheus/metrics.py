"""
AgriAI Prometheus instrumentation.

Usage — add to backend/src/main.py:

    from src.metrics import instrument_app
    instrument_app(app)

Requires:
    pip install prometheus-fastapi-instrumentator
"""
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Counter, Histogram, Gauge

predictions_total = Counter(
    "agriai_predictions_total",
    "Total yield predictions served",
    ["crop", "region", "soil_quality"],
)

prediction_yield = Histogram(
    "agriai_prediction_yield_t_ha",
    "Predicted yield in tonnes per hectare",
    ["crop"],
    buckets=[0.5, 1.0, 2.0, 3.0, 5.0, 8.0, 10.0, 12.0, 15.0],
)

prediction_confidence = Histogram(
    "agriai_prediction_confidence",
    "Model confidence score (0–1)",
    buckets=[0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.88, 0.9, 0.95, 1.0],
)

history_total = Gauge(
    "agriai_history_total",
    "Number of predictions currently held in the in-memory history buffer",
)


def instrument_app(app):
    """Attach Prometheus middleware and expose /metrics."""
    Instrumentator(
        should_group_status_codes=False,
        should_ignore_untemplated=True,
        excluded_handlers=["/metrics", "/docs", "/openapi.json", "/redoc"],
    ).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


def record_prediction(crop: str, region: str, soil_quality: str,
                      yield_t_ha: float, confidence: float,
                      history_size: int) -> None:
    """Call this from the /predict handler to update business-level metrics."""
    predictions_total.labels(
        crop=crop.lower(),
        region=region,
        soil_quality=soil_quality,
    ).inc()
    prediction_yield.labels(crop=crop.lower()).observe(yield_t_ha)
    prediction_confidence.observe(confidence)
    history_total.set(history_size)
