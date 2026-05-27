import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { GuideHeader } from "@/components/GuideHeader";
import { pageHead, articleJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/guides/transit")({
  component: Transit,
  head: () => {
    const base = pageHead({
      path: "/guides/transit",
      title: "China Transit Guide — Metro, Rail & Taxis | GoChina",
      description:
        "Navigate China's metros, high-speed rail, taxis, and DiDi with step-by-step ticketing and payment instructions.",
      type: "article",
    });
    return {
      ...base,
      scripts: [
        articleJsonLd(
          "China Transit Guide",
          "Metro, high-speed rail, taxi, and DiDi guidance for China travelers.",
          "/guides/transit",
        ),
      ],
    };
  },
});

const METRO_STEPS = [
  'Touch the screen → select "English" if available',
  "Tap your destination station on the map",
  "Select your ticket count and confirm",
  "Pay by Alipay, WeChat Pay, or cash",
  "Scan QR code at turnstile to enter & exit",
  "Line numbers & station names shown in both Chinese and English",
];

const MAPS = [
  {
    name: "Gaode Maps (高德)",
    desc: "Best navigation, Chinese + English",
    url: "https://mobile.amap.com/",
  },
  {
    name: "Baidu Maps",
    desc: "Strong for transit + walking routes",
    url: "https://map.baidu.com/",
  },
  {
    name: "Maps.me",
    desc: "Offline maps, works without VPN",
    url: "https://maps.me/",
  },
];

const DIDI_POINTS = [
  "English interface available in Settings → Language",
  "Pay by WeChat Pay, Alipay, or linked card",
  "Show pickup pin to driver — no need to speak Chinese",
  "Estimated fare shown before booking",
  "DiDi Express is cheapest; DiDi Premier for comfort",
];

const RAIL_POINTS = [
  "Book via Trip.com (English) or the 12306 app",
  "G-trains: 300 km/h — Beijing → Shanghai in 4.5 hrs",
  "Bring passport — same one used for booking",
  "Arrive 30 min early for security screening",
  "¥553 second class Beijing → Shanghai as example",
];

function Transit() {
  return (
    <MobileShell>
      <GuideHeader emoji="🚇" title="Transit Help" />

      <section className="px-5 pb-5">
        <div className="rounded-2xl bg-card border border-border p-5">
          <h2 className="font-bold text-foreground mb-4">Using the Metro</h2>
          <ol className="space-y-4">
            {METRO_STEPS.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground leading-snug pt-1">{s}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-sm text-indigo-900">
            💡 Metro hours: approx 06:00–23:00. Budget ¥3–¥10 per ride.
          </div>
        </div>
      </section>

      <section className="px-5 pb-5">
        <div className="rounded-2xl bg-foreground text-background p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-primary mb-1">
            Essential Tip
          </p>
          <h2 className="text-xl font-bold">Download Offline Maps</h2>
          <p className="text-sm text-background/70 mt-1">
            Google Maps is blocked in China. These work offline:
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {MAPS.map((m) => (
              <a
                key={m.name}
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-background/10 hover:bg-background/15 px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold">{m.name}</div>
                  <div className="text-xs text-background/60">{m.desc}</div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-primary" />
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-5">
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl">
              🚗
            </div>
            <div>
              <h2 className="font-bold text-foreground">DiDi Ride-Hailing</h2>
              <p className="text-xs text-muted-foreground">
                China's Uber — safest option for foreigners
              </p>
            </div>
          </div>
          <ul className="space-y-2.5">
            {DIDI_POINTS.map((p) => (
              <li key={p} className="flex gap-2 text-sm text-foreground leading-snug">
                <span className="text-emerald-600 font-bold shrink-0">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <a
            href="https://www.didiglobal.com/"
            target="_blank"
            rel="noreferrer"
            className="mt-4 w-full h-11 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm inline-flex items-center justify-center gap-1.5"
          >
            Get DiDi App <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      <section className="px-5 pb-10">
        <div className="rounded-2xl bg-card border border-border p-5">
          <h2 className="font-bold text-foreground mb-3">High-Speed Rail (Between Cities)</h2>
          <ul className="space-y-2.5">
            {RAIL_POINTS.map((p) => (
              <li key={p} className="flex gap-2 text-sm text-foreground leading-snug">
                <span className="shrink-0">🚄</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <a
              href="https://www.trip.com/trains/"
              target="_blank"
              rel="noreferrer"
              className="flex-1 h-11 rounded-full bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center justify-center gap-1.5"
            >
              Trip.com <ArrowUpRight className="w-4 h-4" />
            </a>
            <a
              href="https://www.12306.cn/en/"
              target="_blank"
              rel="noreferrer"
              className="flex-1 h-11 rounded-full border border-border text-foreground font-semibold text-sm inline-flex items-center justify-center gap-1.5"
            >
              12306 <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>
    </MobileShell>
  );
}