"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/modal";
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
    <Modal
      as="form"
      closeDisabled={pending}
      footer={(close) => (
        <div className="grid grid-cols-2 gap-3">
          <button
            className="h-11 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-white"
            disabled={pending}
            onClick={close}
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
        </div>
      )}
      onClose={onCancel}
      onSubmit={submit}
      subtitle={description}
      title={title}
    >
      <label className="block">
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
    </Modal>
  );
}
