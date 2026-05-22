import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { GuideHeader } from "@/components/GuideHeader";
import { useAppStore } from "@/store/useAppStore";
import { Check, Circle, Clock } from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/guides/setup")({
  component: SetupGuide,
});

const PHASES = [
  {
    phase: "Before You Fly",
    items: [
      { id: "visa", title: "Sort your visa or visa-free entry", detail: "Confirm your visa type and prepare passport, photos, and bookings." },
      { id: "vpn", title: "Install a paid VPN on every device", detail: "ExpressVPN, Astrill, or LetsVPN. Provider sites are blocked in China — install before flying." },
      { id: "esim", title: "Buy and install an eSIM", detail: "Airalo / Holafly / Nomad. Hong Kong-routed plans often bypass the Firewall." },
      { id: "wechat", title: "Create your WeChat account", detail: "Sign up early so a friend can verify you before you need it." },
      { id: "payments", title: "Install Alipay + WeChat Pay and link a card", detail: "Set up BOTH — some merchants only accept one. Tour Pass works as a fallback." },
    ],
  },
  {
    phase: "On Arrival",
    items: [
      { id: "esim", title: "Switch data line to the China eSIM", detail: "Enable data roaming for the eSIM line only." },
      { id: "vpn", title: "Connect VPN to a Hong Kong or Japan server", detail: "Test Google, WhatsApp, and Instagram before leaving the airport." },
      { id: "didi", title: "Open DiDi and book your first ride", detail: "Save your hotel address in Chinese to share with drivers." },
      { id: "payments", title: "Pay by QR at your first vendor", detail: "Carry ~¥500 cash as a backup for small shops." },
    ],
  },
  {
    phase: "Getting Around",
    items: [
      { id: "didi", title: "Buy a metro ticket or transit card", detail: "Use Alipay/WeChat QR at turnstiles, or get Yikatong (Beijing) / SPTC (Shanghai)." },
      { id: "didi", title: "Book intercity high-speed rail", detail: "Use Trip.com or 12306 with the same passport you'll show at the station." },
    ],
  },
];

const STATUS_ICON: Record<string, ReactNode> = {
  not_started: <Circle className="w-4 h-4 text-muted-foreground" />,
  in_progress: <Clock className="w-4 h-4 text-amber-600" />,
  done: <Check className="w-4 h-4 text-emerald-600" />,
};

const STATUS_ORDER = ["not_started", "in_progress", "done"] as const;
function nextStatus(s: string) {
  const i = STATUS_ORDER.indexOf(s as any);
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
}

function SetupGuide() {
  const digitalTools = useAppStore((s) => s.digitalTools);
  const updateDigitalTool = useAppStore((s) => s.updateDigitalTool);

  return (
    <MobileShell>
      <GuideHeader emoji="🧭" title="Setup Guide" />
      <section className="px-5 pb-2">
        <p className="text-sm text-muted-foreground leading-snug">
          A combined walkthrough for all your essential tools. Tap a status to cycle it
          between Not Started, In Progress, and Done.
        </p>
      </section>
      {PHASES.map((p) => (
        <section key={p.phase} className="px-5 pt-5">
          <h2 className="text-xs font-bold tracking-wide text-primary uppercase mb-2">
            {p.phase}
          </h2>
          <div className="rounded-2xl bg-card border border-border divide-y divide-border">
            {p.items.map((it, i) => {
              const status = digitalTools[it.id] || "not_started";
              return (
                <button
                  key={p.phase + i}
                  type="button"
                  onClick={() => updateDigitalTool(it.id, nextStatus(status))}
                  className="w-full text-left p-4 flex gap-3 items-start hover:bg-muted/40"
                >
                  <span className="mt-0.5 shrink-0">{STATUS_ICON[status]}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-foreground text-sm leading-tight">
                      {it.title}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-1 leading-snug">
                      {it.detail}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <div className="h-10" />
    </MobileShell>
  );
}