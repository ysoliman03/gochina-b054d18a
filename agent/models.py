"""
models.py — Data shapes used by the agent.
────────────────────────────────────────────────────────────────────────────
 📖 PYDANTIC AI CONCEPT #1: Pydantic Models
────────────────────────────────────────────────────────────────────────────
Pydantic is a Python library for data validation.
You describe the *shape* of your data using a class that inherits from
`BaseModel`, and Pydantic automatically:

  ✔ validates incoming data (wrong type? missing field? → clear error)
  ✔ converts types (e.g. "3" → 3 for an int field)
  ✔ generates JSON schemas (used by the AI to understand what to return)

Example:
    class Dog(BaseModel):
        name: str           # required string
        age: int            # required integer
        tricks: list[str] = []  # optional list, defaults to empty

    Dog(name="Rex", age=3)           # ✔ valid
    Dog(name="Rex", age="three")     # ✔ also valid — Pydantic converts "three"? No, raises error!
    Dog(name=123,   age=3)           # ✔ Pydantic coerces 123 → "123" for str fields

In this project there are two main model groups:
  • REQUEST models  — the data the React app sends TO the agent
  • RESPONSE models — the data the agent sends BACK to the React app

────────────────────────────────────────────────────────────────────────────
 📖 BONUS CONCEPT: computed_field
────────────────────────────────────────────────────────────────────────────
A @computed_field is a read-only property that Pydantic treats like a real
field — it appears in the JSON schema, gets serialised, and is always
derived from other fields. Use it when a value can ONLY ever be calculated
and should never be set directly from outside.

    from pydantic import computed_field

    class MyModel(BaseModel):
        startDate: str
        endDate: str

        @computed_field
        @property
        def days(self) -> int:
            # always computed — callers cannot override this
            return (date.fromisoformat(self.endDate)
                    - date.fromisoformat(self.startDate)).days + 1

Compare with @model_validator (which you may see in other projects):
  • computed_field  — field is DERIVED, read-only, can never be sent by caller
  • model_validator — field exists normally but gets OVERWRITTEN after validation
  Use computed_field when the value should always come from other fields.
  Use model_validator when the value can come from outside OR be derived.
"""
from __future__ import annotations
from datetime import date as _date
from pydantic import BaseModel, Field, computed_field


# ═══════════════════════════════════════════════════════════════════════════
#  REQUEST  — What the React form sends to /generate-itinerary
# ═══════════════════════════════════════════════════════════════════════════

class UserProfile(BaseModel):
    """Mirrors the `profile` object in the React Zustand store."""
    name: str = ""
    nationality: str = ""
    groupType: str = "couple"           # "solo" | "couple" | "family" | "friends"
    pace: str = "moderate"              # "slow" | "moderate" | "fast"
    budget: str = "mid"                 # "budget" | "mid" | "luxury"
    interests: list[str] = []           # e.g. ["historical", "food", "nightlife"]
    dietaryRestrictions: list[str] = [] # e.g. ["Halal", "No Pork"]


class ItineraryRequest(BaseModel):
    """The full body of a POST /generate-itinerary request."""
    cityId: str                                    # e.g. "BJ", "SH", "XA", "CQ"
    startDate: str                                 # "YYYY-MM-DD" — when the trip starts
    endDate: str                                   # "YYYY-MM-DD" — when the trip ends
    profile: UserProfile = Field(default_factory=UserProfile)
    notes: str = ""                                # free-text from the traveller

    # ── BONUS CONCEPT: computed_field ───────────────────────────────────────
    # days is always derived from startDate/endDate — callers cannot set it.
    # Pydantic treats it like a real field: it appears in the JSON schema and
    # gets serialised, but it is never read from incoming JSON.
    @computed_field
    @property
    def days(self) -> int:
        """Number of trip days, inclusive (Jun 1 → Jun 4 = 4 days)."""
        try:
            start = _date.fromisoformat(self.startDate)
            end   = _date.fromisoformat(self.endDate)
            return max(1, min(14, (end - start).days + 1))
        except ValueError:
            return 3  # fallback if dates are malformed


# ═══════════════════════════════════════════════════════════════════════════
#  RESPONSE  — What the agent returns
# ═══════════════════════════════════════════════════════════════════════════
#
# These models do double duty:
#  1. They tell Pydantic AI exactly what structured output to produce.
#  2. FastAPI uses them to generate the OpenAPI response schema automatically.
#
# The agent MUST return valid JSON that matches ItineraryResult —
# Pydantic AI enforces this and will retry if the LLM produces garbage.

class StopOut(BaseModel):
    """One stop in a day's plan (attraction, restaurant, park, …)."""
    id: str              # POI id — e.g. "BJ001" (must match a real POI)
    name: str            # human-readable, used in the preview
    scheduledStart: int  # minutes since midnight — 9:00 AM = 540
    scheduledEnd: int    # scheduledStart + duration
    transitFromPrev: int # travel time from the previous stop; 0 for first stop
    # These fields are filled in by server.py after the agent responds:
    nameZh: str = ""
    category: str = ""
    district: str = ""
    description: str = ""
    tips: str = ""
    duration: int = 0
    transitInfo: dict | None = None  # real connection record (mode, distanceKm, notes) when available


class DayOut(BaseModel):
    """One day in the itinerary."""
    dayIndex: int        # 0-based (Day 1 = dayIndex 0)
    date: str = ""       # "YYYY-MM-DD" — filled in by server.py from the request dates
    stops: list[StopOut]


class ItineraryResult(BaseModel):
    """
    The complete itinerary returned by the agent.
    This is the `result_type` of the Pydantic AI Agent — see agent.py.
    """
    cityId: str
    days: list[DayOut]
    summary: str         # 2-3 warm sentences about the trip
    tips: list[str] = [] # practical tips for the traveller
