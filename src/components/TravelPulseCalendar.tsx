import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Landmark,
  PartyPopper,
  Utensils,
  UsersRound,
} from "lucide-react";
import { constraints } from "@/data/generated/constraints";
import { cities } from "@/data/generated/cities";
import type { TravelConstraint } from "@/data/types";

type TripLike = {
  cities: { cityId: string; startDate: string; endDate: string; days: number }[];
  currentCityId: string;
  itinerary: Record<string, { date?: string; stops?: { id: string }[] }[]>;
};

type TravelPulseCalendarProps = {
  cityId?: string | null;
  trip?: TripLike;
};

type MonthDay = {
  month: number;
  day: number;
};

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const SHORT_MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
const SELECTED_DAY_LABEL = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const TYPE_ORDER = ["holiday", "closure", "event", "weather", "crowd", "food_time"];

const TYPE_META: Record<
  string,
  {
    label: string;
    Icon: typeof Activity;
    iconBg: string;
    iconColor: string;
  }
> = {
  holiday: {
    label: "Holiday",
    Icon: PartyPopper,
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
  },
  closure: {
    label: "Closure",
    Icon: Landmark,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-700",
  },
  event: {
    label: "Event",
    Icon: Activity,
    iconBg: "bg-teal-100",
    iconColor: "text-teal-700",
  },
  weather: {
    label: "Weather",
    Icon: CloudRain,
    iconBg: "bg-sky-100",
    iconColor: "text-sky-700",
  },
  crowd: {
    label: "Crowd",
    Icon: UsersRound,
    iconBg: "bg-stone-200",
    iconColor: "text-stone-700",
  },
  food_time: {
    label: "Food timing",
    Icon: Utensils,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-700",
  },
};

const SEVERITY_META: Record<
  string,
  {
    rank: number;
    label: string;
    dot: string;
    dayClass: string;
    selectedDayClass: string;
    cardClass: string;
    textClass: string;
  }
> = {
  avoid: {
    rank: 3,
    label: "Severe",
    dot: "bg-red-600",
    dayClass: "bg-red-50 border-red-100 text-red-900",
    selectedDayClass: "bg-red-600 border-red-600 text-white",
    cardClass: "bg-red-50 border-red-100",
    textClass: "text-red-700",
  },
  warning: {
    rank: 2,
    label: "Moderate",
    dot: "bg-orange-500",
    dayClass: "bg-orange-50 border-orange-100 text-orange-900",
    selectedDayClass: "bg-orange-500 border-orange-500 text-white",
    cardClass: "bg-orange-50 border-orange-100",
    textClass: "text-orange-700",
  },
  info: {
    rank: 1,
    label: "Light",
    dot: "bg-sky-500",
    dayClass: "bg-sky-50 border-sky-100 text-sky-900",
    selectedDayClass: "bg-sky-500 border-sky-500 text-white",
    cardClass: "bg-sky-50 border-sky-100",
    textClass: "text-sky-700",
  },
};

function makeDate(year: number, month: number, day: number) {
  return new Date(year, month, day, 12);
}

function dateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseFullDate(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = makeDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseMonthDay(value: string | null | undefined): MonthDay | null {
  if (!value) return null;
  const match = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = makeDate(2024, month - 1, day);

  if (parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return { month, day };
}

function compareMonthDay(a: MonthDay, b: MonthDay) {
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function getMonthStart(date: Date) {
  return makeDate(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(month: Date, delta: number) {
  return makeDate(month.getFullYear(), month.getMonth() + delta, 1);
}

function buildMonthDays(month: Date) {
  const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: totalDays }, (_, index) =>
    makeDate(month.getFullYear(), month.getMonth(), index + 1),
  );
}

function recurringWindowIncludes(date: Date, startDate: string, endDate: string) {
  const fixedStart = parseFullDate(startDate);
  const fixedEnd = parseFullDate(endDate);
  if (fixedStart && fixedEnd) return date >= fixedStart && date <= fixedEnd;

  const start = parseMonthDay(startDate);
  const end = parseMonthDay(endDate);
  if (!start || !end) return false;

  const crossesYear = compareMonthDay(start, end) > 0;
  const year = date.getFullYear();

  for (let occurrenceYear = year - 1; occurrenceYear <= year + 1; occurrenceYear += 1) {
    const occurrenceStart = makeDate(occurrenceYear, start.month - 1, start.day);
    const occurrenceEnd = makeDate(
      crossesYear ? occurrenceYear + 1 : occurrenceYear,
      end.month - 1,
      end.day,
    );

    if (date >= occurrenceStart && date <= occurrenceEnd) return true;
  }

  return false;
}

function weekdayRange(start: number, end: number) {
  const days = [];
  let current = start;

  while (true) {
    days.push(current);
    if (current === end) break;
    current = (current + 1) % 7;
  }

  return days;
}

function parseWeekdayToken(token: string) {
  if (token.startsWith("sun")) return 0;
  if (token.startsWith("mon")) return 1;
  if (token.startsWith("tue")) return 2;
  if (token.startsWith("wed")) return 3;
  if (token.startsWith("thu")) return 4;
  if (token.startsWith("fri")) return 5;
  if (token.startsWith("sat")) return 6;
  return null;
}

function inferWeeklyDays(constraint: TravelConstraint) {
  const days = new Set<number>();
  const text = `${constraint.title} ${constraint.impact} ${constraint.action}`
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-");
  const dayToken =
    "(sun(?:day)?s?|mon(?:day)?s?|tue(?:s|sday)?s?|wed(?:nesday)?s?|thu(?:r|rs|rsday)?s?|fri(?:day)?s?|sat(?:urday)?s?)";
  const rangeRegex = new RegExp(
    `\\b${dayToken}\\b\\s*(?:-|to|through|thru)\\s*\\b${dayToken}\\b`,
    "g",
  );
  const singleRegex = new RegExp(`\\b${dayToken}\\b`, "g");

  if (/\bweekends?\b/.test(text)) {
    days.add(0);
    days.add(6);
  }
  if (/\bweekdays?\b/.test(text)) {
    [1, 2, 3, 4, 5].forEach((day) => days.add(day));
  }
  for (const match of text.matchAll(rangeRegex)) {
    const start = parseWeekdayToken(match[1]);
    const end = parseWeekdayToken(match[2]);
    if (start == null || end == null) continue;
    weekdayRange(start, end).forEach((day) => days.add(day));
  }
  for (const match of text.matchAll(singleRegex)) {
    const day = parseWeekdayToken(match[1]);
    if (day != null) days.add(day);
  }

  return [...days];
}

function constraintOccursOnDate(constraint: TravelConstraint, date: Date) {
  switch (constraint.recurrencePattern) {
    case "daily":
      return constraint.startDate && constraint.endDate
        ? recurringWindowIncludes(date, constraint.startDate, constraint.endDate)
        : true;
    case "weekly": {
      const days = inferWeeklyDays(constraint);
      return days.length ? days.includes(date.getDay()) : false;
    }
    case "monthly":
    case "seasonal":
    case "yearly":
      return recurringWindowIncludes(date, constraint.startDate, constraint.endDate);
    default:
      return false;
  }
}

function constraintType(constraint: TravelConstraint) {
  return TYPE_META[constraint.type] ? constraint.type : "";
}

function severityMeta(severity: string | undefined) {
  return SEVERITY_META[severity || "info"] ?? SEVERITY_META.info;
}

function highestSeverity(dayConstraints: TravelConstraint[]) {
  return dayConstraints.reduce(
    (highest, constraint) =>
      severityMeta(constraint.severity).rank > severityMeta(highest).rank
        ? constraint.severity
        : highest,
    "info",
  );
}

function sortConstraints(items: TravelConstraint[]) {
  return [...items].sort((a, b) => {
    const severityDiff = severityMeta(b.severity).rank - severityMeta(a.severity).rank;
    if (severityDiff !== 0) return severityDiff;
    const typeDiff = TYPE_ORDER.indexOf(constraintType(a)) - TYPE_ORDER.indexOf(constraintType(b));
    if (typeDiff !== 0) return typeDiff;
    return a.title.localeCompare(b.title);
  });
}

function isUsefulCalendarConstraint(constraint: TravelConstraint) {
  const type = constraintType(constraint);
  if (!type) return false;
  if (type === "food_time" && !constraint.cityId && !constraint.poiId) return false;
  return true;
}

function formatRange(constraint: TravelConstraint) {
  if (constraint.startDate && constraint.endDate) {
    const start = parseMonthDay(constraint.startDate);
    const end = parseMonthDay(constraint.endDate);
    if (start && end) {
      const startDate = makeDate(2024, start.month - 1, start.day);
      const endDate = makeDate(2024, end.month - 1, end.day);
      const label = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
      return constraint.startDate === constraint.endDate
        ? label.format(startDate)
        : `${label.format(startDate)} - ${label.format(endDate)}`;
    }
  }
  return constraint.recurrencePattern;
}

function sourceLabel(constraint: TravelConstraint) {
  if (constraint.poiId) return "Itinerary stop";
  if (constraint.cityId) return "City advisory";
  return "Travel advisory";
}

export function TravelPulseCalendar({ cityId, trip }: TravelPulseCalendarProps) {
  const [openedToday] = useState(() => new Date());
  const tripCityIds = useMemo(
    () => new Set((trip?.cities || []).map((city) => city.cityId)),
    [trip?.cities],
  );
  const activeTripCity = useMemo(() => {
    if (!trip?.cities?.length || !cityId) return null;
    return trip.cities.find((city) => city.cityId === cityId) ?? null;
  }, [cityId, trip?.cities]);
  const hasGeneratedTrip = !!trip?.cities?.length;
  const activeCityId = cityId ? activeTripCity?.cityId || cityId : null;
  const preferredDate = openedToday;

  const [month, setMonth] = useState(() => getMonthStart(preferredDate));
  const [selectedDateKey, setSelectedDateKey] = useState(() => dateKey(preferredDate));
  const [expandedConstraintIds, setExpandedConstraintIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setMonth(getMonthStart(preferredDate));
    setSelectedDateKey(dateKey(preferredDate));
    setExpandedConstraintIds(new Set());
  }, [preferredDate, activeCityId]);

  useEffect(() => {
    setExpandedConstraintIds(new Set());
  }, [selectedDateKey]);

  const monthDays = useMemo(() => buildMonthDays(month), [month]);
  const relevantConstraints = useMemo(() => {
    return constraints.filter((constraint) => {
      if (!isUsefulCalendarConstraint(constraint)) return false;
      if (constraint.poiId) return false;
      if (activeCityId && constraint.cityId && constraint.cityId !== activeCityId) return false;
      if (
        !activeCityId &&
        hasGeneratedTrip &&
        constraint.cityId &&
        !tripCityIds.has(constraint.cityId)
      ) {
        return false;
      }
      return true;
    });
  }, [activeCityId, hasGeneratedTrip, tripCityIds]);

  const constraintsByDate = useMemo(() => {
    const grouped = new Map<string, TravelConstraint[]>();
    for (const date of monthDays) {
      grouped.set(
        dateKey(date),
        sortConstraints(
          relevantConstraints.filter((constraint) => constraintOccursOnDate(constraint, date)),
        ),
      );
    }
    return grouped;
  }, [monthDays, relevantConstraints]);

  const selectedDate = parseFullDate(selectedDateKey) ?? preferredDate;
  const selectedConstraints = constraintsByDate.get(selectedDateKey) ?? [];
  const monthConstraintCount = new Set(
    [...constraintsByDate.values()].flat().map((constraint) => constraint.id),
  ).size;
  const cityName = activeCityId
    ? (cities as any)[activeCityId]?.name || activeCityId
    : hasGeneratedTrip
      ? "Trip cities"
      : "All cities";

  function toggleConstraint(id: string) {
    setExpandedConstraintIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="mx-5 mb-5 rounded-2xl bg-card border border-border p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Travel Calendar</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {cityName} - {monthConstraintCount} active advisories this month
          </p>
        </div>
        <div className="flex items-center gap-1 text-primary">
          <button
            type="button"
            onClick={() => setMonth((current) => shiftMonth(current, -1))}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-primary/10"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[84px] text-center">
            {SHORT_MONTH_LABEL.format(month)}
          </span>
          <button
            type="button"
            onClick={() => setMonth((current) => shiftMonth(current, 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-primary/10"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar pb-1 snap-x">
        {monthDays.map((date) => {
          const key = dateKey(date);
          const dayConstraints = constraintsByDate.get(key) ?? [];
          const selected = key === selectedDateKey;
          const hasConstraints = dayConstraints.length > 0;
          const severity = hasConstraints ? highestSeverity(dayConstraints) : "none";
          const meta = hasConstraints ? severityMeta(severity) : null;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDateKey(key)}
              className={
                "snap-start shrink-0 w-14 h-[70px] rounded-xl border flex flex-col items-center justify-center transition-colors " +
                (selected
                  ? meta?.selectedDayClass || "bg-primary border-primary text-primary-foreground"
                  : meta?.dayClass || "bg-muted/70 border-transparent text-foreground")
              }
            >
              <span className="text-[11px] font-semibold">
                {date.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span className="text-xl font-bold leading-tight">{date.getDate()}</span>
              <span
                className={
                  "mt-1 h-1.5 w-1.5 rounded-full " +
                  (selected
                    ? "bg-current"
                    : meta?.dot || (hasConstraints ? "bg-muted-foreground" : "bg-transparent"))
                }
              />
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Travel constraints ({SELECTED_DAY_LABEL.format(selectedDate)})
          </p>
          <span className="text-xs text-muted-foreground">
            {selectedConstraints.length || "No"} active
          </span>
        </div>

        <div className="space-y-2.5">
          {selectedConstraints.map((constraint) => {
            const type = constraintType(constraint);
            const typeMeta = TYPE_META[type] ?? TYPE_META.event;
            const severity = severityMeta(constraint.severity);
            const Icon = typeMeta.Icon;
            const expanded = expandedConstraintIds.has(constraint.id);

            return (
              <div
                key={constraint.id}
                className={`rounded-xl border overflow-hidden ${severity.cardClass}`}
              >
                <button
                  type="button"
                  onClick={() => toggleConstraint(constraint.id)}
                  aria-expanded={expanded}
                  className="w-full p-3 flex items-center gap-3 text-left"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${typeMeta.iconBg}`}
                  >
                    <Icon className={`w-5 h-5 ${typeMeta.iconColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground leading-tight truncate">
                      {constraint.title}
                    </p>
                    <p className={`text-xs mt-0.5 flex items-center gap-1.5 ${severity.textClass}`}>
                      <span className={`w-2 h-2 rounded-full ${severity.dot}`} />
                      {severity.label}
                    </p>
                  </div>
                  <ChevronDown
                    className={
                      "w-4 h-4 text-muted-foreground shrink-0 transition-transform " +
                      (expanded ? "rotate-180" : "")
                    }
                  />
                </button>

                {expanded && (
                  <div className="px-3 pb-3 pl-[64px] space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-background/70 text-foreground border border-border">
                        {typeMeta.label}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-background/70 text-foreground border border-border">
                        {sourceLabel(constraint)}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-background/70 text-foreground border border-border">
                        {formatRange(constraint)}
                      </span>
                    </div>
                    {constraint.impact && (
                      <p className="text-xs text-muted-foreground leading-snug">
                        <span className="font-semibold text-foreground">Impact: </span>
                        {constraint.impact}
                      </p>
                    )}
                    {constraint.action && (
                      <p className="text-xs text-muted-foreground leading-snug">
                        <span className="font-semibold text-foreground">Suggested action: </span>
                        {constraint.action}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {selectedConstraints.length === 0 && (
            <div className="rounded-xl border border-border bg-muted/40 p-4 flex items-start gap-3">
              <CalendarDays className="w-5 h-5 text-muted-foreground mt-0.5" />
              <p className="text-sm text-muted-foreground">
                No city travel constraints are active for this date.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
