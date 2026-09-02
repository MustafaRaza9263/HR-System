"use client";

import { CircleCheck, UserX, XCircle, type LucideIcon } from "lucide-react";

import { Modal } from "@/components/ui/modal";

type ConfirmableAction = "cancel" | "no_show" | "mark_complete";

const COPY: Record<
  ConfirmableAction,
  {
    title: string;
    subtitle: (name: string) => string;
    confirm: string;
    icon: LucideIcon;
    iconClass: string;
    buttonClass: string;
  }
> = {
  cancel: {
    title: "Cancel interview?",
    subtitle: (name) => `${name} will be emailed. Notes on this interview will be kept.`,
    confirm: "Cancel interview",
    icon: XCircle,
    iconClass: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    buttonClass: "bg-red-600 hover:bg-red-700",
  },
  no_show: {
    title: "Mark as no-show?",
    subtitle: (name) => `${name} will be recorded as a no-show. The candidate will not be emailed.`,
    confirm: "Mark no-show",
    icon: UserX,
    iconClass: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    buttonClass: "bg-amber-600 hover:bg-amber-700",
  },
  mark_complete: {
    title: "Mark interview complete?",
    subtitle: (name) => `${name}'s interview will be locked. Notes cannot be added or changed after this.`,
    confirm: "Mark complete",
    icon: CircleCheck,
    iconClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
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
  const Icon = copy.icon;

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
      subtitle={copy.subtitle(candidateName)}
      title={copy.title}
    >
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${copy.iconClass}`}>
        <Icon aria-hidden className="h-5 w-5" />
      </span>
    </Modal>
  );
}
