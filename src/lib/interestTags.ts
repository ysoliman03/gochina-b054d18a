/**
 * Maps onboarding interest values (broad, lowercase: "historical", "food", …)
 * to keyword fragments found in POI tags (varied casing/specificity, e.g.
 * "UNESCO", "Bar", "Cuisine"). Exact-match against profile.interests almost
 * never hits because the vocabularies differ — this keyword/substring match
 * is what makes interest-based personalization actually work across the app.
 */
export const INTEREST_TAG_KEYWORDS: Record<string, string[]> = {
  historical: ["historical", "imperial", "heritage", "ancient", "museum", "culture", "landmark", "unesco"],
  food: ["cuisine", "foodie", "food", "snack", "hotpot", "dessert"],
  nightlife: ["bar", "nightlife", "club", "entertainment", "skyline", "river view"],
  shopping: ["shopping", "market"],
  nature: ["nature", "hiking", "park", "landscape", "zoo"],
  art: ["art", "museum", "photography", "instagram"],
  modern: ["modern", "olympics", "architecture", "skyline"],
};

export function tagsHaveKeyword(tags: string[], keywords: string[]): boolean {
  const lower = tags.map((t) => t.toLowerCase());
  return keywords.some((kw) => lower.some((t) => t.includes(kw)));
}

export function interestMatchesTags(interest: string, tags: string[]): boolean {
  return tagsHaveKeyword(tags, INTEREST_TAG_KEYWORDS[interest] || [interest]);
}

export function matchedInterests(interests: string[], tags: string[]): string[] {
  return interests.filter((interest) => interestMatchesTags(interest, tags));
}
