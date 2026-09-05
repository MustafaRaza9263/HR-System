"use client";

import { DateTimeDisplay } from "@/components/ui/date-time-display";
import { StatusPills, type PillTone } from "@/components/ui/status-pills";
import type { ApplicationStatus, StatusHistoryEntry } from "@/lib/applications/types";

function statusLabel(status: ApplicationStatus) {
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

function statusTone(status: ApplicationStatus): PillTone {
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
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-800/70">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Status timeline</h2>
      <ol className="mt-4 space-y-0">
        {history.map((entry, index) => {
          const current = index === history.length - 1;
          return (
            <li className="flex gap-3 pb-4 last:pb-0" key={`${entry.status}-${entry.at}-${index}`}>
              <div className="flex w-4 shrink-0 flex-col items-center">
                <span
                  className={`mt-1.5 h-2.5 w-2.5 rounded-full ${current ? "bg-indigo-600 dark:bg-indigo-400" : "bg-gray-300 dark:bg-gray-600"}`}
                />
                {index < history.length - 1 ? (
                  <span className="mt-1 w-px flex-1 bg-gray-200 dark:bg-gray-700" />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <StatusPills items={[{ label: statusLabel(entry.status), tone: statusTone(entry.status) }]} />
                <DateTimeDisplay className="shrink-0 text-right" size="sm" value={entry.at} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
