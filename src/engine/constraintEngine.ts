import { constraints } from "@/data/constraints";

export function getActiveConstraints(cityId: string, dateRange: { start: string; end: string }) {
  const { start, end } = dateRange;
  const tripStart = new Date(start);
  const tripEnd = new Date(end);
  return constraints.filter((c) => {
    const cStart = new Date(c.start);
    const cEnd = new Date(c.end);
    const dateOverlap = tripStart <= cEnd && tripEnd >= cStart;
    if (!dateOverlap) return false;
    if (c.cityId && c.cityId !== cityId) return false;
    return true;
  });
}