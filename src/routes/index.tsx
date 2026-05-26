import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { useAppStore } from "@/store/useAppStore";
import { cities } from "@/data/cities";
import { pois } from "@/data/pois";
import { getActiveConstraints } from "@/engine/constraintEngine";
import { CloudRain, AlertTriangle, MapPin, Sparkles, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const onboarded = useAppStore((s) => s.onboarded);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(useAppStore.persist.hasHydrated());
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    return () => unsub();
  }, []);
  const profile = useAppStore((s) => s.profile);
  const trip = useAppStore((s) => s.trip);
  const savedPois = useAppStore((s) => s.savedPois);
  const weather = useAppStore((s) => s.mockWeather);

  useEffect(() => {
    if (hydrated && !onboarded) navigate({ to: "/onboarding" });
  }, [hydrated, onboarded, navigate]);

  const city = (cities as any)[trip.currentCityId];
  const currentCity = trip.cities.find((c) => c.cityId === trip.currentCityId);
  const activeConstraints = getActiveConstraints(trip.currentCityId, {
    start: currentCity?.startDate ?? "",
    end: currentCity?.endDate ?? "",
  });

  const recommended = Object.values(pois)
    .filter((p: any) => p.cityId === trip.currentCityId)
    .slice(0, 5);

  return (
    <MobileShell>
      <header className="px-5 pt-8 pb-4">
        <p className="text-sm text-muted-foreground">
          Welcome back{profile.name ? `, ${profile.name}` : ""}
        </p>
        <h1 className="text-3xl font-bold text-foreground mt-1">{city?.name ?? "Your trip"}</h1>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{city?.intro}</p>
      </header>

      <section className="mx-5 mb-4 rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-accent/40 flex items-center justify-center">
          <CloudRain className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{weather.temp}°C · AQI {weather.aqi}</p>
          <p className="text-xs text-muted-foreground">{weather.description}</p>
        </div>
      </section>

      {activeConstraints.length > 0 && (
        <section className="mx-5 mb-4 space-y-2">
          {activeConstraints.slice(0, 2).map((c: any) => (
            <div key={c.id} className="rounded-xl bg-primary/10 border border-primary/20 p-3 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">{c.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{c.impact}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="px-5 mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Recommended for you</h2>
        <Link to="/explore" className="text-sm text-primary flex items-center gap-1">
          See all <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
      <div className="pl-5 pb-4 flex gap-3 overflow-x-auto">
        {recommended.map((p: any) => (
          <Link
            key={p.id}
            to="/explore"
            className="flex-shrink-0 w-44 rounded-2xl bg-card border border-border p-3"
          >
            <div className="w-full h-24 rounded-xl bg-gradient-to-br from-primary/30 to-accent/40 flex items-center justify-center mb-2">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground line-clamp-1">{p.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" /> {p.district}
            </p>
          </Link>
        ))}
      </div>

      <section className="px-5 pb-6">
        <div className="rounded-2xl bg-primary text-primary-foreground p-5">
          <p className="text-xs uppercase tracking-wide opacity-80">Your trip</p>
          <p className="text-xl font-bold mt-1">
            {trip.cities.length} cities · {trip.cities.reduce((s, c) => s + c.days, 0)} days
          </p>
          <p className="text-sm opacity-90 mt-2">{savedPois.length} saved places</p>
          <Link to="/itinerary" className="inline-flex items-center gap-1 mt-3 text-sm font-medium underline">
            Open itinerary <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </MobileShell>
  );
}
