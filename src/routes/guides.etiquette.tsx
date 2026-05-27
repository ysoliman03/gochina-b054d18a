import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { GuideHeader } from "@/components/GuideHeader";
import { pageHead, articleJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/guides/etiquette")({
  component: Etiquette,
  head: () => {
    const base = pageHead({
      path: "/guides/etiquette",
      title: "China Cultural Etiquette Guide | GoChina",
      description:
        "Avoid awkward moments in China — dining, greetings, gift-giving, and public-space etiquette explained for travelers.",
      type: "article",
    });
    return {
      ...base,
      scripts: [
        articleJsonLd(
          "China Cultural Etiquette Guide",
          "Dining, greetings, and public-space etiquette explained for travelers.",
          "/guides/etiquette",
        ),
      ],
    };
  },
});

const SECTIONS = [
  {
    title: "Dining Etiquette",
    emoji: "🍽️",
    items: [
      "Wait for the host to start eating before you do.",
      "Use chopsticks — never stick them upright in rice (funeral symbolism).",
      "Tap two fingers on the table to thank someone pouring your tea.",
      "Sharing dishes is standard. Use the serving spoons when provided.",
      "Slurping noodles and soup is welcome — it shows you're enjoying it.",
    ],
  },
  {
    title: "Greetings & Conversation",
    emoji: "🙏",
    items: [
      "A light handshake or nod works. Hugs are uncommon with strangers.",
      "Use two hands when giving or receiving business cards or gifts.",
      "Avoid sensitive political topics (Taiwan, Tibet, Tiananmen).",
      "Compliments are often deflected — a polite 'no, no' is just modesty.",
    ],
  },
  {
    title: "Temples & Sacred Sites",
    emoji: "⛩️",
    items: [
      "Dress modestly — cover shoulders and knees.",
      "Walk clockwise around stupas and prayer wheels.",
      "Don't point at Buddha statues with your finger or feet.",
      "Ask before photographing monks or worshippers.",
    ],
  },
  {
    title: "Tipping & Cash",
    emoji: "💴",
    items: [
      "Tipping is not customary — locals don't tip at restaurants or taxis.",
      "High-end hotels and tour guides may accept tips (¥20–¥100).",
      "Most payments are mobile (WeChat Pay / Alipay). Carry ¥200–¥500 cash as backup.",
      "Round up taxi fares to the nearest yuan; receipts (发票) on request.",
    ],
  },
  {
    title: "Public Behavior",
    emoji: "🚶",
    items: [
      "Queuing is improving but not universal — stand your ground politely.",
      "Speak softly on public transit; loud phone calls are frowned upon.",
      "Smoking is banned indoors but common outdoors and in some bars.",
      "Don't be alarmed by curiosity — people may want photos with you.",
    ],
  },
];

function Etiquette() {
  return (
    <MobileShell>
      <GuideHeader emoji="🎎" title="Cultural Etiquette" />
      <section className="px-5 pb-10 flex flex-col gap-4">
        {SECTIONS.map((s) => (
          <div key={s.title} className="rounded-2xl bg-card border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{s.emoji}</span>
              <h2 className="font-bold text-foreground">{s.title}</h2>
            </div>
            <ul className="space-y-2.5">
              {s.items.map((item, i) => (
                <li key={i} className="text-sm text-foreground flex gap-2 leading-snug">
                  <span className="text-primary font-bold shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </MobileShell>
  );
}