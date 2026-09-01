import { format, isValid } from "date-fns";

interface DateTimeDisplayProps {
  value: string | number | Date;
  className?: string;
}

export function DateTimeDisplay({ value, className }: DateTimeDisplayProps) {
  const date = value instanceof Date ? value : new Date(value);
  if (!isValid(date)) {
    return <span className={className}>—</span>;
  }

  return (
    <time className={`flex flex-col leading-tight ${className ?? ""}`} dateTime={date.toISOString()}>
      <span className="text-sm font-bold text-gray-950 dark:text-white">{format(date, "MMM d, yyyy")}</span>
      <span className="mt-0.5 text-xs font-normal text-gray-500 dark:text-gray-400">{format(date, "hh:mm:ss a")}</span>
    </time>
  );
}
