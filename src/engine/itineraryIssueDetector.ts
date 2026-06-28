/**
 * Itinerary Issue Detector — deterministic, local checks that flag practical
 * problems with a day's plan, grounded in the actual POI dataset (hours,
 * booking_required, visitor tips, caution notes, best_time_of_day, duration)
 * plus a narrow set of real, date-bound constraints (closures/holidays/
 * crowds/events). No LLM, no map/weather APIs, no generic planner-rule text.
 */
import { pois } from "@/data/generated/pois";
import { getActiveConstraints } from "@/engine/constraintEngine";
import { getDistanceKm } from "@/engine/hotelBaseOptimizer";
import { minutesToTime } from "@/engine/itineraryEngine";
import {
  formatOpeningHours,
  isOperationallyUsefulTip,
  mentionsBooking,
  normalizePoiTextList,
  truncateForDisplay,
} from "@/lib/poiDisplay";
import type { POI } from "@/data/types";
import type { ProfileState } from "@/store/useAppStore";

export type ItineraryIssueSeverity = "info" | "warning" | "critical";

export type ItineraryIssueType =
  | "closed_at_scheduled_time"
  | "schedule_too_tight"
  | "long_transfer"
  | "booking_required"
  | "missing_meal"
  | "too_many_stops"
  | "active_constraint"
  | "poi_caution"
  | "poi_tip"
  | "best_time_mismatch"
  | "idle_gap";

export type SuggestedFixAction =
  | "move_earlier"
  | "move_later"
  | "replace_stop"
  | "remove_stop"
  | "add_meal"
  | "add_filler"
  | "review_booking"
  | "reduce_day"
  | "open_explore_food"
  | "open_explore_restaurants"
  | "none";

export type ItineraryIssueDatasetSource =
  | "opening_hours"
  | "closing_hours"
  | "booking_required"
  | "visitor_tips"
  | "caution_notes"
  | "best_time_of_day"
  | "duration"
  | "constraint"
  | "derived";

export type ItineraryIssue = {
  id: string;
  type: ItineraryIssueType;
  severity: ItineraryIssueSeverity;
  dayIndex: number;
  stopId?: string;
  poiId?: string;
  poiName?: string;
  stopTitle?: string;
  stopTime?: string | null;
  title: string;
  message: string;
  datasetSource?: ItineraryIssueDatasetSource;
  suggestedFixes: { label: string; action: SuggestedFixAction }[];
};

// The itinerary stop shape used throughout the store/UI is an untyped POI
// spread plus scheduling fields — there's no shared type for it yet, so we
// define the minimal shape this detector actually depends on.
export type ItineraryStop = {
  id: string;
  name?: string;
  category?: string;
  duration?: number;
  scheduledStart?: number;
  scheduledEnd?: number;
  transitFromPrev?: number;
  [key: string]: any;
};

export type ItineraryDay = {
  date?: string;
  stops: ItineraryStop[];
  [key: string]: any;
};

// ── Safe helpers — all return null instead of throwing on bad data ────────

export function parseClockTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m) || h > 24 || m > 59) return null;
  return h * 60 + m;
}

function parseHoursWindow(hours: string | undefined): { open: number; close: number } | null {
  if (!hours) return null;
  if (hours === "24h") return { open: 0, close: 24 * 60 };
  const parts = hours.split("-");
  if (parts.length !== 2) return null;
  const open = parseClockTimeToMinutes(parts[0]);
  const close = parseClockTimeToMinutes(parts[1]);
  if (open == null || close == null || close <= open) return null;
  return { open, close };
}

export function getStopStartMinutes(stop: ItineraryStop): number | null {
  return typeof stop?.scheduledStart === "number" ? stop.scheduledStart : null;
}

export function getStopEndMinutes(stop: ItineraryStop): number | null {
  return typeof stop?.scheduledEnd === "number" ? stop.scheduledEnd : null;
}

export function getPoiById(poiId: string | undefined): POI | null {
  if (!poiId) return null;
  const poi = (pois as any)[poiId];
  return poi ?? null;
}

export { getDistanceKm };

/** Fallback transit estimate when a stop has no transitFromPrev/transitInfo — flat speed assumption, not a routing API. */
export function getApproxTransitMinutes(fromPoi: POI | null, toPoi: POI | null): number | null {
  if (!fromPoi || !toPoi) return null;
  if (typeof fromPoi.lat !== "number" || typeof fromPoi.lng !== "number") return null;
  if (typeof toPoi.lat !== "number" || typeof toPoi.lng !== "number") return null;
  const km = getDistanceKm(
    { lat: fromPoi.lat, lng: fromPoi.lng },
    { lat: toPoi.lat, lng: toPoi.lng },
  );
  return Math.round((km / 25) * 60) + 5; // ~25km/h average incl. walk/wait overhead
}

function formatStopTime(stop: ItineraryStop): string | null {
  const start = getStopStartMinutes(stop);
  const end = getStopEndMinutes(stop);
  if (start == null || end == null) return null;
  return `${minutesToTime(start)}–${minutesToTime(end)}`;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

function meridiemTimeToMinutes(hour: number, minute: number, meridiem: string | undefined) {
  if (!meridiem) return hour * 60 + minute;
  const normalized = meridiem.toLowerCase();
  let adjustedHour = hour % 12;
  if (normalized === "pm") adjustedHour += 12;
  return adjustedHour * 60 + minute;
}

function inferTimeWindowsFromText(text: string): { start: number; end: number }[] {
  const normalized = text.toLowerCase().replace(/[\u2013\u2014]/g, "-");
  const windows: { start: number; end: number }[] = [];
  const seen = new Set<string>();
  const pushWindow = (start: number, end: number) => {
    if (start < 0 || end <= start || end > 24 * 60) return;
    const key = `${start}-${end}`;
    if (seen.has(key)) return;
    seen.add(key);
    windows.push({ start, end });
  };

  for (const match of normalized.matchAll(
    /\b([01]?\d|2[0-3]):([0-5]\d)\s*-\s*([01]?\d|2[0-3]):([0-5]\d)\b/g,
  )) {
    pushWindow(Number(match[1]) * 60 + Number(match[2]), Number(match[3]) * 60 + Number(match[4]));
  }

  for (const match of normalized.matchAll(
    /\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)?\s*-\s*(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/g,
  )) {
    const startMeridiem = match[3] || match[6];
    const start = meridiemTimeToMinutes(Number(match[1]), Number(match[2] || 0), startMeridiem);
    const end = meridiemTimeToMinutes(Number(match[4]), Number(match[5] || 0), match[6]);
    pushWindow(start, end);
  }

  return windows;
}

function paceMajorStopLimit(pace: string | undefined): number {
  if (pace === "slow") return 3;
  if (pace === "fast") return 5;
  return 4; // moderate / unset
}

const LUNCH_WINDOW = { start: 11 * 60 + 30, end: 14 * 60 };
const DINNER_WINDOW = { start: 18 * 60, end: 20 * 60 + 30 };

const BEST_TIME_WINDOWS: Record<string, { start: number; end: number }> = {
  morning: { start: 6 * 60, end: 11 * 60 + 30 },
  afternoon: { start: 12 * 60, end: 17 * 60 + 30 },
  evening: { start: 18 * 60, end: 22 * 60 },
  daytime: { start: 9 * 60, end: 17 * 60 },
};

// Real, date-bound constraints worth surfacing. Deliberately excludes:
//  - "weather" (mock weather/AQI/rain — not implemented as a user-facing issue)
//  - "food_time" / "" (generic planner-guidance rows, not specific to this trip)
const RELEVANT_CONSTRAINT_TYPES = new Set(["holiday", "crowd", "event", "closure"]);

const PRIORITY_ORDER: ItineraryIssueType[] = [
  "closed_at_scheduled_time",
  "active_constraint",
  "booking_required",
  "schedule_too_tight",
  "long_transfer",
  "too_many_stops",
  "poi_caution",
  "best_time_mismatch",
  "missing_meal",
  "idle_gap",
  "poi_tip",
];

const MAX_TOTAL_ISSUES = 6;
const MAX_CAUTION_ISSUES = 2;
const MAX_TIP_ISSUES = 2;

let issueCounter = 0;
function makeId(dayIndex: number, type: ItineraryIssueType, key: string) {
  issueCounter += 1;
  return `${dayIndex}-${type}-${key}-${issueCounter}`;
}

function moveTimeFix(label: "Move earlier" | "Move later", action: "move_earlier" | "move_later") {
  return { label, action };
}

function samePoi(a: ItineraryIssue, b: ItineraryIssue) {
  const aKey = a.poiId ?? a.stopId;
  const bKey = b.poiId ?? b.stopId;
  return !!aKey && aKey === bKey;
}

function mergeFixes(target: ItineraryIssue, source: ItineraryIssue) {
  const existing = new Set(target.suggestedFixes.map((fix) => fix.action));
  for (const fix of source.suggestedFixes) {
    if (fix.action === "none" || existing.has(fix.action)) continue;
    target.suggestedFixes.push(fix);
    existing.add(fix.action);
  }
}

function normalizedIssueText(issue: ItineraryIssue) {
  return `${issue.title} ${issue.message}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function issueDedupeKey(issue: ItineraryIssue) {
  const scope = issue.poiId ?? issue.stopId ?? "day";
  const text = normalizedIssueText(issue).split(" ").slice(0, 10).join(" ");
  return `${issue.type}:${scope}:${text}`;
}

function mergeMissingMealIssues(issues: ItineraryIssue[]) {
  const mealIssues = issues.filter((issue) => issue.type === "missing_meal");
  if (mealIssues.length <= 1) return issues;

  const mergedMealIssue: ItineraryIssue = {
    ...mealIssues[0],
    title: "No meal stops planned",
    message: "This day spans mealtimes but has no lunch or dinner restaurant stop.",
    suggestedFixes: [{ label: "Add meal", action: "open_explore_restaurants" }],
  };

  let inserted = false;
  return issues.flatMap((issue) => {
    if (issue.type !== "missing_meal") return [issue];
    if (inserted) return [];
    inserted = true;
    return [mergedMealIssue];
  });
}

function dedupeIssues(rawIssues: ItineraryIssue[]) {
  const issues = mergeMissingMealIssues(rawIssues).map((issue) => ({
    ...issue,
    suggestedFixes: [...issue.suggestedFixes],
  }));
  const removed = new Set<string>();

  for (const issue of issues) {
    if (removed.has(issue.id)) continue;

    if (issue.type === "active_constraint") {
      for (const candidate of issues) {
        if (candidate.id === issue.id || removed.has(candidate.id) || !samePoi(issue, candidate)) {
          continue;
        }
        if (
          candidate.type === "best_time_mismatch" ||
          candidate.type === "poi_caution" ||
          candidate.type === "poi_tip"
        ) {
          mergeFixes(issue, candidate);
          removed.add(candidate.id);
        }
      }
    }

    if (issue.type === "closed_at_scheduled_time") {
      for (const candidate of issues) {
        if (
          candidate.id !== issue.id &&
          !removed.has(candidate.id) &&
          samePoi(issue, candidate) &&
          candidate.type === "best_time_mismatch"
        ) {
          mergeFixes(issue, candidate);
          removed.add(candidate.id);
        }
      }
    }

    if (issue.type === "booking_required") {
      for (const candidate of issues) {
        if (
          candidate.id !== issue.id &&
          !removed.has(candidate.id) &&
          samePoi(issue, candidate) &&
          candidate.type === "poi_tip" &&
          mentionsBooking(candidate.message)
        ) {
          mergeFixes(issue, candidate);
          removed.add(candidate.id);
        }
      }
    }
  }

  if (issues.some((issue) => issue.type === "schedule_too_tight" && !removed.has(issue.id))) {
    for (const issue of issues) {
      if (issue.type === "too_many_stops") removed.add(issue.id);
    }
  }

  const seen = new Map<string, ItineraryIssue>();
  for (const issue of issues) {
    if (removed.has(issue.id)) continue;
    const key = issueDedupeKey(issue);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, issue);
      continue;
    }
    mergeFixes(existing, issue);
    removed.add(issue.id);
  }

  return issues.filter((issue) => !removed.has(issue.id));
}

export function detectItineraryIssues(args: {
  cityId: string;
  day: ItineraryDay;
  dayIndex: number;
  profile?: ProfileState | null;
  date?: string | null;
}): ItineraryIssue[] {
  const { cityId, day, dayIndex, profile } = args;
  const stops = day?.stops || [];
  const issues: ItineraryIssue[] = [];
  issueCounter = 0;
  if (!stops.length) return issues;

  // ── Closed at scheduled time ─────────────────────────────────────────
  for (const stop of stops) {
    const poi = getPoiById(stop.id);
    const start = getStopStartMinutes(stop);
    const end = getStopEndMinutes(stop);
    if (!poi || start == null || end == null) continue;
    const window = parseHoursWindow(poi.hours);
    if (!window) continue; // unparsable hours — skip rather than guess
    if (start < window.open || end > window.close) {
      const fix =
        start < window.open
          ? moveTimeFix("Move later", "move_later")
          : moveTimeFix("Move earlier", "move_earlier");
      issues.push({
        id: makeId(dayIndex, "closed_at_scheduled_time", stop.id),
        type: "closed_at_scheduled_time",
        severity: "critical",
        dayIndex,
        stopId: stop.id,
        poiId: stop.id,
        poiName: poi.name,
        stopTitle: poi.name,
        stopTime: formatStopTime(stop),
        title: "May be closed at this time",
        message: `Listed hours: ${formatOpeningHours(poi)}. This stop is scheduled outside that window.`,
        datasetSource: "opening_hours",
        suggestedFixes: [fix],
      });
    }
  }

  // ── Schedule too tight ────────────────────────────────────────────────
  for (const stop of stops) {
    const poi = getPoiById(stop.id);
    const start = getStopStartMinutes(stop);
    const end = getStopEndMinutes(stop);
    if (!poi || !poi.duration || start == null || end == null) continue;
    const allocated = end - start;
    if (allocated > 0 && allocated < poi.duration * 0.7) {
      issues.push({
        id: makeId(dayIndex, "schedule_too_tight", stop.id),
        type: "schedule_too_tight",
        severity: "warning",
        dayIndex,
        stopId: stop.id,
        poiId: stop.id,
        poiName: poi.name,
        stopTitle: poi.name,
        stopTime: formatStopTime(stop),
        title: "This stop may be rushed",
        message: `Only ${allocated} minutes planned, but ${poi.name} usually takes about ${poi.duration} minutes.`,
        datasetSource: "duration",
        suggestedFixes: [
          { label: "Reduce this day", action: "reduce_day" },
          { label: "Remove stop", action: "remove_stop" },
        ],
      });
    }
  }

  // ── Too many stops for pace ───────────────────────────────────────────
  // Restaurant stops aren't treated as "major" sightseeing load.
  const majorStops = stops.filter((s) => s.category !== "restaurant");
  const limit = paceMajorStopLimit(profile?.pace);
  if (majorStops.length > limit) {
    issues.push({
      id: makeId(dayIndex, "too_many_stops", "day"),
      type: "too_many_stops",
      severity: "warning",
      dayIndex,
      title: "This day may be too packed for your selected pace",
      message: `${majorStops.length} sightseeing stops planned, above the ${limit} suggested for your pace.`,
      datasetSource: "derived",
      suggestedFixes: [{ label: "Reduce this day", action: "reduce_day" }],
    });
  }

  // ── Long transfer ──────────────────────────────────────────────────────
  for (let i = 1; i < stops.length; i++) {
    const prevStop = stops[i - 1];
    const stop = stops[i];
    const prevPoi = getPoiById(prevStop.id);
    const poi = getPoiById(stop.id);
    let transitMinutes: number | null =
      typeof stop.transitFromPrev === "number" ? stop.transitFromPrev : null;
    if (transitMinutes == null) {
      transitMinutes = getApproxTransitMinutes(prevPoi, poi);
    }
    if (transitMinutes == null) continue;
    if (transitMinutes >= 45) {
      const prevName = prevPoi?.name || prevStop.name || "the previous stop";
      const name = poi?.name || stop.name || "this stop";
      issues.push({
        id: makeId(dayIndex, "long_transfer", stop.id),
        type: "long_transfer",
        severity: transitMinutes >= 70 ? "critical" : "warning",
        dayIndex,
        stopId: stop.id,
        poiId: stop.id,
        poiName: poi?.name,
        stopTitle: name,
        stopTime: formatStopTime(stop),
        title: "Long transfer between stops",
        message: `The transfer from ${prevName} to ${name} looks long (~${transitMinutes} min).`,
        datasetSource: "derived",
        suggestedFixes: [
          { label: "Replace stop", action: "replace_stop" },
          { label: "Reduce this day", action: "reduce_day" },
        ],
      });
    }
  }

  // ── Booking required ──────────────────────────────────────────────────
  for (const stop of stops) {
    const poi = getPoiById(stop.id);
    if (!poi?.bookingRequired) continue;
    const bookingNote =
      normalizePoiTextList(poi.tips).find(mentionsBooking) ??
      normalizePoiTextList(poi.cautions).find(mentionsBooking);
    issues.push({
      id: makeId(dayIndex, "booking_required", stop.id),
      type: "booking_required",
      severity: "warning",
      dayIndex,
      stopId: stop.id,
      poiId: stop.id,
      poiName: poi.name,
      stopTitle: poi.name,
      stopTime: formatStopTime(stop),
      title: "Booking may be needed",
      message: bookingNote
        ? `${poi.name} requires advance booking. "${truncateForDisplay(bookingNote)}"`
        : `${poi.name} requires advance booking.`,
      datasetSource: "booking_required",
      suggestedFixes: [{ label: "Review booking", action: "review_booking" }],
    });
  }

  // ── POI caution notes (capped) ───────────────────────────────────────
  let cautionCount = 0;
  for (const stop of stops) {
    if (cautionCount >= MAX_CAUTION_ISSUES) break;
    const poi = getPoiById(stop.id);
    if (!poi) continue;
    const cautions = normalizePoiTextList(poi.cautions);
    if (!cautions.length) continue;
    issues.push({
      id: makeId(dayIndex, "poi_caution", stop.id),
      type: "poi_caution",
      severity: "info",
      dayIndex,
      stopId: stop.id,
      poiId: stop.id,
      poiName: poi.name,
      stopTitle: poi.name,
      stopTime: formatStopTime(stop),
      title: "Caution for this stop",
      message: truncateForDisplay(cautions[0]),
      datasetSource: "caution_notes",
      suggestedFixes: [],
    });
    cautionCount++;
  }

  // ── Best time of day mismatch ─────────────────────────────────────────
  for (const stop of stops) {
    const poi = getPoiById(stop.id);
    const start = getStopStartMinutes(stop);
    if (!poi?.bestTime || poi.bestTime === "any" || start == null) continue;
    const window = BEST_TIME_WINDOWS[poi.bestTime];
    if (!window) continue;
    if (start < window.start || start > window.end) {
      const fix =
        start < window.start
          ? moveTimeFix("Move later", "move_later")
          : moveTimeFix("Move earlier", "move_earlier");
      issues.push({
        id: makeId(dayIndex, "best_time_mismatch", stop.id),
        type: "best_time_mismatch",
        severity: "info",
        dayIndex,
        stopId: stop.id,
        poiId: stop.id,
        poiName: poi.name,
        stopTitle: poi.name,
        stopTime: formatStopTime(stop),
        title: `Best in the ${poi.bestTime}`,
        message: `${poi.name} is best in the ${poi.bestTime}, but it's scheduled at ${minutesToTime(start)}.`,
        datasetSource: "best_time_of_day",
        suggestedFixes: [fix],
      });
    }
  }

  // ── Missing meal ───────────────────────────────────────────────────────
  // Use the actual min/max across all stops rather than the first/last array
  // entries — AI-generated days aren't guaranteed to list stops in
  // chronological order, so array position alone is unreliable here.
  const starts = stops.map(getStopStartMinutes).filter((v): v is number => v != null);
  const ends = stops.map(getStopEndMinutes).filter((v): v is number => v != null);
  const dayStart = starts.length ? Math.min(...starts) : null;
  const dayEnd = ends.length ? Math.max(...ends) : null;
  if (dayStart != null && dayEnd != null) {
    const hasMealInWindow = (winStart: number, winEnd: number) =>
      stops.some((s) => {
        if (s.category !== "restaurant") return false;
        const start = getStopStartMinutes(s);
        const end = getStopEndMinutes(s);
        return start != null && end != null && rangesOverlap(start, end, winStart, winEnd);
      });

    if (
      rangesOverlap(dayStart, dayEnd, LUNCH_WINDOW.start, LUNCH_WINDOW.end) &&
      !hasMealInWindow(LUNCH_WINDOW.start, LUNCH_WINDOW.end)
    ) {
      issues.push({
        id: makeId(dayIndex, "missing_meal", "lunch"),
        type: "missing_meal",
        severity: "info",
        dayIndex,
        title: "No lunch stop planned",
        message: "This day spans lunchtime but has no restaurant stop.",
        datasetSource: "derived",
        suggestedFixes: [{ label: "Add meal", action: "open_explore_restaurants" }],
      });
    }
    if (
      rangesOverlap(dayStart, dayEnd, DINNER_WINDOW.start, DINNER_WINDOW.end) &&
      !hasMealInWindow(DINNER_WINDOW.start, DINNER_WINDOW.end)
    ) {
      issues.push({
        id: makeId(dayIndex, "missing_meal", "dinner"),
        type: "missing_meal",
        severity: "info",
        dayIndex,
        title: "No dinner stop planned",
        message: "This day spans dinnertime but has no restaurant stop.",
        datasetSource: "derived",
        suggestedFixes: [{ label: "Add meal", action: "open_explore_restaurants" }],
      });
    }
  }

  // ── Active constraints — real, date-bound ones only ──────────────────
  // Excludes weather (no mock weather/AQI/rain issues) and generic planner
  // guidance rows (food_time / untyped) that aren't tied to this trip.
  const dateStr = args.date ?? day.date ?? null;
  if (dateStr) {
    const activeConstraints = getActiveConstraints(cityId, { start: dateStr, end: dateStr });
    const stopPoiIds = new Set(stops.map((s) => s.id));

    for (const constraint of activeConstraints) {
      if (!RELEVANT_CONSTRAINT_TYPES.has(constraint.type)) continue;
      if (constraint.poiId && !stopPoiIds.has(constraint.poiId)) continue; // not relevant to this day's stops
      const poi = constraint.poiId ? getPoiById(constraint.poiId) : null;
      const stop = constraint.poiId ? stops.find((s) => s.id === constraint.poiId) : null;
      const timeWindows = inferTimeWindowsFromText(
        `${constraint.title} ${constraint.impact} ${constraint.action}`,
      );
      if (stop && timeWindows.length > 0) {
        const start = getStopStartMinutes(stop);
        const end = getStopEndMinutes(stop);
        if (
          start != null &&
          end != null &&
          !timeWindows.some((window) => rangesOverlap(start, end, window.start, window.end))
        ) {
          continue;
        }
      }
      const suggestedFixes: ItineraryIssue["suggestedFixes"] = [];
      if (constraint.poiId && (constraint.type === "crowd" || constraint.type === "event")) {
        suggestedFixes.push({ label: "Move earlier", action: "move_earlier" });
      }
      if (constraint.poiId && constraint.type === "closure") {
        suggestedFixes.push({ label: "Replace stop", action: "replace_stop" });
      }
      issues.push({
        id: makeId(dayIndex, "active_constraint", constraint.id),
        type: "active_constraint",
        severity:
          constraint.severity === "avoid"
            ? "critical"
            : constraint.severity === "warning"
              ? "warning"
              : "info",
        dayIndex,
        stopId: constraint.poiId ?? undefined,
        poiId: constraint.poiId ?? undefined,
        poiName: poi?.name,
        stopTitle: poi?.name,
        stopTime: stop ? formatStopTime(stop) : null,
        title: constraint.title,
        message: constraint.impact || constraint.title,
        datasetSource: "constraint",
        suggestedFixes,
      });
    }
  }

  // ── Visitor tips — operationally useful only (capped) ────────────────
  let tipCount = 0;
  for (const stop of stops) {
    if (tipCount >= MAX_TIP_ISSUES) break;
    const poi = getPoiById(stop.id);
    if (!poi) continue;
    const usefulTip = normalizePoiTextList(poi.tips).find(isOperationallyUsefulTip);
    if (!usefulTip) continue;
    issues.push({
      id: makeId(dayIndex, "poi_tip", stop.id),
      type: "poi_tip",
      severity: "info",
      dayIndex,
      stopId: stop.id,
      poiId: stop.id,
      poiName: poi.name,
      stopTitle: poi.name,
      stopTime: formatStopTime(stop),
      title: "Useful tip",
      message: truncateForDisplay(usefulTip),
      datasetSource: "visitor_tips",
      suggestedFixes: [],
    });
    tipCount++;
  }

  // ── Idle gap ───────────────────────────────────────────────────────────
  for (let i = 1; i < stops.length; i++) {
    const prevEnd = getStopEndMinutes(stops[i - 1]);
    const start = getStopStartMinutes(stops[i]);
    if (prevEnd == null || start == null) continue;
    const gap = start - prevEnd;
    if (gap >= 60) {
      const prevPoi = getPoiById(stops[i - 1].id);
      const poi = getPoiById(stops[i].id);
      const prevName = prevPoi?.name || stops[i - 1].name || "the previous stop";
      const name = poi?.name || stops[i].name || "the next stop";
      issues.push({
        id: makeId(dayIndex, "idle_gap", stops[i].id),
        type: "idle_gap",
        severity: "info",
        dayIndex,
        stopId: stops[i].id,
        poiId: stops[i].id,
        poiName: poi?.name,
        stopTitle: name,
        stopTime: formatStopTime(stops[i]),
        title: "Free gap before this stop",
        message: `There is a ${gap}-minute gap between ${prevName} and ${name}. You could add a short nearby café, shop, viewpoint, or walk.`,
        datasetSource: "derived",
        suggestedFixes: [{ label: "Add filler", action: "add_filler" }],
      });
    }
  }

  // ── Cap and prioritize ────────────────────────────────────────────────
  const sorted = dedupeIssues(issues).sort((a, b) => {
    const ai = PRIORITY_ORDER.indexOf(a.type);
    const bi = PRIORITY_ORDER.indexOf(b.type);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  return sorted.slice(0, MAX_TOTAL_ISSUES);
}
