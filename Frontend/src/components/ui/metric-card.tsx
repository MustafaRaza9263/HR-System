import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  supporting: string;
  icon: LucideIcon;
}

export function MetricCard({ label, value, supporting, icon: Icon }: MetricCardProps) {
  return (
    <article className="flex h-full min-h-36 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 dark:border-gray-700 dark:bg-gray-800/70">
      <div className="flex flex-col items-start sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-600 sm:order-2 sm:h-10 sm:w-10 dark:bg-gray-800 dark:text-gray-300">
          <Icon aria-hidden className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
        <div className="mt-3 flex min-w-0 flex-col items-start sm:mt-0 sm:order-1">
          <p className="order-2 mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 sm:order-1 sm:mt-0 sm:text-sm sm:normal-case sm:tracking-normal dark:text-gray-400">
            {label}
          </p>
          <p className="order-1 text-2xl font-bold tracking-[-0.04em] text-gray-950 sm:order-2 sm:mt-2 sm:text-3xl dark:text-white">
            {value}
          </p>
        </div>
      </div>
      <p className="mt-auto pt-3 text-xs text-gray-400 dark:text-gray-500">{supporting}</p>
    </article>
  );
}
