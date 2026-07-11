import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import { MobileShell } from "@/components/MobileShell";
import { useAppStore } from "@/store/useAppStore";
import { cities } from "@/data/generated/cities";
import { pois } from "@/data/generated/pois";
import {
  deriveDayDate,
  getTransitOptions,
  minutesToTime,
  recalculateTimes,
} from "@/engine/itineraryEngine";
import {
  Clock,
  MapPin,
  Trash2,
  Sparkles,
  Wand2,
  ChevronUp,
  ChevronDown,
  Footprints,
  TrainFront,
  Car,
  Plane,
  Navigation,
  CalendarDays,
  Plus,
} from "lucide-react";

const TRANSIT_MODE_ICON: Record<string, typeof Car> = {
  walk: Footprints,
  metro: TrainFront,
  taxi: Car,
};
import { ItineraryBuilderSheet } from "@/components/ItineraryBuilderSheet";
import { PoiDetailOverlay } from "@/components/PoiDetailOverlay";
import { pageHead } from "@/lib/seo";
import {
  getConnectionsBetween,
  getRecommendedConnection,
  getRecommendedTransferHubs,
} from "@/lib/cityConnections";
import { HotelBaseOptimizerCard } from "@/components/HotelBaseOptimizerCard";
import { ItineraryIssuePanel } from "@/components/ItineraryIssuePanel";
import { detectItineraryIssues } from "@/engine/itineraryIssueDetector";
import { formatDistanceKm, getGaodeDistanceKm } from "@/lib/gochina/distance";
import { getGaodeDirectionsUrl } from "@/lib/gochina/gaodeLinks";
import { getPoiFallbackEmoji, getPoiImageSrc } from "@/lib/contentMedia";
import type { CityId } from "@/data/types";

const CITY_TRAVEL_MODE_ICON: Record<string, typeof Car> = {
  flight: Plane,
  high_speed_rail: TrainFront,
};

function resolvePoi(stop: any) {
  return ((pois as any)[stop?.id] ?? stop) as any;
}

function hideBrokenImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = "none";
}

function transitModeLabel(mode: string) {
  return mode.replace(/_/g, " ");
}

function formatShortDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateRange(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (!startDate || !endDate) return "Dates not set";
  return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`;
}

function parseTimeInput(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function getStopDurationMinutes(stop: any) {
  const duration = Number(stop?.duration);
  if (Number.isFinite(duration) && duration > 0) return Math.round(duration);
  const range = Number(stop?.scheduledEnd) - Number(stop?.scheduledStart);
  if (Number.isFinite(range) && range > 0) return Math.round(range);
  return 60;
}

function ItineraryLeg({ from, to }: { from: any; to: any }) {
  const fromPoi = resolvePoi(from);
  const toPoi = resolvePoi(to);
  const distance = formatDistanceKm(getGaodeDistanceKm(fromPoi, toPoi));
  const gaodeUrl = getGaodeDirectionsUrl(fromPoi, toPoi);
  const transitOptions = getTransitOptions(from?.id, to?.id);

  if (!distance && transitOptions.length === 0) return null;

  return (
    <li className="list-none px-1 py-1.5">
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        {distance && <span className="text-muted-foreground">{distance}</span>}
        {gaodeUrl && (
          <a
            href={gaodeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Navigation className="w-3 h-3" />
            Gaode Maps
          </a>
        )}
      </div>
      {transitOptions.length > 0 && (
        <div className="mt-1 space-y-1.5">
          {transitOptions.map((option) => {
            const Icon = TRANSIT_MODE_ICON[option.mode] || Sparkles;
            return (
              <div key={`${option.from}-${option.to}-${option.mode}`} className="text-xs">
                <p className="font-medium text-foreground flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                  {option.duration} min by {transitModeLabel(option.mode)}
                  {option.distanceKm != null ? ` · ${option.distanceKm} km` : ""}
                </p>
                {option.notes && (
                  <p className="mt-0.5 text-muted-foreground leading-snug">{option.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
}

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
  const profile = useAppStore((s) => s.profile);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<any | null>(null);
  const removePOIFromDay = useAppStore((s) => s.removePOIFromDay);
  const updateTrip = useAppStore((s) => s.updateTrip);
  const movePOIToDay = useAppStore((s) => s.movePOIToDay);
  const reorderStopInDay = useAppStore((s) => s.reorderStopInDay);
  const setStopTime = useAppStore((s) => s.setStopTime);
  const deleteItinerary = useAppStore((s) => s.deleteItinerary);

  const [activeCity, setActiveCity] = useState(trip.currentCityId);
  const [activeDay, setActiveDay] = useState(0);

  const rawDays = trip.itinerary[activeCity];
  const days = useMemo(
    () =>
      (rawDays || []).map((day: any) => ({
        ...day,
        stops: recalculateTimes(day.stops || []),
      })),
    [rawDays],
  );
  const hasTrips = trip.cities.length > 0;

  const activeCityIndex = trip.cities.findIndex((c) => c.cityId === activeCity);
  const prevCity = activeCityIndex > 0 ? trip.cities[activeCityIndex - 1] : null;
  const intercityConnections = prevCity ? getConnectionsBetween(prevCity.cityId, activeCity) : [];
  const recommendedConnection = prevCity
    ? getRecommendedConnection(prevCity.cityId, activeCity, profile.budget)
    : undefined;
  const recommendedHubs = prevCity
    ? getRecommendedTransferHubs(prevCity.cityId, activeCity, recommendedConnection)
    : { departureHub: null, arrivalHub: null };

  // Only show base-area advice once a trip exists; the empty state stays China-wide.
  const baseCityIds = hasTrips ? trip.cities.map((c) => c.cityId) : [];

  // Best-effort date for the active day — used to check date-bound constraints
  // (holidays/weather). Falls back to the day's own `date` field if AI-planned,
  // else derives from the trip city's start date, else skips date-bound checks.
  const activeTripCity = trip.cities.find((c) => c.cityId === activeCity);
  const activeDayDate = deriveDayDate(
    days[activeDay]?.date,
    activeTripCity?.startDate ?? null,
    activeDay,
  );

  const issues = useMemo(() => {
    if (!days[activeDay]) return [];
    return detectItineraryIssues({
      cityId: activeCity,
      day: days[activeDay],
      dayIndex: activeDay,
      profile,
      date: activeDayDate,
      allDays: days,
    });
  }, [days, activeDay, activeCity, profile, activeDayDate]);

  function handleDeleteCity(cityId: string, cityName: string) {
    if (!window.confirm(`Delete the ${cityName} itinerary?`)) return;
    const nextCityId = trip.cities.find((city) => city.cityId !== cityId)?.cityId ?? "";
    deleteItinerary(cityId);
    if (activeCity === cityId) {
      setActiveCity(nextCityId);
      setActiveDay(0);
    }
  }

  return (
    <MobileShell>
      <header className="px-5 pt-8 pb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your Itinerary</h1>
          <p className="text-sm text-muted-foreground">Tap any day to view stops</p>
        </div>
        {!hasTrips && (
          <button
            onClick={() => setBuilderOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground flex-shrink-0 mt-1"
          >
            <Wand2 className="w-3.5 h-3.5" />
            AI Plan
          </button>
        )}
      </header>

      <div className="px-5 pb-4 flex flex-col gap-2">
        {baseCityIds.map((cid) => (
          <HotelBaseOptimizerCard key={cid} cityId={cid as CityId} />
        ))}
      </div>

      <ItineraryBuilderSheet open={builderOpen} onOpenChange={setBuilderOpen} />
      <PoiDetailOverlay
        poiId={selectedPoi?.id ?? null}
        poi={selectedPoi}
        onClose={() => setSelectedPoi(null)}
      />

      {hasTrips && (
        <div className="px-5 pb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            City itineraries
          </p>
          <button
            type="button"
            onClick={() => setBuilderOpen(true)}
            className="h-9 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add AI Itinerary
          </button>
        </div>
      )}

      {hasTrips ? (
        <div className="px-5 flex gap-2 pb-3 overflow-x-auto">
          {trip.cities.map((c) => {
            const city: any = (cities as any)[c.cityId];
            const active = c.cityId === activeCity;
            return (
              <div key={c.cityId} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveCity(c.cityId);
                  setActiveDay(0);
                  updateTrip({ currentCityId: c.cityId });
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground"
                }`}
              >
                {city?.name} · {c.days}d
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCity(c.cityId, city?.name || c.cityId)}
                aria-label={`Delete ${city?.name || c.cityId} itinerary`}
                className="w-9 h-9 rounded-full bg-card border border-border text-muted-foreground hover:text-destructive flex items-center justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {hasTrips && activeTripCity ? (
        <div className="px-5 pb-4">
          <div className="rounded-2xl border border-border bg-card p-3 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {(cities as any)[activeTripCity.cityId]?.name || activeTripCity.cityId}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDateRange(activeTripCity.startDate, activeTripCity.endDate)} -{" "}
                {activeTripCity.days} days
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {prevCity && intercityConnections.length > 0 && (
        <div className="px-5 pb-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Getting from {(cities as any)[prevCity.cityId]?.name || prevCity.cityId} to{" "}
              {(cities as any)[activeCity]?.name || activeCity}
            </p>
            {recommendedConnection && (
              <div className="pb-3 mb-3 border-b border-border">
                {(() => {
                  const Icon = CITY_TRAVEL_MODE_ICON[recommendedConnection.travelMode] || Car;
                  const { departureHub, arrivalHub } = recommendedHubs;
                  return (
                    <div className="flex items-start gap-2.5">
                      <Icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                      <div className="text-sm min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">Recommended transfer</p>
                          <span className="text-[11px] rounded-full bg-primary/10 px-2 py-0.5 text-primary font-semibold">
                            Dataset match
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {recommendedConnection.travelMode.replace(/_/g, " ")} ·{" "}
                          {Math.floor(recommendedConnection.durationMin / 60)}h{" "}
                          {recommendedConnection.durationMin % 60}m
                          {recommendedConnection.frequency
                            ? ` · ${recommendedConnection.frequency}`
                            : ""}
                        </p>
                        {(departureHub || arrivalHub) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Use {departureHub?.name || "the main departure hub"}
                            {" -> "}
                            {arrivalHub?.name || "the main arrival hub"}.
                          </p>
                        )}
                        {recommendedConnection.notes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {recommendedConnection.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            <div className="flex flex-col gap-2">
              {intercityConnections.map((conn, i) => {
                const Icon = CITY_TRAVEL_MODE_ICON[conn.travelMode] || Car;
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <Icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-foreground">
                        {conn.travelMode.replace(/_/g, " ")} · {Math.floor(conn.durationMin / 60)}h{" "}
                        {conn.durationMin % 60}m{conn.frequency ? ` · ${conn.frequency}` : ""}
                      </p>
                      {conn.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5">{conn.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {hasTrips ? (
        <div className="px-5 flex gap-2 pb-4 overflow-x-auto">
          {days.map((day: any, i) => {
            const dayDate = deriveDayDate(day?.date, activeTripCity?.startDate ?? null, i);
            return (
              <button
                key={i}
                onClick={() => setActiveDay(i)}
                className={`min-w-[82px] px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${
                  i === activeDay ? "bg-foreground text-background" : "bg-muted text-foreground"
                }`}
              >
                <span className="block">Day {i + 1}</span>
                {dayDate && (
                  <span
                    className={
                      i === activeDay
                        ? "block text-[11px] text-background/70"
                        : "block text-[11px] text-muted-foreground"
                    }
                  >
                    {formatShortDate(dayDate)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      <section className="px-5">
        {hasTrips ? (
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Day {activeDay + 1}</h2>
            {activeDayDate && (
              <p className="text-xs text-muted-foreground">{formatShortDate(activeDayDate)}</p>
            )}
          </div>
        ) : null}
        {hasTrips && days[activeDay] && (
          <div className="mb-3">
            <ItineraryIssuePanel issues={issues} />
          </div>
        )}
        {!hasTrips && (
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <h2 className="text-lg font-semibold text-foreground">No itineraries yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use AI Plan to create your first trip. Nothing is saved until you import a generated
              itinerary.
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
          {(days[activeDay]?.stops || []).map((stop: any, idx: number) => {
            const stopCount = days[activeDay]?.stops.length ?? 0;
            const poi = resolvePoi(stop);
            const imageSrc = getPoiImageSrc(poi);
            const fallbackEmoji = getPoiFallbackEmoji(poi);
            const poiName = poi.name ?? stop.name;
            const poiDistrict = poi.district ?? stop.district;
            return (
              <Fragment key={`${stop.id}-${idx}`}>
                {idx > 0 && <ItineraryLeg from={days[activeDay].stops[idx - 1]} to={stop} />}
                <li className="rounded-2xl bg-card border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold text-secondary-foreground">
                      <Clock className="w-3.5 h-3.5 shrink-0 text-primary" />
                      <input
                        type="time"
                        value={minutesToTime(stop.scheduledStart)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const minutes = parseTimeInput(e.target.value);
                          if (minutes != null) setStopTime(activeCity, activeDay, stop.id, minutes);
                        }}
                        aria-label={`Start time for ${stop.name}`}
                        className="time-range-input w-[43px] bg-transparent p-0 text-center text-xs font-semibold text-secondary-foreground focus:outline-none focus:ring-1 focus:ring-primary rounded"
                      />
                      <span className="text-muted-foreground">-</span>
                      <input
                        type="time"
                        value={minutesToTime(stop.scheduledEnd)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const minutes = parseTimeInput(e.target.value);
                          if (minutes == null) return;
                          const duration = getStopDurationMinutes(stop);
                          setStopTime(activeCity, activeDay, stop.id, Math.max(0, minutes - duration));
                        }}
                        aria-label={`End time for ${stop.name}`}
                        className="time-range-input w-[43px] bg-transparent p-0 text-center text-xs font-semibold text-secondary-foreground focus:outline-none focus:ring-1 focus:ring-primary rounded"
                      />
                    </div>
                    <button
                      onClick={() => removePOIFromDay(activeCity, activeDay, stop.id)}
                      aria-label={`Remove ${stop.name} from day ${activeDay + 1}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPoi(poi)}
                    className="mt-5 flex w-full items-center gap-4 text-left"
                    aria-label={`Open details for ${poiName}`}
                  >
                    <div className="relative w-20 h-20 shrink-0 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-accent/50 to-primary/20 flex items-center justify-center text-3xl">
                      <span aria-hidden="true">{fallbackEmoji}</span>
                      {imageSrc && (
                        <img
                          src={imageSrc}
                          alt=""
                          loading="lazy"
                          onError={hideBrokenImage}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground leading-tight">{poiName}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span className="truncate">{poiDistrict}</span>
                      </p>
                    </div>
                  </button>
                  {false && stop.transitFromPrev > 0 && (
                    <div className="text-xs text-muted-foreground mt-2">
                      {stop.transitInfo ? (
                        <p className="flex items-center gap-1">
                          {(() => {
                            const Icon = TRANSIT_MODE_ICON[stop.transitInfo.mode] || Sparkles;
                            return <Icon className="w-3 h-3" />;
                          })()}
                          {stop.transitInfo.duration} min by {stop.transitInfo.mode}
                          {stop.transitInfo.distanceKm != null
                            ? ` · ${stop.transitInfo.distanceKm} km`
                            : ""}
                        </p>
                      ) : (
                        <p className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> {stop.transitFromPrev} min transit from
                          previous
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                    <button
                      onClick={() => reorderStopInDay(activeCity, activeDay, stop.id, "up")}
                      disabled={idx === 0}
                      aria-label="Move earlier in the day"
                      className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => reorderStopInDay(activeCity, activeDay, stop.id, "down")}
                      disabled={idx === stopCount - 1}
                      aria-label="Move later in the day"
                      className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {days.length > 1 && (
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value === "") return;
                          movePOIToDay(activeCity, activeDay, Number(e.target.value), stop.id);
                        }}
                        aria-label={`Move ${stop.name} to a different day`}
                        className="ml-auto text-xs font-medium rounded-lg bg-secondary text-secondary-foreground px-2.5 py-1.5 border-0"
                      >
                        <option value="">Move to day…</option>
                        {days.map((_, dIdx) =>
                          dIdx === activeDay ? null : (
                            <option key={dIdx} value={dIdx}>
                              Day {dIdx + 1}
                            </option>
                          ),
                        )}
                      </select>
                    )}
                  </div>
                </li>
              </Fragment>
            );
          })}
          {(days[activeDay]?.stops || []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No stops planned. Tap re-plan to auto-fill.
            </p>
          )}
        </ol>
      </section>
    </MobileShell>
  );
}
