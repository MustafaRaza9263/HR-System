"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Modal } from "@/components/ui/modal";
import { ToggleRow } from "@/components/ui/toggle-row";
import { alerts } from "@/lib/alerts";
import { ApiClientError, apiRequest } from "@/lib/api";
import type { Interview, InterviewResponse } from "@/lib/interviews/types";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

export function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function ScheduleInterviewModal({
  applicationId,
  applicant,
  interview,
  onClose,
  onSaved,
}: {
  applicationId: string;
  applicant: { name: string; email: string };
  interview?: Interview;
  onClose: () => void;
  onSaved: () => void;
}) {
  const reschedule = Boolean(interview);
  const [label, setLabel] = useState(interview?.label ?? "");
  const [date, setDate] = useState(interview?.date ?? "");
  const [time, setTime] = useState(interview?.time ?? "09:00");
  const [duration, setDuration] = useState(interview ? String(interview.durationMinutes) : "45");
  const [sendEmail, setSendEmail] = useState(true);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedLabel = label.trim();
      if (!trimmedLabel) throw new ApiClientError(422, "VALIDATION_ERROR", "Enter a label.");
      if (!date) throw new ApiClientError(422, "VALIDATION_ERROR", "Select an interview date.");
      const nextTime = time || "09:00";
      if (reschedule && interview && date === interview.date && nextTime === interview.time) {
        throw new ApiClientError(
          422,
          "INTERVIEW_UNCHANGED",
          "Change the date or the time to reschedule this interview.",
        );
      }
      const body = {
        label: trimmedLabel,
        date,
        time: nextTime,
        durationMinutes: Number(duration),
        ...(reschedule ? { sendEmail } : {}),
      };
      if (reschedule && interview) {
        return apiRequest<InterviewResponse>(`/interviews/${interview.id}/reschedule`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      return apiRequest<InterviewResponse>(`/applications/${applicationId}/interviews`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      alerts.success(reschedule ? "Interview rescheduled." : "Interview scheduled.");
      onSaved();
    },
    onError: (error) => alerts.error(errorMessage(error, "Interview could not be saved.")),
  });

  return (
    <Modal
      as="form"
      closeDisabled={saveMutation.isPending}
      footer={(close) => (
        <div className="grid grid-cols-2 gap-3">
          <button
            className="h-11 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-white"
            disabled={saveMutation.isPending}
            onClick={close}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-11 rounded-xl bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={saveMutation.isPending}
            type="submit"
          >
            {saveMutation.isPending ? "Saving..." : reschedule ? "Reschedule" : "Schedule"}
          </button>
        </div>
      )}
      maxWidth="max-w-lg"
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        saveMutation.mutate();
      }}
      title={reschedule ? "Reschedule interview" : "Schedule interview"}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-[#2a2150] dark:text-indigo-300">
          {getInitials(applicant.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-gray-950 dark:text-white">{applicant.name}</p>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{applicant.email}</p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Label</span>
            <input
              className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              maxLength={80}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Technical round"
              required
              type="text"
              value={label}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Date</span>
            <input
              className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              onChange={(event) => setDate(event.target.value)}
              required
              type="date"
              value={date}
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Time (PKT)</span>
            <input
              className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              onChange={(event) => setTime(event.target.value)}
              type="time"
              value={time}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Duration (minutes)</span>
            <input
              className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              max={240}
              min={15}
              onChange={(event) => setDuration(event.target.value)}
              type="number"
              value={duration}
            />
          </label>
        </div>
        {reschedule ? (
          <ToggleRow
            checked={sendEmail}
            description="Notify the candidate of the new date and time."
            disabled={saveMutation.isPending}
            onChange={setSendEmail}
            title="Send email"
          />
        ) : null}
      </div>
    </Modal>
  );
}
