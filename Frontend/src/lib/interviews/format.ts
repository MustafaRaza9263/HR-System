import { format } from "date-fns";

export function formatCalendarDate(date: string, pattern = "EEE, d MMM yyyy") {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return format(new Date(year, month - 1, day), pattern);
}

export function formatInterviewWhen(date: string, time: string) {
  return `${formatCalendarDate(date)} · ${time}`;
}
