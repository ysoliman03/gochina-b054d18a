import type { CuisineDish, POI } from "@/data/types";

const POI_IMAGE_BASE = "/images/POIs_Images/";
const DISH_IMAGE_BASE = "/images/Dish_Images/";

const POI_IMAGE_OVERRIDES: Record<string, string> = {
  CQ010: "CQ010_cover.bmp",
  CQ011: "CQ011_cover.jpeg",
};

const DISH_IMAGE_OVERRIDES: Record<string, string> = {
  // This asset was delivered in the POI folder; keep the file in place and map it here.
  D009: "/images/POIs_Images/D009_cover.jpg",
};

const MISSING_POI_IMAGES = new Set(["BJ023_cover.jpg", "BJ026_cover.jpg"]);
const MISSING_DISH_IMAGES = new Set(["D015_cover.jpg"]);

const POI_FALLBACK_EMOJI: Record<string, string> = {
  attraction: "\u{1F5FA}\u{FE0F}",
  experience: "\u{1F3AD}",
  nightlife: "\u{1F303}",
  restaurant: "\u{1F35C}",
  shopping: "\u{1F6CD}\u{FE0F}",
};

const DISH_FALLBACK_EMOJI: Record<string, string> = {
  barbecue: "\u{1F362}",
  dumpling: "\u{1F95F}",
  hotpot: "\u{1F372}",
  noodle: "\u{1F35C}",
  pastry: "\u{1F96E}",
  seafood: "\u{1F990}",
  snack: "\u{1F960}",
  soup: "\u{1F963}",
};

function imagePath(base: string, fileName: string) {
  return `${base}${encodeURIComponent(fileName)}`;
}

export function getPoiImageSrc(poi: Pick<POI, "id" | "coverImage"> | null | undefined) {
  if (!poi) return null;
  const fileName = POI_IMAGE_OVERRIDES[poi.id] ?? poi.coverImage;
  if (!fileName || MISSING_POI_IMAGES.has(fileName)) return null;
  return imagePath(POI_IMAGE_BASE, fileName);
}

export function getDishImageSrc(dish: Pick<CuisineDish, "id" | "imageKey"> | null | undefined) {
  if (!dish) return null;
  const override = DISH_IMAGE_OVERRIDES[dish.id];
  if (override) return override;
  if (!dish.imageKey || MISSING_DISH_IMAGES.has(dish.imageKey)) return null;
  return imagePath(DISH_IMAGE_BASE, dish.imageKey);
}

export function getPoiFallbackEmoji(poi: Pick<POI, "category"> | null | undefined) {
  return poi ? (POI_FALLBACK_EMOJI[poi.category] ?? "\u{1F5FA}\u{FE0F}") : "\u{1F5FA}\u{FE0F}";
}

export function getDishFallbackEmoji(dish: Pick<CuisineDish, "category"> | null | undefined) {
  return dish ? (DISH_FALLBACK_EMOJI[dish.category] ?? "\u{1F37D}\u{FE0F}") : "\u{1F37D}\u{FE0F}";
}
