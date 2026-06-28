/**
 * Hotel Base Optimizer — recommends which district/neighborhood to stay in,
 * derived entirely from local POI data (coordinates, district, category, tags)
 * plus the user's saved places, itinerary, and profile. No hotel data, no
 * external APIs — deterministic geographic + heuristic scoring only.
 */
import { pois } from "@/data/generated/pois";
import { transportHubs } from "@/data/generated/transportHubs";
import type { CityId, POI } from "@/data/types";
import type { ProfileState } from "@/store/useAppStore";
import { getDistrictProfile } from "@/data/districtProfiles";
import { INTEREST_TAG_KEYWORDS, matchedInterests, tagsHaveKeyword } from "@/lib/interestTags";

export type HotelBaseLabel =
  | "Best overall"
  | "Best for convenience"
  | "Best for nightlife"
  | "Best for budget"
  | "Best for culture"
  | "Best backup";

export type HotelBaseRecommendation = {
  cityId: CityId;
  district: string;
  title: string;
  score: number;
  rank: number;
  label: HotelBaseLabel;
  reasons: string[];
  tradeoffs: string[];
  nearbyPoiIds: string[];
  plannedPoiCount: number;
  savedPoiCount: number;
  avgDistanceKm: number | null;
  /** false when there was no saved/itinerary signal for this city — ranking fell back to general POI density. */
  isPersonalized: boolean;
};

type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

export function getDistanceKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const CULTURE_KEYWORDS = INTEREST_TAG_KEYWORDS.historical;
const NIGHTLIFE_KEYWORDS = INTEREST_TAG_KEYWORDS.nightlife.filter((k) => k !== "skyline" && k !== "river view");

function validPoi(poi: any): poi is POI {
  return !!poi && typeof poi.lat === "number" && typeof poi.lng === "number" && !!poi.district?.trim();
}

type WeightedPoi = { poi: POI; weight: number; isPlanned: boolean; isSaved: boolean };

function buildWeightedPois(
  cityId: CityId,
  savedPoiIds: string[],
  itinerary: Record<string, any[]> | undefined,
  profile: ProfileState | undefined,
): WeightedPoi[] {
  const plannedIds = new Set<string>();
  (itinerary?.[cityId] || []).forEach((day) => {
    (day?.stops || []).forEach((stop: any) => {
      if (stop?.id) plannedIds.add(stop.id);
    });
  });

  const savedIdsInCity = new Set(
    savedPoiIds.filter((id) => {
      const poi = (pois as any)[id];
      return validPoi(poi) && poi.cityId === cityId;
    }),
  );

  const allRelevantIds = new Set([...plannedIds, ...savedIdsInCity]);
  const likesNightlife = (profile?.interests || []).includes("nightlife");

  const result: WeightedPoi[] = [];
  for (const id of allRelevantIds) {
    const poi = (pois as any)[id];
    if (!validPoi(poi)) continue; // edge case: stale id, missing coords/district

    const isPlanned = plannedIds.has(id);
    const isSaved = savedIdsInCity.has(id);
    let weight = isPlanned ? 2.0 : 1.0;
    if (isPlanned && isSaved) weight += 0.3; // combined signal bonus, not double-counted

    if (poi.category === "restaurant") weight *= 0.8;
    if (poi.category === "nightlife" && likesNightlife) weight *= 1.1;

    result.push({ poi, weight, isPlanned, isSaved });
  }
  return result;
}

type DistrictAgg = {
  district: string;
  center: LatLng;
  allPois: POI[];
};

function buildDistrictAggregates(cityId: CityId): DistrictAgg[] {
  const byDistrict = new Map<string, POI[]>();
  Object.values(pois).forEach((p: any) => {
    if (!validPoi(p) || p.cityId !== cityId) return;
    const list = byDistrict.get(p.district) || [];
    list.push(p);
    byDistrict.set(p.district, list);
  });

  const aggregates: DistrictAgg[] = [];
  for (const [district, list] of byDistrict) {
    const center = {
      lat: list.reduce((sum, p) => sum + p.lat, 0) / list.length,
      lng: list.reduce((sum, p) => sum + p.lng, 0) / list.length,
    };
    aggregates.push({ district, center, allPois: list });
  }
  return aggregates;
}

function nearestHubDistanceKm(cityId: CityId, point: LatLng): number | null {
  const hubs = (transportHubs as any[]).filter((h) => h.cityId === cityId && typeof h.lat === "number");
  if (!hubs.length) return null;
  return Math.min(...hubs.map((h) => getDistanceKm(point, { lat: h.lat, lng: h.lng })));
}

function budgetToPriceCeiling(budget: string | undefined): number {
  if (budget === "budget") return 1;
  if (budget === "luxury") return 3;
  return 2; // mid / unset
}

export function getHotelBaseRecommendations(args: {
  cityId: CityId;
  savedPoiIds: string[];
  itinerary?: Record<string, any[]>;
  profile?: ProfileState;
  maxResults?: number;
}): HotelBaseRecommendation[] {
  const { cityId, savedPoiIds, itinerary, profile, maxResults = 4 } = args;

  const weighted = buildWeightedPois(cityId, savedPoiIds, itinerary, profile);
  const districts = buildDistrictAggregates(cityId);
  if (!districts.length) return []; // no POI data for this city at all

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  const isPersonalized = totalWeight > 0;

  type Scored = {
    agg: DistrictAgg;
    score: number;
    avgDistanceKm: number | null;
    nearbyIds: string[];
    plannedCount: number;
    savedCount: number;
    matchedInterests: string[];
    cultureRatio: number;
    nightlifeRatio: number;
    shoppingRestaurantRatio: number;
    avgPrice: number;
    hubDistanceKm: number | null;
  };

  const scored: Scored[] = districts.map((agg) => {
    // --- proximity + concentration (personalized signal) ---
    let proximityScore = 0;
    let concentrationScore = 0;
    let avgDistanceKm: number | null = null;
    const nearbyIds: string[] = [];
    let plannedCount = 0;
    let savedCount = 0;

    if (isPersonalized) {
      let weightedDistanceSum = 0;
      let nearWeight = 0;
      for (const w of weighted) {
        const d = getDistanceKm(agg.center, { lat: w.poi.lat, lng: w.poi.lng });
        weightedDistanceSum += d * w.weight;
        if (d <= 2.5) {
          nearWeight += w.weight;
          nearbyIds.push(w.poi.id);
          if (w.isPlanned) plannedCount++;
          if (w.isSaved) savedCount++;
        }
      }
      avgDistanceKm = weightedDistanceSum / totalWeight;
      proximityScore = Math.max(0, 40 - avgDistanceKm * 8);
      concentrationScore = 25 * (nearWeight / totalWeight);
    } else {
      // No personal signal yet — fall back to general POI density as a starter heuristic.
      proximityScore = 0;
      concentrationScore = Math.min(25, agg.allPois.length * 1.5);
    }

    // --- category / interest fit ---
    const interests = profile?.interests || [];
    const allTags = agg.allPois.flatMap((p) => p.tags || []);
    const districtMatchedInterests = matchedInterests(interests, allTags);
    const categoryFitScore = Math.min(15, districtMatchedInterests.length * 5);

    const cultureCount = agg.allPois.filter((p) => tagsHaveKeyword(p.tags || [], CULTURE_KEYWORDS)).length;
    const nightlifeCount = agg.allPois.filter(
      (p) => p.category === "nightlife" || tagsHaveKeyword(p.tags || [], NIGHTLIFE_KEYWORDS),
    ).length;
    const shoppingRestaurantCount = agg.allPois.filter(
      (p) => p.category === "shopping" || p.category === "restaurant",
    ).length;
    const cultureRatio = cultureCount / agg.allPois.length;
    const nightlifeRatio = nightlifeCount / agg.allPois.length;
    const shoppingRestaurantRatio = shoppingRestaurantCount / agg.allPois.length;

    // --- profile fit (budget / group) ---
    const avgPrice = agg.allPois.reduce((sum, p) => sum + (p.price ?? 2), 0) / agg.allPois.length;
    const priceCeiling = budgetToPriceCeiling(profile?.budget);
    const profileFitScore = avgPrice <= priceCeiling ? 10 : Math.max(0, 10 - (avgPrice - priceCeiling) * 6);

    // --- convenience (distance to nearest transport hub) ---
    const hubDistanceKm = nearestHubDistanceKm(cityId, agg.center);
    const convenienceScore = hubDistanceKm == null ? 5 : Math.max(0, 10 - hubDistanceKm * 1.2);

    // --- tradeoff penalty: very isolated districts with few POIs and far from hubs ---
    let tradeoffPenalty = 0;
    if (agg.allPois.length < 4) tradeoffPenalty += 5;
    if (hubDistanceKm != null && hubDistanceKm > 15) tradeoffPenalty += 5;

    const score = Math.max(
      0,
      Math.min(
        100,
        proximityScore + concentrationScore + categoryFitScore + profileFitScore + convenienceScore - tradeoffPenalty,
      ),
    );

    return {
      agg,
      score,
      avgDistanceKm,
      nearbyIds,
      plannedCount,
      savedCount,
      matchedInterests: districtMatchedInterests,
      cultureRatio,
      nightlifeRatio,
      shoppingRestaurantRatio,
      avgPrice,
      hubDistanceKm,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.max(1, maxResults));

  const usedLabels = new Set<HotelBaseLabel>();
  const likesNightlife = (profile?.interests || []).includes("nightlife");
  const isBudgetTraveler = profile?.budget === "budget";

  function pickLabel(s: Scored, rank: number): HotelBaseLabel {
    if (rank === 0) {
      usedLabels.add("Best overall");
      return "Best overall";
    }
    const profileBudgetLevel = getDistrictProfile(cityId, s.agg.district)?.budgetLevel;
    let budgetWeight = isBudgetTraveler && s.avgPrice <= 1.5 ? 1 : s.avgPrice <= 1.2 ? 0.6 : 0;
    if (profileBudgetLevel === "budget") budgetWeight += 0.5;
    if (profileBudgetLevel === "premium") budgetWeight = Math.max(0, budgetWeight - 0.5);

    const candidates: { label: HotelBaseLabel; weight: number }[] = [
      { label: "Best for nightlife", weight: (likesNightlife ? 1.5 : 1) * s.nightlifeRatio },
      { label: "Best for culture", weight: s.cultureRatio },
      { label: "Best for convenience", weight: s.shoppingRestaurantRatio },
      { label: "Best for budget", weight: budgetWeight },
    ];
    candidates.sort((a, b) => b.weight - a.weight);
    for (const c of candidates) {
      if (c.weight > 0 && !usedLabels.has(c.label)) {
        usedLabels.add(c.label);
        return c.label;
      }
    }
    return "Best backup";
  }

  return top.map((s, idx) => {
    const label = pickLabel(s, idx);
    const reasons: string[] = [];
    const tradeoffs: string[] = [];

    if (s.plannedCount + s.savedCount > 0) {
      reasons.push(
        `Near ${s.plannedCount + s.savedCount} of your saved/planned place${
          s.plannedCount + s.savedCount === 1 ? "" : "s"
        }`,
      );
    }
    if (s.avgDistanceKm != null) {
      reasons.push(`Reduces average distance to your selected stops (~${s.avgDistanceKm.toFixed(1)} km)`);
    }
    if (s.matchedInterests.length > 0) {
      reasons.push(`Good match for your ${s.matchedInterests.slice(0, 2).join(" and ")} interests`);
    }
    if (s.hubDistanceKm != null && s.hubDistanceKm < 8) {
      reasons.push("Close to a major transport hub for arrival/departure");
    }
    if (label === "Best for nightlife") {
      reasons.push("Better evening base — nearby nightlife and food spots");
    }
    if (label === "Best for culture") {
      reasons.push("Many historic and cultural sights within easy reach");
    }
    if (!isPersonalized) {
      reasons.unshift("Starter suggestion based on attraction density — save places or build an itinerary to personalize this");
    }
    if (reasons.length === 0) {
      reasons.push("Reasonably central relative to this city's points of interest");
    }

    if (label === "Best for nightlife") tradeoffs.push("May be less quiet at night");
    if (label === "Best for culture") tradeoffs.push("Better for sightseeing than nightlife");
    if (label === "Best for budget") tradeoffs.push("Fewer upscale dining and shopping options nearby");
    if (s.hubDistanceKm != null && s.hubDistanceKm > 10) {
      tradeoffs.push("Could involve longer rides to airport/station areas");
    }
    if (isPersonalized && s.avgDistanceKm != null && s.avgDistanceKm > 3) {
      tradeoffs.push("Not the closest base for some of your outer-city plans");
    }
    if (tradeoffs.length === 0) {
      tradeoffs.push("Not the closest base for every stop on a spread-out itinerary");
    }

    // Optional hand-written flavor — engine output above is already complete without it.
    const districtProfile = getDistrictProfile(cityId, s.agg.district);
    if (districtProfile) {
      for (const strength of districtProfile.strengths) {
        if (!reasons.includes(strength)) reasons.push(strength);
      }
      for (const tradeoff of districtProfile.tradeoffs) {
        if (!tradeoffs.includes(tradeoff)) tradeoffs.push(tradeoff);
      }
    }

    return {
      cityId,
      district: s.agg.district,
      title: s.agg.district,
      score: Math.round(s.score),
      rank: idx + 1,
      label,
      reasons: reasons.slice(0, 5),
      tradeoffs: tradeoffs.slice(0, 4),
      nearbyPoiIds: s.nearbyIds,
      plannedPoiCount: s.plannedCount,
      savedPoiCount: s.savedCount,
      avgDistanceKm: s.avgDistanceKm == null ? null : Math.round(s.avgDistanceKm * 10) / 10,
      isPersonalized,
    };
  });
}
