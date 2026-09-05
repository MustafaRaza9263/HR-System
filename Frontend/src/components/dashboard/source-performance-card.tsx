"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { DashboardCard, DashboardEmpty, DashboardSkeleton } from "@/components/dashboard/dashboard-card";
import { DashboardFilterField, DashboardFilterSheet } from "@/components/dashboard/dashboard-filter-sheet";
import { DashboardJobSelect } from "@/components/dashboard/dashboard-job-select";
import type { DropdownOption } from "@/components/ui/dropdown";
import { apiRequest } from "@/lib/api";
import {
  DASHBOARD_STALE_TIME,
  type DashboardJobFilter,
  type DashboardSourceRow,
  type DashboardSourcesResponse,
} from "@/lib/dashboard/types";
import { queryKeys } from "@/lib/query/query-keys";

type SortKey = "name" | "applications" | "interviewed" | "approved" | "rate";

interface SourcePerformanceCardProps {
  jobOptions: DropdownOption[];
}

function rateClass(rate: number) {
  if (rate >= 8) return "text-emerald-600 dark:text-emerald-400";
  if (rate >= 3) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function SourcePerformanceCard({ jobOptions }: SourcePerformanceCardProps) {
  const [job, setJob] = useState<DashboardJobFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("applications");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.dashboard.sources(job),
    queryFn: async () => apiRequest<DashboardSourcesResponse>(`/dashboard/sources?job=${encodeURIComponent(job)}`),
    staleTime: DASHBOARD_STALE_TIME,
    placeholderData: keepPreviousData,
  });

  const rows = useMemo(() => {
    const list = [...(query.data?.data.sources ?? [])];
    list.sort((left, right) => {
      const a = left[sortKey];
      const b = right[sortKey];
      if (typeof a === "string" && typeof b === "string") {
        return sortDir === "asc" ? a.localeCompare(b) : b.localeCompare(a);
      }
      return sortDir === "asc" ? Number(a) - Number(b) : Number(b) - Number(a);
    });
    return list;
  }, [query.data?.data.sources, sortDir, sortKey]);

  const maxApplications = Math.max(...rows.map((row) => row.applications), 1);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((value) => (value === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "name" ? "asc" : "desc");
  }

  return (
    <DashboardCard
      actions={
        <DashboardFilterSheet
          desktop={
            <DashboardJobSelect
              onChange={(value) => {
                setJob(value);
                setExpanded(null);
              }}
              options={jobOptions}
              value={job}
            />
          }
          title="Source filters"
        >
          <DashboardFilterField label="Job">
            <DashboardJobSelect
              className="w-full"
              onChange={(value) => {
                setJob(value);
                setExpanded(null);
              }}
              options={jobOptions}
              size="md"
              value={job}
            />
          </DashboardFilterField>
        </DashboardFilterSheet>
      }
      className="h-[420px]"
      subtitle="Sort any column. Click a row to see campaigns."
      title="Source & campaign performance"
    >
      {query.isPending && !query.data ? (
        <DashboardSkeleton />
      ) : rows.length === 0 ? (
        <DashboardEmpty>No source data yet.</DashboardEmpty>
      ) : (
        <div>
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-16 z-20 border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-400">
              <tr>
                {(
                  [
                    ["name", "Source"],
                    ["applications", "Applications"],
                    ["interviewed", "Interviewed"],
                    ["approved", "Approved"],
                    ["rate", "Approval %"],
                  ] as Array<[SortKey, string]>
                ).map(([key, label]) => (
                  <th className="px-3 py-2" key={key}>
                    <button className="font-bold uppercase tracking-wide hover:text-gray-800 dark:hover:text-gray-200" onClick={() => toggleSort(key)} type="button">
                      {label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((row) => (
                <SourceRows
                  expanded={expanded === row.source}
                  key={row.source}
                  maxApplications={maxApplications}
                  onToggle={() => setExpanded((current) => (current === row.source ? null : row.source))}
                  row={row}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  );
}

function SourceRows({
  row,
  expanded,
  maxApplications,
  onToggle,
}: {
  row: DashboardSourceRow;
  expanded: boolean;
  maxApplications: number;
  onToggle: () => void;
}) {
  const barWidth = Math.round((row.applications / maxApplications) * 100);
  return (
    <>
      <tr className="cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-900/40" onClick={onToggle}>
        <td className="px-3 py-2.5">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded border border-gray-200 text-xs text-gray-500 dark:border-gray-700">
            {expanded ? "−" : "+"}
          </span>
          {row.name}
        </td>
        <td className="px-3 py-2.5">
          {row.applications.toLocaleString()}
          <span className="mt-1 block h-1 w-24 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
            <span className="block h-full rounded bg-indigo-600" style={{ width: `${barWidth}%` }} />
          </span>
        </td>
        <td className="px-3 py-2.5">{row.interviewed.toLocaleString()}</td>
        <td className="px-3 py-2.5">{row.approved.toLocaleString()}</td>
        <td className={`px-3 py-2.5 font-bold ${rateClass(row.rate)}`}>{row.rate.toFixed(1)}%</td>
      </tr>
      {expanded ? (
        <tr>
          <td className="px-3 pb-3" colSpan={5}>
            <div className="rounded-lg bg-gray-50 px-3 py-1 dark:bg-gray-900/60">
              {row.campaigns.map((campaign, index) => (
                <div
                  className="grid grid-cols-5 gap-2 border-b border-gray-100 py-1.5 text-xs text-gray-500 last:border-b-0 dark:border-gray-800 dark:text-gray-400"
                  key={`${campaign.name}-${index}`}
                >
                  <span className="font-semibold text-gray-900 dark:text-white">{campaign.name}</span>
                  <span>{campaign.applications.toLocaleString()}</span>
                  <span>{campaign.interviewed.toLocaleString()}</span>
                  <span>{campaign.approved.toLocaleString()}</span>
                  <span>{campaign.rate.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
