"use client";

import { Clock } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { pad, pickerInputClass, WheelPickerSheet } from "@/components/ui/wheel-picker";

const HOURS = Array.from({ length: 12 }, (_, index) => {
  const value = index + 1;
  return { value, label: pad(value) };
});
const MINUTES = Array.from({ length: 60 }, (_, index) => ({ value: index, label: pad(index) }));
const PERIODS = [
  { value: 0, label: "AM" },
  { value: 1, label: "PM" },
] as const;

function parseHm(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minutes = Number(match[2]);
  if (hour24 > 23 || minutes > 59) return null;
  return {
    hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
    minutes,
    period: hour24 >= 12 ? 1 : 0,
  };
}

function toHm(hour12: number, minutes: number, period: number) {
  return `${pad((hour12 % 12) + (period === 1 ? 12 : 0))}:${pad(minutes)}`;
}

function hmToDisplay(value: string) {
  const parts = parseHm(value);
  if (!parts) return "";
  return `${pad(parts.hour12)}:${pad(parts.minutes)} ${parts.period === 1 ? "PM" : "AM"}`;
}

function formatClock(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  const letters = raw.toUpperCase().replace(/[^AP]/g, "");
  const period = letters.includes("P") ? "PM" : letters.includes("A") ? "AM" : "";
  const body = digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
  if (period) return body ? `${body} ${period}` : period;
  return body;
}

function displayToHm(text: string) {
  const match = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i.exec(text.trim());
  if (!match) return "";
  const hour = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return "";
  const period = match[3]?.toUpperCase();
  if (period) {
    if (hour < 1 || hour > 12) return "";
    return toHm(hour, minutes, period === "PM" ? 1 : 0);
  }
  if (hour > 23) return "";
  return `${pad(hour)}:${pad(minutes)}`;
}

export function nowHmTime() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function TimePickerDialog({
  value,
  onCancel,
  onSet,
}: {
  value: string;
  onCancel: () => void;
  onSet: (time: string) => void;
}) {
  const initial = parseHm(value) ?? parseHm(nowHmTime())!;
  const [hour12, setHour12] = useState(initial.hour12);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [period, setPeriod] = useState(initial.period);

  function jumpToNow() {
    const parts = parseHm(nowHmTime());
    if (!parts) return;
    setHour12(parts.hour12);
    setMinutes(parts.minutes);
    setPeriod(parts.period);
  }

  return (
    <WheelPickerSheet
      closeLabel="Close time picker"
      columns={[
        {
          items: HOURS,
          nextLabel: "Next hour",
          onSelect: setHour12,
          previousLabel: "Previous hour",
          selected: hour12,
        },
        {
          items: MINUTES,
          nextLabel: "Next minute",
          onSelect: setMinutes,
          previousLabel: "Previous minute",
          selected: minutes,
        },
        {
          items: [...PERIODS],
          nextLabel: "Next period",
          onSelect: setPeriod,
          previousLabel: "Previous period",
          selected: period,
        },
      ]}
      extraAction={{ label: "Now", onClick: jumpToNow }}
      onCancel={onCancel}
      onSet={() => onSet(toHm(hour12, minutes, period))}
      title="Pick a time"
    />
  );
}

export function TimeInput({
  value,
  onChange,
  disabled = false,
  id,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => hmToDisplay(value));

  useEffect(() => {
    setText((current) => {
      const currentHm = displayToHm(current);
      if (value) return currentHm === value ? current : hmToDisplay(value);
      return currentHm ? "" : current;
    });
  }, [value]);

  function commitTime(time: string) {
    setText(hmToDisplay(time));
    if (time !== value) onChange(time);
  }

  return (
    <div className="relative">
      <input
        aria-invalid={invalid || undefined}
        autoComplete="off"
        className={pickerInputClass}
        disabled={disabled}
        id={inputId}
        maxLength={8}
        onChange={(event) => {
          const next = formatClock(event.target.value);
          setText(next);
          const time = displayToHm(next);
          if (time !== value && (time || value)) onChange(time);
        }}
        placeholder="hh:mm AM"
        value={text}
      />
      <button
        aria-label="Pick a time"
        className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 disabled:cursor-not-allowed dark:hover:text-white"
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
      >
        <Clock className="h-4 w-4" />
      </button>
      {open ? (
        <TimePickerDialog
          onCancel={() => setOpen(false)}
          onSet={(time) => {
            commitTime(time);
            setOpen(false);
          }}
          value={value}
        />
      ) : null}
    </div>
  );
}
