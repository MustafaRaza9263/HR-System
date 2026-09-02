"use client";

import { UserX, XCircle } from "lucide-react";

import { Modal } from "@/components/ui/modal";

export function InterviewActionConfirmModal({
  action,
  candidateName,
  pending,
  onCancel,
  onConfirm,
}: {
  action: "cancel" | "no_show";
  candidateName: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelling = action === "cancel";

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
            className={`h-11 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 ${
              cancelling ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
            }`}
            disabled={pending}
            onClick={onConfirm}
            type="button"
          >
            {pending ? "Working..." : cancelling ? "Cancel interview" : "Mark no-show"}
          </button>
        </div>
      )}
      onClose={onCancel}
      subtitle={
        cancelling
          ? `${candidateName} will be emailed. Notes on this interview will be kept.`
          : `${candidateName} will be recorded as a no-show. The candidate will not be emailed.`
      }
      title={cancelling ? "Cancel interview?" : "Mark as no-show?"}
    >
      <span
        className={`grid h-11 w-11 place-items-center rounded-xl ${
          cancelling
            ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
            : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
        }`}
      >
        {cancelling ? <XCircle aria-hidden className="h-5 w-5" /> : <UserX aria-hidden className="h-5 w-5" />}
      </span>
    </Modal>
  );
}
