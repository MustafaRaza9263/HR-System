import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  supporting: string;
  icon: LucideIcon;
}

export function MetricCard({ label, value, supporting, icon: Icon }: MetricCardProps) {
  return (
    <article className="min-h-36 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-[-0.04em] text-gray-950 dark:text-white">{value}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <Icon aria-hidden className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">{supporting}</p>
    </article>
  );
}
