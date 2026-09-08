"use client";

import { Calendar } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { pad, pickerInputClass, WheelPickerSheet } from "@/components/ui/wheel-picker";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

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
  const today = todayIsoDate();
  const minYear = min ? Number(min.slice(0, 4)) : 1920;
  const maxYear = max ? Number(max.slice(0, 4)) : new Date().getFullYear() + 10;
  const initial = parseIso(clampIso(value || today, min, max)) ?? parseIso(today)!;
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);

  const maxDays = daysInMonth(year, month);
  const safeDay = Math.min(day, maxDays);

  useEffect(() => {
    if (day !== safeDay) setDay(safeDay);
  }, [day, safeDay]);

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
  }

  return (
    <WheelPickerSheet
      closeLabel="Close date picker"
      columns={[
        {
          items: days,
          nextLabel: "Next day",
          onSelect: setDay,
          previousLabel: "Previous day",
          selected: safeDay,
        },
        {
          items: months,
          nextLabel: "Next month",
          onSelect: setMonth,
          previousLabel: "Previous month",
          selected: month,
        },
        {
          items: years,
          nextLabel: "Next year",
          onSelect: setYear,
          previousLabel: "Previous year",
          selected: year,
        },
      ]}
      extraAction={{ label: "Today", onClick: jumpToToday }}
      onCancel={onCancel}
      onSet={() => onSet(clampIso(toIso(safeDay, month, year), min, max))}
      title="Pick a date"
    />
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
        className={pickerInputClass}
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
