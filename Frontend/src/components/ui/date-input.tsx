"use client";

import { Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { registerOverlay } from "@/components/ui/overlay-presence";

const inputClass =
  "h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 pr-11 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-800";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const ITEM_H = 40;
const VISIBLE_ITEMS = 5;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function isValidYmd(year: string, month: string, day: string) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function formatDmy(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function dmyToIso(text: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return "";
  const [, day, month, year] = match;
  if (!isValidYmd(year, month, day)) return "";
  return `${year}-${month}-${day}`;
}

function isoToDmy(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function parseIso(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function toIso(day: number, month: number, year: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function clampIso(iso: string, min?: string, max?: string) {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

export function todayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function Wheel({
  items,
  selected,
  onSelect,
  scrollToken,
}: {
  items: Array<{ value: number; label: string }>;
  selected: number;
  onSelect: (value: number) => void;
  scrollToken: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const skipRef = useRef(false);
  const timerRef = useRef(0);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  function scrollToIndex(index: number) {
    const el = ref.current;
    if (!el || index < 0) return;
    skipRef.current = true;
    el.scrollTop = index * ITEM_H;
    window.setTimeout(() => {
      skipRef.current = false;
    }, 50);
  }

  function scrollToSelected() {
    const index = itemsRef.current.findIndex((item) => item.value === selectedRef.current);
    scrollToIndex(index);
  }

  useLayoutEffect(() => {
    scrollToSelected();
    const id = window.setTimeout(scrollToSelected, 0);
    const id2 = window.setTimeout(scrollToSelected, 50);
    const id3 = window.setTimeout(scrollToSelected, 350);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(id2);
      window.clearTimeout(id3);
    };
  }, [selected, scrollToken, items.length]);

  return (
    <div
      className="hr-hide-scrollbar overflow-y-auto overscroll-contain"
      onScroll={() => {
        if (skipRef.current) return;
        const el = ref.current;
        if (!el) return;
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          const list = itemsRef.current;
          const index = Math.max(0, Math.min(list.length - 1, Math.round(el.scrollTop / ITEM_H)));
          scrollToIndex(index);
          const item = list[index];
          if (item && item.value !== selectedRef.current) onSelect(item.value);
        }, 80);
      }}
      ref={ref}
      role="listbox"
      style={{ height: ITEM_H * VISIBLE_ITEMS }}
    >
      <div style={{ height: ITEM_H * Math.floor(VISIBLE_ITEMS / 2) }} />
      {items.map((item) => (
        <div
          aria-selected={item.value === selected}
          className={`flex items-center justify-center ${
            item.value === selected
              ? "text-lg font-semibold text-neutral-900 dark:text-white"
              : "text-base text-neutral-400 dark:text-neutral-500"
          }`}
          key={item.value}
          role="option"
          style={{ height: ITEM_H }}
        >
          {item.label}
        </div>
      ))}
      <div style={{ height: ITEM_H * Math.floor(VISIBLE_ITEMS / 2) }} />
    </div>
  );
}

function stepValue(items: Array<{ value: number }>, selected: number, delta: number) {
  const index = items.findIndex((item) => item.value === selected);
  const next = items[Math.max(0, Math.min(items.length - 1, index + delta))];
  return next?.value ?? selected;
}

function DatePickerDialog({
  value,
  min,
  max,
  onCancel,
  onSet,
}: {
  value: string;
  min?: string;
  max?: string;
  onCancel: () => void;
  onSet: (iso: string) => void;
}) {
  const titleId = useId();
  const today = todayIsoDate();
  const minYear = min ? Number(min.slice(0, 4)) : 1920;
  const maxYear = max ? Number(max.slice(0, 4)) : new Date().getFullYear() + 10;
  const initial = parseIso(clampIso(value || today, min, max)) ?? parseIso(today)!;
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [wheelToken, setWheelToken] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  const maxDays = daysInMonth(year, month);
  const safeDay = Math.min(day, maxDays);

  useEffect(() => {
    if (day !== safeDay) setDay(safeDay);
  }, [day, safeDay]);

  useEffect(() => registerOverlay(), []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setSheetOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    const first = window.setTimeout(() => setWheelToken((token) => token + 1), 40);
    const second = window.setTimeout(() => setWheelToken((token) => token + 1), 360);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [sheetOpen]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, index) => {
    const next = minYear + index;
    return { value: next, label: String(next) };
  });
  const months = MONTHS.map((label, index) => ({ value: index + 1, label }));
  const days = Array.from({ length: maxDays }, (_, index) => {
    const next = index + 1;
    return { value: next, label: String(next) };
  });

  function jumpToToday() {
    const parts = parseIso(clampIso(today, min, max));
    if (!parts) return;
    setYear(parts.year);
    setMonth(parts.month);
    setDay(parts.day);
    setWheelToken((token) => token + 1);
  }

  return createPortal(
    <div className="fixed inset-0 z-1300 flex items-end justify-center md:items-center md:p-4">
      <button
        aria-label="Close date picker"
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${sheetOpen ? "opacity-100" : "opacity-0"}`}
        onClick={onCancel}
        type="button"
      />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`relative w-full overflow-hidden border border-neutral-200 bg-white shadow-2xl transition-transform duration-300 ease-out dark:border-gray-700 dark:bg-gray-900 max-md:rounded-t-3xl md:max-w-xs md:rounded-xl md:duration-200 ${
          sheetOpen ? "max-md:translate-y-0 md:scale-100 md:opacity-100" : "max-md:translate-y-full md:scale-95 md:opacity-0"
        }`}
        role="dialog"
      >
        <div className="flex justify-center pt-3 md:hidden">
          <div className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-gray-700" />
        </div>
        <div className="border-b border-sky-400 px-4 py-3">
          <h2 className="text-sm font-semibold text-sky-500 dark:text-sky-400" id={titleId}>
            Pick a date
          </h2>
        </div>

        <div className="px-1 py-1">
          <div className="grid grid-cols-3">
            <button
              aria-label="Previous day"
              className="flex h-5 items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
              onClick={() => setDay(stepValue(days, safeDay, -1))}
              type="button"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              aria-label="Previous month"
              className="flex h-5 items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
              onClick={() => setMonth(stepValue(months, month, -1))}
              type="button"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              aria-label="Previous year"
              className="flex h-5 items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
              onClick={() => setYear(stepValue(years, year, -1))}
              type="button"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-1 top-1/2 z-10 -translate-y-1/2 border-y-2 border-sky-400"
              style={{ height: ITEM_H }}
            />
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-linear-to-b from-white from-25% to-transparent dark:from-gray-900" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-linear-to-t from-white from-25% to-transparent dark:from-gray-900" />
            <div className="grid grid-cols-3">
              <Wheel items={days} onSelect={setDay} scrollToken={wheelToken} selected={safeDay} />
              <Wheel items={months} onSelect={setMonth} scrollToken={wheelToken} selected={month} />
              <Wheel items={years} onSelect={setYear} scrollToken={wheelToken} selected={year} />
            </div>
          </div>

          <div className="grid grid-cols-3">
            <button
              aria-label="Next day"
              className="flex h-5 items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
              onClick={() => setDay(stepValue(days, safeDay, 1))}
              type="button"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              aria-label="Next month"
              className="flex h-5 items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
              onClick={() => setMonth(stepValue(months, month, 1))}
              type="button"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              aria-label="Next year"
              className="flex h-5 items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
              onClick={() => setYear(stepValue(years, year, 1))}
              type="button"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-neutral-200 border-t border-neutral-200 pb-[max(0px,env(safe-area-inset-bottom))] dark:divide-gray-700 dark:border-gray-700">
          <button
            className="h-11 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:text-white dark:hover:bg-gray-800"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-11 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:text-white dark:hover:bg-gray-800"
            onClick={jumpToToday}
            type="button"
          >
            Today
          </button>
          <button
            className="h-11 text-sm font-semibold text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-500/10"
            onClick={() => onSet(clampIso(toIso(safeDay, month, year), min, max))}
            type="button"
          >
            Set
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function DateInput({
  value,
  onChange,
  disabled = false,
  id,
  min,
  max,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  min?: string;
  max?: string;
  invalid?: boolean;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => isoToDmy(value));

  useEffect(() => {
    setText((current) => {
      const currentIso = dmyToIso(current);
      if (value) return currentIso === value ? current : isoToDmy(value);
      return currentIso ? "" : current;
    });
  }, [value]);

  function commitIso(iso: string) {
    setText(isoToDmy(iso));
    if (iso !== value) onChange(iso);
  }

  return (
    <div className="relative">
      <input
        aria-invalid={invalid || undefined}
        autoComplete="off"
        className={inputClass}
        disabled={disabled}
        id={inputId}
        inputMode="numeric"
        maxLength={10}
        onChange={(event) => {
          const next = formatDmy(event.target.value);
          setText(next);
          const iso = dmyToIso(next);
          if (iso !== value && (iso || value)) onChange(iso);
        }}
        placeholder="dd/mm/yyyy"
        value={text}
      />
      <button
        aria-label="Pick a date"
        className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 disabled:cursor-not-allowed dark:hover:text-white"
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
      >
        <Calendar className="h-4 w-4" />
      </button>
      {open ? (
        <DatePickerDialog
          max={max}
          min={min}
          onCancel={() => setOpen(false)}
          onSet={(iso) => {
            commitIso(iso);
            setOpen(false);
          }}
          value={value}
        />
      ) : null}
    </div>
  );
}
