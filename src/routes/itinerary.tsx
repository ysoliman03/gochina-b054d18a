import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { useAppStore } from "@/store/useAppStore";
import { cities } from "@/data/cities";
import { buildDayPlan, minutesToTime } from "@/engine/itineraryEngine";
import { Clock, MapPin, RefreshCw, Trash2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/itinerary")({
  component: Itinerary,
});

function Itinerary() {
  const trip = useAppStore((s) => s.trip);
  const profile = useAppStore((s) => s.profile);
  const setItinerary = useAppStore((s) => s.setItinerary);
  const removePOIFromDay = useAppStore((s) => s.removePOIFromDay);
  const replanDay = useAppStore((s) => s.replanDay);
  const updateTrip = useAppStore((s) => s.updateTrip);

  const [activeCity, setActiveCity] = useState(trip.currentCityId);
  const [activeDay, setActiveDay] = useState(0);

  const cityTrip = trip.cities.find((c) => c.cityId === activeCity);
  const days = trip.itinerary[activeCity] || [];

  useEffect(() => {
    if (!cityTrip) return;
    if (days.length === 0) {
      const usedIds: string[] = [];
      const seeded = Array.from({ length: cityTrip.days }, (_, i) => {
        const stops = buildDayPlan(activeCity, null, profile, usedIds);
        stops.forEach((s: any) => usedIds.push(s.id));
        return { dayIndex: i, stops };
      });
      setItinerary(activeCity, seeded);
    }
  }, [activeCity, cityTrip, days.length, profile, setItinerary]);

  return (
    <MobileShell>
      <header className="px-5 pt-8 pb-3">
        <h1 className="text-2xl font-bold text-foreground">Your Itinerary</h1>
        <p className="text-sm text-muted-foreground">Tap any day to view stops</p>
      </header>

      <div className="px-5 flex gap-2 pb-3 overflow-x-auto">
        {trip.cities.map((c) => {
          const city: any = (cities as any)[c.cityId];
          const active = c.cityId === activeCity;
          return (
            <button
              key={c.cityId}
              onClick={() => {
                setActiveCity(c.cityId);
                setActiveDay(0);
                updateTrip({ currentCityId: c.cityId });
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                active ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"
              }`}
            >
              {city?.name} · {c.days}d
            </button>
          );
        })}
      </div>

      <div className="px-5 flex gap-2 pb-4 overflow-x-auto">
        {days.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveDay(i)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${
              i === activeDay ? "bg-foreground text-background" : "bg-muted text-foreground"
            }`}
          >
            Day {i + 1}
          </button>
        ))}
      </div>

      <section className="px-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Day {activeDay + 1}</h2>
          <button
            onClick={() => replanDay(activeCity, activeDay)}
            className="text-xs flex items-center gap-1 text-primary"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-plan
          </button>
        </div>
        <ol className="space-y-3">
          {(days[activeDay]?.stops || []).map((stop: any, idx: number) => (
            <li key={stop.id + idx} className="rounded-2xl bg-card border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {minutesToTime(stop.scheduledStart)} – {minutesToTime(stop.scheduledEnd)}
                  </p>
                  <h3 className="font-semibold text-foreground mt-0.5">{stop.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" /> {stop.district}
                  </p>
                </div>
                <button
                  onClick={() => removePOIFromDay(activeCity, activeDay, stop.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {stop.transitFromPrev > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  <Sparkles className="inline w-3 h-3" /> {stop.transitFromPrev} min transit from previous
                </p>
              )}
            </li>
          ))}
          {(days[activeDay]?.stops || []).length === 0 && (
            <p className="text-sm text-muted-foreground">No stops planned. Tap re-plan to auto-fill.</p>
          )}
        </ol>
      </section>
    </MobileShell>
  );
}