import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { GuideHeader } from "@/components/GuideHeader";

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
  return (
    <MobileShell>
      <GuideHeader emoji="🍜" title="Food Guide" />
      <section className="px-5 pt-2 pb-10">
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