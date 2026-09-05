"use client";

import { Funnel } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Modal } from "@/components/ui/modal";

interface FilterSheetProps {
  title: string;
  children: ReactNode;
  active?: boolean;
  triggerSize?: "sm" | "md";
}

export function FilterSheet({ title, children, active = false, triggerSize = "sm" }: FilterSheetProps) {
  const [open, setOpen] = useState(false);
  const triggerClass =
    triggerSize === "md"
      ? "relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 hover:text-gray-900 md:hidden dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
      : "relative inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 md:hidden dark:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-white";

  return (
    <>
      <button
        aria-label={active ? "Open filters, filters applied" : "Open filters"}
        className={triggerClass}
        onClick={() => setOpen(true)}
        title="Open filters"
        type="button"
      >
        <Funnel aria-hidden className="h-4 w-4" />
        {active ? <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-indigo-600" /> : null}
      </button>
      {open ? (
        <Modal
          footer={(close) => (
            <button
              className="h-11 w-full rounded-xl bg-indigo-600 text-sm font-bold text-white transition hover:bg-indigo-700"
              onClick={close}
              type="button"
            >
              Done
            </button>
          )}
          onClose={() => setOpen(false)}
          title={title}
        >
          <div className="space-y-4">{children}</div>
        </Modal>
      ) : null}
    </>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      {children}
    </div>
  );
}
