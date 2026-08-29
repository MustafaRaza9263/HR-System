"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CircleCheck,
  ClipboardList,
  Search,
  UserX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { MetricCard } from "@/components/ui/metric-card";
import { ApiClientError, apiRequest } from "@/lib/api";
import type {
  ApplicationListItem,
  ApplicationStats,
  ApplicationStatus,
  ApplicationsListResponse,
} from "@/lib/applications/types";
import { APPLICATION_STATUSES } from "@/lib/applications/types";
import type { JobsListResponse } from "@/lib/jobs/types";
import { queryKeys } from "@/lib/query/query-keys";

const emptyApps: ApplicationListItem[] = [];
const emptyStats: ApplicationStats = {
  total: 0,
  scheduled: 0,
  rejected: 0,
  approved: 0,
};

function statusBadgeClass(status: ApplicationStatus) {
  switch (status) {
    case "submitted":
      return "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400";
    case "under_review":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
    case "interviewing":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300";
    case "approved":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "rejected":
      return "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400";
    case "trial":
      return "bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function statusLabel(status: ApplicationStatus) {
  return status.replaceAll("_", " ");
}

export function ApplicationsManager() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const filters = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      jobId: jobId || undefined,
      status: status || undefined,
    }),
    [debouncedQuery, jobId, status],
  );

  const listQuery = useQuery({
    queryKey: queryKeys.applications.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.jobId) params.set("jobId", filters.jobId);
      if (filters.status) params.set("status", filters.status);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return apiRequest<ApplicationsListResponse>(`/applications${suffix}`);
    },
  });

  const jobsQuery = useQuery({
    queryKey: queryKeys.jobs.list(),
    queryFn: async () => apiRequest<JobsListResponse>("/jobs"),
  });

  const applications = listQuery.data?.data.applications ?? emptyApps;
  const stats = listQuery.data?.data.stats ?? emptyStats;
  const jobs = jobsQuery.data?.data.jobs ?? [];

  return (
    <div className="min-h-full bg-gray-50 p-4 text-gray-900 sm:p-6 md:p-8 dark:bg-gray-900 dark:text-gray-100">
      <div className="w-full space-y-6">
        <section aria-label="Application metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={ClipboardList} label="Total applications" supporting="All statuses" value={stats.total} />
          <MetricCard icon={CalendarClock} label="Scheduled" supporting="Coming later" value={stats.scheduled} />
          <MetricCard icon={UserX} label="Rejected" supporting="Closed as not a fit" value={stats.rejected} />
          <MetricCard icon={CircleCheck} label="Approved" supporting="Hired or offered" value={stats.approved} />
        </section>

        <section aria-labelledby="applications-table-title">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search applications</span>
              <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                className="h-12 w-full rounded-xl border border-gray-300 bg-white pl-12 pr-4 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by candidate name or email…"
                value={query}
              />
            </label>
            <select
              aria-label="Filter by job"
              className="h-12 rounded-xl border border-gray-300 bg-white px-3 text-sm shadow-sm outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              onChange={(event) => setJobId(event.target.value)}
              value={jobId}
            >
              <option value="">All jobs</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by status"
              className="h-12 rounded-xl border border-gray-300 bg-white px-3 text-sm shadow-sm outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="">All statuses</option>
              {APPLICATION_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {statusLabel(item)}
                </option>
              ))}
            </select>
          </div>

          <h2 className="sr-only" id="applications-table-title">
            Applications
          </h2>

          <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/70">
            {listQuery.isPending ? <LoadingState /> : null}
            {listQuery.isError ? (
              <LoadError
                message={
                  listQuery.error instanceof ApiClientError
                    ? listQuery.error.message
                    : "Applications could not be loaded"
                }
                onRetry={() => void listQuery.refetch()}
              />
            ) : null}
            {listQuery.isSuccess && applications.length === 0 ? (
              <EmptyState hasQuery={Boolean(debouncedQuery || jobId || status)} />
            ) : null}
            {listQuery.isSuccess && applications.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Candidate</th>
                      <th className="px-4 py-3">Job</th>
                      <th className="px-4 py-3">Department / role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Applied</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {applications.map((application) => (
                      <tr
                        className="cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-900/40"
                        key={application.id}
                        onClick={() => router.push(`/dashboard/applications/${application.id}`)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-950 dark:text-white">{application.candidateName}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{application.candidateEmail}</p>
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-gray-700 dark:text-gray-200">
                          {application.jobTitle}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {application.departmentName} / {application.roleName}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(application.status)}`}>
                            {statusLabel(application.status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(new Date(application.createdAt), { addSuffix: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div aria-label="Loading applications" className="space-y-3 p-4" role="status">
      {[1, 2, 3].map((item) => (
        <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-900" key={item} />
      ))}
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="px-6 py-12 text-center">
      <AlertTriangle aria-hidden className="mx-auto h-8 w-8 text-red-500" />
      <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">{message}</h3>
      <button className="mt-3 text-sm font-bold text-indigo-600 dark:text-indigo-400" onClick={onRetry} type="button">
        Try again
      </button>
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="px-6 py-16 text-center">
      <ClipboardList aria-hidden className="mx-auto h-9 w-9 text-gray-400" />
      <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">
        {hasQuery ? "No applications match your filters" : "No applications yet"}
      </h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {hasQuery ? "Try another search or clear filters." : "Applications appear here after candidates apply from careers."}
      </p>
    </div>
  );
}
