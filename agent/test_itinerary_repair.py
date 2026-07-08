import unittest
from unittest.mock import patch

import itinerary_repair as ir
from data import POIS
from itinerary_repair import MAX_CLOCK_MINUTE, MAX_STOPS_BY_PACE, normalize_itinerary
from models import DayOut, ItineraryRequest, ItineraryResult, StopOut, UserProfile
from tools import get_transit_info, get_transit_time


class ItineraryRepairTests(unittest.TestCase):
    def test_coordinate_fallback_transit_is_not_fixed_twenty_minutes(self):
        minutes = get_transit_time("BJ001", "BJ046")
        info = get_transit_info("BJ001", "BJ046")

        self.assertGreater(minutes, 20)
        self.assertIsNotNone(info)
        self.assertEqual(info["mode"], "estimated")
        self.assertGreater(info["distanceKm"], 1)

    def test_normalize_itinerary_repairs_duplicates_restaurants_and_clock_bounds(self):
        request = ItineraryRequest(
            cityId="BJ",
            startDate="2026-07-01",
            endDate="2026-07-02",
            profile=UserProfile(groupType="couple", pace="moderate", budget="luxury"),
        )
        raw = ItineraryResult(
            cityId="BJ",
            summary="A Beijing plan.",
            tips=[],
            days=[
                DayOut(
                    dayIndex=0,
                    stops=[
                        StopOut(
                            id="BJ005",
                            name="Peking Duck at Da Dong",
                            scheduledStart=570,
                            scheduledEnd=690,
                            transitFromPrev=0,
                        ),
                        StopOut(
                            id="BJ005",
                            name="Peking Duck at Da Dong",
                            scheduledStart=700,
                            scheduledEnd=820,
                            transitFromPrev=10,
                        ),
                        StopOut(
                            id="BJ001",
                            name="Forbidden City",
                            scheduledStart=1400,
                            scheduledEnd=1540,
                            transitFromPrev=20,
                        ),
                    ],
                ),
                DayOut(
                    dayIndex=1,
                    stops=[
                        StopOut(
                            id="BJ001",
                            name="Forbidden City",
                            scheduledStart=540,
                            scheduledEnd=720,
                            transitFromPrev=0,
                        ),
                        StopOut(
                            id="BJ005",
                            name="Peking Duck at Da Dong",
                            scheduledStart=730,
                            scheduledEnd=850,
                            transitFromPrev=10,
                        ),
                    ],
                ),
            ],
        )

        repaired = normalize_itinerary(request, raw)

        self.assertEqual(len(repaired.days), 2)
        seen_ids: set[str] = set()
        for day in repaired.days:
            self.assertGreaterEqual(len(day.stops), 2)
            restaurants = [
                stop for stop in day.stops if POIS[stop.id].get("category") == "restaurant"
            ]
            self.assertLessEqual(len(restaurants), 1)
            for index, stop in enumerate(day.stops):
                self.assertGreaterEqual(stop.scheduledStart, 0)
                self.assertLessEqual(stop.scheduledEnd, MAX_CLOCK_MINUTE)
                self.assertLess(stop.scheduledStart, stop.scheduledEnd)
                self.assertNotIn(stop.id, seen_ids)
                seen_ids.add(stop.id)
                if index > 0:
                    previous = day.stops[index - 1]
                    previous_category = POIS[previous.id].get("category")
                    category = POIS[stop.id].get("category")
                    self.assertFalse(previous_category == category == "restaurant")

    def test_repair_tops_up_day_when_a_candidate_fails_to_schedule(self):
        """
        A candidate stop can look fine but still fail to schedule (hours
        window, transit overrun) — previously the repair pass just dropped
        it, silently leaving the day under-filled (the "day with only one
        stop" bug). It must now pull a replacement from the fallback pool
        instead.
        """
        request = ItineraryRequest(
            cityId="BJ",
            startDate="2026-07-01",
            endDate="2026-07-01",
            profile=UserProfile(groupType="couple", pace="fast", budget="luxury"),
        )
        raw = ItineraryResult(
            cityId="BJ",
            summary="A Beijing plan.",
            tips=[],
            days=[
                DayOut(
                    dayIndex=0,
                    stops=[
                        StopOut(
                            id="BJ001",
                            name="Forbidden City",
                            scheduledStart=540,
                            scheduledEnd=660,
                            transitFromPrev=0,
                        ),
                        StopOut(
                            id="BJ005",
                            name="Peking Duck at Da Dong",
                            scheduledStart=1110,
                            scheduledEnd=1200,
                            transitFromPrev=20,
                        ),
                    ],
                ),
            ],
        )

        real_schedule_stop = ir._schedule_stop
        rejected_once = {"done": False}

        def flaky_schedule_stop(poi_id, *args, **kwargs):
            if poi_id == "BJ001" and not rejected_once["done"]:
                rejected_once["done"] = True
                return None  # simulate a real hours/transit conflict
            return real_schedule_stop(poi_id, *args, **kwargs)

        with patch.object(ir, "_schedule_stop", side_effect=flaky_schedule_stop):
            repaired = ir.normalize_itinerary(request, raw)

        self.assertTrue(rejected_once["done"], "test setup didn't exercise the failure path")
        day = repaired.days[0]
        # Without the top-up fix this day would have only 3 stops (2
        # attractions it happened to find on the first pass + dinner) even
        # though the city has plenty of other valid attractions available.
        # We don't assert the literal pace maximum (5) because once the
        # rejected first candidate wastes time, realistic hours/transit
        # constraints can genuinely leave no room left for a full extra
        # attraction before the pre-dinner cutoff — the fix's job is to fill
        # every slot that *is* still reachable, not to fabricate one that isn't.
        self.assertGreaterEqual(len(day.stops), 4)
        self.assertLessEqual(len(day.stops), MAX_STOPS_BY_PACE["fast"])

    def test_repair_excludes_poi_closed_on_its_scheduled_date(self):
        """
        The real dataset has a constraint (C013): Terracotta Warriors (XA002)
        is closed on Mondays. 2026-07-06 is a Monday. Even if the model
        scheduled XA002 that day, the repair pass must drop/replace it rather
        than trusting the model to have honored the constraint on its own.
        """
        request = ItineraryRequest(
            cityId="XA",
            startDate="2026-07-06",  # a Monday
            endDate="2026-07-06",
            profile=UserProfile(groupType="couple", pace="moderate", budget="mid"),
        )
        raw = ItineraryResult(
            cityId="XA",
            summary="A Xi'an plan.",
            tips=[],
            days=[
                DayOut(
                    dayIndex=0,
                    stops=[
                        StopOut(
                            id="XA002",
                            name="Terracotta Warriors",
                            scheduledStart=540,
                            scheduledEnd=720,
                            transitFromPrev=0,
                        ),
                    ],
                ),
            ],
        )

        repaired = ir.normalize_itinerary(request, raw)

        scheduled_ids = {stop.id for stop in repaired.days[0].stops}
        self.assertNotIn("XA002", scheduled_ids)

    def test_repair_allows_poi_on_a_date_it_is_not_closed(self):
        """Control case: the same POI is not excluded on a date it's actually open (a Wednesday)."""
        request = ItineraryRequest(
            cityId="XA",
            startDate="2026-07-08",  # a Wednesday
            endDate="2026-07-08",
            profile=UserProfile(groupType="couple", pace="moderate", budget="mid"),
        )
        raw = ItineraryResult(
            cityId="XA",
            summary="A Xi'an plan.",
            tips=[],
            days=[
                DayOut(
                    dayIndex=0,
                    stops=[
                        StopOut(
                            id="XA002",
                            name="Terracotta Warriors",
                            scheduledStart=540,
                            scheduledEnd=720,
                            transitFromPrev=0,
                        ),
                    ],
                ),
            ],
        )

        repaired = ir.normalize_itinerary(request, raw)

        scheduled_ids = {stop.id for stop in repaired.days[0].stops}
        self.assertIn("XA002", scheduled_ids)


if __name__ == "__main__":
    unittest.main()
