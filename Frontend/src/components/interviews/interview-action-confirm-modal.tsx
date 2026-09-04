"use client";

import { Modal } from "@/components/ui/modal";

type ConfirmableAction = "cancel" | "no_show" | "mark_complete";

const COPY: Record<
  ConfirmableAction,
  {
    title: string;
    description: (name: string) => string;
    confirm: string;
    buttonClass: string;
  }
> = {
  cancel: {
    title: "Cancel interview?",
    description: (name) => `${name} will be emailed. Notes on this interview will be kept.`,
    confirm: "Cancel interview",
    buttonClass: "bg-red-600 hover:bg-red-700",
  },
  no_show: {
    title: "Mark as no-show?",
    description: (name) => `${name} will be recorded as a no-show. The candidate will not be emailed.`,
    confirm: "Mark no-show",
    buttonClass: "bg-amber-600 hover:bg-amber-700",
  },
  mark_complete: {
    title: "Mark interview complete?",
    description: (name) => `${name}'s interview will be locked. Notes cannot be added or changed after this.`,
    confirm: "Mark complete",
    buttonClass: "bg-emerald-600 hover:bg-emerald-700",
  },
};

export function InterviewActionConfirmModal({
  action,
  candidateName,
  pending,
  onCancel,
  onConfirm,
}: {
  action: ConfirmableAction;
  candidateName: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = COPY[action];

  return (
    <Modal
      closeDisabled={pending}
      footer={(close) => (
        <div className="grid grid-cols-2 gap-3">
          <button
            className="h-11 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            disabled={pending}
            onClick={close}
            type="button"
          >
            Go back
          </button>
          <button
            className={`h-11 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 ${copy.buttonClass}`}
            disabled={pending}
            onClick={onConfirm}
            type="button"
          >
            {pending ? "Working..." : copy.confirm}
          </button>
        </div>
      )}
      onClose={onCancel}
      title={copy.title}
    >
      <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{copy.description(candidateName)}</p>
    </Modal>
  );
}
