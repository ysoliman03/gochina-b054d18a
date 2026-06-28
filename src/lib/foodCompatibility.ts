import type { CuisineDish } from "@/data/types";

type ProfileDietary = {
  dietary?: string[];
  dietaryRestrictions?: string[];
};

export function normalizeDietaryRestriction(label: string): string {
  const map: Record<string, string> = {
    Vegetarian: "vegetarian",
    Vegan: "vegan",
    Pescatarian: "pescatarian",
    Halal: "halal",
    Kosher: "kosher",
    "No Pork": "no_pork",
    "No Beef": "no_beef",
    "Dairy Free": "dairy_free",
    "Nut Free": "nut_free",
    "Egg Free": "egg_free",
    "Gluten Free": "gluten_free",
    "Shellfish Free": "shellfish_free",
    "Soy Free": "soy_free",
    "No Alcohol": "no_alcohol",
    "Low Spice": "low_spice",
  };

  return (
    map[label] ??
    label
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, "_")
  );
}

export function dishMatchesProfile(
  dish: Pick<CuisineDish, "dietaryTags">,
  profile: ProfileDietary = {},
): boolean {
  const rawRestrictions = profile.dietary ?? profile.dietaryRestrictions ?? [];
  const restrictions = rawRestrictions.map(normalizeDietaryRestriction);

  if (!restrictions.length) return true;

  return restrictions.every((restriction) => dish.dietaryTags.includes(restriction));
}
