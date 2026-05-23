# Zipkin — AgriAI Distributed Tracing

Zipkin collects end-to-end traces for every HTTP request through the AgriAI backend,
making it easy to see exactly where time is spent inside `/predict`.

## Running standalone

```bash
docker run -d \
  --name agriai-zipkin \
  -p 9411:9411 \
  openzipkin/zipkin
```

Open http://localhost:9411

## Integrating with the FastAPI backend

### 1. Install dependencies

```bash
pip install \
  opentelemetry-sdk \
  opentelemetry-instrumentation-fastapi \
  opentelemetry-exporter-zipkin
```

### 2. Add to main.py

```python
from src.tracing import setup_tracing
setup_tracing(app, service_name="agriai-backend")
```

### 3. Environment variable

```bash
# Point at local Zipkin (development)
ZIPKIN_ENDPOINT=http://localhost:9411/api/v2/spans uvicorn src.main:app --reload

# Point at Docker Compose Zipkin
ZIPKIN_ENDPOINT=http://zipkin:9411/api/v2/spans uvicorn src.main:app --reload
```

## What gets traced

Every inbound HTTP request becomes a root span. The instrumentor automatically
records:

- HTTP method, URL, and status code
- Response time
- Exception details on 5xx

Custom child spans can be added with:

```python
from opentelemetry import trace
tracer = trace.get_tracer(__name__)

with tracer.start_as_current_span("compute_yield"):
    result = _compute_prediction(farm_data)
```

## Lambda note

OpenTelemetry traces are exported asynchronously. On Lambda, force a flush
before the handler returns:

```python
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
# or call provider.force_flush() at end of handler
```
