"use client";

import { X } from "lucide-react";
import { useId, type KeyboardEvent } from "react";

export function TagInput({
  values,
  onChange,
  draft,
  onDraftChange,
  placeholder = "Type and press Enter",
  disabled = false,
  maxItems = 50,
  maxLength = 100,
  id,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxItems?: number;
  maxLength?: number;
  id?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const atCap = values.length >= maxItems;

  function commit(raw: string) {
    const value = raw.trim().replace(/\s+/g, " ").slice(0, maxLength);
    if (!value || atCap) return;
    if (values.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      onDraftChange("");
      return;
    }
    onChange([...values, value]);
    onDraftChange("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === "Backspace" && !draft && values.length > 0) {
      event.preventDefault();
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div
      className="flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-2 py-1.5 dark:border-gray-600 dark:bg-gray-800 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/25"
      onClick={(event) => {
        const input = event.currentTarget.querySelector("input");
        input?.focus();
      }}
    >
      {values.map((value) => (
        <span
          className="inline-flex max-w-full items-center gap-1 rounded-md bg-gray-100 py-0.5 pl-2 pr-0.5 text-sm text-gray-800 dark:bg-gray-700/90 dark:text-gray-100"
          key={value}
        >
          <span className="truncate">{value}</span>
          <button
            aria-label={`Remove ${value}`}
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-50"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              onChange(values.filter((item) => item !== value));
            }}
            type="button"
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <input
        className="min-w-24 flex-1 bg-transparent px-1 py-1 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-500"
        disabled={disabled || atCap}
        id={inputId}
        maxLength={maxLength}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={values.length === 0 ? placeholder : ""}
        value={draft}
      />
    </div>
  );
}

export function commitTagDraft(values: string[], draft: string, maxItems = 50, maxLength = 100) {
  const value = draft.trim().replace(/\s+/g, " ").slice(0, maxLength);
  if (!value || values.length >= maxItems) return values;
  if (values.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) return values;
  return [...values, value];
}
