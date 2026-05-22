import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { useAppStore } from "@/store/useAppStore";
import { pois } from "@/data/pois";
import { cities } from "@/data/cities";
import { CityMap } from "@/components/CityMap";
import { ArrowRight, Heart, Plus } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/explore")({
  component: Explore,
});

const FILTERS = [
  { id: "all", label: "All" },
  { id: "attraction", label: "Attraction" },
  { id: "experience", label: "Experience" },
  { id: "restaurant", label: "Restaurant" },
];

const GUIDES = [
  { id: "etiquette", emoji: "🍽️", label: "Dining Etiquette" },
  { id: "tipping", emoji: "💴", label: "Tipping & Cash" },
  { id: "apps", emoji: "📱", label: "Must-have Apps" },
];

const CATEGORY_LABEL: Record<string, string> = {
  attraction: "Attraction",
  restaurant: "Restaurant",
  experience: "Experience",
  nightlife: "Nightlife",
  shopping: "Shopping",
};

function Explore() {
  const trip = useAppStore((s) => s.trip);
  const savedPois = useAppStore((s) => s.savedPois);
  const toggleSavePoi = useAppStore((s) => s.toggleSavePoi);
  const addPOIToDay = useAppStore((s) => s.addPOIToDay);
  const [filter, setFilter] = useState("all");
  const city = (cities as any)[trip.currentCityId];

  const cityPois = useMemo(
    () => Object.values(pois).filter((p: any) => p.cityId === trip.currentCityId),
    [trip.currentCityId],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return cityPois;
    return cityPois.filter((p: any) => p.category === filter);
  }, [cityPois, filter]);

  const mapMarkers = useMemo(
    () =>
      filtered.slice(0, 30).map((p: any) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        name: p.name,
        category: p.category,
      })),
    [filtered],
  );

  function formatDuration(min: number) {
    if (!min) return "";
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  function priceLabel(p: number) {
    if (p == null) return "";
    if (p === 0) return "Free";
    return "¥".repeat(Math.max(1, Math.min(4, p)));
  }

  return (
    <MobileShell>
      <header className="px-5 pt-8 pb-3 flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground leading-tight">
          Discover in {city?.name}
        </h1>
        <Link
          to="/itinerary"
          className="text-sm font-medium text-primary inline-flex items-center gap-1 shrink-0"
        >
          My Itinerary <ArrowRight className="w-4 h-4" />
        </Link>
      </header>

      <div className="px-5 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors " +
                (active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted")
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="px-5 pb-4">
        <CityMap
          center={{ lat: city?.lat ?? 39.9, lng: city?.lng ?? 116.4 }}
          markers={mapMarkers}
          className="h-64"
        />
      </div>

      <section className="pl-5 pb-5">
        <div className="flex gap-3 overflow-x-auto no-scrollbar pr-5 snap-x snap-mandatory">
          {filtered.map((p: any) => {
            const saved = savedPois.includes(p.id);
            const dayIdx = (trip.itinerary[trip.currentCityId] || []).length - 1;
            return (
              <article
                key={p.id}
                className="snap-start shrink-0 w-[78%] rounded-2xl bg-card border border-border overflow-hidden flex flex-col"
              >
                <div className="relative h-36 bg-gradient-to-br from-accent/50 via-secondary to-primary/20 flex items-center justify-center">
                  <span className="text-5xl">
                    {p.category === "restaurant"
                      ? "🍜"
                      : p.category === "experience"
                        ? "🎭"
                        : p.category === "nightlife"
                          ? "🌃"
                          : p.category === "shopping"
                            ? "🛍️"
                            : "🗺️"}
                  </span>
                  <button
                    onClick={() => toggleSavePoi(p.id, p.name)}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/85 backdrop-blur flex items-center justify-center"
                    aria-label="Save"
                  >
                    <Heart
                      className={"w-4 h-4 " + (saved ? "text-primary" : "text-muted-foreground")}
                      fill={saved ? "currentColor" : "none"}
                    />
                  </button>
                  <span className="absolute bottom-3 left-3 text-xs font-medium px-2.5 py-1 rounded-full bg-foreground/85 text-background">
                    {CATEGORY_LABEL[p.category] || p.category}
                  </span>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-foreground leading-tight">{p.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.district} · ⏱ {formatDuration(p.duration)} · {priceLabel(p.price)}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(p.tags || []).slice(0, 2).map((t: string) => (
                      <span
                        key={t}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => addPOIToDay(trip.currentCityId, Math.max(0, dayIdx), p)}
                    className="mt-3 w-full py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-primary/90"
                  >
                    <Plus className="w-4 h-4" /> Add to Trip
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="px-5 pb-6">
        <h2 className="text-xl font-bold text-foreground mb-3">Guides & Info</h2>
        <div className="grid grid-cols-3 gap-3">
          {GUIDES.map((g) => (
            <div
              key={g.id}
              className="rounded-2xl bg-card border border-border p-4 flex flex-col items-center text-center gap-2 aspect-square justify-center"
            >
              <span className="text-3xl">{g.emoji}</span>
              <span className="text-xs font-medium text-foreground leading-tight">{g.label}</span>
            </div>
          ))}
        </div>
      </section>
    </MobileShell>
  );
}