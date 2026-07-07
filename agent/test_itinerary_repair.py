import unittest

from data import POIS
from itinerary_repair import MAX_CLOCK_MINUTE, normalize_itinerary
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


if __name__ == "__main__":
    unittest.main()
