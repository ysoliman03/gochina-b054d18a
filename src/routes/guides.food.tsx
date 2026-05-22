import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { GuideHeader } from "@/components/GuideHeader";
import { useAppStore } from "@/store/useAppStore";
import { dishes as allDishes } from "@/data/dishes";
import { cities } from "@/data/cities";

export const Route = createFileRoute("/guides/food")({
  component: FoodGuide,
});

const PHRASES = [
  { zh: "我不吃辣", pinyin: "Wǒ bù chī là", en: "I don't eat spicy food" },
  { zh: "我吃素", pinyin: "Wǒ chī sù", en: "I'm vegetarian" },
  { zh: "请给我菜单", pinyin: "Qǐng gěi wǒ cài dān", en: "Please give me the menu" },
  { zh: "不要猪肉", pinyin: "Bù yào zhūròu", en: "No pork please" },
  { zh: "这个", pinyin: "Zhège", en: "This one (point and say)" },
  { zh: "慢点", pinyin: "Màn diǎn", en: "Slowly please" },
  { zh: "买单", pinyin: "Mǎi dān", en: "The bill, please" },
];

function FoodGuide() {
  const trip = useAppStore((s) => s.trip);
  const profile = useAppStore((s) => s.profile);
  const [cityId, setCityId] = useState<string>(trip.currentCityId);

  const dietary = profile.dietaryRestrictions || [];
  const isVeg = dietary.includes("Vegetarian") || dietary.includes("Vegan");
  const isHalal = dietary.includes("Halal");
  const noPork = isHalal || dietary.includes("No Pork");
  const dietLabel = isVeg ? "Vegetarian" : isHalal ? "Halal" : noPork ? "No Pork" : null;

  const tripCityIds = trip.cities.map((c: any) => c.cityId);
  const tabCities = tripCityIds.length ? tripCityIds : Object.keys(cities);

  const matchingDishes = useMemo(() => {
    return allDishes.filter((d) => {
      if (!d.restaurantsByCity[cityId] && !d.region.toLowerCase().includes((cities as any)[cityId]?.name?.toLowerCase() || "")) {
        const inCity = !!d.restaurantsByCity[cityId];
        if (!inCity) return false;
      }
      if (isVeg && !d.vegetarian) return false;
      if (isHalal && !d.halal) return false;
      if (noPork && d.containsPork) return false;
      return true;
    });
  }, [cityId, isVeg, isHalal, noPork]);

  return (
    <MobileShell>
      <GuideHeader emoji="🍜" title="Food Guide" />

      <div className="px-5 pb-4 flex gap-2 overflow-x-auto no-scrollbar">
        {tabCities.map((id: string) => {
          const c = (cities as any)[id];
          if (!c) return null;
          const active = cityId === id;
          return (
            <button
              key={id}
              onClick={() => setCityId(id)}
              className={
                "flex-1 min-w-[110px] py-3 rounded-2xl text-sm font-semibold transition-colors " +
                (active
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground border border-border")
              }
            >
              {c.name}
            </button>
          );
        })}
      </div>

      {dietLabel && (
        <div className="mx-5 mb-4 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-emerald-800">
            Filtered for: <strong>{dietLabel}</strong>
          </span>
          <span className="text-sm font-semibold text-emerald-700">
            {matchingDishes.length} dish{matchingDishes.length === 1 ? "" : "es"}
          </span>
        </div>
      )}

      <section className="px-5 flex flex-col gap-4">
        {matchingDishes.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border p-6 text-center">
            <div className="text-4xl mb-2">🥗</div>
            <h3 className="font-bold text-foreground">No matching dishes found</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-snug">
              Consider asking your restaurant for steamed fish or egg fried rice — universally
              available halal-friendly options.
            </p>
          </div>
        ) : (
          matchingDishes.map((d) => (
            <article
              key={d.id}
              className="rounded-2xl bg-card border border-border overflow-hidden"
            >
              <div className="relative h-40 overflow-hidden">
                <img
                  src={d.image}
                  alt={d.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 flex gap-1.5">
                  {d.halal && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
                      Halal
                    </span>
                  )}
                  {d.vegetarian && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-teal-600 text-white">
                      Veg
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-foreground leading-tight">{d.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {d.nameZh} · {d.region}
                    </p>
                  </div>
                  {d.spice > 0 && <span className="text-sm">{"🌶️".repeat(d.spice)}</span>}
                </div>
                {d.allergens.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {d.allergens.map((a) => (
                      <span
                        key={a}
                        className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-100"
                      >
                        <AlertTriangle className="w-3 h-3" /> {a}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-sm italic text-muted-foreground mt-2 leading-snug">
                  Tip: {d.tip}
                </p>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="px-5 mt-6 pb-10">
        <div className="rounded-2xl bg-card border border-border p-5">
          <h2 className="font-bold text-foreground text-lg mb-4">Useful Phrases</h2>
          <div className="flex flex-col gap-4">
            {PHRASES.map((p) => (
              <div key={p.zh}>
                <p className="text-primary font-semibold">
                  "{p.pinyin}" <span className="text-foreground/70">({p.zh})</span>
                </p>
                <p className="text-sm text-muted-foreground">{p.en}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MobileShell>
  );
}