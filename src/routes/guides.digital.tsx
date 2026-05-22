import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, ChevronDown, Lightbulb } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { GuideHeader } from "@/components/GuideHeader";
import { useAppStore } from "@/store/useAppStore";

export const Route = createFileRoute("/guides/digital")({
  component: DigitalTools,
});

const TOOLS = [
  {
    id: "wechat",
    name: "WeChat",
    tag: "Messaging & Payments",
    tagClass: "bg-emerald-100 text-emerald-700",
    description: "China's super-app for messaging, social, and mobile payments.",
    emoji: "💬",
    bg: "bg-emerald-100",
    url: "https://www.wechat.com/",
    ctaLabel: "Get WeChat",
    steps: [
      "Download WeChat from App Store or Google Play",
      "Sign up with your phone number",
      "Verify with an existing WeChat user if prompted",
      "Link an international card via WeChat Pay (Tenpay)",
    ],
    tip: "Ask a friend with WeChat to verify your account — it's the fastest way through sign-up.",
  },
  {
    id: "alipay",
    name: "Alipay",
    tag: "Mobile Payments",
    tagClass: "bg-indigo-100 text-indigo-700",
    description: "Ant Group's payment platform with a dedicated international setup.",
    emoji: "💙",
    bg: "bg-indigo-100",
    url: "https://www.alipay.com/",
    ctaLabel: "Alipay International",
    steps: [
      "Download Alipay from App Store or Google Play",
      'Select "International" on the sign-up screen',
      "Link your international Visa/Mastercard directly",
      'Use "Tour Pass" feature if direct card link fails',
    ],
    tip: "Tour Pass tops up a digital wallet — great backup if card linking fails.",
  },
  {
    id: "didi",
    name: "DiDi",
    tag: "Ride Hailing",
    tagClass: "bg-orange-100 text-orange-700",
    description: "China's Uber equivalent. Has English in-app and accepts foreign cards.",
    emoji: "🚗",
    bg: "bg-orange-100",
    url: "https://www.didiglobal.com/",
    ctaLabel: "Get DiDi",
    steps: [
      "Download DiDi from App Store or Google Play",
      "Switch the app language to English in settings",
      "Sign up with your phone number",
      "Add an international Visa/Mastercard for payment",
    ],
    tip: "Show the driver your destination in Chinese characters to avoid miscommunication.",
  },
  {
    id: "taobao",
    name: "Taobao",
    tag: "Shopping",
    tagClass: "bg-rose-100 text-rose-700",
    description: "China's biggest online marketplace. Find anything, often dirt cheap.",
    emoji: "🛍️",
    bg: "bg-rose-100",
    url: "https://world.taobao.com/",
    ctaLabel: "Open Taobao",
    steps: [
      "Download Taobao from App Store or Google Play",
      "Sign in with WeChat or phone number",
      "Translate listings using built-in or browser translation",
      "Pay with Alipay or international card via Tour Pass",
    ],
    tip: "Use image search — snap a photo of something you want and Taobao finds it.",
  },
];

const STATUS: Record<string, { label: string; className: string }> = {
  not_started: { label: "NOT STARTED", className: "text-muted-foreground" },
  in_progress: { label: "IN PROGRESS", className: "text-amber-600" },
  done: { label: "DONE", className: "text-emerald-600" },
};

function DigitalTools() {
  const digitalTools = useAppStore((s) => s.digitalTools);
  const updateDigitalTool = useAppStore((s) => s.updateDigitalTool);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <MobileShell>
      <GuideHeader emoji="📱" title="Digital Tools" />
      <p className="px-5 pb-4 text-sm text-muted-foreground leading-snug">
        Set up these apps before or on arrival to navigate China with confidence.
      </p>
      <section className="px-5 pb-10 flex flex-col gap-3">
        {TOOLS.map((t) => {
          const status = digitalTools[t.id] || "not_started";
          const meta = STATUS[status];
          const open = openId === t.id;
          const isDone = status === "done";
          return (
            <div key={t.id} className="rounded-2xl bg-card border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : t.id)}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${t.bg}`}
                >
                  {t.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground leading-tight">{t.name}</span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${t.tagClass}`}
                    >
                      {t.tag}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>
                  <span className={`text-[10px] font-bold tracking-wide ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>
                <ChevronDown
                  className={
                    "w-5 h-5 text-muted-foreground shrink-0 transition-transform " +
                    (open ? "rotate-180" : "")
                  }
                />
              </button>
              {open && (
                <div className="px-4 pb-4 border-t border-border">
                  <ol className="mt-4 space-y-3">
                    {t.steps.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm text-foreground">
                        <span className="font-bold text-primary shrink-0 w-5">{i + 1}.</span>
                        <span className="leading-snug">{step}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 p-3 flex gap-2 text-xs text-amber-900">
                    <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-snug">{t.tip}</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        if (status === "not_started") updateDigitalTool(t.id, "in_progress");
                      }}
                      className="flex-1 h-11 rounded-full bg-foreground text-background font-semibold text-sm inline-flex items-center justify-center gap-1.5"
                    >
                      {t.ctaLabel} <ArrowUpRight className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        updateDigitalTool(t.id, isDone ? "not_started" : "done")
                      }
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
      </section>
    </MobileShell>
  );
}