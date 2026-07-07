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
from datetime import date, timedelta
import math
import re

from data import (
    CITIES,
    CITY_CONNECTIONS,
    CONSTRAINTS,
    CUISINE,
    POIS,
    POI_CONNECTIONS,
    TRANSPORT_HUBS,
)

EARTH_RADIUS_KM = 6371


def _distance_km(a: dict | None, b: dict | None) -> float | None:
    if not a or not b:
        return None
    if not isinstance(a.get("lat"), (int, float)) or not isinstance(a.get("lng"), (int, float)):
        return None
    if not isinstance(b.get("lat"), (int, float)) or not isinstance(b.get("lng"), (int, float)):
        return None

    lat1 = math.radians(a["lat"])
    lat2 = math.radians(b["lat"])
    dlat = lat2 - lat1
    dlng = math.radians(b["lng"] - a["lng"])
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(min(1, math.sqrt(h)))


def estimate_transit_minutes(from_poi_id: str | None, to_poi_id: str | None) -> int:
    """Conservative city-transit estimate from POI coordinates when no curated route exists."""
    if not from_poi_id or not to_poi_id:
        return 0

    from_poi = POIS.get(from_poi_id)
    to_poi = POIS.get(to_poi_id)
    km = _distance_km(from_poi, to_poi)
    if km is None:
        return 20

    road_km = km * 1.35
    same_district = from_poi.get("district") and from_poi.get("district") == to_poi.get("district")

    if road_km <= 1.2:
        minutes = road_km / 4.5 * 60 + 5
    elif same_district and road_km <= 4:
        minutes = road_km / 14 * 60 + 8
    elif road_km <= 12:
        minutes = road_km / 22 * 60 + 10
    elif road_km <= 35:
        minutes = road_km / 32 * 60 + 15
    else:
        minutes = road_km / 45 * 60 + 20

    return max(8, min(180, int(math.ceil(minutes / 5) * 5)))


def _estimated_transit_info(from_poi_id: str, to_poi_id: str) -> dict | None:
    from_poi = POIS.get(from_poi_id)
    to_poi = POIS.get(to_poi_id)
    if not from_poi or not to_poi:
        return None

    distance = _distance_km(from_poi, to_poi)
    return {
        "from": from_poi_id,
        "to": to_poi_id,
        "mode": "estimated",
        "duration": estimate_transit_minutes(from_poi_id, to_poi_id),
        "distanceKm": round(distance, 1) if distance is not None else None,
        "notes": "Estimated from POI coordinates because this route is not in the curated transit dataset.",
    }


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
        "cautions":       (poi.get("cautions") or "")[:160],
    }


def _normalize_dietary_restriction(label: str) -> str:
    mapping = {
        "Vegetarian": "vegetarian",
        "Vegan": "vegan",
        "Pescatarian": "pescatarian",
        "Halal": "halal",
        "Kosher": "kosher",
        "No Pork": "no_pork",
        "No Beef": "no_beef",
        "Dairy Free": "dairy_free",
        "Nut Free": "nut_free",
        "Egg Free": "egg_free",
        "Gluten Free": "gluten_free",
        "Shellfish Free": "shellfish_free",
        "Soy Free": "soy_free",
        "No Alcohol": "no_alcohol",
        "Low Spice": "low_spice",
    }
    return mapping.get(label, re.sub(r"[\s-]+", "_", label.strip().lower()))


def _dish_matches_restrictions(dish: dict, dietary_restrictions: list[str] | None) -> bool:
    restrictions = [
        _normalize_dietary_restriction(label)
        for label in (dietary_restrictions or [])
    ]
    if not restrictions:
        return True

    tags = set(dish.get("dietaryTags") or [])
    return all(restriction in tags for restriction in restrictions)


def _slim_dish(dish: dict) -> dict:
    return {
        "id": dish.get("id"),
        "cityId": dish.get("cityId"),
        "poiIds": dish.get("poiIds", []),
        "name": dish.get("name", ""),
        "nameZh": dish.get("nameZh", ""),
        "category": dish.get("category", ""),
        "dietaryTags": dish.get("dietaryTags", []),
        "description": (dish.get("description") or "")[:240],
    }


def _slim_hub(hub: dict) -> dict:
    return {
        "id": hub.get("id"),
        "cityId": hub.get("cityId"),
        "name": hub.get("name", ""),
        "nameZh": hub.get("nameZh", ""),
        "type": hub.get("type", ""),
        "district": hub.get("district", ""),
        "openingHours": hub.get("openingHours", ""),
        "foreignFriendly": hub.get("foreignFriendly"),
        "description": (hub.get("description") or "")[:220],
        "tips": hub.get("tips", [])[:2],
        "cautions": hub.get("cautions", [])[:2],
    }


def _parse_iso_date(value: str) -> date | None:
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _parse_month_day(value: str) -> tuple[int, int] | None:
    if not re.fullmatch(r"\d{2}-\d{2}", value or ""):
        return None

    month, day = [int(part) for part in value.split("-")]
    try:
        date(2024, month, day)
    except ValueError:
        return None

    return month, day


def _recurring_window_overlaps(
    trip_start: date,
    trip_end: date,
    start_value: str,
    end_value: str,
) -> bool:
    start = _parse_month_day(start_value)
    end = _parse_month_day(end_value)
    if not start or not end:
        return False

    crosses_year = start > end
    for year in range(trip_start.year - 1, trip_end.year + 2):
        occurrence_start = date(year, start[0], start[1])
        occurrence_end_year = year + 1 if crosses_year else year
        occurrence_end = date(occurrence_end_year, end[0], end[1])

        if trip_start <= occurrence_end and trip_end >= occurrence_start:
            return True

    return False


def _parse_weekday_token(token: str) -> int | None:
    token = token.lower()
    if token.startswith("sun"):
        return 0
    if token.startswith("mon"):
        return 1
    if token.startswith("tue"):
        return 2
    if token.startswith("wed"):
        return 3
    if token.startswith("thu"):
        return 4
    if token.startswith("fri"):
        return 5
    if token.startswith("sat"):
        return 6
    return None


def _weekday_range(start: int, end: int) -> list[int]:
    days = []
    current = start
    while True:
        days.append(current)
        if current == end:
            break
        current = (current + 1) % 7
    return days


def _infer_weekly_days(constraint: dict) -> list[int]:
    days: set[int] = set()
    text = (
        f"{constraint.get('title', '')} "
        f"{constraint.get('impact', '')} "
        f"{constraint.get('action', '')}"
    ).lower()
    text = re.sub(r"[\u2013\u2014]", "-", text)
    day_token = (
        r"(sun(?:day)?s?|mon(?:day)?s?|tue(?:s|sday)?s?|wed(?:nesday)?s?|"
        r"thu(?:r|rs|rsday)?s?|fri(?:day)?s?|sat(?:urday)?s?)"
    )

    if re.search(r"\bweekends?\b", text):
        days.update({0, 6})

    if re.search(r"\bweekdays?\b", text):
        days.update({1, 2, 3, 4, 5})

    for start_token, end_token in re.findall(
        rf"\b{day_token}\b\s*(?:-|to|through|thru)\s*\b{day_token}\b",
        text,
    ):
        start = _parse_weekday_token(start_token)
        end = _parse_weekday_token(end_token)
        if start is not None and end is not None:
            days.update(_weekday_range(start, end))

    for token in re.findall(rf"\b{day_token}\b", text):
        day = _parse_weekday_token(token)
        if day is not None:
            days.add(day)

    return list(days)


def _range_contains_weekday(trip_start: date, trip_end: date, weekdays: list[int]) -> bool:
    if not weekdays:
        return True

    if (trip_end - trip_start).days >= 6:
        return True

    targets = set(weekdays)
    current = trip_start
    while current <= trip_end:
        # Python: Monday=0. Agent convention here: Sunday=0, Monday=1.
        weekday = (current.weekday() + 1) % 7
        if weekday in targets:
            return True
        current += timedelta(days=1)

    return False


def _constraint_matches_dates(constraint: dict, trip_start: date, trip_end: date) -> bool:
    recurrence = constraint.get("recurrencePattern")

    if recurrence == "daily":
        return True

    if recurrence == "weekly":
        return _range_contains_weekday(trip_start, trip_end, _infer_weekly_days(constraint))

    if recurrence in {"seasonal", "yearly"}:
        return _recurring_window_overlaps(
            trip_start,
            trip_end,
            constraint.get("startDate", ""),
            constraint.get("endDate", ""),
        )

    if recurrence == "monthly":
        start_date = constraint.get("startDate", "")
        end_date = constraint.get("endDate", "")
        return (
            _recurring_window_overlaps(trip_start, trip_end, start_date, end_date)
            if start_date and end_date
            else True
        )

    return False


# ── Tool functions ──────────────────────────────────────────────────────────
# Each function below will be wrapped by @agent.tool in agent.py.
# They are plain Python — no Pydantic AI imports here.

def search_pois(
    city_id: str,
    categories: list[str] | None = None,
    tags: list[str] | None = None,
    budget_max: int | None = None,
    dietary_restrictions: list[str] | None = None,
    group_type: str | None = None,
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

    def group_penalty(poi: dict) -> int:
        suitable_for = poi.get("suitableFor") or []
        if not group_type or not suitable_for:
            return 0
        return 0 if group_type in suitable_for else 1

    # Sort by profile fit first, then foreignFriendly score.
    results.sort(
        key=lambda p: (
            group_penalty(p),
            -(p.get("foreignFriendly") or 0),
            p.get("name", ""),
        )
    )
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
    Uses curated connections first, then estimates from POI coordinates.
    """
    matches = [
        c for c in POI_CONNECTIONS
        if (c["from"] == from_poi_id and c["to"] == to_poi_id)
        or (c["from"] == to_poi_id   and c["to"] == from_poi_id)
    ]
    if matches:
        return min(c["duration"] for c in matches)
    return estimate_transit_minutes(from_poi_id, to_poi_id)


def get_transit_info(from_poi_id: str | None, to_poi_id: str | None) -> dict | None:
    """
    Return the full connection record (mode, duration, distanceKm, notes) between
    two POIs. Uses curated connections first, then estimates from POI coordinates.
    """
    if not from_poi_id or not to_poi_id:
        return None
    matches = [
        c for c in POI_CONNECTIONS
        if (c["from"] == from_poi_id and c["to"] == to_poi_id)
        or (c["from"] == to_poi_id   and c["to"] == from_poi_id)
    ]
    if not matches:
        return _estimated_transit_info(from_poi_id, to_poi_id)
    return min(matches, key=lambda c: c["duration"])


def get_city_info(city_id: str) -> dict | None:
    """Return high-level information about a city: name, intro text, tags, coordinates."""
    return CITIES.get(city_id)


def search_cuisine(
    city_id: str,
    dietary_restrictions: list[str] | None = None,
    max_results: int = 12,
) -> list[dict]:
    """
    Search cuisine dishes in a city.
    dietary_restrictions uses safe tags: a dish matches only when every requested
    restriction appears in the dish dietaryTags list.
    """
    results = [
        dish
        for dish in CUISINE
        if dish.get("cityId") == city_id
        and _dish_matches_restrictions(dish, dietary_restrictions)
    ]
    results.sort(key=lambda dish: (dish.get("category", ""), dish.get("name", "")))
    return [_slim_dish(dish) for dish in results[:max_results]]


def get_transport_hubs(city_id: str) -> list[dict]:
    """
    Return airports and railway stations for a city.
    Use this for arrival/departure planning, first-day logistics, and transfer advice.
    """
    hubs = [hub for hub in TRANSPORT_HUBS if hub.get("cityId") == city_id]
    hubs.sort(key=lambda hub: (hub.get("type", ""), hub.get("name", "")))
    return [_slim_hub(hub) for hub in hubs]


def get_city_connections(from_city_id: str, to_city_id: str) -> list[dict]:
    """
    Return known transport connections between two cities.
    Connections are treated as bidirectional for planning purposes.
    """
    return [
        connection
        for connection in CITY_CONNECTIONS
        if (
            connection.get("fromCityId") == from_city_id
            and connection.get("toCityId") == to_city_id
        )
        or (
            connection.get("fromCityId") == to_city_id
            and connection.get("toCityId") == from_city_id
        )
    ]


def check_travel_constraints(city_id: str, start_date: str, end_date: str) -> list[dict]:
    """
    Return active travel warnings for this city and trip date range.
    Includes nationwide warnings (public holidays, air quality) and city-specific ones.
    The agent should check this first and mention important warnings in its summary.
    """
    trip_start = _parse_iso_date(start_date)
    trip_end = _parse_iso_date(end_date)

    if not trip_start or not trip_end or trip_start > trip_end:
        return []

    relevant = [
        c for c in CONSTRAINTS
        if (c.get("cityId") is None or c.get("cityId") == city_id)
        and _constraint_matches_dates(c, trip_start, trip_end)
    ]
    return [
        {
            "id":       c.get("id", ""),
            "title":    c.get("title", ""),
            "type":     c.get("type", ""),
            "poiId":    c.get("poiId"),
            "startDate": c.get("startDate", ""),
            "endDate":   c.get("endDate", ""),
            "recurrencePattern": c.get("recurrencePattern", ""),
            "severity": c.get("severity", ""),
            "impact":   c.get("impact", ""),
            "action":   c.get("action", ""),
        }
        for c in relevant[:8]  # cap at 8 to save tokens
    ]


# ── Enrichment helper (called by server.py, not by the agent) ──────────────

def enrich_stop(
    poi_id: str,
    scheduled_start: int,
    scheduled_end: int,
    transit: int,
    prev_poi_id: str | None = None,
) -> dict:
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
        "transitInfo":    get_transit_info(prev_poi_id, poi_id),
    }
