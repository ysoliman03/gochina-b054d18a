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
  ChevronDown,
  ArrowUpRight,
  Lightbulb,
  Plane,
  TrainFront,
  Check,
} from "lucide-react";
import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
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
    id: "payments",
    name: "Money & Payments",
    tag: "Mobile Payments",
    tagClass: "bg-indigo-100 text-indigo-700",
    description: "Set up Alipay/WeChat Pay, link a foreign card, and pay by QR.",
    emoji: "💙",
    bg: "bg-indigo-100",
    url: "https://www.alipay.com/",
    ctaLabel: "Alipay International",
    steps: [
      "Install Alipay and WeChat from your app store before flying",
      'In Alipay, choose "International" sign-up and verify your passport',
      "Link your Visa/Mastercard directly, or top up Alipay Tour Pass",
      "Enable WeChat Pay (Tenpay) and link the same card as backup",
      "Carry ~¥500 cash for small vendors that still refuse foreign cards",
      "Pay by scanning merchant QR codes, or show your own pay-code",
    ],
    tip: "Always have BOTH Alipay and WeChat Pay set up — some merchants only accept one.",
  },
  {
    id: "didi",
    name: "DiDi & Transit",
    tag: "Ride Hailing & Transit",
    tagClass: "bg-orange-100 text-orange-700",
    description: "China's Uber equivalent with English in-app, plus metro & bus guidance.",
    emoji: "🚗",
    bg: "bg-orange-100",
    url: "https://www.didiglobal.com/",
    ctaLabel: "Open DiDi",
    steps: [
      "Install DiDi, switch to English in Settings, link a foreign card",
      "Save your hotel address in Chinese to share with drivers",
      "Metro: buy single tickets at machines (English option) or scan via Alipay/WeChat",
      "Tap your QR code at the turnstile to enter and exit — fares ¥3–¥10",
      "Buses: pay by Alipay/WeChat QR; have small cash as a fallback",
      "Get a rechargeable transit card (Yikatong in Beijing, SPTC in Shanghai) for buses + metro",
      "Between cities: book high-speed rail on Trip.com or the 12306 app with your passport",
    ],
    tip: "DiDi is safest at night and in bad weather. For short hops, metro is faster than taxis.",
  },
  {
    id: "visa",
    name: "Visa Info",
    tag: "Entry & Documents",
    tagClass: "bg-sky-100 text-sky-700",
    description: "Visa types, entry requirements, and what to prepare before arrival.",
    emoji: "🛂",
    bg: "bg-sky-100",
    url: "https://bio.visaforchina.cn/",
    ctaLabel: "Apply for Visa",
    steps: [
      "Check if your nationality qualifies for visa-free transit (up to 240 hours)",
      "Otherwise apply for an L (tourist) visa via your nearest Chinese visa center",
      "Prepare: passport valid 6+ months, return flight, hotel bookings, photo",
      "Complete the COVA online application form and book a biometrics appointment",
      "Allow 4–7 working days for processing; rush service is available at extra cost",
      "On arrival, fill the arrival card and keep your passport on you at all times",
    ],
    tip: "Register your address with local police within 24h of arrival — most hotels do this for you automatically.",
  },
  {
    id: "vpn",
    name: "VPN",
    tag: "Connectivity",
    tagClass: "bg-purple-100 text-purple-700",
    description: "Access Google, Instagram, WhatsApp and other blocked apps from inside China.",
    emoji: "🛡️",
    bg: "bg-purple-100",
    url: "https://www.expressvpn.com/",
    ctaLabel: "Get a VPN",
    steps: [
      "Choose a paid VPN known to work in China: ExpressVPN, Astrill, or LetsVPN",
      "Buy and install the app BEFORE you arrive — provider sites are blocked in China",
      "Download apps for every device (phone, laptop, tablet) while still home",
      "Sign in and run a connection test to a Hong Kong or Japan server",
      "Enable auto-connect on untrusted Wi-Fi for reliability",
      "If a server gets blocked, switch protocols (Lightway / OpenVPN / WireGuard)",
    ],
    tip: "Free VPNs almost never work in China. Pay for one with a money-back guarantee.",
  },
  {
    id: "esim",
    name: "eSIM",
    tag: "Connectivity",
    tagClass: "bg-rose-100 text-rose-700",
    description: "Get mobile data the moment you land — recommended eSIM providers and steps.",
    emoji: "📶",
    bg: "bg-rose-100",
    url: "https://www.airalo.com/china-esim",
    ctaLabel: "Browse eSIMs",
    steps: [
      "Confirm your phone supports eSIM (iPhone XS+ and most modern Androids)",
      "Pick a provider: Airalo, Holafly, or Nomad — choose Hong Kong-routed plans for open internet",
      "Buy a data plan sized to your trip (1GB/day works for most travelers)",
      "Install the eSIM via QR code BEFORE leaving home — keep your home SIM active",
      "On landing, switch the data line to the China eSIM in Settings → Cellular",
      "Enable data roaming for the eSIM line only; keep your home line on Wi-Fi calling",
    ],
    tip: "Hong Kong-routed eSIMs often bypass the Great Firewall — no VPN needed for Google or WhatsApp.",
  },
];

const STATUS_META: Record<string, { label: string; className: string }> = {
  not_started: { label: "NOT STARTED", className: "text-muted-foreground" },
  in_progress: { label: "IN PROGRESS", className: "text-amber-600" },
  done: { label: "DONE", className: "text-emerald-600" },
};

const STATUS_ORDER = ["not_started", "in_progress", "done"] as const;
function nextStatus(s: string) {
  const i = STATUS_ORDER.indexOf(s as any);
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
}

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

function Explore() {
  const search = Route.useSearch();
  const trip = useAppStore((s) => s.trip);
  const savedPois = useAppStore((s) => s.savedPois);
  const toggleSavePoi = useAppStore((s) => s.toggleSavePoi);
  const addPOIToDay = useAppStore((s) => s.addPOIToDay);
  const updateTrip = useAppStore((s) => s.updateTrip);
  const profile = useAppStore((s) => s.profile);
  const digitalTools = useAppStore((s) => s.digitalTools);
  const updateDigitalTool = useAppStore((s) => s.updateDigitalTool);
  const [filter, setFilter] = useState(() =>
    search.category && FILTERS.some((f) => f.id === search.category) ? search.category : "all",
  );
  const [openTool, setOpenTool] = useState<string | null>("alipay");
  const [selectedDishId, setSelectedDishId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const linkedPoi: any = search.poi ? (pois as any)[search.poi] : null;
  const requestedCityId =
    linkedPoi && isKnownCityId(linkedPoi.cityId)
      ? linkedPoi.cityId
      : isKnownCityId(search.city)
        ? search.city
        : undefined;
  const currentCityId =
    requestedCityId ?? (isKnownCityId(trip.currentCityId) ? trip.currentCityId : "BJ");
  const city = (cities as any)[currentCityId];
  const selected: any = selectedId ? (pois as any)[selectedId] : null;

  // Deep-link support: /explore?city=SH&category=restaurant switches city + filter on arrival.
  useEffect(() => {
    if (requestedCityId && requestedCityId !== trip.currentCityId) {
      updateTrip({ currentCityId: requestedCityId });
    } else if (!isKnownCityId(trip.currentCityId) && currentCityId !== trip.currentCityId) {
      updateTrip({ currentCityId });
    }
    if (search.category && FILTERS.some((f) => f.id === search.category)) {
      setFilter(search.category);
    }
    if (linkedPoi && search.poi) {
      setSelectedId(search.poi);
    }
  }, [
    currentCityId,
    linkedPoi,
    requestedCityId,
    search.category,
    search.poi,
    trip.currentCityId,
    updateTrip,
  ]);

  const cityPois = useMemo(
    () => Object.values(pois).filter((p: any) => p.cityId === currentCityId),
    [currentCityId],
  );

  const filtered = useMemo(() => {
    const list = filter === "all" ? cityPois : cityPois.filter((p: any) => p.category === filter);
    // Surface POIs that actually match this traveler's interests/budget/group type first.
    return [...list].sort((a: any, b: any) => scorePoi(b, profile) - scorePoi(a, profile));
  }, [cityPois, filter, profile]);

  const cityTransportHubs = useMemo(
    () => transportHubs.filter((hub) => hub.cityId === currentCityId),
    [currentCityId],
  );

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

  const dietary = profile.dietaryRestrictions || [];
  const filteredDishes = useMemo(() => {
    return cuisine.filter(
      (dish) => dish.cityId === currentCityId && dishMatchesProfile(dish, profile),
    );
  }, [currentCityId, profile]);
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
            const dayIdx = (trip.itinerary[currentCityId] || []).length - 1;
            const isHighlighted = p.id === selectedId;
            const inTrip = isPoiInTrip(trip, currentCityId, p.id);
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
                      if (!inTrip) addPOIToDay(currentCityId, Math.max(0, dayIdx), p);
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

      {cityTransportHubs.length > 0 && (
        <section className="px-5 pb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-foreground">Transport Hubs</h2>
            <span className="text-sm text-muted-foreground">
              {cityTransportHubs.length} options
            </span>
          </div>
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
        </section>
      )}

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

      <section className="px-5 pb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-foreground">Essential Tools</h2>
          <Link
            to="/guides/setup"
            className="text-sm font-medium text-primary inline-flex items-center gap-1"
          >
            Setup Guide <ArrowRight className="w-4 h-4" />
          </Link>
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
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenTool(open ? null : tool.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenTool(open ? null : tool.id);
                    }
                  }}
                  className="w-full flex items-center gap-3 p-4 text-left cursor-pointer"
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${tool.bg}`}
                  >
                    {tool.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground leading-tight">{tool.name}</span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tool.tagClass}`}
                      >
                        {tool.tag}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {tool.description}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateDigitalTool(tool.id, nextStatus(status));
                      }}
                      className={`mt-0.5 inline-flex items-center text-[10px] font-bold tracking-wide hover:underline ${meta.className}`}
                      aria-label="Change status"
                    >
                      {meta.label}
                    </button>
                  </div>
                  <ChevronDown
                    className={
                      "w-5 h-5 text-muted-foreground shrink-0 transition-transform " +
                      (open ? "rotate-180" : "")
                    }
                  />
                </div>

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
                        onClick={() => updateDigitalTool(tool.id, isDone ? "not_started" : "done")}
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
                {isPoiInTrip(trip, selected.cityId || currentCityId, selected.id) ? (
                  <button
                    disabled
                    className="flex-1 h-11 rounded-full bg-secondary text-secondary-foreground font-semibold text-sm inline-flex items-center justify-center gap-1.5 cursor-default"
                  >
                    <Check className="w-4 h-4" /> In Trip
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const dayIdx = Math.max(
                        0,
                        (trip.itinerary[selected.cityId || currentCityId] || []).length - 1,
                      );
                      addPOIToDay(selected.cityId || currentCityId, dayIdx, selected);
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
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
          onClick={() => setSelectedDishId(null)}
        >
          <div
            className="w-full max-w-md bg-background rounded-t-3xl max-h-[85dvh] overflow-y-auto overscroll-contain pb-8 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`relative h-40 bg-gradient-to-br ${cuisineGradient(selectedDish)} overflow-hidden rounded-t-3xl`}
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
                    const dayIdx = (trip.itinerary[r.cityId] || []).length - 1;
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
                            if (!inTrip) addPOIToDay(r.cityId, Math.max(0, dayIdx), r);
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
