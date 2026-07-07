from __future__ import annotations

import re

from data import POIS
from models import DayOut, ItineraryRequest, ItineraryResult, StopOut
from tools import get_transit_time, search_pois


DAY_START = 9 * 60
DAY_END = 21 * 60
DINNER_TARGET = 18 * 60 + 30
MAX_CLOCK_MINUTE = 23 * 60 + 59

MAX_STOPS_BY_PACE = {
    "slow": 3,
    "moderate": 4,
    "fast": 5,
}

BEST_TIME_ORDER = {
    "morning": 0,
    "daytime": 1,
    "any": 1,
    "afternoon": 2,
    "evening": 3,
}

BEST_TIME_TARGET = {
    "morning": DAY_START,
    "daytime": DAY_START,
    "any": DAY_START,
    "afternoon": 13 * 60,
    "evening": 17 * 60,
}


def _as_int(value: object, default: int) -> int:
    return value if isinstance(value, int) else default


def _clamp_minute(value: int) -> int:
    return max(0, min(MAX_CLOCK_MINUTE, int(value)))


def _poi_for_stop(stop: StopOut) -> dict | None:
    return POIS.get(stop.id)


def _valid_city_poi(stop: StopOut, city_id: str) -> bool:
    poi = _poi_for_stop(stop)
    return bool(poi and poi.get("cityId") == city_id)


def _parse_clock(value: str) -> int | None:
    match = re.fullmatch(r"(\d{1,2}):(\d{2})", value.strip())
    if not match:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2))
    if minute > 59:
        return None
    if hour == 24:
        return MAX_CLOCK_MINUTE if minute == 0 else None
    if hour > 23:
        return None
    return hour * 60 + minute


def _hours_window(poi: dict) -> tuple[int, int]:
    hours = str(poi.get("hours") or "09:00-18:00")
    if hours == "24h":
        return 0, MAX_CLOCK_MINUTE

    parts = hours.split("-", 1)
    if len(parts) != 2:
        return DAY_START, DAY_END

    open_min = _parse_clock(parts[0])
    close_min = _parse_clock(parts[1])
    if open_min is None:
        open_min = DAY_START
    if close_min is None:
        close_min = DAY_END
    if close_min <= open_min:
        close_min += 24 * 60
    return open_min, min(close_min, MAX_CLOCK_MINUTE)


def _stop_duration(poi: dict, default: int = 60) -> int:
    duration = poi.get("duration")
    if not isinstance(duration, int) or duration <= 0:
        return default
    return duration


def _budget_max(request: ItineraryRequest) -> int:
    return {"budget": 1, "mid": 2, "luxury": 5}.get(request.profile.budget, 2)


def _profile_poi_ok(request: ItineraryRequest, poi: dict) -> bool:
    price = poi.get("price")
    if isinstance(price, int) and price > _budget_max(request):
        return False

    suitable_for = poi.get("suitableFor") or []
    if suitable_for and request.profile.groupType not in suitable_for:
        return False

    return True


def _fallback_stop_ids(
    request: ItineraryRequest,
    categories: list[str],
    used_ids: set[str],
    max_results: int,
) -> list[str]:
    results = search_pois(
        city_id=request.cityId,
        categories=categories,
        budget_max=_budget_max(request),
        dietary_restrictions=request.profile.dietaryRestrictions or None,
        group_type=request.profile.groupType,
        max_results=max_results * 3,
    )
    return [p["id"] for p in results if p.get("id") not in used_ids][:max_results]


def _choose_dinner(
    request: ItineraryRequest,
    stops: list[StopOut],
    used_ids: set[str],
) -> StopOut | None:
    restaurants = [
        (index, stop)
        for index, stop in enumerate(stops)
        if _valid_city_poi(stop, request.cityId)
        and POIS[stop.id].get("category") == "restaurant"
        and _profile_poi_ok(request, POIS[stop.id])
        and stop.id not in used_ids
    ]
    if restaurants:
        _, chosen = min(
            restaurants,
            key=lambda item: (
                abs(_as_int(item[1].scheduledStart, DINNER_TARGET) - DINNER_TARGET),
                item[0],
            ),
        )
        return chosen

    fallback_ids = _fallback_stop_ids(request, ["restaurant"], used_ids, 1)
    if not fallback_ids:
        return None
    return StopOut(
        id=fallback_ids[0],
        name=POIS[fallback_ids[0]].get("name", fallback_ids[0]),
        scheduledStart=DINNER_TARGET,
        scheduledEnd=DINNER_TARGET + _stop_duration(POIS[fallback_ids[0]]),
        transitFromPrev=0,
    )


def _candidate_non_restaurants(
    request: ItineraryRequest,
    stops: list[StopOut],
    dinner_id: str | None,
    used_ids: set[str],
    max_count: int,
) -> list[StopOut]:
    candidates: list[StopOut] = []
    seen: set[str] = set()
    for stop in stops:
        if stop.id == dinner_id or stop.id in seen or stop.id in used_ids:
            continue
        if not _valid_city_poi(stop, request.cityId):
            continue
        if POIS[stop.id].get("category") == "restaurant":
            continue
        if not _profile_poi_ok(request, POIS[stop.id]):
            continue
        candidates.append(stop)
        seen.add(stop.id)

    if len(candidates) < max_count:
        fallback_ids = _fallback_stop_ids(
            request,
            ["attraction", "experience", "shopping", "nightlife"],
            used_ids | seen | ({dinner_id} if dinner_id else set()),
            max_count - len(candidates),
        )
        for poi_id in fallback_ids:
            candidates.append(
                StopOut(
                    id=poi_id,
                    name=POIS[poi_id].get("name", poi_id),
                    scheduledStart=DAY_START,
                    scheduledEnd=DAY_START + _stop_duration(POIS[poi_id]),
                    transitFromPrev=0,
                )
            )

    return candidates


def _best_time_order(stop: StopOut) -> int:
    poi = _poi_for_stop(stop) or {}
    return BEST_TIME_ORDER.get(str(poi.get("bestTime") or "any"), 1)


def _order_non_restaurants(stops: list[StopOut]) -> list[StopOut]:
    remaining = list(enumerate(stops))
    ordered: list[StopOut] = []
    previous_id: str | None = None

    while remaining:
        if previous_id is None:
            index, stop = min(
                remaining,
                key=lambda item: (
                    _best_time_order(item[1]),
                    _as_int(item[1].scheduledStart, DAY_START),
                    item[0],
                ),
            )
        else:
            index, stop = min(
                remaining,
                key=lambda item: (
                    get_transit_time(previous_id, item[1].id),
                    _best_time_order(item[1]) * 10,
                    item[0],
                ),
            )

        ordered.append(stop)
        previous_id = stop.id
        remaining = [(i, s) for i, s in remaining if i != index]

    return ordered


def _schedule_stop(
    poi_id: str,
    current_time: int,
    previous_id: str | None,
    latest_end: int,
    target_time: int | None = None,
    duration_override: int | None = None,
) -> StopOut | None:
    poi = POIS.get(poi_id)
    if not poi:
        return None

    duration = duration_override or _stop_duration(poi)
    open_min, close_min = _hours_window(poi)
    transit = get_transit_time(previous_id, poi_id) if previous_id else 0
    earliest = current_time + transit if previous_id else current_time
    effective_latest = min(close_min, latest_end, MAX_CLOCK_MINUTE)

    start = max(earliest, open_min, target_time or DAY_START)
    end = start + duration

    if end > effective_latest and target_time is not None:
        start = max(earliest, open_min)
        end = start + duration

    if end > effective_latest or end <= start:
        return None

    return StopOut(
        id=poi_id,
        name=poi.get("name", poi_id),
        scheduledStart=_clamp_minute(start),
        scheduledEnd=_clamp_minute(end),
        transitFromPrev=transit,
    )


def _schedule_dinner(dinner: StopOut, planned: list[StopOut]) -> StopOut | None:
    poi = POIS.get(dinner.id)
    if not poi:
        return None

    duration = min(_stop_duration(poi), 120)

    while True:
        previous = planned[-1] if planned else None
        current_time = previous.scheduledEnd if previous else DAY_START
        previous_id = previous.id if previous else None
        scheduled = _schedule_stop(
            dinner.id,
            current_time,
            previous_id,
            DAY_END,
            DINNER_TARGET,
            duration_override=duration,
        )
        if scheduled:
            return scheduled
        if not planned:
            return None
        planned.pop()


def _repair_day(
    request: ItineraryRequest,
    source_day: DayOut,
    day_index: int,
    used_ids: set[str],
) -> DayOut:
    max_total = MAX_STOPS_BY_PACE.get(request.profile.pace, 4)
    max_non_restaurants = max(1, max_total - 1)
    dinner = _choose_dinner(request, source_day.stops, used_ids)
    non_restaurants = _candidate_non_restaurants(
        request,
        source_day.stops,
        dinner.id if dinner else None,
        used_ids,
        max_non_restaurants,
    )

    planned: list[StopOut] = []
    current_time = DAY_START
    previous_id: str | None = None

    for stop in _order_non_restaurants(non_restaurants):
        if len(planned) >= max_non_restaurants:
            break
        poi = POIS.get(stop.id)
        if not poi:
            continue
        target = BEST_TIME_TARGET.get(str(poi.get("bestTime") or "any"), DAY_START)
        scheduled = _schedule_stop(stop.id, current_time, previous_id, DINNER_TARGET - 30, target)
        if not scheduled:
            continue
        planned.append(scheduled)
        current_time = scheduled.scheduledEnd
        previous_id = scheduled.id

    if dinner:
        scheduled_dinner = _schedule_dinner(dinner, planned)
        if scheduled_dinner:
            planned.append(scheduled_dinner)

    for stop in planned:
        used_ids.add(stop.id)

    return DayOut(dayIndex=day_index, date=source_day.date, stops=planned)


def normalize_itinerary(request: ItineraryRequest, result: ItineraryResult) -> ItineraryResult:
    """
    Make model output safe and practical using local dataset facts:
    valid city POIs only, no duplicate POIs, one dinner restaurant per day,
    realistic transit, and bounded clock times.
    """
    ordered_days = sorted(result.days, key=lambda day: day.dayIndex)
    days_by_index = {day.dayIndex: day for day in result.days}
    used_ids: set[str] = set()
    repaired_days: list[DayOut] = []

    for day_index in range(request.days):
        source_day = days_by_index.get(day_index)
        if source_day is None and day_index < len(ordered_days):
            source_day = ordered_days[day_index]
        if source_day is None:
            source_day = DayOut(dayIndex=day_index, stops=[])

        repaired_days.append(_repair_day(request, source_day, day_index, used_ids))

    return ItineraryResult(
        cityId=request.cityId,
        days=repaired_days,
        summary=result.summary,
        tips=result.tips,
    )
