import { X } from "lucide-react";
import type { SyntheticEvent } from "react";
import { pois } from "@/data/generated/pois";
import { getPoiFallbackEmoji, getPoiImageSrc } from "@/lib/contentMedia";
import {
  formatBestTime,
  formatOpeningHours,
  getPoiDisplayChips,
  normalizePoiTextList,
} from "@/lib/poiDisplay";

const CATEGORY_LABEL: Record<string, string> = {
  attraction: "Attraction",
  restaurant: "Restaurant",
  experience: "Experience",
  nightlife: "Nightlife",
  shopping: "Shopping",
};

function hideBrokenImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = "none";
}

function formatDuration(min: number | undefined | null) {
  if (!min) return "";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function priceLabel(price: number | undefined | null) {
  if (price == null) return "";
  if (price === 0) return "Free";
  return "¥".repeat(Math.max(1, Math.min(4, price)));
}

export function PoiDetailOverlay({
  poiId,
  poi,
  onClose,
}: {
  poiId?: string | null;
  poi?: any;
  onClose: () => void;
}) {
  const selected = (poiId ? (pois as any)[poiId] : null) ?? poi;
  if (!selected) return null;

  const imageSrc = getPoiImageSrc(selected);
  const chips = getPoiDisplayChips(selected);
  const tips = normalizePoiTextList(selected.tips);
  const cautions = normalizePoiTextList(selected.cautions);
  const highlights = normalizePoiTextList(selected.highlights);
  const hours = formatOpeningHours(selected);
  const bestTime = formatBestTime(selected.bestTime);
  const dishes = normalizePoiTextList(selected.signatureDishes);
  const hasDatasetDetails =
    highlights.length ||
    tips.length ||
    cautions.length ||
    hours ||
    bestTime ||
    selected.bookingRequired ||
    dishes.length;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9999] flex justify-center pointer-events-none">
      <div className="w-full max-w-md pointer-events-auto px-3 pb-20">
        <div className="rounded-2xl bg-card border border-border shadow-2xl p-4 max-h-[75dvh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-start gap-3">
            <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-accent/50 to-primary/20 overflow-hidden flex items-center justify-center text-2xl shrink-0">
              <span aria-hidden="true">{getPoiFallbackEmoji(selected)}</span>
              {imageSrc && (
                <img
                  src={imageSrc}
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
                  onClick={onClose}
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

          {selected.description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {selected.description}
            </p>
          )}

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}

          {hasDatasetDetails && (
            <div className="mt-4 pt-3 border-t border-border space-y-3">
              {highlights.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-foreground mb-1">Highlights</p>
                  <ul className="space-y-0.5">
                    {highlights.map((highlight, index) => (
                      <li key={index} className="text-xs text-muted-foreground">
                        - {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tips.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-foreground mb-1">Visitor tips</p>
                  {tips.map((tip, index) => (
                    <p key={index} className="text-xs text-muted-foreground leading-snug">
                      {tip}
                    </p>
                  ))}
                </div>
              )}

              {cautions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-foreground mb-1">Cautions</p>
                  {cautions.map((caution, index) => (
                    <p key={index} className="text-xs text-muted-foreground leading-snug">
                      {caution}
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
                  <p className="text-xs font-semibold text-foreground mb-1">Signature dishes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {dishes.map((dish, index) => (
                      <span
                        key={index}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                      >
                        {dish}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
