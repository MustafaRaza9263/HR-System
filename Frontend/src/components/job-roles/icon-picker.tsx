"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AppIcon, availableIconNames, normalizeIconName } from "@/components/ui/app-icon";

const MAX_VISIBLE_ICONS = 120;

function iconLabel(name: string) {
  return name.split("-").map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1)).join(" ");
}

interface IconPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function IconPicker({ label, value, onChange }: IconPickerProps) {
  const [query, setQuery] = useState("");
  const selectedName = normalizeIconName(value, "building-2");
  const matchingIcons = useMemo(() => {
    const cleanQuery = query.trim().toLocaleLowerCase();
    if (!cleanQuery) return availableIconNames;
    return availableIconNames.filter((name) => name.includes(cleanQuery.replace(/\s+/g, "-")));
  }, [query]);
  const visibleIcons = matchingIcons.slice(0, MAX_VISIBLE_ICONS);

  return (
    <fieldset>
      <div className="mb-2 flex items-center justify-between gap-3">
        <legend className="text-sm font-bold text-gray-700 dark:text-gray-200">{label}</legend>
        <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <AppIcon className="h-4 w-4" name={selectedName} />
          {iconLabel(selectedName)}
        </span>
      </div>
      <label className="relative block">
        <span className="sr-only">Search icons</span>
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search icons..."
          value={query}
        />
      </label>
      <div className="mt-3 grid max-h-56 grid-cols-6 gap-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2 sm:grid-cols-8 dark:border-gray-600 dark:bg-gray-800">
        {visibleIcons.map((name) => {
          const active = name === selectedName;
          return (
            <button
              aria-label={`Use ${iconLabel(name)} icon`}
              aria-pressed={active}
              className={`grid aspect-square min-h-10 place-items-center rounded-lg border transition ${active ? "border-indigo-400 bg-indigo-50 text-indigo-600 ring-2 ring-indigo-500/15 dark:bg-indigo-500/15 dark:text-indigo-300" : "border-transparent bg-white text-gray-500 hover:border-gray-300 hover:text-gray-900 dark:bg-gray-900/80 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-white"}`}
              key={name}
              onClick={() => onChange(name)}
              title={iconLabel(name)}
              type="button"
            >
              <AppIcon className="h-5 w-5" name={name} />
            </button>
          );
        })}
        {visibleIcons.length === 0 ? (
          <p className="col-span-full py-5 text-center text-xs text-gray-500">No matching icons.</p>
        ) : null}
      </div>
      {matchingIcons.length > MAX_VISIBLE_ICONS ? (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Showing the first {MAX_VISIBLE_ICONS} of {matchingIcons.length} Lucide icons. Search to narrow the catalog.
        </p>
      ) : null}
    </fieldset>
  );
}
