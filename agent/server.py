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
    # Build a human-readable date range string for the prompt
    date_line = ""
    if request.startDate and request.endDate:
        date_line = f"  Dates      : {request.startDate} → {request.endDate} ({request.days} days)"
    else:
        date_line = f"  Duration   : {request.days} day(s)"

    # Enumerate the exact dayIndex values the model must produce — very explicit
    required_days = list(range(request.days))  # e.g. [0, 1, 2, 3, 4, 5] for 6 days

    min_stops = {"slow": 3, "moderate": 4, "fast": 5}.get(request.profile.pace, 4)

    # Build the user message — this is what the agent "reads" as input
    prompt = f"""
Create a {request.days}-day itinerary for {request.cityId.upper()}.

Trip details:
{date_line}
  Group type : {request.profile.groupType}
  Pace       : {request.profile.pace}  (minimum {min_stops} stops per day including dinner)
  Budget     : {request.profile.budget}
  Interests  : {", ".join(request.profile.interests) or "general sightseeing"}
  Dietary    : {", ".join(request.profile.dietaryRestrictions) or "no restrictions"}
{f"  Special requests: {request.notes}" if request.notes.strip() else ""}

YOUR OUTPUT MUST CONTAIN EXACTLY {request.days} DAYS.
Required dayIndex values: {required_days}
Each day needs at least {min_stops} stops (including 1 dinner restaurant).
Do not stop early. Do not skip any dayIndex.
""".strip()

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

    # Enrich each stop with full POI data (description, tips, etc.)
    # The agent only returned the scheduling info — this merges in everything else.
    enriched_days: list[DayOut] = []

    # Compute the starting calendar date (if provided by the frontend)
    trip_start: _date | None = None
    if request.startDate:
        try:
            trip_start = _date.fromisoformat(request.startDate)
        except ValueError:
            pass

    for day in result.output.days:
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
        day_date = ""
        if trip_start is not None:
            day_date = (trip_start + timedelta(days=day.dayIndex)).isoformat()

        enriched_days.append(DayOut(dayIndex=day.dayIndex, date=day_date, stops=stops))

    return ItineraryResult(
        cityId=result.output.cityId,
        days=enriched_days,
        summary=result.output.summary,
        tips=result.output.tips,
    )
