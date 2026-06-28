import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Landmark,
  PartyPopper,
  UsersRound,
} from "lucide-react";
import { constraints } from "@/data/generated/constraints";
import type { TravelConstraint } from "@/data/types";

type TravelPulseCalendarProps = {
  cityId: string;
};

type MonthDay = {
  month: number;
  day: number;
};

type CalendarCell = {
  date: Date;
  key: string;
  inMonth: boolean;
  day: number;
};

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const MONTH_DAY_LABEL = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

const TYPE_ORDER = ["holiday", "event", "closure", "weather", "crowd", "food_time", "other"];

const TYPE_META: Record<
  string,
  {
    label: string;
    dot: string;
    iconBg: string;
    iconColor: string;
    Icon: typeof Activity;
  }
> = {
  holiday: {
    label: "Holiday",
    dot: "bg-red-500",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    Icon: PartyPopper,
  },
  event: {
    label: "Event",
    dot: "bg-teal-500",
    iconBg: "bg-teal-100",
    iconColor: "text-teal-700",
    Icon: Activity,
  },
  closure: {
    label: "Closure",
    dot: "bg-orange-500",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    Icon: Landmark,
  },
  weather: {
    label: "Weather",
    dot: "bg-blue-500",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    Icon: CloudRain,
  },
  crowd: {
    label: "Crowds",
    dot: "bg-purple-500",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    Icon: UsersRound,
  },
  food_time: {
    label: "Food",
    dot: "bg-emerald-500",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    Icon: Activity,
  },
  other: {
    label: "Other",
    dot: "bg-slate-500",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    Icon: CalendarX,
  },
};

function dateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function makeDate(year: number, month: number, day: number) {
  return new Date(year, month, day, 12);
}

function getMonthForDate(date: Date) {
  return makeDate(date.getFullYear(), date.getMonth(), 1);
}

function parseMonthDay(value: string): MonthDay | null {
  const match = /^(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const parsed = makeDate(2024, month - 1, day);

  if (parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return { month, day };
}

function compareMonthDay(a: MonthDay, b: MonthDay) {
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function getConstraintType(constraint: TravelConstraint) {
  const type = constraint.type?.trim() || "other";
  return TYPE_META[type] ? type : "other";
}

function getTypeMeta(type: string) {
  return TYPE_META[type] ?? TYPE_META.other;
}

function isRelevantToCity(constraint: TravelConstraint, cityId: string) {
  return !constraint.cityId || constraint.cityId === cityId;
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

function recurringWindowIncludes(date: Date, startDate: string, endDate: string) {
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

function buildCalendarCells(month: Date): CalendarCell[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = makeDate(year, monthIndex, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = makeDate(year, monthIndex, 1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = makeDate(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    );

    return {
      date,
      key: dateKey(date),
      inMonth: date.getMonth() === monthIndex,
      day: date.getDate(),
    };
  });
}

function getMonthConstraintEntries(relevantConstraints: TravelConstraint[], cells: CalendarCell[]) {
  return relevantConstraints
    .map((constraint) => {
      const activeCells = cells.filter(
        (cell) => cell.inMonth && constraintOccursOnDate(constraint, cell.date),
      );
      return {
        constraint,
        firstDate: activeCells[0]?.date ?? null,
      };
    })
    .filter((entry) => entry.firstDate)
    .sort((a, b) => {
      const firstDiff = (a.firstDate?.getTime() ?? 0) - (b.firstDate?.getTime() ?? 0);
      if (firstDiff !== 0) return firstDiff;
      return (
        TYPE_ORDER.indexOf(getConstraintType(a.constraint)) -
        TYPE_ORDER.indexOf(getConstraintType(b.constraint))
      );
    });
}

function formatMonthDay(date: Date) {
  return MONTH_DAY_LABEL.format(date);
}

function formatRange(constraint: TravelConstraint, month: Date) {
  if (constraint.startDate && constraint.endDate) {
    const start = parseMonthDay(constraint.startDate);
    const end = parseMonthDay(constraint.endDate);

    if (start && end) {
      const year = month.getFullYear();
      const crossesYear = compareMonthDay(start, end) > 0;
      const startDate = makeDate(year, start.month - 1, start.day);
      const endDate = makeDate(crossesYear ? year + 1 : year, end.month - 1, end.day);

      if (constraint.startDate === constraint.endDate) return formatMonthDay(startDate);
      return `${formatMonthDay(startDate)} - ${formatMonthDay(endDate)}`;
    }
  }

  if (constraint.recurrencePattern === "daily") return "Daily";
  if (constraint.recurrencePattern === "weekly") return "Weekly";
  return constraint.recurrencePattern;
}

function shiftMonth(month: Date, delta: number) {
  return makeDate(month.getFullYear(), month.getMonth() + delta, 1);
}

export function TravelPulseCalendar({ cityId }: TravelPulseCalendarProps) {
  const [today] = useState(() => new Date());
  const todayKey = dateKey(today);
  const currentMonth = useMemo(() => getMonthForDate(today), [today]);
  const [month, setMonth] = useState(currentMonth);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(todayKey);

  useEffect(() => {
    setMonth(currentMonth);
    setSelectedDateKey(todayKey);
  }, [cityId, currentMonth, todayKey]);

  const cells = useMemo(() => buildCalendarCells(month), [month]);
  const relevantConstraints = useMemo(
    () => constraints.filter((constraint) => isRelevantToCity(constraint, cityId)),
    [cityId],
  );
  const monthEntries = useMemo(
    () => getMonthConstraintEntries(relevantConstraints, cells),
    [relevantConstraints, cells],
  );

  const constraintsByDate = useMemo(() => {
    const grouped = new Map<string, TravelConstraint[]>();

    for (const cell of cells) {
      if (!cell.inMonth) continue;
      const dayConstraints = relevantConstraints.filter((constraint) =>
        constraintOccursOnDate(constraint, cell.date),
      );
      grouped.set(cell.key, dayConstraints);
    }

    return grouped;
  }, [cells, relevantConstraints]);

  const displayedEntries = monthEntries;
  const activeLegendTypes = TYPE_ORDER.filter((type) =>
    monthEntries.some((entry) => getConstraintType(entry.constraint) === type),
  );
  const legendTypes = activeLegendTypes.length
    ? activeLegendTypes
    : ["holiday", "event", "closure", "weather", "crowd"];

  return (
    <section className="mx-5 mb-4 rounded-2xl bg-card border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Calendar</h2>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((current) => shiftMonth(current, -1))}
          className="w-8 h-8 rounded-full flex items-center justify-center text-primary hover:bg-primary/10"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-semibold text-foreground">{MONTH_LABEL.format(month)}</p>
        <button
          type="button"
          onClick={() => setMonth((current) => shiftMonth(current, 1))}
          className="w-8 h-8 rounded-full flex items-center justify-center text-primary hover:bg-primary/10"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="h-7 flex items-center justify-center text-[10px] font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
        {cells.map((cell) => {
          const dayConstraints = constraintsByDate.get(cell.key) ?? [];
          const dayTypes = TYPE_ORDER.filter((type) =>
            dayConstraints.some((constraint) => getConstraintType(constraint) === type),
          );
          const selected = cell.key === selectedDateKey;

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => cell.inMonth && setSelectedDateKey(cell.key)}
              disabled={!cell.inMonth}
              className={
                "h-10 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors " +
                (selected
                  ? "bg-primary text-primary-foreground"
                  : cell.inMonth
                    ? "text-foreground hover:bg-muted"
                    : "text-muted-foreground/40")
              }
            >
              <span className="text-sm leading-none">{cell.day}</span>
              <span className="flex gap-0.5 h-1.5">
                {cell.inMonth &&
                  dayTypes
                    .slice(0, 5)
                    .map((type) => (
                      <span
                        key={type}
                        className={`w-1.5 h-1.5 rounded-full ${selected ? "bg-primary-foreground" : getTypeMeta(type).dot}`}
                      />
                    ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded-xl border border-border px-3 py-2 flex flex-wrap gap-x-4 gap-y-2">
        {legendTypes.map((type) => {
          const meta = getTypeMeta(type);
          return (
            <span
              key={type}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          );
        })}
      </div>

      <div className="mt-3 divide-y divide-border">
        {displayedEntries.map(({ constraint }) => {
          const type = getConstraintType(constraint);
          const meta = getTypeMeta(type);
          const Icon = meta.Icon;

          return (
            <div key={constraint.id} className="py-3 flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${meta.iconBg}`}
              >
                <Icon className={`w-5 h-5 ${meta.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {constraint.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatRange(constraint, month)}
                  {constraint.impact ? ` · ${constraint.impact}` : ""}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground mt-3 shrink-0" />
            </div>
          );
        })}
        {monthEntries.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">
            No Travel Constraints entries for this city in {MONTH_LABEL.format(month)}.
          </p>
        )}
      </div>
    </section>
  );
}
