import { formatCalendarDate } from "@/lib/interviews/format";

import type { TrendGranularity } from "./types";

export function formatTrendLabel(dateKey: string, granularity: TrendGranularity) {
  if (granularity === "yearly") return formatCalendarDate(dateKey, "yyyy");
  if (granularity === "monthly") return formatCalendarDate(dateKey, "MMM yy");
  return formatCalendarDate(dateKey, "d MMM");
}

export const TREND_RANGE_LABEL: Record<TrendGranularity, string> = {
  daily: "Last 30 days",
  weekly: "Last 12 weeks",
  monthly: "Last 12 months",
  yearly: "Last 5 years",
};

export function deltaLabel(value: number, suffix: string) {
  return `+${value} ${suffix}`;
}
