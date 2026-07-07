import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { useAppStore } from "@/store/useAppStore";
import { pois } from "@/data/generated/pois";
import { cities } from "@/data/generated/cities";
import { transportHubs } from "@/data/generated/transportHubs";
import { CityMap } from "@/components/CityMap";
import {
  ArrowRight,
  Heart,
  Plus,
  X,
  Plane,
  TrainFront,
  Check,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { cuisine } from "@/data/generated/cuisine";
import type { CuisineDish, TransportHub } from "@/data/types";
import {
  getDishFallbackEmoji,
  getDishImageSrc,
  getPoiFallbackEmoji,
  getPoiImageSrc,
} from "@/lib/contentMedia";
import { dishMatchesProfile } from "@/lib/foodCompatibility";
import { scorePoi } from "@/engine/itineraryEngine";
import { getActiveConstraints } from "@/engine/constraintEngine";
import {
  formatBestTime,
  formatOpeningHours,
  getPoiDisplayChips,
  normalizePoiTextList,
} from "@/lib/poiDisplay";
import { pageHead } from "@/lib/seo";

type ExploreSearch = { city?: string; category?: string; poi?: string };

export const Route = createFileRoute("/explore")({
  component: Explore,
  validateSearch: (search: Record<string, unknown>): ExploreSearch => ({
    city: typeof search.city === "string" ? search.city : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
    poi: typeof search.poi === "string" ? search.poi : undefined,
  }),
  head: () =>
    pageHead({
      path: "/explore",
      title: "Explore China — Attractions, Food & Experiences | GoChina",
      description:
        "Discover attractions, restaurants, and experiences across China's top cities, filtered to your dietary preferences and travel interests.",
    }),
});

const FILTERS = [
  { id: "all", label: "All" },
  { id: "attraction", label: "Attraction" },
  { id: "experience", label: "Experience" },
  { id: "restaurant", label: "Restaurant" },
  { id: "shopping", label: "Shopping" },
  { id: "nightlife", label: "Nightlife" },
];

const CATEGORY_LABEL: Record<string, string> = {
  attraction: "Attraction",
  restaurant: "Restaurant",
  experience: "Experience",
  nightlife: "Nightlife",
  shopping: "Shopping",
};

const CUISINE_GRADIENTS: Record<string, string> = {
  barbecue: "from-amber-100 to-orange-200",
  dumpling: "from-rose-100 to-pink-200",
  hotpot: "from-red-100 to-rose-200",
  noodle: "from-amber-100 to-yellow-200",
  pastry: "from-yellow-100 to-amber-200",
  seafood: "from-cyan-100 to-blue-200",
  snack: "from-lime-100 to-emerald-200",
  soup: "from-orange-100 to-amber-200",
};

const DIETARY_TAG_LABELS: Record<string, string> = {
  dairy_free: "Dairy free",
  egg_free: "Egg free",
  halal: "Halal",
  low_spice: "Low spice",
  no_beef: "No beef",
  no_pork: "No pork",
  nut_free: "Nut free",
  vegan: "Vegan",
  vegetarian: "Veg",
};

function cuisineGradient(dish: CuisineDish) {
  return CUISINE_GRADIENTS[dish.category] ?? "from-stone-100 to-slate-200";
}

function dietaryTagLabel(tag: string) {
  return DIETARY_TAG_LABELS[tag] ?? tag.replaceAll("_", " ");
}

/** Source CSVs sometimes lost their Chinese text on export, leaving literal "?" placeholders. */
function zhName(value: string | undefined | null) {
  if (!value) return null;
  return /^\?+$/.test(value.trim()) ? null : value;
}

function hideBrokenImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = "none";
}

function isPoiInTrip(trip: any, cityId: string, poiId: string) {
  const days = trip.itinerary[cityId] || [];
  return days.some((d: any) => (d.stops || []).some((s: any) => s.id === poiId));
}

function isKnownCityId(cityId: unknown): cityId is keyof typeof cities {
  return typeof cityId === "string" && Object.prototype.hasOwnProperty.call(cities, cityId);
}

function hubTypeLabel(hub: TransportHub) {
  if (hub.type === "airport") return "Airport";
  if (hub.type === "railway_station") return "Railway station";
  return "Transport hub";
}

const ALL_CITY_IDS = Object.keys(cities);
const SEVERITY_RANK: Record<string, number> = { avoid: 3, warning: 2, info: 1 };

function todayKey() {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function CityFilterChips({
  selectedCityIds,
  onToggle,
  onClear,
  compact = false,
}: {
  selectedCityIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  compact?: boolean;
}) {
  const isAll = selectedCityIds.length === 0;
  const sizeClasses = compact ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm";
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      <button
        onClick={onClear}
        className={
          `${sizeClasses} rounded-full font-medium whitespace-nowrap border transition-colors ` +
          (isAll
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card text-foreground border-border hover:bg-muted")
        }
      >
        All Cities
      </button>
      {Object.values(cities).map((c: any) => {
        const active = selectedCityIds.includes(c.id);
        return (
          <button
            key={c.id}
            onClick={() => onToggle(c.id)}
            className={
              `${sizeClasses} rounded-full font-medium whitespace-nowrap border transition-colors ` +
              (active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:bg-muted")
            }
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

/** POIs with a travel constraint (closure/crowd/holiday/etc.) active today, across all cities. */
function buildActivePoiWarnings() {
  const today = todayKey();
  const map = new Map<string, "avoid" | "warning" | "info">();
  for (const cityId of ALL_CITY_IDS) {
    for (const constraint of getActiveConstraints(cityId, { start: today, end: today })) {
      if (!constraint.poiId) continue;
      const severity = (constraint.severity as "avoid" | "warning" | "info") || "info";
      const existing = map.get(constraint.poiId);
      if (!existing || SEVERITY_RANK[severity] > SEVERITY_RANK[existing]) {
        map.set(constraint.poiId, severity);
      }
    }
  }
  return map;
}

function Explore() {
  const search = Route.useSearch();
  const trip = useAppStore((s) => s.trip);
  const savedPois = useAppStore((s) => s.savedPois);
  const toggleSavePoi = useAppStore((s) => s.toggleSavePoi);
  const addPOIToBestDay = useAppStore((s) => s.addPOIToBestDay);
  const updateTrip = useAppStore((s) => s.updateTrip);
  const profile = useAppStore((s) => s.profile);
  const [categoryFilters, setCategoryFilters] = useState<string[]>(() =>
    search.category && FILTERS.some((f) => f.id === search.category) ? [search.category] : [],
  );
  const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);
  const [selectedDishId, setSelectedDishId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cityFilterTouched = useRef(false);
  const poiWarnings = useMemo(() => buildActivePoiWarnings(), []);

  const linkedPoi: any = search.poi ? (pois as any)[search.poi] : null;
  const hasTrips = trip.cities.length > 0;
  const requestedCityId =
    linkedPoi && isKnownCityId(linkedPoi.cityId)
      ? linkedPoi.cityId
      : isKnownCityId(search.city)
        ? search.city
        : undefined;
  const selected: any = selectedId ? (pois as any)[selectedId] : null;

  // Deep-link support: /explore?city=SH&category=restaurant switches city + filter on arrival.
  useEffect(() => {
    if (requestedCityId && requestedCityId !== trip.currentCityId) {
      updateTrip({ currentCityId: requestedCityId });
    } else if (
      requestedCityId &&
      !isKnownCityId(trip.currentCityId) &&
      requestedCityId !== trip.currentCityId
    ) {
      updateTrip({ currentCityId: requestedCityId });
    }
    if (requestedCityId) {
      cityFilterTouched.current = true;
      setSelectedCityIds([requestedCityId]);
    }
    if (search.category && FILTERS.some((f) => f.id === search.category)) {
      setCategoryFilters([search.category]);
    }
    if (linkedPoi && search.poi) {
      setSelectedId(search.poi);
    }
  }, [linkedPoi, requestedCityId, search.category, search.poi, trip.currentCityId, updateTrip]);

  // Default to the traveler's active trip city (existing behavior) — but only once,
  // and only if the deep-link effect above hasn't already claimed a city. With no
  // active trip yet, the filter stays empty ("all cities") so the default/discovery
  // view shows everything China has to offer.
  useEffect(() => {
    if (cityFilterTouched.current || requestedCityId) return;
    if (hasTrips && isKnownCityId(trip.currentCityId)) {
      setSelectedCityIds([trip.currentCityId]);
    }
  }, [hasTrips, requestedCityId, trip.currentCityId]);

  function toggleCityFilter(id: string) {
    cityFilterTouched.current = true;
    setSelectedCityIds((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    );
  }

  function clearCityFilter() {
    cityFilterTouched.current = true;
    setSelectedCityIds([]);
  }

  function toggleCategoryFilter(id: string) {
    if (id === "all") {
      setCategoryFilters([]);
      return;
    }
    setCategoryFilters((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    );
  }

  const isAllCities = selectedCityIds.length === 0;
  const activeCityIds = isAllCities ? ALL_CITY_IDS : selectedCityIds;
  const singleCityId = selectedCityIds.length === 1 ? selectedCityIds[0] : undefined;
  const singleCity = singleCityId ? (cities as any)[singleCityId] : null;

  // Transport Hubs and Compatible Flavors each get their own independent city
  // filter — separate from the POI/map filter above — so a traveler can browse
  // e.g. hubs in Beijing while cuisine still shows everywhere.
  const [hubCityIds, setHubCityIds] = useState<string[]>([]);
  const [cuisineCityIds, setCuisineCityIds] = useState<string[]>([]);
  const hubFilterTouched = useRef(false);
  const cuisineFilterTouched = useRef(false);

  useEffect(() => {
    if (hubFilterTouched.current) return;
    if (hasTrips && isKnownCityId(trip.currentCityId)) setHubCityIds([trip.currentCityId]);
  }, [hasTrips, trip.currentCityId]);

  useEffect(() => {
    if (cuisineFilterTouched.current) return;
    if (hasTrips && isKnownCityId(trip.currentCityId)) setCuisineCityIds([trip.currentCityId]);
  }, [hasTrips, trip.currentCityId]);

  function toggleHubCity(id: string) {
    hubFilterTouched.current = true;
    setHubCityIds((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
  }
  function clearHubCity() {
    hubFilterTouched.current = true;
    setHubCityIds([]);
  }
  function toggleCuisineCity(id: string) {
    cuisineFilterTouched.current = true;
    setCuisineCityIds((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    );
  }
  function clearCuisineCity() {
    cuisineFilterTouched.current = true;
    setCuisineCityIds([]);
  }

  const hubActiveCityIds = hubCityIds.length === 0 ? ALL_CITY_IDS : hubCityIds;
  const cuisineActiveCityIds = cuisineCityIds.length === 0 ? ALL_CITY_IDS : cuisineCityIds;

  const cityPois = useMemo(
    () => Object.values(pois).filter((p: any) => activeCityIds.includes(p.cityId)),
    [activeCityIds],
  );

  const filtered = useMemo(() => {
    const list =
      categoryFilters.length === 0
        ? cityPois
        : cityPois.filter((p: any) => categoryFilters.includes(p.category));
    // Surface POIs that actually match this traveler's interests/budget/group type first.
    return [...list].sort((a: any, b: any) => scorePoi(b, profile) - scorePoi(a, profile));
  }, [cityPois, categoryFilters, profile]);

  const cityTransportHubs = useMemo(
    () => transportHubs.filter((hub) => hubActiveCityIds.includes(hub.cityId)),
    [hubActiveCityIds],
  );

  const mapMarkers = useMemo(
    () =>
      filtered.map((p: any) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        name: p.name,
        category: p.category,
        warningSeverity: poiWarnings.get(p.id),
      })),
    [filtered, poiWarnings],
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

  const dietary = profile.dietaryRestrictions || [];
  const filteredDishes = useMemo(() => {
    return cuisine.filter(
      (dish) => cuisineActiveCityIds.includes(dish.cityId) && dishMatchesProfile(dish, profile),
    );
  }, [cuisineActiveCityIds, profile]);
  const selectedDish = selectedDishId
    ? cuisine.find((dish) => dish.id === selectedDishId) || null
    : null;
  const selectedImageSrc = selected ? getPoiImageSrc(selected) : null;
  const selectedDishImageSrc = selectedDish ? getDishImageSrc(selectedDish) : null;
  const dishRestaurants = useMemo(() => {
    if (!selectedDish) return [] as any[];
    return selectedDish.poiIds.map((id) => (pois as any)[id]).filter(Boolean);
  }, [selectedDish]);
  const dietaryLabel = dietary.length ? dietary.join(", ") : null;

  return (
    <MobileShell>
      <header className="px-5 pt-8 pb-3 flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground leading-tight">
          Discover in {singleCity ? singleCity.name : "China"}
        </h1>
        <Link
          to="/itinerary"
          className="text-sm font-medium text-primary inline-flex items-center gap-1 shrink-0"
        >
          My Itinerary <ArrowRight className="w-4 h-4" />
        </Link>
      </header>

      <div className="px-5 pb-3">
        <CityFilterChips
          selectedCityIds={selectedCityIds}
          onToggle={toggleCityFilter}
          onClear={clearCityFilter}
        />
      </div>

      <div className="px-5 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => {
          const active = f.id === "all" ? categoryFilters.length === 0 : categoryFilters.includes(f.id);
          return (
            <button
              key={f.id}
              onClick={() => toggleCategoryFilter(f.id)}
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
          center={{ lat: singleCity?.lat ?? 35.8617, lng: singleCity?.lng ?? 104.1954 }}
          markers={mapMarkers}
          className="h-64"
          onMarkerClick={(id) => setSelectedId(id)}
          selectedId={selectedId}
        />
      </div>

      <section className="pl-5 pb-5" aria-labelledby="top-picks-heading">
        <h2 id="top-picks-heading" className="sr-only">
          Top picks
        </h2>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pr-5 snap-x snap-mandatory">
          {filtered.map((p: any) => {
            const saved = savedPois.includes(p.id);
            const isHighlighted = p.id === selectedId;
            const inTrip = isPoiInTrip(trip, p.cityId, p.id);
            const imageSrc = getPoiImageSrc(p);
            const fallbackEmoji = getPoiFallbackEmoji(p);
            return (
              <article
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={
                  "snap-start shrink-0 w-[78%] rounded-2xl bg-card border overflow-hidden flex flex-col cursor-pointer transition-colors " +
                  (isHighlighted ? "border-primary ring-2 ring-primary/30" : "border-border")
                }
              >
                <div className="relative h-36 bg-gradient-to-br from-accent/50 via-secondary to-primary/20 overflow-hidden">
                  <div
                    className="absolute inset-0 flex items-center justify-center text-5xl"
                    aria-hidden="true"
                  >
                    {fallbackEmoji}
                  </div>
                  {imageSrc && (
                    <img
                      src={imageSrc}
                      alt=""
                      loading="lazy"
                      onError={hideBrokenImage}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/5 pointer-events-none" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSavePoi(p.id, p.name);
                    }}
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
                    {getPoiDisplayChips(p).map((chip) => (
                      <span
                        key={chip}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!inTrip) addPOIToBestDay(p.cityId, p);
                    }}
                    disabled={inTrip}
                    className={
                      "mt-3 w-full py-2.5 rounded-full font-semibold text-sm inline-flex items-center justify-center gap-1.5 " +
                      (inTrip
                        ? "bg-secondary text-secondary-foreground cursor-default"
                        : "bg-primary text-primary-foreground hover:bg-primary/90")
                    }
                  >
                    {inTrip ? (
                      <>
                        <Check className="w-4 h-4" /> In Trip
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" /> Add to Trip
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="px-5 pb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-foreground">Transport Hubs</h2>
          <span className="text-sm text-muted-foreground">{cityTransportHubs.length} options</span>
        </div>
        <div className="mb-3">
          <CityFilterChips
            selectedCityIds={hubCityIds}
            onToggle={toggleHubCity}
            onClear={clearHubCity}
            compact
          />
        </div>
        {cityTransportHubs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No transport hubs in this selection yet.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {cityTransportHubs.slice(0, 6).map((hub) => {
              const HubIcon = hub.type === "airport" ? Plane : TrainFront;
              return (
                <article
                  key={hub.id}
                  className="min-w-[240px] rounded-2xl bg-card border border-border p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <HubIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {hubTypeLabel(hub)}
                      </p>
                      <h3 className="font-bold text-foreground leading-tight line-clamp-2">
                        {hub.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {hub.district} · {hub.openingHours}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3 leading-snug line-clamp-2">
                    {hub.description}
                  </p>
                  {hub.tips[0] && (
                    <p className="text-xs text-primary mt-3 leading-snug line-clamp-2">
                      {hub.tips[0]}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="px-5 pb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-foreground">Compatible Flavors</h2>
          <Link
            to="/guides/food"
            className="text-sm font-medium text-primary inline-flex items-center gap-1"
          >
            Full Guide <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="mb-3">
          <CityFilterChips
            selectedCityIds={cuisineCityIds}
            onToggle={toggleCuisineCity}
            onClear={clearCuisineCity}
            compact
          />
        </div>
        {dietaryLabel && (
          <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">
            Filtered for: {dietaryLabel}
          </div>
        )}
        <div className="flex flex-col gap-4">
          {filteredDishes.map((d) => {
            const imageSrc = getDishImageSrc(d);
            const fallbackEmoji = getDishFallbackEmoji(d);
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDishId(d.id)}
                className="text-left rounded-2xl bg-card border border-border overflow-hidden hover:border-primary/40 transition-colors"
              >
                <div
                  className={`relative h-40 bg-gradient-to-br ${cuisineGradient(d)} overflow-hidden`}
                >
                  <div
                    className="absolute inset-0 flex items-center justify-center text-6xl"
                    aria-hidden="true"
                  >
                    {fallbackEmoji}
                  </div>
                  {imageSrc && (
                    <img
                      src={imageSrc}
                      alt=""
                      loading="lazy"
                      onError={hideBrokenImage}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/5 pointer-events-none" />
                  <div className="absolute bottom-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-background/85 text-foreground capitalize">
                    {d.category}
                  </div>
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    {d.dietaryTags.includes("halal") && (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
                        Halal
                      </span>
                    )}
                    {d.dietaryTags.includes("vegetarian") && (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-teal-600 text-white">
                        Veg
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-foreground leading-tight">{d.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {zhName(d.nameZh) ? `${zhName(d.nameZh)} · ` : ""}
                        {(cities as any)[d.cityId]?.name || d.cityId}
                      </p>
                    </div>
                    {d.dietaryTags.includes("low_spice") && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-100 shrink-0">
                        Low spice
                      </span>
                    )}
                  </div>
                  {d.dietaryTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {d.dietaryTags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                        >
                          {dietaryTagLabel(tag)}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mt-2 leading-snug line-clamp-2">
                    {d.description}
                  </p>
                </div>
              </button>
            );
          })}
          {filteredDishes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No dishes match your dietary preferences yet.
            </p>
          )}
        </div>
      </section>

      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-[9999] flex justify-center pointer-events-none">
          <div className="w-full max-w-md pointer-events-auto px-3 pb-20">
            <div className="rounded-2xl bg-card border border-border shadow-2xl p-4 max-h-[75dvh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200">
              <div className="flex items-start gap-3">
                <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-accent/50 to-primary/20 overflow-hidden flex items-center justify-center text-2xl shrink-0">
                  <span aria-hidden="true">{getPoiFallbackEmoji(selected)}</span>
                  {selectedImageSrc && (
                    <img
                      src={selectedImageSrc}
                      alt=""
                      onError={hideBrokenImage}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
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
              {getPoiDisplayChips(selected).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {getPoiDisplayChips(selected).map((chip) => (
                    <span
                      key={chip}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => toggleSavePoi(selected.id, selected.name)}
                  className="w-11 h-11 rounded-full border border-border flex items-center justify-center shrink-0"
                  aria-label="Save"
                >
                  <Heart
                    className={
                      "w-4 h-4 " +
                      (savedPois.includes(selected.id) ? "text-primary" : "text-muted-foreground")
                    }
                    fill={savedPois.includes(selected.id) ? "currentColor" : "none"}
                  />
                </button>
                {isPoiInTrip(trip, selected.cityId, selected.id) ? (
                  <button
                    disabled
                    className="flex-1 h-11 rounded-full bg-secondary text-secondary-foreground font-semibold text-sm inline-flex items-center justify-center gap-1.5 cursor-default"
                  >
                    <Check className="w-4 h-4" /> In Trip
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      addPOIToBestDay(selected.cityId, selected);
                      setSelectedId(null);
                    }}
                    className="flex-1 h-11 rounded-full bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-primary/90"
                  >
                    <Plus className="w-4 h-4" /> Add to Trip
                  </button>
                )}
              </div>
              {(() => {
                const tips = normalizePoiTextList(selected.tips);
                const cautions = normalizePoiTextList(selected.cautions);
                const highlights = normalizePoiTextList(selected.highlights);
                const hours = formatOpeningHours(selected);
                const bestTime = formatBestTime(selected.bestTime);
                const dishes = normalizePoiTextList(selected.signatureDishes);
                const hasAny =
                  highlights.length ||
                  tips.length ||
                  cautions.length ||
                  hours ||
                  bestTime ||
                  selected.bookingRequired ||
                  dishes.length;
                if (!hasAny) return null;
                return (
                  <div className="mt-4 pt-3 border-t border-border space-y-3">
                    {highlights.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1">Highlights</p>
                        <ul className="space-y-0.5">
                          {highlights.map((h, i) => (
                            <li key={i} className="text-xs text-muted-foreground">
                              • {h}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {tips.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1">Visitor tips</p>
                        {tips.map((t, i) => (
                          <p key={i} className="text-xs text-muted-foreground leading-snug">
                            {t}
                          </p>
                        ))}
                      </div>
                    )}
                    {cautions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1">Cautions</p>
                        {cautions.map((c, i) => (
                          <p key={i} className="text-xs text-muted-foreground leading-snug">
                            {c}
                          </p>
                        ))}
                      </div>
                    )}
                    {(hours || bestTime || selected.bookingRequired) && (
                      <div className="flex flex-col gap-1">
                        {hours && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">Opening hours: </span>
                            {hours}
                          </p>
                        )}
                        {bestTime && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">Best time: </span>
                            {bestTime.replace("Best ", "")}
                          </p>
                        )}
                        {selected.bookingRequired && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">Booking: </span>
                            Advance booking may be required.
                          </p>
                        )}
                      </div>
                    )}
                    {dishes.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1">
                          Signature dishes
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {dishes.map((d, i) => (
                            <span
                              key={i}
                              className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {selectedDish && (
        <div
          className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center px-4 pt-6 pb-24"
          onClick={() => setSelectedDishId(null)}
        >
          <div
            className="w-full max-w-md bg-background rounded-2xl max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain pb-8 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`relative h-40 bg-gradient-to-br ${cuisineGradient(selectedDish)} overflow-hidden rounded-t-2xl`}
            >
              <div
                className="absolute inset-0 flex items-center justify-center text-6xl"
                aria-hidden="true"
              >
                {getDishFallbackEmoji(selectedDish)}
              </div>
              {selectedDishImageSrc && (
                <img
                  src={selectedDishImageSrc}
                  alt=""
                  onError={hideBrokenImage}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/5 pointer-events-none" />
              <div className="absolute bottom-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-background/85 text-foreground capitalize">
                {selectedDish.category}
              </div>
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
                {zhName(selectedDish.nameZh) ? `${zhName(selectedDish.nameZh)} · ` : ""}
                {(cities as any)[selectedDish.cityId]?.name || selectedDish.cityId}
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
                    const isSaved = savedPois.includes(r.id);
                    const inTrip = isPoiInTrip(trip, r.cityId, r.id);
                    const restaurantImageSrc = getPoiImageSrc(r);
                    return (
                      <div
                        key={r.id}
                        className="rounded-xl border border-border p-3 flex items-center gap-3"
                      >
                        <div className="relative w-11 h-11 rounded-lg bg-gradient-to-br from-accent/40 to-primary/20 overflow-hidden flex items-center justify-center text-xl shrink-0">
                          <span aria-hidden="true">{getPoiFallbackEmoji(r)}</span>
                          {restaurantImageSrc && (
                            <img
                              src={restaurantImageSrc}
                              alt=""
                              loading="lazy"
                              onError={hideBrokenImage}
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          )}
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
                          onClick={() => toggleSavePoi(r.id, r.name)}
                          className="shrink-0 w-9 h-9 rounded-full bg-secondary flex items-center justify-center"
                          aria-label={isSaved ? "Remove from saved places" : "Save to your places"}
                        >
                          <Heart
                            className={
                              "w-4 h-4 " + (isSaved ? "text-primary" : "text-muted-foreground")
                            }
                            fill={isSaved ? "currentColor" : "none"}
                          />
                        </button>
                        <button
                          onClick={() => {
                            if (!inTrip) addPOIToBestDay(r.cityId, r);
                          }}
                          disabled={inTrip}
                          className={
                            "shrink-0 h-9 px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1 " +
                            (inTrip
                              ? "bg-secondary text-secondary-foreground cursor-default"
                              : "bg-primary text-primary-foreground hover:bg-primary/90")
                          }
                          title={inTrip ? "Already in trip" : "Add to trip"}
                        >
                          {inTrip ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> In Trip
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" /> Add
                            </>
                          )}
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
