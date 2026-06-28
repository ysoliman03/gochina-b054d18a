/**
 * Shared helpers for turning raw POI dataset fields into safe, compact
 * display text — used by both the Explore UI and the itinerary issue
 * detector so a POI's tips/cautions/highlights/hours are presented
 * consistently everywhere.
 */
import type { POI } from "@/data/types";

/** Source CSVs sometimes lost their Chinese text on export, leaving literal "?" placeholders. */
export function hideCorruptedChinese(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^\?+$/.test(value.trim()) ? null : value;
}

export function isUsefulText(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^\?+$/.test(trimmed)) return false;
  return true;
}

/** Splits semicolon/pipe-separated dataset fields and drops empty/corrupted fragments. */
export function normalizePoiTextList(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .flatMap((v) => String(v).split(/[;|]/))
    .map((v) => v.replace(/^["']+|["']+$/g, "").trim())
    .filter(isUsefulText);
}

export function formatOpeningHours(poi: Pick<POI, "hours"> | null | undefined): string | null {
  if (!poi?.hours) return null;
  if (poi.hours === "24h") return "Open 24 hours";
  return poi.hours;
}

const BEST_TIME_LABEL: Record<string, string> = {
  morning: "Best morning",
  afternoon: "Best afternoon",
  evening: "Best evening",
  daytime: "Best daytime",
};

/** Returns null for "any" or unrecognized values — no issue/chip should be shown for those. */
export function formatBestTime(bestTime: string | null | undefined): string | null {
  if (!bestTime) return null;
  return BEST_TIME_LABEL[bestTime] ?? null;
}

export function formatIndoorOutdoor(indoor: boolean | null | undefined): string | null {
  if (typeof indoor !== "boolean") return null;
  return indoor ? "Indoor" : "Outdoor";
}

/** Compact, capped set of chips for a POI card — highlights, indoor/outdoor, best time, booking. */
export function getPoiDisplayChips(poi: Partial<POI> | null | undefined, max = 5): string[] {
  if (!poi) return [];
  const chips: string[] = [];

  const indoorOutdoor = formatIndoorOutdoor(poi.indoor);
  if (indoorOutdoor) chips.push(indoorOutdoor);

  const bestTime = formatBestTime(poi.bestTime);
  if (bestTime) chips.push(bestTime);

  const highlights = normalizePoiTextList(poi.highlights)
    .filter((h) => h.length >= 4 && h.length <= 30)
    .slice(0, 2);
  for (const h of highlights) {
    if (chips.length >= max) break;
    chips.push(h);
  }

  if (poi.bookingRequired && chips.length < max) chips.push("Booking needed");

  return chips.slice(0, max);
}

/** Keywords that make a visitor tip operationally useful for executing an itinerary (vs. flavor text). */
const USEFUL_TIP_KEYWORDS = [
  "arrive early",
  "book",
  "ticket",
  "passport",
  "id",
  "metro",
  "exit",
  "queue",
  "crowd",
  "cash",
  "reservation",
  "security",
  "entrance",
  "bring",
  "avoid",
];

export function isOperationallyUsefulTip(tip: string): boolean {
  const lower = tip.toLowerCase();
  return USEFUL_TIP_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Keywords that suggest a tip/caution is specifically about booking/reservations/required documents. */
const BOOKING_KEYWORDS = ["book", "ticket", "reservation", "passport", "id", "advance"];

export function mentionsBooking(text: string): boolean {
  const lower = text.toLowerCase();
  return BOOKING_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Shortens a dataset sentence for inline display in an issue/chip without truncating mid-word. */
export function truncateForDisplay(text: string, maxLength = 110): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : maxLength)}…`;
}
