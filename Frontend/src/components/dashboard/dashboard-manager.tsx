"use client";

import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, CirclePlus, Clock3, UserRoundCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { ActiveInterviewersCard } from "@/components/dashboard/active-interviewers-card";
import { ApplicationsTrendCard } from "@/components/dashboard/applications-trend-card";
import { PipelineCard } from "@/components/dashboard/pipeline-card";
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";
import { SourcePerformanceCard } from "@/components/dashboard/source-performance-card";
import { UpcomingInterviewsCard } from "@/components/dashboard/upcoming-interviews-card";
import type { DropdownOption } from "@/components/ui/dropdown";
import { MetricCard } from "@/components/ui/metric-card";
import { apiRequest } from "@/lib/api";
import { deltaLabel } from "@/lib/dashboard/format";
import { DASHBOARD_STALE_TIME, type DashboardSummaryResponse } from "@/lib/dashboard/types";
import type { JobOptionsResponse } from "@/lib/jobs/types";
import { queryKeys } from "@/lib/query/query-keys";

export function DashboardManager({ userName }: { userName: string }) {
  const summaryQuery = useQuery({
    queryKey: queryKeys.dashboard.summary,
    queryFn: async () => apiRequest<DashboardSummaryResponse>("/dashboard/summary"),
    staleTime: DASHBOARD_STALE_TIME,
  });

  const jobsQuery = useQuery({
    queryKey: queryKeys.jobs.options,
    queryFn: async () => apiRequest<JobOptionsResponse>("/jobs/options"),
    staleTime: DASHBOARD_STALE_TIME,
  });

  const summary = summaryQuery.data?.data;
  const jobOptions = useMemo<DropdownOption[]>(
    () => [
      { value: "all", label: "All jobs" },
      { value: "open", label: "All open jobs" },
      ...(jobsQuery.data?.data.jobs ?? [])
        .filter((job) => job.status !== "draft")
        .map((job) => ({ value: job.id, label: job.title })),
    ],
    [jobsQuery.data?.data.jobs],
  );

  return (
    <div className="min-h-full bg-gray-50 p-4 text-gray-900 sm:p-6 md:p-8 dark:bg-gray-900 dark:text-gray-100">
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-gray-950 sm:text-3xl dark:text-white">
              {userName ? `Welcome, ${userName}` : "Welcome"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Recruitment activity across all departments.
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-bold text-gray-800 shadow-sm transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:hover:bg-gray-800"
            href="/dashboard/jobs/new"
          >
            <CirclePlus aria-hidden className="h-4 w-4" />
            Create job
          </Link>
        </div>

        <section aria-label="Hiring metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <MetricCard
            icon={BriefcaseBusiness}
            label="Open jobs"
            supporting={summary ? deltaLabel(summary.openJobs.delta, "this month") : "Loading…"}
            value={summary?.openJobs.value ?? "—"}
          />
          <MetricCard
            icon={UsersRound}
            label="Applications"
            supporting={summary ? deltaLabel(summary.applications.delta, "today") : "Loading…"}
            value={summary?.applications.value ?? "—"}
          />
          <MetricCard
            icon={Clock3}
            label="Scheduled interviews"
            supporting="today"
            value={summary?.interviewsToday.value ?? "—"}
          />
          <MetricCard
            icon={UserRoundCheck}
            label="Hired candidates"
            supporting={summary ? deltaLabel(summary.hired.delta, "this month") : "Loading…"}
            value={summary?.hired.value ?? "—"}
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-stretch">
          <ApplicationsTrendCard jobOptions={jobOptions} />
          <UpcomingInterviewsCard />
        </div>

        <PipelineCard jobOptions={jobOptions} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-stretch">
          <SourcePerformanceCard jobOptions={jobOptions} />
          <ActiveInterviewersCard />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-stretch">
          <RecentActivityCard />
          <QuickActionsCard />
        </div>
      </div>
    </div>
  );
}
