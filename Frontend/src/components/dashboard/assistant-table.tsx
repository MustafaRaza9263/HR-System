"use client";

import { DateTimeDisplay } from "@/components/ui/date-time-display";
import { StatusPills, type PillTone } from "@/components/ui/status-pills";
import { UserProfile } from "@/components/ui/user-profile";
import type { AssistantColumnType, AssistantTablePayload } from "@/lib/assistant/types";

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  interview_scheduled: "Interview scheduled",
  interviewed: "Interviewed",
  approved: "Approved",
  rejected: "Rejected",
  trial: "Trial",
  scheduled: "Scheduled",
  overdue: "Overdue",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  pending: "Pending",
  pending_approval: "Pending",
  active: "Active",
  inactive: "Inactive",
};

const STATUS_TONES: Record<string, PillTone> = {
  submitted: "sky",
  under_review: "warning",
  interview_scheduled: "info",
  interviewed: "violet",
  trial: "violet",
  approved: "success",
  rejected: "danger",
  scheduled: "info",
  overdue: "danger",
  completed: "success",
  cancelled: "neutral",
  no_show: "warning",
  draft: "neutral",
  open: "success",
  closed: "neutral",
  pending: "warning",
  pending_approval: "warning",
  active: "success",
  inactive: "neutral",
};

function statusItem(value: string) {
  const key = value.trim().toLowerCase().replace(/\s+/g, "_");
  return {
    label: STATUS_LABELS[key] ?? value,
    tone: STATUS_TONES[key] ?? ("info" as PillTone),
  };
}

function personCell(value: string) {
  const split = value.indexOf("|");
  if (split === -1) return { name: value, email: "" };
  return { name: value.slice(0, split), email: value.slice(split + 1) };
}

function Cell({ type, value }: { type: AssistantColumnType; value: string }) {
  if (!value) return <span className="text-gray-400">—</span>;
  if (type === "status") {
    return <StatusPills items={[statusItem(value)]} />;
  }
  if (type === "person") {
    const person = personCell(value);
    return <UserProfile email={person.email} name={person.name || "—"} />;
  }
  if (type === "datetime") {
    return <DateTimeDisplay value={value} />;
  }
  return <span className="text-gray-700 dark:text-gray-200">{value}</span>;
}

export function AssistantTable({ table }: { table: AssistantTablePayload }) {
  if (table.columns.length === 0 || table.rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
            <tr>
              {table.columns.map((column) => (
                <th className="whitespace-nowrap px-4 py-3" key={column.key}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {table.columns.map((column, columnIndex) => (
                  <td className="px-4 py-3 align-middle" key={`${column.key}-${rowIndex}`}>
                    <Cell type={column.type} value={row[columnIndex] ?? ""} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
