import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { useAppStore } from "@/store/useAppStore";
import { pois } from "@/data/pois";
import { cities } from "@/data/cities";
import { Bookmark, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/explore")({
  component: Explore,
});

const CATEGORIES = [
  { id: "attraction", label: "Attractions", emoji: "🏛️" },
  { id: "food", label: "Food", emoji: "🍜" },
  { id: "nightlife", label: "Nightlife", emoji: "🌃" },
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
];

function Explore() {
  const trip = useAppStore((s) => s.trip);
  const savedPois = useAppStore((s) => s.savedPois);
  const toggleSavePoi = useAppStore((s) => s.toggleSavePoi);
  const [q, setQ] = useState("");
  const city = (cities as any)[trip.currentCityId];

  const filtered = useMemo(() => {
    const lower = q.toLowerCase();
    return Object.values(pois).filter(
      (p: any) =>
        p.cityId === trip.currentCityId &&
        (!lower || p.name.toLowerCase().includes(lower) || (p.tags || []).some((t: string) => t.toLowerCase().includes(lower))),
    );
  }, [q, trip.currentCityId]);

  return (
    <MobileShell>
      <header className="px-5 pt-8 pb-3">
        <h1 className="text-2xl font-bold text-foreground">Explore {city?.name}</h1>
        <p className="text-sm text-muted-foreground">Discover places curated for you</p>
      </header>

      <div className="px-5 pb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search places, tags…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="px-5 grid grid-cols-4 gap-2 pb-5">
        {CATEGORIES.map((c) => (
          <Link
            key={c.id}
            to="/explore/$category"
            params={{ category: c.id }}
            className="rounded-xl bg-card border border-border p-3 flex flex-col items-center gap-1 text-center"
          >
            <span className="text-2xl">{c.emoji}</span>
            <span className="text-xs text-foreground font-medium">{c.label}</span>
          </Link>
        ))}
      </div>

      <section className="px-5 space-y-3">
        {filtered.map((p: any) => {
          const saved = savedPois.includes(p.id);
          return (
            <article key={p.id} className="rounded-2xl bg-card border border-border overflow-hidden">
              <div className="h-28 bg-gradient-to-br from-primary/30 via-accent/40 to-secondary flex items-center justify-center">
                <span className="text-4xl">{p.category === "food" ? "🍜" : "🏛️"}</span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{p.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" /> {p.district} · {p.hours}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleSavePoi(p.id, p.name)}
                    className={`p-2 rounded-full ${saved ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                  >
                    <Bookmark className="w-4 h-4" fill={saved ? "currentColor" : "none"} />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{p.description}</p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {(p.tags || []).slice(0, 3).map((t: string) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-accent/40 text-accent-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </MobileShell>
  );
}