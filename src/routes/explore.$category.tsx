import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { useAppStore } from "@/store/useAppStore";
import { pois } from "@/data/pois";
import { ArrowLeft, Bookmark, MapPin } from "lucide-react";

export const Route = createFileRoute("/explore/$category")({
  component: ExploreCategory,
});

function ExploreCategory() {
  const { category } = Route.useParams();
  const trip = useAppStore((s) => s.trip);
  const savedPois = useAppStore((s) => s.savedPois);
  const toggleSavePoi = useAppStore((s) => s.toggleSavePoi);

  const items = Object.values(pois).filter(
    (p: any) =>
      p.cityId === trip.currentCityId &&
      (p.category === category || (p.tags || []).includes(category)),
  );

  return (
    <MobileShell>
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <Link to="/explore" className="p-2 rounded-full bg-card border border-border">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold text-foreground capitalize">{category}</h1>
      </header>
      <section className="px-5 space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">No places in this category yet.</p>
        )}
        {items.map((p: any) => {
          const saved = savedPois.includes(p.id);
          return (
            <article key={p.id} className="rounded-2xl bg-card border border-border p-4 flex gap-3">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/30 to-accent/40 flex items-center justify-center text-2xl">
                🏯
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground">{p.name}</h3>
                  <button
                    onClick={() => toggleSavePoi(p.id, p.name)}
                    className={saved ? "text-primary" : "text-muted-foreground"}
                  >
                    <Bookmark className="w-4 h-4" fill={saved ? "currentColor" : "none"} />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" /> {p.district}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{p.description}</p>
              </div>
            </article>
          );
        })}
      </section>
    </MobileShell>
  );
}