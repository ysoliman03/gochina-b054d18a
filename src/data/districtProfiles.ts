/**
 * Optional, hand-written metadata for well-known districts to make Hotel Base
 * Optimizer copy richer. The engine in src/engine/hotelBaseOptimizer.ts must
 * work correctly for any district even when no profile exists here — this is
 * a flavor layer, not a dependency.
 */
import type { CityId } from "./types";

export type DistrictProfile = {
  cityId: CityId;
  district: string;
  labels: string[];
  vibe: string;
  strengths: string[];
  tradeoffs: string[];
  budgetLevel?: "budget" | "mid" | "premium";
};

export const districtProfiles: DistrictProfile[] = [
  {
    cityId: "BJ",
    district: "Dongcheng",
    labels: ["history", "first-timer"],
    vibe: "Central, walkable, packed with imperial-era sights",
    strengths: ["Walking distance to the Forbidden City and hutongs", "Easy metro access to most of the city"],
    tradeoffs: ["Can feel touristy near the main sights", "Hotel rooms tend to be smaller/older in historic buildings"],
    budgetLevel: "mid",
  },
  {
    cityId: "BJ",
    district: "Chaoyang",
    labels: ["nightlife", "modern"],
    vibe: "Embassy-district energy with bars, malls, and international dining",
    strengths: ["Strong nightlife and international food scene", "Good for business travelers and groups"],
    tradeoffs: ["Further from the old-town historic core", "Busier traffic in the CBD area"],
    budgetLevel: "premium",
  },
  {
    cityId: "BJ",
    district: "Xicheng",
    labels: ["culture", "quiet"],
    vibe: "Lakeside hutongs, quieter than Dongcheng but still central",
    strengths: ["Houhai/Shichahai lakes for evening strolls", "Still close to central sights"],
    tradeoffs: ["Fewer big shopping malls nearby", "Narrow hutong streets can be hard for luggage"],
    budgetLevel: "mid",
  },
  {
    cityId: "SH",
    district: "Huangpu",
    labels: ["history", "first-timer"],
    vibe: "The Bund, People's Square, and old Shanghai core",
    strengths: ["Walkable to the Bund and Nanjing Road", "Best metro connectivity in the city"],
    tradeoffs: ["Among the pricier areas to stay", "Very busy with tourists along the riverfront"],
    budgetLevel: "premium",
  },
  {
    cityId: "SH",
    district: "Jing’an",
    labels: ["shopping", "convenience"],
    vibe: "Upscale, central, great mix of shopping and dining",
    strengths: ["Central location with strong metro access", "High density of restaurants and cafes"],
    tradeoffs: ["Less budget-friendly than outer districts"],
    budgetLevel: "premium",
  },
  {
    cityId: "SH",
    district: "Pudong",
    labels: ["modern", "skyline"],
    vibe: "Skyscrapers, the Bund's river-view side, financial district",
    strengths: ["Iconic skyline views", "Close to Shanghai's modern landmarks"],
    tradeoffs: ["Feels more corporate/less local than across the river", "Longer trips to old-town areas"],
    budgetLevel: "premium",
  },
  {
    cityId: "XA",
    district: "Beilin",
    labels: ["history", "first-timer"],
    vibe: "Inside or near the old city walls, close to the Bell Tower",
    strengths: ["Walking distance to the Bell Tower and Muslim Quarter", "Central to most major sights"],
    tradeoffs: ["Can be noisy near the Muslim Quarter at night"],
    budgetLevel: "mid",
  },
  {
    cityId: "XA",
    district: "Lianhu",
    labels: ["culture", "food"],
    vibe: "Home to the Muslim Quarter's street food core",
    strengths: ["Best street food access in the city", "Still inside the city walls"],
    tradeoffs: ["Streets get crowded and loud in the evening"],
    budgetLevel: "budget",
  },
  {
    cityId: "CQ",
    district: "Yuzhong",
    labels: ["first-timer", "skyline"],
    vibe: "The central peninsula — Hongyadong, Jiefangbei, river views",
    strengths: ["Walkable to Hongyadong and the main riverfront sights", "Best metro and monorail access"],
    tradeoffs: ["Extremely hilly — lots of stairs and slopes", "Busy and crowded around Jiefangbei"],
    budgetLevel: "mid",
  },
];

export function getDistrictProfile(cityId: CityId, district: string): DistrictProfile | null {
  return districtProfiles.find((p) => p.cityId === cityId && p.district === district) ?? null;
}
