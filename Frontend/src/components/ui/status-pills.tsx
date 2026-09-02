export type PillTone = "success" | "danger" | "warning" | "info" | "neutral" | "sky" | "violet";

export interface StatusPillItem {
  label: string;
  tone?: PillTone;
}

interface StatusPillProps extends StatusPillItem {
  className?: string;
}

interface StatusPillsProps {
  items: StatusPillItem[];
  className?: string;
  direction?: "col" | "row";
}

const TONE_CLASS: Record<PillTone, string> = {
  success: "border-emerald-500/70 text-emerald-700 dark:border-emerald-400/80 dark:text-emerald-400",
  danger: "border-red-500/70 text-red-600 dark:border-red-400/80 dark:text-red-400",
  warning: "border-amber-500/70 text-amber-700 dark:border-amber-400/80 dark:text-amber-400",
  info: "border-indigo-400/80 text-indigo-600 dark:border-indigo-400/80 dark:text-indigo-300",
  sky: "border-sky-400/80 text-sky-600 dark:border-sky-400/80 dark:text-sky-300",
  violet: "border-violet-400/80 text-violet-600 dark:border-violet-400/80 dark:text-violet-300",
  neutral: "border-gray-400/70 text-gray-600 dark:border-gray-500 dark:text-gray-400",
};

const PILL_CLASS =
  "inline-flex w-fit max-w-full truncate rounded-md border px-2 py-0.5 text-xs font-semibold leading-tight";

export function StatusPill({ label, tone = "info", className }: StatusPillProps) {
  return (
    <span className={`${PILL_CLASS} ${TONE_CLASS[tone]} ${className ?? ""}`.trim()} title={label}>
      {label}
    </span>
  );
}

export function StatusPills({ items, className, direction = "col" }: StatusPillsProps) {
  const visible = items.filter((item) => item.label.trim());
  if (visible.length === 0) return null;

  return (
    <div
      className={`${direction === "row" ? "flex flex-row flex-wrap items-center gap-1" : "flex flex-col items-start gap-1"} ${className ?? ""}`.trim()}
    >
      {visible.map((item, index) => (
        <StatusPill key={`${item.label}-${index}`} label={item.label} tone={item.tone} />
      ))}
    </div>
  );
}
