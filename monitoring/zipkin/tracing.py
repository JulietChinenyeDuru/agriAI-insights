"""
AgriAI OpenTelemetry → Zipkin tracing setup.

Usage — add to backend/src/main.py:

    from src.tracing import setup_tracing
    setup_tracing(app, service_name="agriai-backend")

Env vars:
    ZIPKIN_ENDPOINT   Zipkin spans URL
                      default: http://localhost:9411/api/v2/spans
    OTEL_SAMPLE_RATE  Fraction of requests to trace (0.0–1.0), default 1.0

Requires:
    pip install opentelemetry-sdk \
                opentelemetry-instrumentation-fastapi \
                opentelemetry-exporter-zipkin
"""
import os
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.exporter.zipkin.json import ZipkinExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

_ZIPKIN_ENDPOINT = os.getenv(
    "ZIPKIN_ENDPOINT",
    "http://localhost:9411/api/v2/spans",
)
_SAMPLE_RATE = float(os.getenv("OTEL_SAMPLE_RATE", "1.0"))


def setup_tracing(app, service_name: str = "agriai-backend") -> TracerProvider:
    """Attach OpenTelemetry → Zipkin tracing to a FastAPI app."""
    resource = Resource.create({SERVICE_NAME: service_name})
    sampler = TraceIdRatioBased(_SAMPLE_RATE)
    provider = TracerProvider(resource=resource, sampler=sampler)

    exporter = ZipkinExporter(endpoint=_ZIPKIN_ENDPOINT)
    provider.add_span_processor(BatchSpanProcessor(exporter))

    trace.set_tracer_provider(provider)

    FastAPIInstrumentor.instrument_app(
        app,
        tracer_provider=provider,
        excluded_urls="/metrics,/docs,/openapi.json,/redoc",
    )

    return provider


def get_tracer(name: str = "agriai"):
    """Return a tracer for manual child spans."""
    return trace.get_tracer(name)
