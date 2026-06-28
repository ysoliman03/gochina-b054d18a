import { useState } from "react";
import { MapPin, ChevronRight } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cities } from "@/data/generated/cities";
import { getHotelBaseRecommendations } from "@/engine/hotelBaseOptimizer";
import type { CityId } from "@/data/types";
import { HotelBaseOptimizerSheet } from "@/components/HotelBaseOptimizerSheet";

export function HotelBaseOptimizerCard({ cityId }: { cityId: CityId }) {
  const [open, setOpen] = useState(false);
  const savedPois = useAppStore((s) => s.savedPois);
  const trip = useAppStore((s) => s.trip);
  const profile = useAppStore((s) => s.profile);

  const recommendations = getHotelBaseRecommendations({
    cityId,
    savedPoiIds: savedPois,
    itinerary: trip.itinerary,
    profile,
    maxResults: 1,
  });
  const top = recommendations[0];
  const city = (cities as any)[cityId];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl bg-card border border-border p-4 flex items-center gap-3 text-left hover:border-primary/40 transition-colors"
      >
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <MapPin className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground leading-tight">Where should I stay?</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {top
              ? `${top.isPersonalized ? "Best base" : "Starter idea"} for ${city?.name || cityId}: ${top.district}`
              : `Find the best base area in ${city?.name || cityId}`}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>
      <HotelBaseOptimizerSheet open={open} onOpenChange={setOpen} cityId={cityId} />
    </>
  );
}
