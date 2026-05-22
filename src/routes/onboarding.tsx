import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { ChevronRight, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

const CUISINES = ["Spicy", "Street Food", "Vegetarian-friendly", "Seafood", "Noodles", "Dim Sum"];
const INTERESTS = ["historical", "food", "nightlife", "shopping", "nature", "art", "modern"];
const DIET = [
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Halal",
  "Kosher",
  "Gluten Free",
  "Dairy Free",
  "Nut Free",
  "Shellfish Free",
  "Egg Free",
  "Soy Free",
  "No Pork",
  "No Beef",
  "No Alcohol",
  "Low Spice",
];

function Onboarding() {
  const navigate = useNavigate();
  const setOnboarded = useAppStore((s) => s.setOnboarded);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const profile = useAppStore((s) => s.profile);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(profile);

  const toggleArr = (key: "cuisine" | "interests" | "dietaryRestrictions", value: string) => {
    setDraft((d) => {
      const arr = d[key] || [];
      return { ...d, [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  };

  const steps = [
    {
      title: "What should we call you?",
      content: (
        <div className="space-y-4">
          <input
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none focus:border-primary"
            placeholder="Your name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <input
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none focus:border-primary"
            placeholder="Nationality"
            value={draft.nationality}
            onChange={(e) => setDraft({ ...draft, nationality: e.target.value })}
          />
        </div>
      ),
    },
    {
      title: "Who's travelling?",
      content: (
        <div className="grid grid-cols-2 gap-3">
          {["solo", "couple", "family", "friends"].map((g) => (
            <button
              key={g}
              onClick={() => setDraft({ ...draft, groupType: g })}
              className={`rounded-xl border p-4 text-sm capitalize ${
                draft.groupType === g ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "Your pace & budget",
      content: (
        <div className="space-y-5">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Pace</p>
            <div className="grid grid-cols-3 gap-2">
              {["slow", "moderate", "fast"].map((p) => (
                <button
                  key={p}
                  onClick={() => setDraft({ ...draft, pace: p })}
                  className={`rounded-xl border p-3 text-sm capitalize ${
                    draft.pace === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Budget</p>
            <div className="grid grid-cols-3 gap-2">
              {["budget", "mid", "luxury"].map((p) => (
                <button
                  key={p}
                  onClick={() => setDraft({ ...draft, budget: p })}
                  className={`rounded-xl border p-3 text-sm capitalize ${
                    draft.budget === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Interests & cuisine",
      content: (
        <div className="space-y-5">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Interests</p>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => (
                <button
                  key={i}
                  onClick={() => toggleArr("interests", i)}
                  className={`rounded-full border px-3 py-1.5 text-sm capitalize ${
                    draft.interests.includes(i) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Cuisine</p>
            <div className="flex flex-wrap gap-2">
              {CUISINES.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleArr("cuisine", c)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    draft.cuisine.includes(c) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Dietary restrictions</p>
            <div className="flex flex-wrap gap-2">
              {DIET.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleArr("dietaryRestrictions", d)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    draft.dietaryRestrictions.includes(d) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ];

  const finish = () => {
    updateProfile(draft);
    setOnboarded(true);
    navigate({ to: "/" });
  };

  const s = steps[step];
  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-md min-h-screen flex flex-col px-6 pt-10 pb-8">
        <div className="flex gap-1 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-border"}`}
            />
          ))}
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{s.title}</h1>
        <p className="text-sm text-muted-foreground mb-6">Step {step + 1} of {steps.length}</p>
        <div className="flex-1">{s.content}</div>
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <button
              onClick={() => setStep((n) => n - 1)}
              className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-medium text-foreground flex items-center justify-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          <button
            onClick={() => (step === steps.length - 1 ? finish() : setStep((n) => n + 1))}
            className="flex-[2] rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-1"
          >
            {step === steps.length - 1 ? "Start exploring" : "Continue"} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}