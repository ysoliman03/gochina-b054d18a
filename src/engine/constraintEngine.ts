import { constraints } from "@/data/generated/constraints";
import type { TravelConstraint } from "@/data/types";

type DateRange = { start: string; end: string };
type MonthDay = { month: number; day: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = utcDate(year, month, day);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function parseDateRange(dateRange: DateRange) {
  const start = parseIsoDate(dateRange.start);
  const end = parseIsoDate(dateRange.end);

  if (!start || !end || start > end) return null;

  return { start, end };
}

function parseMonthDay(value: string): MonthDay | null {
  const match = /^(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const parsed = utcDate(2024, month, day);

  if (parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;

  return { month, day };
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart <= bEnd && aEnd >= bStart;
}

function monthDayCompare(a: MonthDay, b: MonthDay) {
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function recurringWindowOverlaps(
  trip: { start: Date; end: Date },
  startDate: string,
  endDate: string,
) {
  const start = parseMonthDay(startDate);
  const end = parseMonthDay(endDate);

  if (!start || !end) return false;

  const tripStartYear = trip.start.getUTCFullYear();
  const tripEndYear = trip.end.getUTCFullYear();
  const crossesYear = monthDayCompare(start, end) > 0;

  for (let year = tripStartYear - 1; year <= tripEndYear + 1; year += 1) {
    const occurrenceStart = utcDate(year, start.month, start.day);
    const occurrenceEnd = utcDate(crossesYear ? year + 1 : year, end.month, end.day);

    if (overlaps(trip.start, trip.end, occurrenceStart, occurrenceEnd)) return true;
  }

  return false;
}

function dayNumber(date: Date) {
  return Math.floor(date.getTime() / DAY_MS);
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

function rangeContainsWeekday(trip: { start: Date; end: Date }, weekdays: number[]) {
  if (!weekdays.length) return true;

  const targetDays = new Set(weekdays);
  const startDay = dayNumber(trip.start);
  const endDay = dayNumber(trip.end);

  if (endDay - startDay >= 6) return weekdays.length > 0;

  for (let day = startDay; day <= endDay; day += 1) {
    const weekday = new Date(day * DAY_MS).getUTCDay();
    if (targetDays.has(weekday)) return true;
  }

  return false;
}

function constraintMatchesDate(constraint: TravelConstraint, trip: { start: Date; end: Date }) {
  switch (constraint.recurrencePattern) {
    case "daily":
      return true;
    case "weekly":
      return rangeContainsWeekday(trip, inferWeeklyDays(constraint));
    case "seasonal":
    case "yearly":
      return recurringWindowOverlaps(trip, constraint.startDate, constraint.endDate);
    case "monthly":
      return constraint.startDate && constraint.endDate
        ? recurringWindowOverlaps(trip, constraint.startDate, constraint.endDate)
        : true;
    default:
      return false;
  }
}

export function getActiveConstraints(cityId: string, dateRange: DateRange) {
  const trip = parseDateRange(dateRange);
  if (!trip) return [];

  return constraints.filter((constraint) => {
    if (constraint.cityId && constraint.cityId !== cityId) return false;
    return constraintMatchesDate(constraint, trip);
  });
}
