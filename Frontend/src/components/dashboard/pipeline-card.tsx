"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { DashboardCard, DashboardSkeleton } from "@/components/dashboard/dashboard-card";
import { DashboardFilterField, DashboardFilterSheet } from "@/components/dashboard/dashboard-filter-sheet";
import { DashboardJobSelect } from "@/components/dashboard/dashboard-job-select";
import type { DropdownOption } from "@/components/ui/dropdown";
import type { ApplicationStatus } from "@/lib/applications/types";
import { apiRequest } from "@/lib/api";
import { DASHBOARD_STALE_TIME, type DashboardJobFilter, type DashboardPipelineResponse } from "@/lib/dashboard/types";
import { queryKeys } from "@/lib/query/query-keys";

const PIPELINE: Array<{ status: ApplicationStatus; label: string; valueClass: string; tileClass: string }> = [
  {
    status: "submitted",
    label: "Submitted",
    tileClass: "bg-sky-50 dark:bg-sky-500/10",
    valueClass: "text-sky-700 dark:text-sky-300",
  },
  {
    status: "under_review",
    label: "Under review",
    tileClass: "bg-amber-50 dark:bg-amber-500/10",
    valueClass: "text-amber-700 dark:text-amber-300",
  },
  {
    status: "interview_scheduled",
    label: "Interview scheduled",
    tileClass: "bg-indigo-50 dark:bg-indigo-500/10",
    valueClass: "text-indigo-700 dark:text-indigo-300",
  },
  {
    status: "interviewed",
    label: "Interviewed",
    tileClass: "bg-violet-50 dark:bg-violet-500/10",
    valueClass: "text-violet-700 dark:text-violet-300",
  },
  {
    status: "approved",
    label: "Approved",
    tileClass: "bg-emerald-50 dark:bg-emerald-500/10",
    valueClass: "text-emerald-700 dark:text-emerald-300",
  },
  {
    status: "rejected",
    label: "Rejected",
    tileClass: "bg-red-50 dark:bg-red-500/10",
    valueClass: "text-red-700 dark:text-red-300",
  },
  {
    status: "trial",
    label: "Trial",
    tileClass: "bg-violet-50 dark:bg-violet-500/10",
    valueClass: "text-violet-700 dark:text-violet-300",
  },
];

interface PipelineCardProps {
  jobOptions: DropdownOption[];
}

export function PipelineCard({ jobOptions }: PipelineCardProps) {
  const [job, setJob] = useState<DashboardJobFilter>("all");
  const query = useQuery({
    queryKey: queryKeys.dashboard.pipeline(job),
    queryFn: async () => apiRequest<DashboardPipelineResponse>(`/dashboard/pipeline?job=${encodeURIComponent(job)}`),
    staleTime: DASHBOARD_STALE_TIME,
    placeholderData: keepPreviousData,
  });

  const counts = query.data?.data.counts;

  return (
    <DashboardCard
      actions={
        <DashboardFilterSheet
          desktop={<DashboardJobSelect onChange={setJob} options={jobOptions} value={job} />}
          title="Pipeline filters"
        >
          <DashboardFilterField label="Job">
            <DashboardJobSelect className="w-full" onChange={setJob} options={jobOptions} size="md" value={job} />
          </DashboardFilterField>
        </DashboardFilterSheet>
      }
      className="h-[260px] max-md:h-[380px]"
      subtitle="Status breakdown, all-time totals for the selected job"
      title="Application pipeline"
    >
      {query.isPending && !query.data ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid h-full grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
          {PIPELINE.map((item) => (
            <div className={`grid place-items-center rounded-xl px-2 py-3 text-center ${item.tileClass}`} key={item.status}>
              <p className={`text-2xl font-bold tracking-[-0.03em] ${item.valueClass}`}>
                {(counts?.[item.status] ?? 0).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
