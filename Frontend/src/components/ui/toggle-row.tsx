"use client";

import { Check, X } from "lucide-react";

export function ToggleRow({
  checked,
  onChange,
  title,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={title}
      className="flex w-full select-none items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition hover:border-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900/60 dark:hover:border-gray-600"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-gray-900 dark:text-white">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</span>
        ) : null}
      </span>
      <span
        aria-hidden
        className={`relative inline-flex h-8 w-16 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-700"
        }`}
      >
        {checked ? (
          <span className="absolute left-1.5 text-[9px] font-bold uppercase tracking-wider text-white/90">On</span>
        ) : (
          <span className="absolute right-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Off
          </span>
        )}
        <span
          className={`absolute top-0.5 left-0.5 grid h-7 w-7 place-items-center rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-8" : "translate-x-0"
          }`}
        >
          {checked ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={3} />
          ) : (
            <X className="h-3.5 w-3.5 text-red-500" strokeWidth={3} />
          )}
        </span>
      </span>
    </button>
  );
}
