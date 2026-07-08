"""
server.py — FastAPI web server that exposes the agent over HTTP.
────────────────────────────────────────────────────────────────────────────
 📖 PYDANTIC AI CONCEPT #6: Running the agent
────────────────────────────────────────────────────────────────────────────
To run the agent you call:

    result = await agent.run(user_prompt, deps=your_deps_object)
    data   = result.data   # ← validated instance of your result_type model

  user_prompt  — the message from the user (what they want)
  deps         — the structured context the agent passes to every tool call
  result.data  — the final, Pydantic-validated response

The agent may call tools multiple times before producing result.data.
You don't have to manage that loop — Pydantic AI handles it automatically.

────────────────────────────────────────────────────────────────────────────
 📖 OBSERVABILITY: Langfuse + Logfire
────────────────────────────────────────────────────────────────────────────
Pydantic AI instruments itself via logfire (OpenTelemetry under the hood).
We route those traces to Langfuse so every agent.run() call produces a
full trace: tool calls, arguments, responses, token usage, and latency.

The flow:
    pydantic-ai → logfire (OTEL) → OTLPSpanExporter → Langfuse cloud

To enable: add LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY to .env.
If the keys are missing, tracing is silently skipped.
────────────────────────────────────────────────────────────────────────────
Start the server:
    cd agent
    uvicorn server:app --reload --port 8787
────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations
import sys

# Windows' console defaults to cp1252, which can't encode the emoji in the
# print()s below and crashes the server at import time. Force UTF-8 stdout.
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from dotenv import load_dotenv

# Load .env FIRST — the agent module needs the API key at import time
load_dotenv()

import base64, os, logfire
from opentelemetry import trace as otel_trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace.export import BatchSpanProcessor

def _setup_langfuse() -> None:
    """
    Connect pydantic-ai's built-in logfire tracing to Langfuse.
    Called once at startup. Silently skipped if keys are not set.

    How it works:
      1. logfire.configure() activates tracing inside pydantic-ai
      2. OTLPSpanExporter sends every span to Langfuse's OTLP endpoint
      3. In Langfuse you see the full agent loop: tool calls, retries, output
    """
    public_key  = os.getenv("LANGFUSE_PUBLIC_KEY", "").strip()
    secret_key  = os.getenv("LANGFUSE_SECRET_KEY", "").strip()
    # Accept both LANGFUSE_HOST and LANGFUSE_BASE_URL (Langfuse's own SDK uses the latter)
    host        = os.getenv("LANGFUSE_HOST") or os.getenv("LANGFUSE_BASE_URL", "https://cloud.langfuse.com")

    if not public_key or not secret_key:
        print("ℹ️  Langfuse keys not set — tracing disabled. Add keys to .env to enable.")
        logfire.configure(send_to_logfire=False)
        return

    # Langfuse uses HTTP Basic auth: base64("publicKey:secretKey")
    token = base64.b64encode(f"{public_key}:{secret_key}".encode()).decode()

    langfuse_exporter = OTLPSpanExporter(
        endpoint=f"{host}/api/public/otel/v1/traces",
        headers={"Authorization": f"Basic {token}"},
    )

    logfire.configure(
        send_to_logfire=False,                                # don't send to Logfire cloud
        additional_span_processors=[
            # BatchSpanProcessor buffers spans and flushes them in the background.
            # More reliable than SimpleSpanProcessor, especially when errors occur.
            BatchSpanProcessor(langfuse_exporter),
        ],
        inspect_arguments=False,                             # suppress noisy inline warnings
    )

    # Tell logfire to actually instrument pydantic-ai and fastapi.
    # Without these calls, logfire is configured but not watching anything.
    logfire.instrument_pydantic_ai()
    print(f"✅ Langfuse tracing enabled → {host}")

_setup_langfuse()

from datetime import date as _date, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import ItineraryRequest, ItineraryResult, StopOut, DayOut
from agent import agent       # the Pydantic AI agent we built in agent.py
from itinerary_repair import normalize_itinerary
from prompting import build_itinerary_prompt
from tools import enrich_stop # helper to add full POI data to each stop

# ── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="GoChina Itinerary Agent",
    description="Pydantic AI agent that builds personalised China travel itineraries.",
    version="1.0.0",
)
# Allow the React dev server to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # open for local dev — fine since this server only runs on your machine
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    """Quick check that the server is running."""
    return {"status": "ok", "service": "gochina-itinerary-agent"}


@app.post("/generate-itinerary", response_model=ItineraryResult)
async def generate_itinerary(request: ItineraryRequest) -> ItineraryResult:
    """
    Generate a personalised itinerary.

    FastAPI automatically:
      • parses + validates the JSON body into an ItineraryRequest
      • validates the return value against ItineraryResult
      • shows both schemas in the interactive docs at /docs
    """
    # Fail fast on bad dates instead of silently generating an itinerary with
    # blank per-day dates (confusing — the UI just shows "Day 1", "Day 2" with
    # no calendar date and no explanation why).
    try:
        parsed_start = _date.fromisoformat(request.startDate)
        parsed_end = _date.fromisoformat(request.endDate)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail="startDate and endDate must be valid YYYY-MM-DD dates.",
        ) from exc
    if parsed_end < parsed_start:
        raise HTTPException(status_code=422, detail="endDate must not be before startDate.")

    # Build the user message — this is what the agent "reads" as input.
    # build_itinerary_prompt() (prompting.py) sanitizes request.notes itself
    # before it ever reaches the model — see guardrails.py.
    prompt = build_itinerary_prompt(request)

    try:
        # ── THIS IS THE CORE PYDANTIC AI CALL ──────────────────────────────
        # agent.run() sends the prompt to the model, which may call tools
        # (search_pois, get_transit_time, etc.) several times before it
        # produces a final ItineraryResult object.
        result = await agent.run(prompt, deps=request)
        # result.output is the validated ItineraryResult instance (v1.x renamed .data → .output)
        # ───────────────────────────────────────────────────────────────────
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Agent error: {exc}") from exc
    finally:
        # Flush all buffered spans to Langfuse — critical when an error occurs,
        # since BatchSpanProcessor buffers spans and might not flush automatically
        # before the exception propagates.
        otel_trace.get_tracer_provider().force_flush()  # type: ignore[union-attr]

    normalized_output = normalize_itinerary(request, result.output)

    # Enrich each stop with full POI data (description, tips, etc.)
    # The agent only returned the scheduling info — this merges in everything else.
    enriched_days: list[DayOut] = []

    # Compute the starting calendar date — already validated above, so every
    # day is guaranteed a real date rather than a blank/confusing one.
    trip_start: _date = parsed_start

    for day in normalized_output.days:
        stops = [
            StopOut(**enrich_stop(
                s.id,
                s.scheduledStart,
                s.scheduledEnd,
                s.transitFromPrev,
                day.stops[idx - 1].id if idx > 0 else None,
            ))
            for idx, s in enumerate(day.stops)
        ]
        # Attach the actual calendar date to each day (e.g. "2025-06-15")
        day_date = (trip_start + timedelta(days=day.dayIndex)).isoformat()

        enriched_days.append(DayOut(dayIndex=day.dayIndex, date=day_date, stops=stops))

    return ItineraryResult(
        cityId=normalized_output.cityId,
        days=enriched_days,
        summary=normalized_output.summary,
        tips=normalized_output.tips,
    )
