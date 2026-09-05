import { BUSINESS_TIMEZONE } from "../constants/timezone.js";

export type DateState = "future" | "today" | "passed";

function calendarDate(date: Date, timeZone = BUSINESS_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Could not resolve a calendar date in the business timezone.");
  }
  return `${year}-${month}-${day}`;
}

export function calendarDateInZone(date: Date, timeZone = BUSINESS_TIMEZONE): string {
  return calendarDate(date, timeZone);
}

export function todayCalendarDate(now = new Date()): string {
  return calendarDate(now);
}

export function clockTimeInZone(date: Date, timeZone = BUSINESS_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hourRaw = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = (parts.find((part) => part.type === "minute")?.value ?? "00").padStart(2, "0");
  const hour = (hourRaw === "24" ? "00" : hourRaw).padStart(2, "0");
  return `${hour}:${minute}`;
}

export function shiftCalendarDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error("Could not shift calendar date.");
  }
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function getDateStateFromCalendarDate(date: string, now = new Date()): DateState {
  const today = calendarDate(now);
  if (date > today) return "future";
  if (date === today) return "today";
  return "passed";
}

/** A same-day link expires at midnight — once the calendar date rolls, yesterday's accessDate is expired. */
export function isAccessDateExpired(accessDate: string, now = new Date()): boolean {
  return accessDate < calendarDate(now);
}

/** First instant of a Karachi calendar day (PKT, UTC+5, no DST). */
export function startOfCalendarInstant(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00+05:00`);
}

/** First instant of the next Karachi calendar day (PKT, UTC+5, no DST). */
export function endOfAccessInstant(accessDate: string): Date {
  return startOfCalendarInstant(shiftCalendarDate(accessDate, 1));
}
