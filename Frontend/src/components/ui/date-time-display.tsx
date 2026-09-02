import { format, isValid } from "date-fns";

interface DateTimeDisplayProps {
  value: string | number | Date;
  className?: string;
  size?: "sm" | "md";
}

export function DateTimeDisplay({ value, className, size = "md" }: DateTimeDisplayProps) {
  const date = value instanceof Date ? value : new Date(value);
  if (!isValid(date)) {
    return <span className={className}>—</span>;
  }

  const compact = size === "sm";
  return (
    <time className={`flex flex-col leading-tight ${className ?? ""}`} dateTime={date.toISOString()}>
      <span className={`font-bold text-gray-950 dark:text-white ${compact ? "text-xs" : "text-sm"}`}>
        {format(date, "MMM d, yyyy")}
      </span>
      <span className={`mt-0.5 font-normal text-gray-500 dark:text-gray-400 ${compact ? "text-[10px]" : "text-xs"}`}>
        {format(date, "hh:mm:ss a")}
      </span>
    </time>
  );
}
