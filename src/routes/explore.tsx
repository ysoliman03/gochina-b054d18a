import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { useAppStore } from "@/store/useAppStore";
import { pois } from "@/data/pois";
import { cities } from "@/data/cities";
import { CityMap } from "@/components/CityMap";
import { ArrowRight, Heart, Plus, X, ChevronDown, ArrowUpRight, Lightbulb } from "lucide-react";
import { useMemo, useState } from "react";
import { dishes as allDishes, type Dish } from "@/data/dishes";
import { AlertTriangle } from "lucide-react";

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
  { id: "food", emoji: "🍜", label: "Food Guide", to: "/guides/food" },
  { id: "etiquette", emoji: "🎎", label: "Cultural Etiquette", to: "/guides/etiquette" },
  { id: "digital", emoji: "📱", label: "Digital Tools", to: "/guides/digital" },
  { id: "transit", emoji: "🚇", label: "Transit Help", to: "/guides/transit" },
  { id: "visa", emoji: "🛂", label: "Visa Info", to: "/guides/visa" },
  { id: "air", emoji: "🌫️", label: "Air Quality", to: "/guides/air" },
];

const DIGITAL_TOOLS = [
  {
    id: "wechat",
    name: "WeChat",
    tag: "Messaging & Payments",
    tagClass: "bg-emerald-100 text-emerald-700",
    description: "China's super-app for messaging, social, and mobile payments.",
    emoji: "💬",
    bg: "bg-emerald-100",
    url: "https://www.wechat.com/",
    ctaLabel: "Open WeChat",
    steps: [
      "Download WeChat from App Store or Google Play",
      "Sign up with your phone number",
      "Verify with an existing WeChat user if prompted",
      "Link an international card via WeChat Pay (Tenpay)",
      "Used for chat, QR payments, mini-programs and more",
    ],
    tip: "Ask a friend with WeChat to verify your account — it's the fastest way through sign-up.",
  },
  {
    id: "alipay",
    name: "Alipay",
    tag: "Mobile Payments",
    tagClass: "bg-indigo-100 text-indigo-700",
    description: "Ant Group's payment platform with a dedicated international setup.",
    emoji: "💙",
    bg: "bg-indigo-100",
    url: "https://www.alipay.com/",
    ctaLabel: "Alipay International",
    steps: [
      "Download Alipay from App Store or Google Play",
      'Select "International" on the sign-up screen',
      "Link your international Visa/Mastercard directly",
      'Use "Tour Pass" feature if direct card link fails',
      "Accepted at most shops, taxis, attractions, and vending machines",
    ],
    tip: "Tour Pass tops up a digital wallet — great backup if card linking fails.",
  },
  {
    id: "didi",
    name: "DiDi",
    tag: "Ride Hailing",
    tagClass: "bg-orange-100 text-orange-700",
    description: "China's Uber equivalent. Has English in-app and accepts foreign cards.",
    emoji: "🚗",
    bg: "bg-orange-100",
    url: "https://www.didiglobal.com/",
    ctaLabel: "Open DiDi",
    steps: [
      "Download DiDi from App Store or Google Play",
      "Switch the app language to English in settings",
      "Sign up with your phone number",
      "Add an international Visa/Mastercard for payment",
      "Save your hotel address in Chinese for easier pickup",
    ],
    tip: "Show the driver your destination in Chinese characters to avoid miscommunication.",
  },
];

const STATUS_META: Record<string, { label: string; className: string }> = {
  not_started: { label: "NOT STARTED", className: "text-muted-foreground" },
  in_progress: { label: "IN PROGRESS", className: "text-amber-600" },
  done: { label: "DONE", className: "text-emerald-600" },
};

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
  const digitalTools = useAppStore((s) => s.digitalTools);
  const updateDigitalTool = useAppStore((s) => s.updateDigitalTool);
  const [filter, setFilter] = useState("all");
  const [openTool, setOpenTool] = useState<string | null>("alipay");
  const [selectedDishId, setSelectedDishId] = useState<string | null>(null);
  const city = (cities as any)[trip.currentCityId];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected: any = selectedId ? (pois as any)[selectedId] : null;

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

  const profile = useAppStore((s) => s.profile);
  const dietary = profile.dietaryRestrictions || [];
  const isVeg = dietary.includes("Vegetarian") || dietary.includes("Vegan");
  const isHalal = dietary.includes("Halal");
  const noPork = isHalal || dietary.includes("No Pork");
  const filteredDishes = useMemo(() => {
    return allDishes.filter((d) => {
      if (isVeg && !d.vegetarian) return false;
      if (isHalal && !d.halal) return false;
      if (noPork && d.containsPork) return false;
      return true;
    });
  }, [isVeg, isHalal, noPork]);
  const selectedDish = selectedDishId
    ? allDishes.find((d) => d.id === selectedDishId) || null
    : null;
  const dishRestaurants = useMemo(() => {
    if (!selectedDish) return [] as any[];
    const ids = Object.values(selectedDish.restaurantsByCity).flat();
    return ids.map((id) => (pois as any)[id]).filter(Boolean);
  }, [selectedDish]);
  const dietaryLabel = isVeg
    ? "Vegetarian"
    : isHalal
      ? "Halal"
      : noPork
        ? "No Pork"
        : null;

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
          onMarkerClick={(id) => setSelectedId(id)}
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
            <Link
              key={g.id}
              to={g.to}
              className="rounded-2xl bg-card border border-border p-4 flex flex-col items-center text-center gap-2 aspect-square justify-center hover:border-primary/40 transition-colors"
            >
              <span className="text-3xl">{g.emoji}</span>
              <span className="text-xs font-semibold text-foreground leading-tight">{g.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-5 pb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-foreground">Compatible Flavors</h2>
          <Link
            to="/explore"
            className="text-sm font-medium text-primary inline-flex items-center gap-1"
          >
            Full Guide <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {dietaryLabel && (
          <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">
            Filtered for: {dietaryLabel}
          </div>
        )}
        <div className="flex flex-col gap-4">
          {filteredDishes.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDishId(d.id)}
              className="text-left rounded-2xl bg-card border border-border overflow-hidden hover:border-primary/40 transition-colors"
            >
              <div className={`relative h-40 bg-gradient-to-br ${d.bg} overflow-hidden`}>
                <img
                  src={d.image}
                  alt={d.name}
                  loading="lazy"
                  width={800}
                  height={600}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 flex gap-1.5">
                  {d.halal && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">Halal</span>
                  )}
                  {d.vegetarian && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-teal-600 text-white">Veg</span>
                  )}
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-foreground leading-tight">{d.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {d.nameZh} · {d.region}
                    </p>
                  </div>
                  {d.spice > 0 && (
                    <span className="text-sm shrink-0" aria-label={`Spice level ${d.spice}`}>
                      {"🌶️".repeat(d.spice)}
                    </span>
                  )}
                </div>
                {d.allergens.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {d.allergens.map((a) => (
                      <span
                        key={a}
                        className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-100"
                      >
                        <AlertTriangle className="w-3 h-3" /> {a}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-sm italic text-muted-foreground mt-2 leading-snug">
                  Tip: {d.tip}
                </p>
              </div>
            </button>
          ))}
          {filteredDishes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No dishes match your dietary preferences yet.
            </p>
          )}
        </div>
      </section>

      <section className="px-5 pb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-foreground">Essential Digital Tools</h2>
          <a
            href="https://docs.lovable.dev"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-primary inline-flex items-center gap-1"
          >
            Setup Guide <ArrowRight className="w-4 h-4" />
          </a>
        </div>
        <div className="flex flex-col gap-3">
          {DIGITAL_TOOLS.map((tool) => {
            const status = digitalTools[tool.id] || "not_started";
            const meta = STATUS_META[status];
            const open = openTool === tool.id;
            const isDone = status === "done";
            return (
              <div
                key={tool.id}
                className="rounded-2xl bg-card border border-border overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenTool(open ? null : tool.id)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${tool.bg}`}>
                    {tool.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground leading-tight">{tool.name}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tool.tagClass}`}>
                        {tool.tag}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {tool.description}
                    </p>
                    <span className={`text-[10px] font-bold tracking-wide ${meta.className}`}>
                      {meta.label}
                    </span>
                  </div>
                  <ChevronDown
                    className={"w-5 h-5 text-muted-foreground shrink-0 transition-transform " + (open ? "rotate-180" : "")}
                  />
                </button>

                {open && (
                  <div className="px-4 pb-4 border-t border-border">
                    <ol className="mt-4 space-y-3">
                      {tool.steps.map((step, i) => (
                        <li key={i} className="flex gap-3 text-sm text-foreground">
                          <span className="font-bold text-primary shrink-0 w-5">{i + 1}.</span>
                          <span className="leading-snug">{step}</span>
                        </li>
                      ))}
                    </ol>

                    <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 p-3 flex gap-2 text-xs text-amber-900">
                      <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="leading-snug">{tool.tip}</span>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <a
                        href={tool.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          if (status === "not_started") updateDigitalTool(tool.id, "in_progress");
                        }}
                        className="flex-1 h-11 rounded-full bg-foreground text-background font-semibold text-sm inline-flex items-center justify-center gap-1.5"
                      >
                        {tool.ctaLabel} <ArrowUpRight className="w-4 h-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          updateDigitalTool(tool.id, isDone ? "not_started" : "done")
                        }
                        className="flex-1 h-11 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90"
                      >
                        {isDone ? "Mark Undone" : "Mark Done"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center pointer-events-none">
          <div className="w-full max-w-md pointer-events-auto px-3 pb-20">
            <div className="rounded-2xl bg-card border border-border shadow-2xl p-4 animate-in slide-in-from-bottom-4 duration-200">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent/50 to-primary/20 flex items-center justify-center text-2xl shrink-0">
                  {selected.category === "restaurant"
                    ? "🍜"
                    : selected.category === "experience"
                      ? "🎭"
                      : selected.category === "nightlife"
                        ? "🌃"
                        : selected.category === "shopping"
                          ? "🛍️"
                          : "🗺️"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-foreground leading-tight truncate">
                      {selected.name}
                    </h3>
                    <button
                      onClick={() => setSelectedId(null)}
                      className="p-1 -m-1 text-muted-foreground hover:text-foreground shrink-0"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {CATEGORY_LABEL[selected.category] || selected.category} · {selected.district}
                    {selected.duration ? ` · ${formatDuration(selected.duration)}` : ""}
                    {selected.price != null ? ` · ${priceLabel(selected.price)}` : ""}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {selected.description}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => toggleSavePoi(selected.id, selected.name)}
                  className="w-11 h-11 rounded-full border border-border flex items-center justify-center shrink-0"
                  aria-label="Save"
                >
                  <Heart
                    className={"w-4 h-4 " + (savedPois.includes(selected.id) ? "text-primary" : "text-muted-foreground")}
                    fill={savedPois.includes(selected.id) ? "currentColor" : "none"}
                  />
                </button>
                <button
                  onClick={() => {
                    const dayIdx = Math.max(0, (trip.itinerary[trip.currentCityId] || []).length - 1);
                    addPOIToDay(trip.currentCityId, dayIdx, selected);
                    setSelectedId(null);
                  }}
                  className="flex-1 h-11 rounded-full bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4" /> Add to Trip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedDish && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
          onClick={() => setSelectedDishId(null)}
        >
          <div
            className="w-full max-w-md bg-background rounded-t-3xl max-h-[85vh] overflow-y-auto pb-8 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`relative h-40 bg-gradient-to-br ${selectedDish.bg} overflow-hidden rounded-t-3xl`}>
              <img
                src={selectedDish.image}
                alt={selectedDish.name}
                width={800}
                height={600}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedDishId(null)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/85 backdrop-blur flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 pt-4">
              <h2 className="text-xl font-bold text-foreground">{selectedDish.name}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedDish.nameZh} · {selectedDish.region}
                {selectedDish.spice > 0 ? ` · ${"🌶️".repeat(selectedDish.spice)}` : ""}
              </p>
              <p className="text-sm text-muted-foreground mt-3 leading-snug">
                {selectedDish.description}
              </p>

              <h3 className="mt-5 text-sm font-bold text-foreground">
                Places that serve it ({dishRestaurants.length})
              </h3>
              {dishRestaurants.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">
                  No curated spots yet in your current cities.
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-2.5">
                  {dishRestaurants.map((r: any) => {
                    const inThisTrip = trip.cities.some((c: any) => c.cityId === r.cityId);
                    return (
                      <div
                        key={r.id}
                        className="rounded-xl border border-border p-3 flex items-center gap-3"
                      >
                        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-accent/40 to-primary/20 flex items-center justify-center text-xl shrink-0">
                          🍜
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground text-sm leading-tight truncate">
                            {r.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {(cities as any)[r.cityId]?.name || r.cityId} · {r.district}
                            {r.price != null ? ` · ${priceLabel(r.price)}` : ""}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const dayIdx = Math.max(
                              0,
                              (trip.itinerary[r.cityId] || []).length - 1,
                            );
                            addPOIToDay(r.cityId, dayIdx, r);
                          }}
                          disabled={!inThisTrip}
                          className="shrink-0 h-9 px-3 rounded-full bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={inThisTrip ? "Add to trip" : "City not in your trip"}
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}