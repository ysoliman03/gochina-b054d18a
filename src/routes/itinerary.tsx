import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { useAppStore } from "@/store/useAppStore";
import { cities } from "@/data/cities";
import { minutesToTime } from "@/engine/itineraryEngine";
import { Clock, MapPin, RefreshCw, Trash2, Sparkles, Wand2 } from "lucide-react";
import { ItineraryBuilderSheet } from "@/components/ItineraryBuilderSheet";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/itinerary")({
  component: Itinerary,
  head: () =>
    pageHead({
      path: "/itinerary",
      title: "Your China Itinerary | GoChina",
      description:
        "View and edit your day-by-day China itinerary — re-plan days, remove stops, and let the AI builder optimize your trip.",
    }),
});

function Itinerary() {
  const trip = useAppStore((s) => s.trip);
  const [builderOpen, setBuilderOpen] = useState(false);
  const removePOIFromDay = useAppStore((s) => s.removePOIFromDay);
  const replanDay = useAppStore((s) => s.replanDay);
  const updateTrip = useAppStore((s) => s.updateTrip);

  const [activeCity, setActiveCity] = useState(trip.currentCityId);
  const [activeDay, setActiveDay] = useState(0);

  const days = trip.itinerary[activeCity] || [];
  const hasTrips = trip.cities.length > 0;

  return (
    <MobileShell>
      <header className="px-5 pt-8 pb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your Itinerary</h1>
          <p className="text-sm text-muted-foreground">Tap any day to view stops</p>
        </div>
        <button
          onClick={() => setBuilderOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground flex-shrink-0 mt-1"
        >
          <Wand2 className="w-3.5 h-3.5" />
          AI Plan
        </button>
      </header>

      <ItineraryBuilderSheet open={builderOpen} onOpenChange={setBuilderOpen} />

      {hasTrips ? <div className="px-5 flex gap-2 pb-3 overflow-x-auto">
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
      </div> : null}

      {hasTrips ? <div className="px-5 flex gap-2 pb-4 overflow-x-auto">
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
      </div> : null}

      <section className="px-5">
        {hasTrips ? (
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Day {activeDay + 1}</h2>
            {days[activeDay] ? (
              <button
                onClick={() => replanDay(activeCity, activeDay)}
                className="text-xs flex items-center gap-1 text-primary"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-plan
              </button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <h2 className="text-lg font-semibold text-foreground">No itineraries yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use AI Plan to create your first trip. Nothing is saved until you import a generated itinerary.
            </p>
            <button
              onClick={() => setBuilderOpen(true)}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              <Wand2 className="w-4 h-4" /> Create itinerary
            </button>
          </div>
        )}
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
                  aria-label={`Remove ${stop.name} from day ${activeDay + 1}`}
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