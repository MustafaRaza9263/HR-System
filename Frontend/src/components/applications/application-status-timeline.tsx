"use client";

import { DateTimeDisplay } from "@/components/ui/date-time-display";
import { StatusPills, type PillTone } from "@/components/ui/status-pills";
import type { ApplicationStatus, StatusHistoryEntry } from "@/lib/applications/types";

export function applicationStatusLabel(status: ApplicationStatus) {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "under_review":
      return "Under review";
    case "interview_scheduled":
      return "Interview scheduled";
    case "interviewed":
      return "Interviewed";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "trial":
      return "Trial";
  }
}

export function applicationStatusTone(status: ApplicationStatus): PillTone {
  switch (status) {
    case "submitted":
      return "sky";
    case "under_review":
      return "warning";
    case "interview_scheduled":
      return "info";
    case "interviewed":
    case "trial":
      return "violet";
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

export function ApplicationStatusTimeline({ history }: { history: StatusHistoryEntry[] }) {
  if (history.length === 0) return null;

  return (
    <ol className="flex flex-col gap-3.5">
      {history.map((entry, index) => {
        const current = index === history.length - 1;
        return (
          <li className="flex gap-2.5" key={`${entry.status}-${entry.at}-${index}`}>
            <span
              aria-hidden
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                current
                  ? "bg-indigo-600 ring-4 ring-indigo-50 dark:bg-indigo-400 dark:ring-indigo-500/20"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            />
            <div className="min-w-0">
              <StatusPills items={[{ label: applicationStatusLabel(entry.status), tone: applicationStatusTone(entry.status) }]} />
              <DateTimeDisplay className="mt-1" size="sm" value={entry.at} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
