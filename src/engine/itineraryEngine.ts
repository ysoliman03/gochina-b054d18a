import { pois } from "@/data/generated/pois";
import { poiConnections } from "@/data/generated/poiConnections";
import { matchedInterests } from "@/lib/interestTags";
import { getActiveConstraints } from "@/engine/constraintEngine";

const EARTH_RADIUS_KM = 6371;
const DAY_START = 9 * 60;
const DAY_END = 21 * 60;
const DINNER_TARGET = 18 * 60 + 30;
const MAX_CLOCK_MINUTE = 23 * 60 + 59;

const RELEVANT_CONSTRAINT_TYPES = new Set(["holiday", "crowd", "event", "closure"]);
const CONSTRAINT_SEVERITY_WEIGHT: Record<string, number> = { avoid: 6000, warning: 300, info: 50 };

/** Real calendar date for a trip day: prefer an explicit stored date, else derive from the city's trip start date + day offset. Shared so the store and route don't each reimplement this. */
export function deriveDayDate(
  explicitDate: string | null | undefined,
  cityStartDate: string | null | undefined,
  dayIndex: number,
): string | null {
  if (explicitDate) return explicitDate;
  if (!cityStartDate) return null;
  const start = new Date(`${cityStartDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + dayIndex * 86400000).toISOString().split("T")[0];
}

/**
 * Soft scoring penalty for placing/keeping a POI on a given date: how much a
 * candidate placement should be deprioritized because of an active
 * holiday/crowd/event/closure warning. City-wide (non-POI-specific)
 * constraints nudge less than ones targeting this exact POI.
 */
function constraintScorePenalty(
  cityId: string | undefined,
  dateStr: string | null | undefined,
  poiId: string,
): number {
  if (!cityId || !dateStr) return 0;
  const active = getActiveConstraints(cityId, { start: dateStr, end: dateStr });
  let penalty = 0;
  for (const constraint of active) {
    if (!RELEVANT_CONSTRAINT_TYPES.has(constraint.type)) continue;
    if (constraint.poiId && constraint.poiId !== poiId) continue;
    const weight = CONSTRAINT_SEVERITY_WEIGHT[constraint.severity] ?? 50;
    penalty += constraint.poiId ? weight : weight * 0.25;
  }
  return penalty;
}

/**
 * True if this POI is genuinely inaccessible on this exact date (e.g. a
 * museum's weekly closure day) — a hard exclusion, not a scoring nudge.
 * Deliberately narrow: only non-daily "closure" constraints with severity
 * "avoid" count. A "daily" recurrence in this dataset is used for standing
 * caution notes (e.g. a temple dress code), not a real closure — a POI
 * that's genuinely closed every single day wouldn't be a recommendable
 * attraction in the first place, so treating "daily" as a closure would
 * wrongly blacklist it from every itinerary forever.
 */
export function isPoiClosedOnDate(
  cityId: string | undefined,
  dateStr: string | null | undefined,
  poiId: string,
): boolean {
  if (!cityId || !dateStr) return false;
  const active = getActiveConstraints(cityId, { start: dateStr, end: dateStr });
  return active.some(
    (constraint) =>
      constraint.poiId === poiId &&
      constraint.type === "closure" &&
      constraint.severity === "avoid" &&
      constraint.recurrencePattern !== "daily",
  );
}

const BEST_TIME_TARGET: Record<string, number> = {
  morning: DAY_START,
  daytime: DAY_START,
  any: DAY_START,
  afternoon: 13 * 60,
  evening: 17 * 60,
};

const TIME_ORDER: Record<string, number> = {
  morning: 0,
  daytime: 1,
  any: 1,
  afternoon: 2,
  evening: 3,
};

function parseTime(timeStr: string) {
  if (timeStr === "24h") return { open: 0, close: MAX_CLOCK_MINUTE };
  if (!timeStr.includes("-")) return { open: DAY_START, close: DAY_END };

  const [open, close] = timeStr.split("-").map((t) => {
    const [h, m] = t.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.NaN;
    if (h === 24 && m === 0) return MAX_CLOCK_MINUTE;
    if (h < 0 || h > 23 || m < 0 || m > 59) return Number.NaN;
    return h * 60 + m;
  });

  if (!Number.isFinite(open) || !Number.isFinite(close)) {
    return { open: DAY_START, close: DAY_END };
  }

  const normalizedClose = close <= open ? close + 1440 : close;
  return { open, close: Math.min(normalizedClose, MAX_CLOCK_MINUTE) };
}

function clampMinute(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_CLOCK_MINUTE, Math.round(value)));
}

function getDistanceKm(a: any, b: any): number | null {
  if (!a || !b) return null;
  if (typeof a.lat !== "number" || typeof a.lng !== "number") return null;
  if (typeof b.lat !== "number" || typeof b.lng !== "number") return null;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function estimateTransitOption(fromId?: string, toId?: string) {
  if (!fromId || !toId) return null;
  const fromPoi = (pois as any)[fromId];
  const toPoi = (pois as any)[toId];
  const km = getDistanceKm(fromPoi, toPoi);
  if (km == null) return null;

  const roadKm = km * 1.35;
  const sameDistrict = fromPoi?.district && fromPoi.district === toPoi?.district;
  let minutes: number;

  if (roadKm <= 1.2) minutes = (roadKm / 4.5) * 60 + 5;
  else if (sameDistrict && roadKm <= 4) minutes = (roadKm / 14) * 60 + 8;
  else if (roadKm <= 12) minutes = (roadKm / 22) * 60 + 10;
  else if (roadKm <= 35) minutes = (roadKm / 32) * 60 + 15;
  else minutes = (roadKm / 45) * 60 + 20;

  return {
    from: fromId,
    to: toId,
    mode: "estimated",
    duration: Math.max(8, Math.min(180, Math.ceil(minutes / 5) * 5)),
    distanceKm: Math.round(km * 10) / 10,
    notes: "",
  };
}

export function getTransitOptions(fromId?: string, toId?: string) {
  if (!fromId || !toId) return [];
  const curated = poiConnections
    .filter((c) => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId))
    .sort((a, b) => a.duration - b.duration);

  if (curated.length > 0) return curated;
  const estimated = estimateTransitOption(fromId, toId);
  return estimated ? [estimated] : [];
}

export function getTransitInfo(fromId?: string, toId?: string) {
  return getTransitOptions(fromId, toId)[0] ?? null;
}

export function getTransitTime(fromId?: string, toId?: string) {
  if (!fromId || !toId) return 0;
  return getTransitInfo(fromId, toId)?.duration ?? 20;
}

function resolveStopPoi(stop: any) {
  return ((pois as any)[stop?.id] ?? stop) as any;
}

function getStopDuration(stop: any) {
  const poi = resolveStopPoi(stop);
  const duration = Number(stop?.duration ?? poi?.duration ?? 60);
  if (!Number.isFinite(duration) || duration <= 0) return 60;
  return Math.max(15, Math.round(duration));
}

function hoursFor(stop: any) {
  const poi = resolveStopPoi(stop);
  return parseTime(String(poi?.hours ?? stop?.hours ?? "09:00-21:00"));
}

function targetStartFor(stop: any) {
  const poi = resolveStopPoi(stop);
  if (poi?.category === "restaurant") return DINNER_TARGET;
  return BEST_TIME_TARGET[String(poi?.bestTime ?? "any")] ?? DAY_START;
}

function scheduleStop(
  stop: any,
  currentTime: number,
  previousId: string | undefined,
  latestEnd = DAY_END,
) {
  const poi = resolveStopPoi(stop);
  const duration = getStopDuration(stop);
  const { open, close } = hoursFor(stop);
  const transitInfo = previousId ? getTransitInfo(previousId, stop.id) : null;
  const transit = previousId ? (transitInfo?.duration ?? 20) : 0;
  const earliest = previousId ? currentTime + transit : currentTime;
  const effectiveLatest = Math.min(close, latestEnd, MAX_CLOCK_MINUTE);

  let start = Math.max(earliest, open, targetStartFor(stop));
  let end = start + duration;

  if (end > effectiveLatest) {
    start = Math.max(earliest, open);
    end = start + duration;
  }

  if (end > effectiveLatest || end <= start) return null;

  return {
    ...stop,
    name: stop?.name ?? poi?.name,
    district: stop?.district ?? poi?.district,
    category: stop?.category ?? poi?.category,
    duration,
    scheduledStart: clampMinute(start),
    scheduledEnd: clampMinute(end),
    transitFromPrev: transit,
    transitInfo,
  };
}

function preserveStopSchedule(
  stop: any,
  currentTime: number,
  previousId: string | undefined,
  latestEnd = DAY_END,
) {
  const poi = resolveStopPoi(stop);
  const duration = getStopDuration(stop);
  const transitInfo = previousId ? getTransitInfo(previousId, stop.id) : null;
  const transit = previousId ? (transitInfo?.duration ?? 20) : 0;

  // A traveller-set time (see setStopTime) is a hard anchor — never
  // reflowed by transit/bestTime heuristics. Later stops in the day still
  // schedule relative to this one's real end time via the normal cursor.
  if (stop?.pinnedStart && Number.isFinite(Number(stop.scheduledStart))) {
    const start = clampMinute(Number(stop.scheduledStart));
    const end = Math.min(start + duration, MAX_CLOCK_MINUTE);
    return {
      ...stop,
      name: stop?.name ?? poi?.name,
      district: stop?.district ?? poi?.district,
      category: stop?.category ?? poi?.category,
      duration,
      scheduledStart: start,
      scheduledEnd: clampMinute(end > start ? end : start + 1),
      transitFromPrev: transit,
      transitInfo,
      pinnedStart: true,
    };
  }

  const { open, close } = hoursFor(stop);
  const earliest = previousId ? currentTime + transit : currentTime;
  const effectiveLatest = Math.max(1, Math.min(latestEnd, MAX_CLOCK_MINUTE));
  const hoursLatest = Math.max(1, Math.min(effectiveLatest, close));
  const target = targetStartFor(stop);
  const latestFullStart = Math.max(0, hoursLatest - duration);
  // The one true floor: this stop physically cannot start before it can be
  // reached (previous stop's end + transit) or before the POI opens.
  const earliestOpenStart = Math.max(earliest, Math.min(open, MAX_CLOCK_MINUTE));

  let start = earliestOpenStart;
  if (target >= earliest && target <= latestFullStart) {
    start = Math.max(start, target);
  }
  if (start + duration > hoursLatest && latestFullStart >= earliestOpenStart) {
    start = Math.max(latestFullStart, Math.min(open, MAX_CLOCK_MINUTE));
  }
  if (start + duration > hoursLatest && latestFullStart < earliestOpenStart) {
    // Nothing fits within the day's ideal window (e.g. a reorder pushed this
    // stop's turn very late). Previously this fell back to
    // `min(target, effectiveLatest - 1)`, which could land *before*
    // earliestOpenStart and silently teleport the stop backward in time —
    // that's what collapsed multiple stops onto the same identical slot.
    // There is no valid "ideal" placement here, so just start as soon as
    // physically possible and let the visit run long; the issue detector
    // will flag it as tight/closed, and the traveller can fix the time
    // directly via setStopTime or move stops to another day.
    start = earliestOpenStart;
  }

  // Absolute invariant, enforced regardless of which branch above fired:
  // never move a stop earlier than it can physically happen. This is what
  // guarantees stops stay in real, non-overlapping sequence even when the
  // day has overflowed past its ideal end time.
  start = Math.max(start, earliestOpenStart);
  start = Math.min(start, MAX_CLOCK_MINUTE - 1);

  // Always the POI's real duration — never a truncated "fake" visit. The
  // day's ideal end time (effectiveLatest) only steers *where* we try to
  // place the stop above; it no longer clips the result after the fact.
  let end = Math.min(start + duration, MAX_CLOCK_MINUTE);
  if (end <= start) end = Math.min(MAX_CLOCK_MINUTE, start + 1);

  return {
    ...stop,
    name: stop?.name ?? poi?.name,
    district: stop?.district ?? poi?.district,
    category: stop?.category ?? poi?.category,
    duration,
    scheduledStart: clampMinute(start),
    scheduledEnd: clampMinute(end),
    transitFromPrev: transit,
    transitInfo,
  };
}

function countPreservedStops(scheduled: any[], originalIds: Set<string>) {
  return scheduled.filter((stop) => originalIds.has(stop.id)).length;
}

function totalTransitMinutes(stops: any[]) {
  return stops.reduce((sum, stop) => sum + (Number(stop?.transitFromPrev) || 0), 0);
}

function adjacentCategoryPenalty(stops: any[], poiId: string) {
  const index = stops.findIndex((stop) => stop.id === poiId);
  if (index < 0) return 250;

  const currentCategory = resolveStopPoi(stops[index])?.category;
  let penalty = 0;
  const neighborCategories = [stops[index - 1], stops[index + 1]]
    .filter(Boolean)
    .map((stop) => resolveStopPoi(stop)?.category);

  for (const category of neighborCategories) {
    if (!category || category !== currentCategory) continue;
    // Two restaurants back-to-back is a near-hard rule, not a soft
    // preference — this must outweigh any realistic combination of transit
    // and timing penalties so another valid slot always wins when one exists.
    penalty += currentCategory === "restaurant" ? 5000 : 45;
  }

  return penalty;
}

function timingIssuePenalty(stop: any) {
  const poi = resolveStopPoi(stop);
  const { open, close } = hoursFor(stop);
  const start = Number(stop?.scheduledStart ?? 0);
  const end = Number(stop?.scheduledEnd ?? 0);
  const duration = getStopDuration(stop);
  let penalty = 0;

  if (start < open || end > close) penalty += 1800;
  if (end - start < duration * 0.8) penalty += 900;
  if (poi?.category === "restaurant" && (start < 11 * 60 || start > 20 * 60 + 30)) penalty += 450;

  return penalty;
}

function scheduleQualityPenalty(stops: any[], cityId?: string, date?: string | null) {
  let penalty = 0;
  let previousEnd = -1;

  for (const stop of stops) {
    const start = Number(stop?.scheduledStart ?? Number.NaN);
    const end = Number(stop?.scheduledEnd ?? Number.NaN);
    const duration = getStopDuration(stop);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      penalty += 50000;
      continue;
    }

    if (previousEnd >= 0 && start < previousEnd) {
      penalty += 50000 + (previousEnd - start) * 200;
    }

    const allocated = end - start;
    if (allocated < duration) {
      penalty += 10000 + (duration - allocated) * 150;
    }
    if (end >= MAX_CLOCK_MINUTE && allocated < duration) {
      penalty += 30000;
    }
    if (end > DAY_END) {
      penalty += (end - DAY_END) * 35;
    }
    if (start > DAY_END) {
      penalty += (start - DAY_END) * 45;
    }

    penalty += timingIssuePenalty(stop);
    penalty += constraintScorePenalty(cityId, date, stop.id);
    previousEnd = end;
  }

  return penalty;
}

function scheduleOrderedStops(stops: any[], preserve = false) {
  const scheduled: any[] = [];
  // Always seed from the same fixed anchor, never from a previous
  // computation's output. Seeding from `stops[0].scheduledStart` (a mutable
  // value that's itself the result of the last recalculation) is what let
  // repeated edits ratchet the whole day earlier or later indefinitely —
  // every recalculation must start from the same reference point so it's
  // idempotent for the same input order. A pinned first stop still works
  // correctly regardless of this seed, since preserveStopSchedule ignores
  // `currentTime` entirely for pinned stops.
  let currentTime = DAY_START;
  let previousId: string | undefined;

  for (const stop of stops) {
    const scheduledStop = preserve
      ? preserveStopSchedule(stop, currentTime, previousId)
      : scheduleStop(stop, currentTime, previousId);
    if (!scheduledStop) return null;
    scheduled.push(scheduledStop);
    currentTime = scheduledStop.scheduledEnd;
    previousId = scheduledStop.id;
  }
  return scheduled;
}

function isDietCompatible(poi: any, profile: any) {
  const r: string[] = profile?.dietaryRestrictions || [];
  if (!r.length) return true;
  if (r.includes("Halal") && poi.halal === false) return false;
  if (r.includes("Vegetarian") && poi.vegetarian === false) return false;
  if (r.includes("No Pork") && poi.containsPork === true) return false;
  return true;
}

function budgetCeiling(profile: any) {
  if (profile?.budget === "budget") return 1;
  if (profile?.budget === "luxury") return 5;
  return 2;
}

function isBudgetCompatible(poi: any, profile: any) {
  return (poi.price ?? 0) <= budgetCeiling(profile);
}

function isGroupCompatible(poi: any, profile: any) {
  const suitableFor = poi.suitableFor || [];
  if (!suitableFor.length || !profile?.groupType) return true;
  return suitableFor.includes(profile.groupType);
}

function isPlannerCompatible(poi: any, profile: any) {
  return (
    isDietCompatible(poi, profile) &&
    isBudgetCompatible(poi, profile) &&
    isGroupCompatible(poi, profile)
  );
}

export function scorePoi(poi: any, profile: any, jitter = false) {
  let score = 0;
  const matched = matchedInterests(profile?.interests || [], poi.tags || []);
  score += matched.length * 2;
  score += isGroupCompatible(poi, profile) ? 2 : -3;
  score += isBudgetCompatible(poi, profile) ? 1 : -4;
  if (poi.foreignFriendly >= 4) score += 1;
  if (jitter) score += Math.random() * 1.5;
  return score;
}

function stopsPerDay(pace?: string) {
  if (pace === "fast") return 5;
  if (pace === "slow") return 3;
  return 4;
}

export function recalculateTimes(stops: any[]) {
  if (!stops.length) return stops;
  return scheduleOrderedStops(stops, true) ?? stops.map((stop) => ({
    ...stop,
    scheduledStart: clampMinute(Number(stop.scheduledStart ?? DAY_START)),
    scheduledEnd: clampMinute(Number(stop.scheduledEnd ?? DAY_START + getStopDuration(stop))),
  }));
}

export function getAvailablePOIs(cityId: string, usedIds: string[] = [], profile: any = {}) {
  return Object.values(pois)
    .filter((p: any) => p.cityId === cityId && !usedIds.includes(p.id))
    .map((p: any) => ({ ...p, score: scorePoi(p, profile) }))
    .sort((a: any, b: any) => b.score - a.score);
}

export function getAlternativePOIs(
  poi: any,
  cityId: string,
  usedIds: string[] = [],
  profile: any = {},
) {
  return Object.values(pois)
    .filter(
      (p: any) =>
        p.cityId === cityId &&
        !usedIds.includes(p.id) &&
        p.id !== poi.id &&
        isDietCompatible(p, profile) &&
        (p.category === poi.category || p.tags.some((t: string) => poi.tags.includes(t))),
    )
    .map((p: any) => ({ ...p, score: scorePoi(p, profile) }))
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 4);
}

export function buildDayPlan(
  cityId: string,
  date: string | null,
  profile: any,
  usedPoiIds: string[] = [],
  useJitter = false,
) {
  const maxStops = stopsPerDay(profile?.pace);
  const nonRestaurantTarget = Math.max(1, maxStops - 1);
  const candidateNonRestaurants = Object.values(pois).filter(
    (p: any) =>
      p.cityId === cityId &&
      !usedPoiIds.includes(p.id) &&
      p.category !== "restaurant" &&
      isDietCompatible(p, profile) &&
      !isPoiClosedOnDate(cityId, date, p.id),
  );
  const compatibleNonRestaurants = candidateNonRestaurants.filter((p: any) =>
    isPlannerCompatible(p, profile),
  );
  const cityPois = compatibleNonRestaurants.length
    ? compatibleNonRestaurants
    : candidateNonRestaurants;

  const scored = cityPois
    .map((p: any) => ({
      ...p,
      score: scorePoi(p, profile, useJitter) - constraintScorePenalty(cityId, date, p.id) / 100,
    }))
    .sort(
      (a: any, b: any) =>
        b.score - a.score || (TIME_ORDER[a.bestTime] ?? 1) - (TIME_ORDER[b.bestTime] ?? 1),
    );

  const plan: any[] = [];
  let currentTime = DAY_START;
  let previousId: string | undefined;

  for (const poi of scored) {
    const scheduled = scheduleStop(poi, currentTime, previousId, DINNER_TARGET - 30);
    if (!scheduled) continue;
    plan.push(scheduled);
    currentTime = scheduled.scheduledEnd;
    previousId = scheduled.id;
    if (plan.length >= nonRestaurantTarget) break;
  }

  const candidateRestaurants = Object.values(pois).filter(
    (p: any) =>
      p.cityId === cityId &&
      p.category === "restaurant" &&
      !usedPoiIds.includes(p.id) &&
      isDietCompatible(p, profile) &&
      !isPoiClosedOnDate(cityId, date, p.id),
  );
  const compatibleRestaurants = candidateRestaurants.filter((p: any) =>
    isPlannerCompatible(p, profile),
  );
  const restaurants = (compatibleRestaurants.length ? compatibleRestaurants : candidateRestaurants).sort(
    (a: any, b: any) =>
      scorePoi(b, profile) -
      constraintScorePenalty(cityId, date, b.id) / 100 -
      (scorePoi(a, profile) - constraintScorePenalty(cityId, date, a.id) / 100),
  );

  for (const dinner of restaurants) {
    const scheduled = scheduleStop(dinner, currentTime, previousId, DAY_END);
    if (!scheduled) continue;
    plan.push(scheduled);
    break;
  }

  return plan;
}

export function planBestPOIInsertion(
  stops: any[],
  poi: any,
  cityId?: string,
  date?: string | null,
) {
  const originalIds = new Set(stops.map((stop) => stop.id));
  let best:
    | {
        stops: any[];
        score: number;
        inserted: boolean;
        allOriginalsPreserved: boolean;
      }
    | null = null;

  for (let index = 0; index <= stops.length; index++) {
    const candidate = [...stops.slice(0, index), poi, ...stops.slice(index)];
    const scheduled = scheduleOrderedStops(candidate, true);
    if (!scheduled) continue;

    const preservedCount = countPreservedStops(scheduled, originalIds);
    const allOriginalsPreserved = preservedCount === originalIds.size;
    const inserted = scheduled.some((stop) => stop.id === poi.id);
    if (!inserted) continue;

    const insertedStop = scheduled.find((stop) => stop.id === poi.id);
    const start = Number(insertedStop?.scheduledStart ?? 0);
    const target = targetStartFor(poi);
    const score =
      (allOriginalsPreserved ? 0 : 10000) +
      totalTransitMinutes(scheduled) * 2 +
      Math.abs(start - target) +
      adjacentCategoryPenalty(scheduled, poi.id) +
      scheduleQualityPenalty(scheduled, cityId, date);

    if (!best || score < best.score) {
      best = { stops: scheduled, score, inserted, allOriginalsPreserved };
    }
  }

  if (best) return best;
  return {
    stops: recalculateTimes([...stops, poi]),
    score: Number.POSITIVE_INFINITY,
    inserted: true,
    allOriginalsPreserved: true,
  };
}

export function insertPOIIntoBestSlot(
  stops: any[],
  poi: any,
  cityId?: string,
  date?: string | null,
) {
  return planBestPOIInsertion(stops, poi, cityId, date).stops;
}

export function minutesToTime(minutes: number) {
  const safe = clampMinute(minutes);
  const h = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const m = (safe % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
