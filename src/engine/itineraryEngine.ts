import { pois } from "@/data/pois";
import { poiConnections } from "@/data/poiConnections";

function parseTime(timeStr: string) {
  if (timeStr === "24h") return { open: 0, close: 1440 };
  const [open, close] = timeStr.split("-").map((t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  });
  return { open, close };
}

export function getTransitTime(fromId?: string, toId?: string) {
  if (!fromId || !toId) return 0;
  const conn = poiConnections.find(
    (c) => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId),
  );
  return conn ? conn.duration : 20;
}

function isDietCompatible(poi: any, profile: any) {
  const r: string[] = profile?.dietaryRestrictions || [];
  if (!r.length) return true;
  if (r.includes("Halal") && poi.halal === false) return false;
  if (r.includes("Vegetarian") && poi.vegetarian === false) return false;
  if (r.includes("No Pork") && poi.containsPork === true) return false;
  return true;
}

function scorePoi(poi: any, profile: any, jitter = false) {
  let score = 0;
  const matchedInterests = (profile?.interests || []).filter((t: string) => poi.tags.includes(t));
  score += matchedInterests.length * 2;
  if (poi.suitableFor.includes(profile?.groupType || "solo")) score += 2;
  if (poi.price <= (profile?.budget === "budget" ? 1 : profile?.budget === "mid" ? 2 : 3)) score += 1;
  if (poi.foreignFriendly >= 4) score += 1;
  if (jitter) score += Math.random() * 1.5;
  return score;
}

const TIME_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2, any: 1 };
function stopsPerDay(pace?: string) {
  if (pace === "fast") return 4;
  if (pace === "slow") return 2;
  return 3;
}

export function recalculateTimes(stops: any[]) {
  if (!stops.length) return stops;
  let currentTime = stops[0].scheduledStart || 9 * 60;
  return stops.map((stop, i) => {
    if (i === 0) {
      const end = currentTime + stop.duration;
      currentTime = end;
      return { ...stop, scheduledStart: currentTime - stop.duration, scheduledEnd: end, transitFromPrev: 0 };
    }
    const transit = getTransitTime(stops[i - 1].id, stop.id);
    const start = currentTime + transit;
    const end = start + stop.duration;
    currentTime = end;
    return { ...stop, scheduledStart: start, scheduledEnd: end, transitFromPrev: transit };
  });
}

export function getAvailablePOIs(cityId: string, usedIds: string[] = [], profile: any = {}) {
  return Object.values(pois)
    .filter((p: any) => p.cityId === cityId && !usedIds.includes(p.id))
    .map((p: any) => ({ ...p, score: scorePoi(p, profile) }))
    .sort((a: any, b: any) => b.score - a.score);
}

export function getAlternativePOIs(poi: any, cityId: string, usedIds: string[] = [], profile: any = {}) {
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
  _date: string | null,
  profile: any,
  usedPoiIds: string[] = [],
  useJitter = false,
) {
  const maxStops = stopsPerDay(profile?.pace);
  const cityPois = Object.values(pois).filter(
    (p: any) => p.cityId === cityId && !usedPoiIds.includes(p.id) && p.category !== "restaurant",
  );

  const scored = cityPois
    .map((p: any) => ({ ...p, score: scorePoi(p, profile, useJitter) }))
    .sort(
      (a: any, b: any) =>
        b.score - a.score ||
        (TIME_ORDER[a.bestTime] ?? 1) - (TIME_ORDER[b.bestTime] ?? 1),
    );

  const plan: any[] = [];
  let currentTime = 9 * 60;

  for (const poi of scored) {
    const { open, close } = parseTime(poi.hours);
    const transit = plan.length > 0 ? getTransitTime(plan[plan.length - 1].id, poi.id) : 0;
    const startTime = Math.max(currentTime + transit, open);
    if (startTime + poi.duration > close) continue;
    if (startTime + poi.duration > 21 * 60) break;
    plan.push({
      ...poi,
      scheduledStart: startTime,
      scheduledEnd: startTime + poi.duration,
      transitFromPrev: transit,
    });
    currentTime = startTime + poi.duration;
    if (plan.length >= maxStops - 1) break;
  }

  const restaurants = Object.values(pois)
    .filter(
      (p: any) =>
        p.cityId === cityId &&
        p.category === "restaurant" &&
        !usedPoiIds.includes(p.id) &&
        isDietCompatible(p, profile),
    )
    .sort((a: any, b: any) => scorePoi(b, profile) - scorePoi(a, profile));

  if (restaurants.length > 0) {
    const dinner: any = restaurants[0];
    const dinnerStart = Math.max(currentTime + 20, 18 * 60 + 30);
    plan.push({
      ...dinner,
      scheduledStart: dinnerStart,
      scheduledEnd: dinnerStart + dinner.duration,
      transitFromPrev: 20,
    });
  }

  return plan;
}

export function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}