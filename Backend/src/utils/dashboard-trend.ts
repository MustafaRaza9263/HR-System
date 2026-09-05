import { BUSINESS_TIMEZONE } from "../constants/timezone.js";
import { shiftCalendarDate } from "./date-state.js";

export const TREND_GRANULARITIES = ["daily", "weekly", "monthly", "yearly"] as const;
export type TrendGranularity = (typeof TREND_GRANULARITIES)[number];

export const TREND_POINT_COUNTS: Record<TrendGranularity, number> = {
  daily: 30,
  weekly: 12,
  monthly: 12,
  yearly: 5,
};

function weekStartKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return date.toISOString().slice(0, 10);
}

function monthStartKey(dateKey: string) {
  return `${dateKey.slice(0, 7)}-01`;
}

function yearStartKey(dateKey: string) {
  return `${dateKey.slice(0, 4)}-01-01`;
}

function shiftMonths(monthStart: string, months: number) {
  const [year, month] = monthStart.split("-").map(Number);
  if (!year || !month) return monthStart;
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 10);
}

export function trendBucketDates(granularity: TrendGranularity, today: string): string[] {
  const count = TREND_POINT_COUNTS[granularity];
  if (granularity === "daily") {
    const dates: string[] = [];
    let current = shiftCalendarDate(today, -(count - 1));
    while (current <= today) {
      dates.push(current);
      current = shiftCalendarDate(current, 1);
    }
    return dates;
  }

  const dates: string[] = [];
  if (granularity === "weekly") {
    let current = weekStartKey(today);
    for (let i = 0; i < count; i += 1) {
      dates.unshift(current);
      current = shiftCalendarDate(current, -7);
    }
    return dates;
  }

  if (granularity === "monthly") {
    let current = monthStartKey(today);
    for (let i = 0; i < count; i += 1) {
      dates.unshift(current);
      current = shiftMonths(current, -1);
    }
    return dates;
  }

  let current = yearStartKey(today);
  for (let i = 0; i < count; i += 1) {
    dates.unshift(current);
    current = `${Number(current.slice(0, 4)) - 1}-01-01`;
  }
  return dates;
}

export function trendDateTrunc(granularity: TrendGranularity) {
  const unit = granularity === "daily" ? "day" : granularity === "weekly" ? "week" : granularity === "monthly" ? "month" : "year";
  const trunc: Record<string, unknown> = {
    date: "$createdAt",
    unit,
    timezone: BUSINESS_TIMEZONE,
  };
  if (granularity === "weekly") trunc.startOfWeek = "monday";
  return {
    $dateToString: {
      format: "%Y-%m-%d",
      date: { $dateTrunc: trunc },
      timezone: BUSINESS_TIMEZONE,
    },
  };
}
