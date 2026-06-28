import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { MapPin, CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cities } from "@/data/generated/cities";
import { getHotelBaseRecommendations, type HotelBaseRecommendation } from "@/engine/hotelBaseOptimizer";
import type { CityId } from "@/data/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cityId: CityId;
}

function countItineraryStops(itinerary: Record<string, any[]>, cityId: string) {
  return (itinerary[cityId] || []).reduce((sum: number, day: any) => sum + (day?.stops?.length || 0), 0);
}

function RecommendationDetail({ rec, isTop }: { rec: HotelBaseRecommendation; isTop: boolean }) {
  const [expanded, setExpanded] = useState(isTop);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">{rec.label}</p>
          <h3 className="text-lg font-bold text-foreground leading-tight mt-0.5">{rec.title}</h3>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-foreground">{rec.score}</p>
          <p className="text-[11px] text-muted-foreground">/ 100</p>
        </div>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 w-full flex items-center justify-between text-xs font-semibold text-muted-foreground"
      >
        <span>Why this area?</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="mt-2 space-y-3">
          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5">Why this works</p>
            <ul className="space-y-1">
              {rec.reasons.map((reason, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  {reason}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5">Tradeoffs</p>
            <ul className="space-y-1">
              {rec.tradeoffs.map((tradeoff, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  {tradeoff}
                </li>
              ))}
            </ul>
          </div>
          {(rec.plannedPoiCount > 0 || rec.savedPoiCount > 0 || rec.avgDistanceKm != null) && (
            <p className="text-[11px] text-muted-foreground/80 pt-1 border-t border-border">
              {rec.plannedPoiCount > 0 && `${rec.plannedPoiCount} itinerary stop${rec.plannedPoiCount === 1 ? "" : "s"} nearby`}
              {rec.plannedPoiCount > 0 && rec.savedPoiCount > 0 && " · "}
              {rec.savedPoiCount > 0 && `${rec.savedPoiCount} saved place${rec.savedPoiCount === 1 ? "" : "s"} nearby`}
              {rec.avgDistanceKm != null && ` · ~${rec.avgDistanceKm} km avg distance`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function HotelBaseOptimizerSheet({ open, onOpenChange, cityId }: Props) {
  const savedPois = useAppStore((s) => s.savedPois);
  const trip = useAppStore((s) => s.trip);
  const profile = useAppStore((s) => s.profile);
  const city = (cities as any)[cityId];

  const recommendations = getHotelBaseRecommendations({
    cityId,
    savedPoiIds: savedPois,
    itinerary: trip.itinerary,
    profile,
    maxResults: 4,
  });

  const itineraryStopCount = countItineraryStops(trip.itinerary, cityId);
  const isPersonalized = recommendations[0]?.isPersonalized ?? false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[88dvh] overflow-y-auto rounded-t-2xl px-5 pb-10">
        <SheetHeader className="pt-2 pb-3">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <MapPin className="w-5 h-5 text-primary" />
            Best base in {city?.name || cityId}
          </SheetTitle>
          <SheetDescription className="text-sm">
            {isPersonalized
              ? "Based on where your saved places and itinerary stops actually are — not hotel listings."
              : "No saved places or itinerary yet for this city — here's a starter idea based on where the city's attractions are concentrated."}
          </SheetDescription>
        </SheetHeader>

        {recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-4">
            Save a few places or build an itinerary and GoChina will recommend the best area to stay.
          </p>
        ) : (
          <div className="space-y-3 mt-2">
            {recommendations.map((rec, i) => (
              <RecommendationDetail key={rec.district} rec={rec} isTop={i === 0} />
            ))}
            <p className="text-xs text-muted-foreground text-center pt-2">
              Based on {savedPois.length} saved place{savedPois.length === 1 ? "" : "s"} and {itineraryStopCount}{" "}
              itinerary stop{itineraryStopCount === 1 ? "" : "s"}.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
