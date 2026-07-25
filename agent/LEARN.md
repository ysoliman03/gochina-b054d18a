# Learning Pydantic AI — Using This Project as Your Guide

> **You don't need any prior AI experience.** This guide explains every concept
> from scratch, using the actual code in this folder as the example.

---

## What is Pydantic AI?

Pydantic AI is a Python framework that makes it easy to build applications
powered by Large Language Models (LLMs like Gemini, GPT-4, Claude, Groq).

The two problems it solves:

| Problem | How Pydantic AI fixes it |
|---|---|
| LLMs return free-form text — hard to use in code | Forces the LLM to return a specific, validated Python object |
| The LLM needs to call your functions | The `@agent.tool` decorator registers any Python function as a "tool" |

---

## The File Map — Read In This Order

```
agent/
  models.py             ← 1️⃣  Define data shapes (Pydantic models + validators)
  data.py                ← 2️⃣  Load the travel database
  tools.py                ← 3️⃣  Functions the AI can call
  agent.py                ← 4️⃣  ⭐ The core — the Pydantic AI agent
  prompting.py            ← builds the sanitized user prompt (see guardrails.py)
  guardrails.py           ← prompt-injection defense (input + output)
  itinerary_repair.py     ← deterministic post-processing after the LLM responds
  server.py                ← 5️⃣  Wrap the agent in a web API (FastAPI)
```

---

## Concept 1 — Pydantic Models (`models.py`)

A **Pydantic model** is a Python class that describes the *shape* of some data.

```python
from pydantic import BaseModel

class UserProfile(BaseModel):
    name: str
    budget: str = "mid"   # "= mid" makes it optional with a default
    interests: list[str] = []
```

When you create one:
```python
profile = UserProfile(name="Alice", budget="luxury")
print(profile.budget)    # "luxury"
print(profile.interests) # []  ← used the default
```

If you pass the wrong type, Pydantic raises a clear error immediately —
before anything reaches the LLM.

**In this project** `models.py` has two groups:
- `ItineraryRequest` — the data the React form sends to Python
- `ItineraryResult` / `DayOut` / `StopOut` — what the agent must return

---

## Concept 2 — `computed_field` (`models.py`)

A **`@computed_field`** is a read-only property Pydantic treats like a real
field — it's derived from other fields and can never be set by the caller.
This project uses it for `days` on `ItineraryRequest`:

```python
from pydantic import BaseModel, computed_field
from datetime import date

class ItineraryRequest(BaseModel):
    startDate: str   # "2025-06-01"
    endDate: str     # "2025-06-06"

    @computed_field
    @property
    def days(self) -> int:
        start = date.fromisoformat(self.startDate)
        end   = date.fromisoformat(self.endDate)
        return (end - start).days + 1   # inclusive
```

**What this does in practice:** the React form sends `startDate` and `endDate`.
Pydantic automatically computes `days = 6` (Jun 1 → Jun 6) whenever it's read —
the LLM always has the correct day count, and callers can never override it
by sending their own `days` value.

**Why `computed_field` here instead of `@model_validator`?** Both can derive
one field from others, but they mean different things:
- `computed_field` — the value can *only* ever be calculated, never set from
  outside. Use it when that's always true (like `days` here).
- `model_validator(mode="after")` — the field exists normally and gets
  *overwritten* after validation. Use it when the value could come from
  either the caller or be derived, depending on the situation.

Since `days` should never be settable by the client, `computed_field` is the
correct tool — see the full reasoning in `models.py`'s own docstring.

---

## Concept 3 — Tools (`tools.py`)

A **tool** is a Python function you give to the agent so it can look things up.

The agent works like this:
1. You give it a task ("plan 3 days in Beijing")
2. It reads the tool docstrings and decides which tools to call
3. It calls tools, reads the results, calls more tools, etc.
4. Eventually it produces the final answer

In `tools.py` we have eight tool functions, each wrapped by `@agent.tool` in
`agent.py` (see Concept 4b):

| Function | What it does |
|---|---|
| `search_pois()` | Browse the 158 points of interest by category/tags |
| `get_poi_details()` | Get full info on one specific POI |
| `get_transit_time()` | Travel time in minutes between two POIs — used internally by the repair pass; the LLM-facing tool (`tool_get_transit_times`) batches multiple pairs into one call |
| `get_city_info()` | Overview of the destination city |
| `search_cuisine()` | Dishes matching the traveller's dietary restrictions |
| `get_transport_hubs()` | Airports/stations for arrival-day logistics |
| `get_city_connections()` | Train/flight connections between two cities |
| `check_travel_constraints()` | Public holidays, weather warnings, closures |

> **Key insight:** the functions in `tools.py` are *just regular Python*.
> No Pydantic AI imports. You can run and test them without the agent at all.

---

## Concept 4 — The Agent (`agent.py`) ⭐

This is where Pydantic AI comes in. Open `agent.py` and you'll see:

### 4a. Creating the agent

```python
from pydantic_ai import Agent
from pydantic_ai.models.groq import GroqModel

agent = Agent(
    GroqModel("llama-3.3-70b-versatile"),  # which LLM to use
    deps_type=ItineraryRequest,             # context available in every tool
    output_type=ItineraryResult,            # shape the answer must take
    system_prompt="You are a travel planner…",
    retries=3,                              # max retries on validation failure
)
```

- **`deps_type`** — structured data available inside every tool via `ctx.deps`
- **`output_type`** — the LLM MUST return something matching this Pydantic model
- **`retries`** — how many times the agent can retry after a `ModelRetry` (see Concept 6)

### 4b. Registering tools with `@agent.tool`

```python
@agent.tool
async def tool_search_pois(
    ctx: RunContext[ItineraryRequest],  # always first — gives access to ctx.deps
    categories: list[str] | None = None,
    tags: list[str] | None = None,
) -> list[dict]:
    """
    Search points of interest.         ← The LLM reads this docstring!
    categories: e.g. ["attraction"]    ← Describe arguments clearly
    """
    req = ctx.deps    # ← access the ItineraryRequest
    return search_pois(city_id=req.cityId, categories=categories, tags=tags)
```

**Three things happen when you use `@agent.tool`:**
1. The function is registered so the agent knows it exists
2. The docstring is sent to the LLM — write it as instructions, not code docs
3. The type hints are used to validate arguments the LLM passes

### 4c. `RunContext` — the dependency container

`ctx: RunContext[ItineraryRequest]` is the bridge between the agent session
and your tool function. Use `ctx.deps` to access whatever you passed as `deps=`.

```python
# In server.py, you call:
result = await agent.run(prompt, deps=request)   # request = ItineraryRequest object

# Inside any tool OR output_validator, ctx.deps IS that same request object:
async def some_tool(ctx: RunContext[ItineraryRequest], ...):
    city = ctx.deps.cityId         # e.g. "BJ"
    pace = ctx.deps.profile.pace   # e.g. "moderate"
    days = ctx.deps.days           # e.g. 6
```

---

## Concept 5 — Running the Agent (`server.py`)

```python
result = await agent.run(user_message, deps=request)
itinerary = result.output   # ← a validated ItineraryResult object
```

That's it. Everything else (calling tools, retrying bad output, streaming)
happens automatically inside Pydantic AI.

`result.output` is guaranteed to be a valid `ItineraryResult` instance.
You can access `result.output.days[0].stops[0].name` without worrying about
key errors or wrong types.

---

## Concept 6 — `@agent.output_validator` + `ModelRetry` (`agent.py`) ⭐

This is the most powerful quality control tool in Pydantic AI.

**The problem it solves:** Pydantic validates the *shape* of the LLM's output
(correct field types, no missing required fields) — but it can't enforce
*business rules* like "return exactly 6 days" or "every day needs dinner".

**The solution:**

```python
from pydantic_ai import ModelRetry

@agent.output_validator
async def validate_itinerary(
    ctx: RunContext[ItineraryRequest],
    result: ItineraryResult,
) -> ItineraryResult:
    expected = ctx.deps.days      # what the user asked for
    actual   = len(result.days)   # what the LLM returned

    if actual < expected:
        raise ModelRetry(         # ← this sends the message back to the LLM
            f"You returned {actual} days but I need {expected}. "
            f"Please add the missing days."
        )

    return result   # ← all good, return the validated result
```

**The retry loop:**

```
agent.run() called
    ↓
LLM produces output (e.g. 3 days instead of 6)
    ↓
@output_validator runs automatically
    ↓
raise ModelRetry("Missing 3 days: dayIndex 3, 4, 5")
    ↓
Pydantic AI sends the error message back to the LLM
    ↓
LLM tries again with the error as context
    ↓
repeat up to `retries` times
    ↓
result.output is returned  ✅
```

**Self-healing strategy actually used in this project** (see
`validate_itinerary` in `agent.py`) — fix what can be fixed, never hard-fail:

| Situation | Action | Why |
|---|---|---|
| Days out of order | Sort silently | Always safe |
| A day has 0 stops | Drop it silently | Better than crashing the frontend |
| Too many days (e.g. 7 instead of 6) | Trim silently | No retry wasted |
| Too few days (e.g. 3 instead of 6) | **Accept as-is, no retry** | A model that got the count wrong once tends to keep getting it wrong — retrying just burns time and cost. A partial itinerary beats an error screen. |
| 0 days total | `ModelRetry` | The only case worth a retry — something went very wrong |

Everything else (exact day count, min stops per day, no back-to-back
restaurants, real transit-based timing) is enforced *deterministically*
afterward by `itinerary_repair.py`, not by retrying the LLM — see Concept 7.

**Key rule:** the `ModelRetry` message is read by the LLM — write it like
you're telling a colleague exactly what went wrong and how to fix it.

---

## Concept 7 — Deterministic repair (`itinerary_repair.py`)

An LLM can be *told* rules (exact day count, real transit times, no closed
POIs), but it can't *guarantee* it follows them. So after `agent.run()`
succeeds, `server.py` runs the model's output through a plain-Python pass
that rebuilds the itinerary's *scheduling* from the same dataset the tools
use — not by asking the model again, by recomputing it directly:

- Drops invalid/duplicate POI ids, and POIs already used on another day
- Enforces exactly one dinner per day, never two restaurants back-to-back
- Recomputes real order and times from opening hours, avg duration, and
  actual transit distances — the model's own proposed times are a rough
  draft, not the final answer
- Hard-excludes any POI with a matching "closed this weekday" constraint
  for its exact scheduled date
- If a candidate stop fails to schedule, pulls a replacement from a wider
  fallback pool instead of leaving the day under-filled

**Why not just ask the model to try harder?** Retrying costs time and money
and doesn't *guarantee* correctness — the model could get it wrong again.
Recomputing deterministically in Python is fast, free, and always correct
relative to the dataset. The LLM's real job is picking good POIs that match
the traveller's taste; the exact scheduling math is better left to code.

---

## How the pieces connect

```
React form
  │  sends { cityId, startDate, endDate, profile, notes }
  ▼
FastAPI /generate-itinerary   (server.py)
  │
  │  ItineraryRequest created — `days` computed_field derives day count
  │  server.py rejects the request (422) if startDate/endDate aren't valid
  │
  │  prompting.py sanitizes `notes` (guardrails.sanitize_notes) and builds
  │  the prompt — untrusted input never reaches the model raw
  │
  │  agent.run(prompt, deps=request)
  ▼
Pydantic AI Agent             (agent.py)
  │
  ├── calls tool_get_city_info()
  ├── calls tool_check_constraints()
  ├── calls tool_search_pois(categories=["attraction", …])
  ├── calls tool_search_pois(categories=["restaurant"])
  ├── calls tool_search_cuisine()
  ├── calls tool_get_transit_times([[from, to], …])   ← batched, optional
  │
  │  LLM produces ItineraryResult JSON
  │
  │  @output_validator runs (Concept 6)
  │    → sort days, drop 0-stop days, trim excess, retry only if 0 days total
  │    → guardrails.clean_output() rewrites a hijacked summary / strips
  │      links and dangerous claims from tips
  │
  │  result.output  ← validated ItineraryResult
  ▼
itinerary_repair.py — deterministic repair pass (Concept 7)
  │  rebuilds real order/timing/dates from the dataset — not another LLM call
  ▼
server.py enriches each stop with full POI data
  │  fills day.date ("2025-06-01", "2025-06-02", …) from startDate
  ▼
React displays the itinerary
```

---

## Experiment Ideas

Once the server is running, try these to build your intuition:

### 1 — Add a new validation rule
In `agent.py`, add a rule to `validate_itinerary` that checks every day
has at least one restaurant stop. Practice writing a good `ModelRetry` message.

### 2 — Add a new tool
In `tools.py`, write a function that returns a packing list for the weather.
Register it with `@agent.tool` in `agent.py`. Watch the agent start using it.

### 3 — Add a new field to the result
Add a field to `ItineraryResult` in `models.py`, e.g.:
```python
packingTips: list[str] = []
```
Then update the system prompt to ask the agent to fill it in.

### 4 — Try a standalone agent
Create a new file `hello_agent.py`:
```python
import asyncio
from dotenv import load_dotenv
load_dotenv()

from pydantic_ai import Agent, ModelRetry
from pydantic_ai.models.groq import GroqModel
from pydantic import BaseModel, model_validator

class CityFact(BaseModel):
    city: str
    funFact: str
    bestMonth: str
    population: int = 0

    @model_validator(mode="after")
    def ensure_population_positive(self) -> "CityFact":
        if self.population < 0:
            self.population = 0
        return self

agent = Agent(
    GroqModel("llama-3.3-70b-versatile"),
    output_type=CityFact,
    system_prompt="You are a geography expert.",
    retries=2,
)

@agent.output_validator
async def check_fact(ctx, result: CityFact) -> CityFact:
    if len(result.funFact) < 20:
        raise ModelRetry("The fun fact is too short — write at least one full sentence.")
    return result

async def main():
    result = await agent.run("Tell me about Beijing")
    print(result.output.funFact)

asyncio.run(main())
```
Run it with: `python hello_agent.py`

---

## Glossary

| Term | Plain-English meaning |
|---|---|
| **Agent** | The main Pydantic AI object that wraps an LLM |
| **Tool** | A Python function the agent can call to get information |
| **deps** | Structured data passed to `agent.run()`, available in all tools via `ctx.deps` |
| **output_type** | A Pydantic model that defines what shape the final answer must take |
| **RunContext** | A container holding `ctx.deps` — always the first argument of a tool or validator |
| **system_prompt** | Standing instructions that shape the agent's behaviour every time |
| **computed_field** | A read-only Pydantic property, always derived from other fields — callers can never set it directly |
| **model_validator** | A Pydantic hook that runs after all fields are set — use it when a field could come from the caller *or* be derived |
| **output_validator** | A Pydantic AI hook that runs after the LLM produces output — raise `ModelRetry` to reject and retry |
| **ModelRetry** | An exception you raise inside `output_validator` — Pydantic AI sends your message back to the LLM |
| **retries** | How many times the agent can retry after a `ModelRetry` before giving up |
| **LLM** | Large Language Model — the AI (Groq, Gemini, GPT-4, Claude, …) |
