"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { registerOverlay } from "@/components/ui/overlay-presence";

export const ITEM_H = 40;
const VISIBLE_ITEMS = 5;

export const pickerInputClass =
  "h-11 w-full rounded border border-neutral-300 bg-white px-3.5 pr-11 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-800";

export function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function Wheel({
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

export function stepValue(items: Array<{ value: number }>, selected: number, delta: number) {
  const index = items.findIndex((item) => item.value === selected);
  const next = items[Math.max(0, Math.min(items.length - 1, index + delta))];
  return next?.value ?? selected;
}

export type WheelColumn = {
  items: Array<{ value: number; label: string }>;
  selected: number;
  onSelect: (value: number) => void;
  previousLabel: string;
  nextLabel: string;
};

export function WheelPickerSheet({
  title,
  closeLabel,
  columns,
  extraAction,
  onCancel,
  onSet,
}: {
  title: string;
  closeLabel: string;
  columns: WheelColumn[];
  extraAction: { label: string; onClick: () => void };
  onCancel: () => void;
  onSet: () => void;
}) {
  const titleId = useId();
  const [wheelToken, setWheelToken] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const columnStyle = { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` };

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
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onCancel]);

  function runExtraAction() {
    extraAction.onClick();
    setWheelToken((token) => token + 1);
  }

  return createPortal(
    <div className="fixed inset-0 z-1300 flex items-end justify-center md:items-center md:p-4">
      <button
        aria-label={closeLabel}
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
            {title}
          </h2>
        </div>

        <div className="px-1 py-1">
          <div className="grid" style={columnStyle}>
            {columns.map((column) => (
              <button
                aria-label={column.previousLabel}
                className="flex h-5 items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                key={`prev-${column.previousLabel}`}
                onClick={() => column.onSelect(stepValue(column.items, column.selected, -1))}
                type="button"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            ))}
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-1 top-1/2 z-10 -translate-y-1/2 border-y-2 border-sky-400"
              style={{ height: ITEM_H }}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-linear-to-b from-white from-25% to-transparent dark:from-gray-900" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-linear-to-t from-white from-25% to-transparent dark:from-gray-900" />
            <div className="grid" style={columnStyle}>
              {columns.map((column) => (
                <Wheel
                  items={column.items}
                  key={column.previousLabel}
                  onSelect={column.onSelect}
                  scrollToken={wheelToken}
                  selected={column.selected}
                />
              ))}
            </div>
          </div>

          <div className="grid" style={columnStyle}>
            {columns.map((column) => (
              <button
                aria-label={column.nextLabel}
                className="flex h-5 items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                key={`next-${column.nextLabel}`}
                onClick={() => column.onSelect(stepValue(column.items, column.selected, 1))}
                type="button"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            ))}
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
            onClick={runExtraAction}
            type="button"
          >
            {extraAction.label}
          </button>
          <button
            className="h-11 text-sm font-semibold text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-500/10"
            onClick={onSet}
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
