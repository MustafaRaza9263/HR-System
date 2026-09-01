"use client";

import { useEffect, useState } from "react";

import { alerts } from "@/lib/alerts";

export function ReasonModal({
  title,
  description,
  confirmLabel,
  pending,
  minLength = 10,
  maxLength = 500,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  minLength?: number;
  maxLength?: number;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onCancel, pending]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = reason.trim();
    if (clean.length < minLength) {
      alerts.error(`Enter a reason of at least ${minLength} characters.`);
      return;
    }
    onConfirm(clean);
  }

  return (
    <div
      className="fixed inset-0 z-[1100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
      role="presentation"
    >
      <form
        aria-labelledby="reason-modal-title"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onSubmit={submit}
        role="dialog"
      >
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-950 dark:text-white" id="reason-modal-title">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-200">
              Reason <span className="text-red-500">*</span>
            </span>
            <textarea
              autoFocus
              className="min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              maxLength={maxLength}
              onChange={(event) => setReason(event.target.value)}
              value={reason}
            />
            <span className="mt-1 block text-xs text-gray-400">
              {reason.trim().length}/{maxLength} · minimum {minLength} characters
            </span>
          </label>
        </div>
        <footer className="grid grid-cols-2 gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/70">
          <button
            className="h-11 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-11 rounded-xl bg-red-600 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            {pending ? "Working..." : confirmLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}
