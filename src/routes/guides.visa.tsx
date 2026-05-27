import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { GuideHeader } from "@/components/GuideHeader";
import { useAppStore } from "@/store/useAppStore";
import { COUNTRIES } from "@/data/countries";
import { pageHead } from "@/lib/seo";
import { articleJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/guides/visa")({
  component: Visa,
  head: () => {
    const base = pageHead({
      path: "/guides/visa",
      title: "China Visa Guide — 144h Visa-Free & E-Visa | GoChina",
      description:
        "Check whether your passport qualifies for 144-hour visa-free transit and learn how to apply for an E-Visa (L visa) to China.",
      type: "article",
    });
    return {
      ...base,
      scripts: [
        articleJsonLd(
          "China Visa Guide — 144h Visa-Free & E-Visa",
          "Check whether your passport qualifies for 144-hour visa-free transit and learn how to apply for an E-Visa to China.",
          "/guides/visa",
        ),
      ],
    };
  },
});

const VISA_FREE_144 = new Set([
  "United States","United Kingdom","Canada","Australia","New Zealand","Ireland",
  "France","Germany","Italy","Spain","Portugal","Netherlands","Belgium","Luxembourg",
  "Austria","Switzerland","Denmark","Sweden","Norway","Finland","Iceland","Greece",
  "Hungary","Poland","Czech Republic","Slovakia","Slovenia","Estonia","Latvia",
  "Lithuania","Malta","Cyprus","Bulgaria","Romania","Croatia","Monaco","Russia",
  "Ukraine","Belarus","Serbia","North Macedonia","Albania","Bosnia and Herzegovina",
  "Japan","South Korea","Singapore","Brunei","United Arab Emirates","Qatar",
  "Mexico","Brazil","Argentina","Chile",
]);

function Visa() {
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const nationality = profile.nationality || "";
  const eligible = nationality && VISA_FREE_144.has(nationality);

  return (
    <MobileShell>
      <GuideHeader emoji="🛂" title="Visa Info" />

      <section className="px-5 pb-5">
        <div className="rounded-2xl bg-card border border-border p-5">
          <h2 className="font-bold text-foreground mb-3">Check Your Eligibility</h2>
          <div className="relative">
            <select
              aria-label="Your nationality"
              value={nationality}
              onChange={(e) => updateProfile({ nationality: e.target.value })}
              className={
                "w-full h-12 rounded-xl bg-muted border border-border px-4 pr-10 text-sm appearance-none " +
                (nationality ? "text-foreground" : "text-muted-foreground")
              }
            >
              <option value="">Select your nationality...</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c} className="text-foreground">
                  {c}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 rotate-90 text-muted-foreground pointer-events-none" />
          </div>
          {nationality && (
            <div
              className={
                "mt-3 rounded-xl px-4 py-3 text-sm " +
                (eligible
                  ? "bg-emerald-50 border border-emerald-100 text-emerald-800"
                  : "bg-amber-50 border border-amber-100 text-amber-900")
              }
            >
              {eligible
                ? `✓ ${nationality} passport holders qualify for 144-hour transit visa-free.`
                : `${nationality} passport holders likely need an E-Visa or standard tourist visa.`}
            </div>
          )}
        </div>
      </section>

      <section className="px-5 pb-5">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-foreground/80">
            Transit Visa-Free
          </p>
          <h2 className="text-4xl font-bold mt-1">144 Hours</h2>
          <p className="text-primary-foreground/80 mt-1">
            Beijing · Shanghai · Chongqing · Guangzhou
          </p>
          <div className="border-t border-primary-foreground/20 my-4" />
          <ul className="space-y-2 text-sm">
            <li>✓ Valid for nationals of 54+ countries</li>
            <li>✓ Must enter & exit via different ports</li>
            <li>✓ No visa application needed — show at border</li>
            <li>✓ Passport must be valid 6+ months</li>
          </ul>
        </div>
      </section>

      <section className="px-5 pb-10">
        <div className="rounded-2xl bg-foreground text-background p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            Online Application
          </p>
          <h2 className="text-2xl font-bold mt-1">E-Visa (L Visa)</h2>
          <p className="text-background/70 mt-1">No embassy visit. Apply at home.</p>
          <ol className="mt-4 space-y-2.5 text-sm">
            <li>
              ① Apply at{" "}
              <a
                href="https://www.visaforchina.cn/"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                visaforchina.cn
              </a>
            </li>
            <li>② Upload passport scan + photo</li>
            <li>③ Receive approval in 4–7 business days</li>
            <li>④ Print or show on phone at border</li>
          </ol>
          <a
            href="https://www.visaforchina.cn/"
            target="_blank"
            rel="noreferrer"
            className="mt-5 w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-primary/90"
          >
            Apply for E-Visa <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    </MobileShell>
  );
}