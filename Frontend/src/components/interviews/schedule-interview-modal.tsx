"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

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
  const [date, setDate] = useState(interview?.date ?? "");
  const [time, setTime] = useState(interview?.time ?? "09:00");
  const [duration, setDuration] = useState(interview ? String(interview.durationMinutes) : "45");

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!date) throw new ApiClientError(422, "VALIDATION_ERROR", "Select an interview date.");
      const body = { date, time: time || "09:00", durationMinutes: Number(duration) };
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
    <div
      className="fixed inset-0 z-[1100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saveMutation.isPending) onClose();
      }}
      role="presentation"
    >
      <form
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-[#2a2150] dark:text-indigo-300">
              {getInitials(applicant.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-gray-950 dark:text-white">{applicant.name}</p>
              <p className="truncate text-sm text-gray-500 dark:text-gray-400">{applicant.email}</p>
            </div>
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-950 dark:text-white">
            {reschedule ? "Reschedule interview" : "Schedule interview"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">Date, time, and duration only. Time is shown for planning and is not used for status rules.</p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
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
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Time (PKT)</span>
              <input
                className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                onChange={(event) => setTime(event.target.value)}
                type="time"
                value={time}
              />
            </label>
          </div>
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

        <footer className="grid grid-cols-2 gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/70">
          <button
            className="h-11 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            disabled={saveMutation.isPending}
            onClick={onClose}
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
        </footer>
      </form>
    </div>
  );
}
