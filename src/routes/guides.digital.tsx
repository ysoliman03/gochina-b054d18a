import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { GuideHeader } from "@/components/GuideHeader";
import { pageHead, articleJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/guides/digital")({
  component: DigitalTools,
  head: () => {
    const base = pageHead({
      path: "/guides/digital",
      title: "Essential Digital Tools for China Travel | GoChina",
      description:
        "Set up WeChat, Alipay, DiDi, eSIMs, and VPNs before you fly to China — step-by-step guidance for travelers.",
      type: "article",
    });
    return {
      ...base,
      scripts: [
        articleJsonLd(
          "Essential Digital Tools for China Travel",
          "Set up WeChat, Alipay, DiDi, eSIMs, and VPNs before flying to China.",
          "/guides/digital",
        ),
      ],
    };
  },
});

function DigitalTools() {
  return (
    <MobileShell>
      <GuideHeader emoji="📱" title="Digital Tools" />
      <section className="px-5 pt-2 pb-10">
        <p className="text-sm text-muted-foreground leading-snug mb-4">
          Set up these apps before or on arrival to navigate China with confidence.
          Find the full setup checklist on the Explore page.
        </p>
        <Link
          to="/explore"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
        >
          Go to Essential Digital Tools <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </MobileShell>
  );
}