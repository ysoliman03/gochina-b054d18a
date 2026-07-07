import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { MobileShell } from "@/components/MobileShell";
import { TravelPulseCalendar } from "@/components/TravelPulseCalendar";
import { useAppStore } from "@/store/useAppStore";
import { pois } from "@/data/generated/pois";
import { MapPin, ArrowRight } from "lucide-react";
import { getPoiFallbackEmoji, getPoiImageSrc } from "@/lib/contentMedia";
import { scorePoi } from "@/engine/itineraryEngine";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  component: Home,
  head: () =>
    pageHead({
      path: "/",
      title: "GoChina — Plan Your China Trip",
      description:
        "Your personal China travel planner. Build a day-by-day itinerary, save places, and get local guidance for visas, transit, and food.",
    }),
});

function Home() {
  const navigate = useNavigate();
  const onboarded = useAppStore((s) => s.onboarded);
  const cloudHydrated = useAppStore((s) => s.cloudHydrated);
  const profile = useAppStore((s) => s.profile);
  const trip = useAppStore((s) => s.trip);
  const savedPois = useAppStore((s) => s.savedPois);

  useEffect(() => {
    if (cloudHydrated && !onboarded) navigate({ to: "/onboarding" });
  }, [cloudHydrated, onboarded, navigate]);

  if (!cloudHydrated || !onboarded) return null;

  const hasTrips = trip.cities.length > 0;
  const recommended = Object.values(pois)
    .filter((p: any) => (hasTrips ? p.cityId === trip.currentCityId : true))
    .sort((a: any, b: any) => scorePoi(b, profile) - scorePoi(a, profile))
    .slice(0, 5);

  return (
    <MobileShell>
      <header className="px-5 pt-8 pb-3">
        <p className="text-sm text-muted-foreground">
          Welcome back{profile.name ? `, ${profile.name}` : ""}
        </p>
      </header>

      <section className="px-5 pb-4">
        <div className="rounded-2xl bg-primary text-primary-foreground p-5">
          <p className="text-xs uppercase tracking-wide opacity-80">Your trip</p>
          <p className="text-xl font-bold mt-1">
            {trip.cities.length} cities · {trip.cities.reduce((s, c) => s + c.days, 0)} days
          </p>
          <p className="text-sm opacity-90 mt-2">{savedPois.length} saved places</p>
          <Link
            to="/itinerary"
            className="inline-flex items-center gap-1 mt-3 text-sm font-medium underline"
          >
            Open itinerary <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <TravelPulseCalendar cityId={hasTrips ? trip.currentCityId : null} trip={trip} />

      <section className="px-5 mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Recommended for you</h2>
        <Link to="/explore" className="text-sm text-primary flex items-center gap-1">
          See all <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
      <div className="pl-5 pb-9 flex gap-3 overflow-x-auto">
        {recommended.map((p: any) => (
          <Link
            key={p.id}
            to="/explore"
            search={{ city: p.cityId, category: p.category, poi: p.id }}
            className="flex-shrink-0 w-44 rounded-2xl bg-card border border-border p-3"
          >
            <div className="relative w-full h-24 rounded-xl bg-gradient-to-br from-primary/20 to-accent/30 flex items-center justify-center mb-2 overflow-hidden text-3xl">
              <span aria-hidden="true">{getPoiFallbackEmoji(p)}</span>
              {getPoiImageSrc(p) && (
                <img
                  src={getPoiImageSrc(p) || ""}
                  alt=""
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
            </div>
            <p className="text-sm font-semibold text-foreground line-clamp-1">{p.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" /> {p.district}
            </p>
          </Link>
        ))}
      </div>
    </MobileShell>
  );
}
