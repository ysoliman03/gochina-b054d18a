import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { useAppStore } from "@/store/useAppStore";
import { pois } from "@/data/generated/pois";
import { ArrowLeft, Bookmark, MapPin } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { scorePoi } from "@/engine/itineraryEngine";
import { getPoiDisplayChips } from "@/lib/poiDisplay";
import { getPoiFallbackEmoji, getPoiImageSrc } from "@/lib/contentMedia";
import type { SyntheticEvent } from "react";

export const Route = createFileRoute("/explore/$category")({
  component: ExploreCategory,
  head: ({ params }) =>
    pageHead({
      path: `/explore/${params.category}`,
      title: `${params.category.charAt(0).toUpperCase() + params.category.slice(1)} in China | GoChina`,
      description: `Browse curated ${params.category} picks across China's top cities, with addresses, tags, and one-tap saving to your trip.`,
    }),
});

function hideBrokenImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = "none";
}

function ExploreCategory() {
  const { category } = Route.useParams();
  const trip = useAppStore((s) => s.trip);
  const savedPois = useAppStore((s) => s.savedPois);
  const toggleSavePoi = useAppStore((s) => s.toggleSavePoi);
  const profile = useAppStore((s) => s.profile);

  const items = Object.values(pois)
    .filter(
      (p: any) =>
        p.cityId === trip.currentCityId &&
        (p.category === category || (p.tags || []).includes(category)),
    )
    .sort((a: any, b: any) => scorePoi(b, profile) - scorePoi(a, profile));

  return (
    <MobileShell>
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <Link to="/explore" aria-label="Back to explore" className="p-2 rounded-full bg-card border border-border">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold text-foreground capitalize">{category}</h1>
      </header>
      <section className="px-5 space-y-3" aria-labelledby="results-heading">
        <h2 id="results-heading" className="sr-only">Results</h2>
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">No places in this category yet.</p>
        )}
        {items.map((p: any) => {
          const saved = savedPois.includes(p.id);
          const imageSrc = getPoiImageSrc(p);
          return (
            <article key={p.id} className="rounded-2xl bg-card border border-border p-4 flex gap-3">
              <div className="relative w-16 h-16 rounded-xl bg-gradient-to-br from-primary/30 to-accent/40 overflow-hidden flex items-center justify-center text-2xl shrink-0">
                <span aria-hidden="true">{getPoiFallbackEmoji(p)}</span>
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
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground">{p.name}</h3>
                  <button
                    onClick={() => toggleSavePoi(p.id, p.name)}
                    aria-label={saved ? `Remove ${p.name} from saved` : `Save ${p.name}`}
                    className={saved ? "text-primary" : "text-muted-foreground"}
                  >
                    <Bookmark className="w-4 h-4" fill={saved ? "currentColor" : "none"} />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" /> {p.district}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{p.description}</p>
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
              </div>
            </article>
          );
        })}
      </section>
    </MobileShell>
  );
}
