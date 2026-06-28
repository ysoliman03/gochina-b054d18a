import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, ChevronDown, Lightbulb } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";

const DIGITAL_TOOLS = [
  {
    id: "wechat",
    name: "WeChat",
    tag: "Messaging & Payments",
    tagClass: "bg-emerald-100 text-emerald-700",
    description: "China's super-app for messaging, social, and mobile payments.",
    emoji: "💬",
    bg: "bg-emerald-100",
    url: "https://www.wechat.com/",
    ctaLabel: "Open WeChat",
    steps: [
      "Download WeChat from App Store or Google Play",
      "Sign up with your phone number",
      "Verify with an existing WeChat user if prompted",
      "Link an international card via WeChat Pay (Tenpay)",
      "Used for chat, QR payments, mini-programs and more",
    ],
    tip: "Ask a friend with WeChat to verify your account — it's the fastest way through sign-up.",
  },
  {
    id: "payments",
    name: "Money & Payments",
    tag: "Mobile Payments",
    tagClass: "bg-indigo-100 text-indigo-700",
    description: "Set up Alipay/WeChat Pay, link a foreign card, and pay by QR.",
    emoji: "💙",
    bg: "bg-indigo-100",
    url: "https://www.alipay.com/",
    ctaLabel: "Alipay International",
    steps: [
      "Install Alipay and WeChat from your app store before flying",
      'In Alipay, choose "International" sign-up and verify your passport',
      "Link your Visa/Mastercard directly, or top up Alipay Tour Pass",
      "Enable WeChat Pay (Tenpay) and link the same card as backup",
      "Carry ~¥500 cash for small vendors that still refuse foreign cards",
      "Pay by scanning merchant QR codes, or show your own pay-code",
    ],
    tip: "Always have BOTH Alipay and WeChat Pay set up — some merchants only accept one.",
  },
  {
    id: "didi",
    name: "DiDi & Transit",
    tag: "Ride Hailing & Transit",
    tagClass: "bg-orange-100 text-orange-700",
    description: "China's Uber equivalent with English in-app, plus metro & bus guidance.",
    emoji: "🚗",
    bg: "bg-orange-100",
    url: "https://www.didiglobal.com/",
    ctaLabel: "Open DiDi",
    steps: [
      "Install DiDi, switch to English in Settings, link a foreign card",
      "Save your hotel address in Chinese to share with drivers",
      "Metro: buy single tickets at machines (English option) or scan via Alipay/WeChat",
      "Tap your QR code at the turnstile to enter and exit — fares ¥3–¥10",
      "Buses: pay by Alipay/WeChat QR; have small cash as a fallback",
      "Get a rechargeable transit card (Yikatong in Beijing, SPTC in Shanghai) for buses + metro",
      "Between cities: book high-speed rail on Trip.com or the 12306 app with your passport",
    ],
    tip: "DiDi is safest at night and in bad weather. For short hops, metro is faster than taxis.",
  },
  {
    id: "visa",
    name: "Visa Info",
    tag: "Entry & Documents",
    tagClass: "bg-sky-100 text-sky-700",
    description: "Visa types, entry requirements, and what to prepare before arrival.",
    emoji: "🛂",
    bg: "bg-sky-100",
    url: "https://bio.visaforchina.cn/",
    ctaLabel: "Apply for Visa",
    steps: [
      "Check if your nationality qualifies for visa-free transit (up to 240 hours)",
      "Otherwise apply for an L (tourist) visa via your nearest Chinese visa center",
      "Prepare: passport valid 6+ months, return flight, hotel bookings, photo",
      "Complete the COVA online application form and book a biometrics appointment",
      "Allow 4–7 working days for processing; rush service is available at extra cost",
      "On arrival, fill the arrival card and keep your passport on you at all times",
    ],
    tip: "Register your address with local police within 24h of arrival — most hotels do this for you automatically.",
  },
  {
    id: "vpn",
    name: "VPN",
    tag: "Connectivity",
    tagClass: "bg-purple-100 text-purple-700",
    description: "Access Google, Instagram, WhatsApp and other blocked apps from inside China.",
    emoji: "🛡️",
    bg: "bg-purple-100",
    url: "https://www.expressvpn.com/",
    ctaLabel: "Get a VPN",
    steps: [
      "Choose a paid VPN known to work in China: ExpressVPN, Astrill, or LetsVPN",
      "Buy and install the app BEFORE you arrive — provider sites are blocked in China",
      "Download apps for every device (phone, laptop, tablet) while still home",
      "Sign in and run a connection test to a Hong Kong or Japan server",
      "Enable auto-connect on untrusted Wi-Fi for reliability",
      "If a server gets blocked, switch protocols (Lightway / OpenVPN / WireGuard)",
    ],
    tip: "Free VPNs almost never work in China. Pay for one with a money-back guarantee.",
  },
  {
    id: "esim",
    name: "eSIM",
    tag: "Connectivity",
    tagClass: "bg-rose-100 text-rose-700",
    description: "Get mobile data the moment you land — recommended eSIM providers and steps.",
    emoji: "📶",
    bg: "bg-rose-100",
    url: "https://www.airalo.com/china-esim",
    ctaLabel: "Browse eSIMs",
    steps: [
      "Confirm your phone supports eSIM (iPhone XS+ and most modern Androids)",
      "Pick a provider: Airalo, Holafly, or Nomad — choose Hong Kong-routed plans for open internet",
      "Buy a data plan sized to your trip (1GB/day works for most travelers)",
      "Install the eSIM via QR code BEFORE leaving home — keep your home SIM active",
      "On landing, switch the data line to the China eSIM in Settings → Cellular",
      "Enable data roaming for the eSIM line only; keep your home line on Wi-Fi calling",
    ],
    tip: "Hong Kong-routed eSIMs often bypass the Great Firewall — no VPN needed for Google or WhatsApp.",
  },
];

const STATUS_META: Record<string, { label: string; className: string }> = {
  not_started: { label: "NOT STARTED", className: "text-muted-foreground" },
  in_progress: { label: "IN PROGRESS", className: "text-amber-600" },
  done: { label: "DONE", className: "text-emerald-600" },
};

const STATUS_ORDER = ["not_started", "in_progress", "done"] as const;

function nextStatus(status: string) {
  const index = STATUS_ORDER.indexOf(status as any);
  return STATUS_ORDER[(index + 1) % STATUS_ORDER.length];
}

export function EssentialTools() {
  const digitalTools = useAppStore((s) => s.digitalTools);
  const updateDigitalTool = useAppStore((s) => s.updateDigitalTool);
  const [openTool, setOpenTool] = useState<string | null>("alipay");

  return (
    <section className="px-5 pb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-foreground">Essential Tools</h2>
        <Link
          to="/guides/setup"
          className="text-sm font-medium text-primary inline-flex items-center gap-1"
        >
          Setup Guide <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {DIGITAL_TOOLS.map((tool) => {
          const status = digitalTools[tool.id] || "not_started";
          const meta = STATUS_META[status] ?? STATUS_META.not_started;
          const open = openTool === tool.id;
          const isDone = status === "done";

          return (
            <div key={tool.id} className="rounded-2xl bg-card border border-border overflow-hidden">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setOpenTool(open ? null : tool.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setOpenTool(open ? null : tool.id);
                  }
                }}
                className="w-full flex items-center gap-3 p-4 text-left cursor-pointer"
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${tool.bg}`}
                >
                  {tool.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground leading-tight">{tool.name}</span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tool.tagClass}`}
                    >
                      {tool.tag}
                    </span>
                  </div>
                  <p
                    className={
                      "text-xs text-muted-foreground mt-0.5 " +
                      (open ? "leading-snug" : "truncate")
                    }
                  >
                    {tool.description}
                  </p>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      updateDigitalTool(tool.id, nextStatus(status));
                    }}
                    className={`mt-0.5 inline-flex items-center text-[10px] font-bold tracking-wide hover:underline ${meta.className}`}
                    aria-label="Change status"
                  >
                    {meta.label}
                  </button>
                </div>
                <ChevronDown
                  className={
                    "w-5 h-5 text-muted-foreground shrink-0 transition-transform " +
                    (open ? "rotate-180" : "")
                  }
                />
              </div>

              {open && (
                <div className="px-4 pb-4 border-t border-border">
                  <ol className="mt-4 space-y-3">
                    {tool.steps.map((step, index) => (
                      <li key={step} className="flex gap-3 text-sm text-foreground">
                        <span className="font-bold text-primary shrink-0 w-5">{index + 1}.</span>
                        <span className="leading-snug">{step}</span>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 p-3 flex gap-2 text-xs text-amber-900">
                    <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-snug">{tool.tip}</span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        if (status === "not_started") updateDigitalTool(tool.id, "in_progress");
                      }}
                      className="flex-1 h-11 rounded-full bg-foreground text-background font-semibold text-sm inline-flex items-center justify-center gap-1.5"
                    >
                      {tool.ctaLabel} <ArrowUpRight className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => updateDigitalTool(tool.id, isDone ? "not_started" : "done")}
                      className="flex-1 h-11 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90"
                    >
                      {isDone ? "Mark Undone" : "Mark Done"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
