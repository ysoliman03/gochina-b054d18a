/**
 * ItineraryBuilderSheet
 * ─────────────────────
 * A bottom sheet with a smart form that calls the Pydantic AI agent to
 * generate a personalised itinerary, then imports it into the Zustand store.
 */
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useAppStore } from "@/store/useAppStore";
import { cities } from "@/data/cities";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";

// ── Config ────────────────────────────────────────────────────────────────
const AGENT_URL = "http://localhost:8787";

const INTERESTS = ["historical", "food", "nightlife", "shopping", "nature", "art", "modern"];
const DIET_OPTS = ["Vegetarian", "Vegan", "Halal", "No Pork", "No Beef", "Low Spice", "Gluten Free"];
const PACE_OPTS = ["slow", "moderate", "fast"] as const;
const BUDGET_OPTS = ["budget", "mid", "luxury"] as const;

// ── Types ─────────────────────────────────────────────────────────────────
type Status = "idle" | "loading" | "success" | "error";

interface FormState {
  cityId: string;
  startDate: string;   // "YYYY-MM-DD"
  endDate: string;     // "YYYY-MM-DD"
  pace: string;
  budget: string;
  interests: string[];
  dietaryRestrictions: string[];
  notes: string;
}

interface AgentStop {
  id: string;
  name: string;
  nameZh: string;
  category: string;
  district: string;
  description: string;
  tips: string;
  duration: number;
  scheduledStart: number;
  scheduledEnd: number;
  transitFromPrev: number;
}

interface AgentDay {
  dayIndex: number;
  date: string;   // "YYYY-MM-DD" — actual calendar date, filled by server
  stops: AgentStop[];
}

interface AgentResult {
  cityId: string;
  days: AgentDay[];
  summary: string;
  tips: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────
function minutesToTime(m: number) {
  const h = Math.floor(m / 60).toString().padStart(2, "0");
  const min = (m % 60).toString().padStart(2, "0");
  return `${h}:${min}`;
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

/** "YYYY-MM-DD" → number of trip days (inclusive, clamped 1–14) */
function computeDays(start: string, end: string): number {
  if (!start || !end) return 1;
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
  return Math.max(1, Math.min(14, diff));
}

/** "YYYY-MM-DD" → "Mon, Jun 15" */
function formatDisplayDate(dateStr: string) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

/** Today as "YYYY-MM-DD" */
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

/** N days from today as "YYYY-MM-DD" */
function daysFromNow(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString().split("T")[0];
}

// ── Component ──────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ItineraryBuilderSheet({ open, onOpenChange }: Props) {
  const profile = useAppStore((s) => s.profile);
  const trip = useAppStore((s) => s.trip);
  const setItinerary = useAppStore((s) => s.setItinerary);
  const updateTrip = useAppStore((s) => s.updateTrip);

  const existingDays = trip.cities.find((c) => c.cityId === trip.currentCityId)?.days ?? 3;

  const [form, setForm] = useState<FormState>({
    cityId: trip.currentCityId,
    startDate: todayStr(),
    endDate: daysFromNow(existingDays - 1),  // e.g. 3-day trip → today + 2 days
    pace: profile.pace,
    budget: profile.budget,
    interests: [...profile.interests],
    dietaryRestrictions: [...profile.dietaryRestrictions],
    notes: "",
  });

  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState("");

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handleGenerate() {
    setStatus("loading");
    setError("");
    setResult(null);

    try {
      const res = await fetch(`${AGENT_URL}/generate-itinerary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityId: form.cityId,
          startDate: form.startDate,
          endDate: form.endDate,
          profile: {
            name: profile.name,
            nationality: profile.nationality,
            groupType: profile.groupType,
            pace: form.pace,
            budget: form.budget,
            interests: form.interests,
            dietaryRestrictions: form.dietaryRestrictions,
          },
          notes: form.notes,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).detail ?? `HTTP ${res.status}`);
      }

      const data: AgentResult = await res.json();
      setResult(data);
      setStatus("success");
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
      setStatus("error");
    }
  }

  // ── Import into store ────────────────────────────────────────────────────
  function handleImport() {
    if (!result) return;

    // Ensure the city exists in the trip; if not, add it
    const cityExists = trip.cities.some((c) => c.cityId === result.cityId);
    if (!cityExists) {
      updateTrip({
        cities: [
          ...trip.cities,
          {
            cityId: result.cityId,
            startDate: form.startDate,   // use the actual dates from the form
            endDate: form.endDate,
            days: result.days.length,
          },
        ],
      });
    }

    setItinerary(result.cityId, result.days);
    updateTrip({ currentCityId: result.cityId });
    onOpenChange(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92dvh] overflow-y-auto rounded-t-2xl px-5 pb-10"
      >
        <SheetHeader className="pt-2 pb-4">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Itinerary Builder
          </SheetTitle>
          <SheetDescription className="text-sm">
            Describe your trip and the agent will build a personalised day-by-day plan.
          </SheetDescription>
        </SheetHeader>

        {/* ── Form ── */}
        {status !== "success" && (
          <div className="space-y-6">
            {/* City */}
            <Field label="Destination">
              <div className="flex flex-wrap gap-2">
                {Object.values(cities).map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    active={form.cityId === c.id}
                    onClick={() => setForm((f) => ({ ...f, cityId: c.id }))}
                  />
                ))}
              </div>
            </Field>

            {/* Travel dates */}
            <Field label="Travel dates">
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1.5">Start</p>
                  <input
                    type="date"
                    value={form.startDate}
                    min={todayStr()}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setForm((f) => ({
                        ...f,
                        startDate: newStart,
                        // If end is now before start, push it forward to match
                        endDate: f.endDate < newStart ? newStart : f.endDate,
                      }));
                    }}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1.5">End</p>
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.startDate || todayStr()}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {computeDays(form.startDate, form.endDate)} day
                {computeDays(form.startDate, form.endDate) !== 1 ? "s" : ""}
                {form.startDate && form.endDate
                  ? ` · ${formatDisplayDate(form.startDate)} → ${formatDisplayDate(form.endDate)}`
                  : ""}
              </p>
            </Field>

            {/* Pace */}
            <Field label="Pace">
              <div className="flex gap-2">
                {PACE_OPTS.map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    active={form.pace === p}
                    onClick={() => setForm((f) => ({ ...f, pace: p }))}
                    className="flex-1 justify-center"
                  />
                ))}
              </div>
            </Field>

            {/* Budget */}
            <Field label="Budget">
              <div className="flex gap-2">
                {BUDGET_OPTS.map((b) => (
                  <Chip
                    key={b}
                    label={b}
                    active={form.budget === b}
                    onClick={() => setForm((f) => ({ ...f, budget: b }))}
                    className="flex-1 justify-center"
                  />
                ))}
              </div>
            </Field>

            {/* Interests */}
            <Field label="Interests">
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((i) => (
                  <Chip
                    key={i}
                    label={i}
                    active={form.interests.includes(i)}
                    onClick={() => setForm((f) => ({ ...f, interests: toggle(f.interests, i) }))}
                  />
                ))}
              </div>
            </Field>

            {/* Dietary */}
            <Field label="Dietary restrictions">
              <div className="flex flex-wrap gap-2">
                {DIET_OPTS.map((d) => (
                  <Chip
                    key={d}
                    label={d}
                    active={form.dietaryRestrictions.includes(d)}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        dietaryRestrictions: toggle(f.dietaryRestrictions, d),
                      }))
                    }
                  />
                ))}
              </div>
            </Field>

            {/* Notes */}
            <Field label="Special requests (optional)">
              <textarea
                rows={3}
                placeholder="e.g. We love street food, avoid tourist traps, my partner has mobility issues…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground resize-none outline-none focus:border-primary"
              />
            </Field>

            {/* Error banner */}
            {status === "error" && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleGenerate}
              disabled={status === "loading"}
              className="w-full rounded-xl bg-primary py-4 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Building your itinerary…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate itinerary
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>

            {status === "loading" && (
              <p className="text-xs text-center text-muted-foreground">
                The agent is searching POIs and planning your days — usually takes 15–30 seconds.
              </p>
            )}
          </div>
        )}

        {/* ── Result preview ── */}
        {status === "success" && result && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4">
              <p className="text-sm text-foreground leading-relaxed">{result.summary}</p>
            </div>

            {/* Tips */}
            {result.tips.length > 0 && (
              <div className="space-y-1.5">
                {result.tips.map((tip, i) => (
                  <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-0.5">✦</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Day previews */}
            <div className="space-y-4">
              {result.days.map((day) => (
                <div key={day.dayIndex} className="rounded-2xl bg-card border border-border p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-baseline gap-2">
                    <span>Day {day.dayIndex + 1}</span>
                    {day.date && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {formatDisplayDate(day.date)}
                      </span>
                    )}
                  </h3>
                  <ol className="space-y-2">
                    {day.stops.map((stop, si) => (
                      <li key={stop.id + si} className="flex gap-3 items-start">
                        <span className="text-xs text-muted-foreground w-[86px] flex-shrink-0 pt-0.5">
                          {minutesToTime(stop.scheduledStart)}–{minutesToTime(stop.scheduledEnd)}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground leading-tight">
                            {stop.name}
                          </p>
                          {stop.district && (
                            <p className="text-xs text-muted-foreground">{stop.district}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStatus("idle")}
                className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-medium text-foreground"
              >
                Re-generate
              </button>
              <button
                onClick={handleImport}
                className="flex-[2] rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Use this itinerary
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {children}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
  className = "",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm capitalize transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground"
      } ${className}`}
    >
      {label}
    </button>
  );
}
