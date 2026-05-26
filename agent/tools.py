"""
tools.py — Functions the AI agent can call.
────────────────────────────────────────────────────────────────────────────
 📖 PYDANTIC AI CONCEPT #2: Tools
────────────────────────────────────────────────────────────────────────────
An AI "tool" is just a regular Python function that you give to the agent.
When the agent is thinking, it can decide to call one of your tools to get
information it needs — like a person Googling something mid-conversation.

In Pydantic AI you register tools with the @agent.tool decorator (see agent.py).
This file just defines the *logic* of each tool as plain functions —
keeping them separate makes them easy to test without running the AI at all.

HOW THE AI USES TOOLS:
  1. You describe what each tool does in its docstring.
  2. The AI reads those docstrings to understand what tools are available.
  3. When it needs information, it calls a tool and waits for the result.
  4. It can call multiple tools, in any order, as many times as it likes.

Think of tools as the agent's "senses" — they let it reach out and touch
the real world (your database, an API, a file, etc.).

In this project the tools give the agent access to:
  • The 158 POI records (search + details)
  • Transit times between POIs
  • City information
  • Travel constraints (holidays, weather warnings)
"""
from __future__ import annotations
from data import POIS, CITIES, CONSTRAINTS, POI_CONNECTIONS


# ── Helper: trim a POI to only the fields the agent needs ──────────────────
# This saves tokens (= money) because the agent doesn't need every field
# when it's just browsing the list — it can call get_poi_details() later.

def _slim(poi: dict) -> dict:
    return {
        "id":             poi.get("id"),
        "name":           poi.get("name"),
        "category":       poi.get("category"),
        "district":       poi.get("district"),
        "hours":          poi.get("hours", "09:00-18:00"),
        "duration":       poi.get("duration"),           # minutes to spend here
        "price":          poi.get("price"),              # 1=budget, 2=mid, 3=luxury
        "bestTime":       poi.get("bestTime", "any"),    # "morning" | "afternoon" | "evening"
        "tags":           (poi.get("tags") or [])[:5],
        "foreignFriendly": poi.get("foreignFriendly", 3),
        "suitableFor":    poi.get("suitableFor", []),
        "tips":           (poi.get("tips") or "")[:120], # first 120 chars only
    }


# ── Tool functions ──────────────────────────────────────────────────────────
# Each function below will be wrapped by @agent.tool in agent.py.
# They are plain Python — no Pydantic AI imports here.

def search_pois(
    city_id: str,
    categories: list[str] | None = None,
    tags: list[str] | None = None,
    budget_max: int | None = None,
    dietary_restrictions: list[str] | None = None,
    max_results: int = 20,
) -> list[dict]:
    """
    Search POIs in a city.

    categories: e.g. ["attraction", "restaurant", "park", "market"]
    tags:       match any — e.g. ["historical", "food", "UNESCO", "nightlife"]
    budget_max: 1=budget, 2=mid, 3=luxury
    dietary_restrictions: e.g. ["Halal", "No Pork", "Vegetarian"]
    """
    results = [p for p in POIS.values() if p.get("cityId") == city_id]

    if categories:
        results = [p for p in results if p.get("category") in categories]

    if tags:
        results = [p for p in results if any(t in (p.get("tags") or []) for t in tags)]

    if budget_max is not None:
        results = [p for p in results if (p.get("price") or 0) <= budget_max]

    if dietary_restrictions:
        filtered = []
        for p in results:
            ok = True
            dr = dietary_restrictions
            if "Halal" in dr and p.get("halal") is False:
                ok = False
            if ("Vegetarian" in dr or "Vegan" in dr) \
                    and p.get("vegetarian") is False \
                    and p.get("category") == "restaurant":
                ok = False
            if "No Pork" in dr and p.get("containsPork") is True:
                ok = False
            if ok:
                filtered.append(p)
        results = filtered

    # Sort by foreignFriendly score (best experience for tourists first)
    results.sort(key=lambda p: (-p.get("foreignFriendly", 0), p.get("name", "")))
    return [_slim(p) for p in results[:max_results]]


def get_poi_details(poi_id: str) -> dict | None:
    """
    Get the full details for one POI: description, highlights, cautions, exact hours.
    Call this after search_pois when you need more info about a specific place.
    """
    poi = POIS.get(poi_id)
    if not poi:
        return None
    return {
        "id":              poi["id"],
        "name":            poi.get("name", ""),
        "nameZh":          poi.get("nameZh", ""),
        "category":        poi.get("category", ""),
        "district":        poi.get("district", ""),
        "description":    (poi.get("description") or "")[:300],
        "highlights":      poi.get("highlights", ""),
        "tips":            poi.get("tips", ""),
        "cautions":        poi.get("cautions", ""),
        "hours":           poi.get("hours", "09:00-18:00"),
        "duration":        poi.get("duration", 60),
        "price":           poi.get("price", 1),
        "lat":             poi.get("lat"),
        "lng":             poi.get("lng"),
        "bestTime":        poi.get("bestTime", "any"),
        "suitableFor":     poi.get("suitableFor", []),
        "bookingRequired": poi.get("bookingRequired", False),
        "foreignFriendly": poi.get("foreignFriendly", 3),
    }


def get_transit_time(from_poi_id: str, to_poi_id: str) -> int:
    """
    Return the fastest transit time in minutes between two POIs.
    Returns 20 minutes as a sensible default if the route is not in the database.
    """
    matches = [
        c for c in POI_CONNECTIONS
        if (c["from"] == from_poi_id and c["to"] == to_poi_id)
        or (c["from"] == to_poi_id   and c["to"] == from_poi_id)
    ]
    return min((c["duration"] for c in matches), default=20)


def get_city_info(city_id: str) -> dict | None:
    """Return high-level information about a city: name, intro text, tags, coordinates."""
    return CITIES.get(city_id)


def check_travel_constraints(city_id: str) -> list[dict]:
    """
    Return any active travel warnings for this city.
    Includes nationwide warnings (public holidays, air quality) and city-specific ones.
    The agent should check this first and mention important warnings in its summary.
    """
    relevant = [
        c for c in CONSTRAINTS
        if c.get("cityId") is None or c.get("cityId") == city_id
    ]
    return [
        {
            "title":    c.get("title", ""),
            "type":     c.get("type", ""),
            "severity": c.get("severity", ""),
            "impact":   c.get("impact", ""),
            "action":   c.get("action", ""),
        }
        for c in relevant[:8]  # cap at 8 to save tokens
    ]


# ── Enrichment helper (called by server.py, not by the agent) ──────────────

def enrich_stop(poi_id: str, scheduled_start: int, scheduled_end: int, transit: int) -> dict:
    """
    After the agent decides *which* POIs to include and *when*,
    this function merges the timing with the full POI data from our database.
    Called in server.py before sending the response to the React app.
    """
    poi = POIS.get(poi_id, {})
    return {
        "id":             poi_id,
        "name":           poi.get("name", poi_id),
        "nameZh":         poi.get("nameZh", ""),
        "category":       poi.get("category", ""),
        "district":       poi.get("district", ""),
        "description":   (poi.get("description") or "")[:200],
        "tips":           poi.get("tips", ""),
        "duration":       poi.get("duration", scheduled_end - scheduled_start),
        "scheduledStart": scheduled_start,
        "scheduledEnd":   scheduled_end,
        "transitFromPrev": transit,
    }
