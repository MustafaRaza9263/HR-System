"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  CircleCheck,
  ClipboardList,
  FileText,
  Search,
  UserX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ScheduleInterviewModal } from "@/components/interviews/schedule-interview-modal";
import { DateTimeDisplay } from "@/components/ui/date-time-display";
import { Dropdown } from "@/components/ui/dropdown";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusPills, type PillTone } from "@/components/ui/status-pills";
import { Tooltip } from "@/components/ui/tooltip";
import { UserProfile } from "@/components/ui/user-profile";
import { alerts } from "@/lib/alerts";
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

import { ReasonModal } from "./reason-modal";
import { ResumeViewerModal } from "./resume-viewer-modal";

const emptyApps: ApplicationListItem[] = [];
const emptyStats: ApplicationStats = {
  total: 0,
  scheduled: 0,
  rejected: 0,
  approved: 0,
};

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
    default:
      return status.replaceAll("_", " ");
  }
}

function statusTone(status: ApplicationStatus): PillTone {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "under_review":
      return "warning";
    case "submitted":
    case "interview_scheduled":
    case "interviewed":
    case "trial":
      return "info";
    default:
      return "neutral";
  }
}

export function ApplicationsManager() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rejectTarget, setRejectTarget] = useState<{
    count: number;
    jobId: string;
    applicationIds?: string[];
  } | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<ApplicationListItem | null>(null);
  const [resumeTarget, setResumeTarget] = useState<ApplicationListItem | null>(null);

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

  const rejectableSelected = applications.filter(
    (item) => selectedIds.includes(item.id) && item.status !== "rejected" && item.status !== "approved",
  );

  const previewMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      apiRequest<{ data: { count: number } }>("/applications/bulk-reject", {
        method: "POST",
        body: JSON.stringify({ ...body, dryRun: true }),
      }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      reason,
      jobId: rejectJobId,
      applicationIds,
    }: {
      reason: string;
      jobId: string;
      applicationIds?: string[];
    }) =>
      apiRequest<{ data: { count: number } }>("/applications/bulk-reject", {
        method: "POST",
        body: JSON.stringify({
          jobId: rejectJobId,
          q: applicationIds ? undefined : filters.q,
          status: applicationIds ? undefined : filters.status,
          applicationIds,
          reason,
          dryRun: false,
        }),
      }),
    onSuccess: (result) => {
      alerts.success(`Rejected ${result.data.count} application${result.data.count === 1 ? "" : "s"}.`);
      setRejectTarget(null);
      setSelectedIds([]);
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
    },
    onError: (error) => {
      alerts.error(error instanceof ApiClientError ? error.message : "Applications could not be rejected.");
    },
  });

  async function openMatchingReject() {
    if (!jobId) {
      alerts.error("Filter by a job before rejecting matching applications.");
      return;
    }
    try {
      const result = await previewMutation.mutateAsync({
        jobId,
        q: filters.q,
        status: filters.status,
      });
      if (result.data.count === 0) {
        alerts.info("No matching applications to reject.");
        return;
      }
      setRejectTarget({ count: result.data.count, jobId });
    } catch (error) {
      alerts.error(error instanceof ApiClientError ? error.message : "Could not count matching applications.");
    }
  }

  function openSelectedReject() {
    if (rejectableSelected.length === 0) {
      alerts.error("Select applications that are not already closed.");
      return;
    }
    const jobIds = new Set(rejectableSelected.map((item) => item.jobId));
    if (jobIds.size > 1 && !jobId) {
      alerts.error("Selected applications span multiple jobs. Filter by one job first.");
      return;
    }
    const resolvedJobId = jobId || rejectableSelected[0]!.jobId;
    setRejectTarget({
      count: rejectableSelected.length,
      jobId: resolvedJobId,
      applicationIds: rejectableSelected.map((item) => item.id),
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <div className="min-h-full bg-gray-50 p-4 text-gray-900 sm:p-6 md:p-8 dark:bg-gray-900 dark:text-gray-100">
      <div className="w-full space-y-6">
        <section aria-label="Application metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={ClipboardList} label="Total applications" supporting="All statuses" value={stats.total} />
          <MetricCard icon={CalendarClock} label="Scheduled" supporting="Interview scheduled" value={stats.scheduled} />
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
            <Dropdown
              aria-label="Filter by job"
              className="w-full xl:w-56"
              onChange={setJobId}
              options={[
                { value: "", label: "All jobs" },
                ...jobs.map((job) => ({ value: job.id, label: job.title })),
              ]}
              size="md"
              value={jobId}
            />
            <Dropdown
              aria-label="Filter by status"
              className="w-full xl:w-48"
              onChange={setStatus}
              options={[
                { value: "", label: "All statuses" },
                ...APPLICATION_STATUSES.map((item) => ({ value: item, label: statusLabel(item) })),
              ]}
              size="md"
              value={status}
            />
          </div>

          {selectedIds.length > 0 || jobId ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/20 dark:bg-amber-500/10">
              <span className="font-semibold text-amber-900 dark:text-amber-200">
                {selectedIds.length > 0 ? `${selectedIds.length} selected` : "Matching this filter"}
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                {selectedIds.length > 0 ? (
                  <button
                    className="h-9 rounded-lg bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                    disabled={previewMutation.isPending || rejectMutation.isPending}
                    onClick={openSelectedReject}
                    type="button"
                  >
                    Reject selected
                  </button>
                ) : null}
                {jobId ? (
                  <button
                    className="h-9 rounded-lg border border-red-300 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:bg-transparent dark:text-red-300"
                    disabled={previewMutation.isPending || rejectMutation.isPending}
                    onClick={() => void openMatchingReject()}
                    type="button"
                  >
                    {previewMutation.isPending ? "Counting…" : "Reject matching"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

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
                      <th className="w-10 px-4 py-3">
                        <span className="sr-only">Select</span>
                      </th>
                      <th className="px-4 py-3">Candidate</th>
                      <th className="px-4 py-3">Job</th>
                      <th className="px-4 py-3">Department / role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Applied At</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {applications.map((application) => (
                      <tr
                        className="cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-900/40"
                        key={application.id}
                        onClick={() => router.push(`/dashboard/applications/${application.id}`)}
                      >
                        <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          <input
                            aria-label={`Select ${application.candidateName}`}
                            checked={selectedIds.includes(application.id)}
                            onChange={() => toggleSelected(application.id)}
                            type="checkbox"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <UserProfile email={application.candidateEmail} name={application.candidateName} />
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-gray-700 dark:text-gray-200">
                          {application.jobTitle}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {application.departmentName} / {application.roleName}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <StatusPills items={[{ label: statusLabel(application.status), tone: statusTone(application.status) }]} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <DateTimeDisplay value={application.createdAt} />
                        </td>
                        <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Tooltip label="View resume">
                              <button
                                aria-label={`View resume for ${application.candidateName}`}
                                className="icon-button"
                                onClick={() => setResumeTarget(application)}
                                type="button"
                              >
                                <FileText aria-hidden className="h-4 w-4" />
                              </button>
                            </Tooltip>
                            {application.status !== "rejected" && application.status !== "approved" ? (
                              <Tooltip label="Schedule interview">
                                <button
                                  aria-label={`Schedule interview for ${application.candidateName}`}
                                  className="icon-button"
                                  onClick={() => setScheduleTarget(application)}
                                  type="button"
                                >
                                  <Calendar aria-hidden className="h-4 w-4" />
                                </button>
                              </Tooltip>
                            ) : null}
                          </div>
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

      {rejectTarget ? (
        <ReasonModal
          confirmLabel={`Reject ${rejectTarget.count}`}
          description={`This will reject ${rejectTarget.count} matching application${rejectTarget.count === 1 ? "" : "s"} and cancel any scheduled interviews.`}
          pending={rejectMutation.isPending}
          title="Reject applications?"
          onCancel={() => setRejectTarget(null)}
          onConfirm={(reason) =>
            rejectMutation.mutate({
              reason,
              jobId: rejectTarget.jobId,
              applicationIds: rejectTarget.applicationIds,
            })
          }
        />
      ) : null}

      {resumeTarget ? (
        <ResumeViewerModal
          applicationId={resumeTarget.id}
          candidateEmail={resumeTarget.candidateEmail}
          candidateName={resumeTarget.candidateName}
          resumeFileName={resumeTarget.resumeFileName}
          onClose={() => setResumeTarget(null)}
        />
      ) : null}

      {scheduleTarget ? (
        <ScheduleInterviewModal
          applicant={{ name: scheduleTarget.candidateName, email: scheduleTarget.candidateEmail }}
          applicationId={scheduleTarget.id}
          onClose={() => setScheduleTarget(null)}
          onSaved={() => {
            setScheduleTarget(null);
            void queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
            void queryClient.invalidateQueries({ queryKey: queryKeys.interviews.all });
          }}
        />
      ) : null}
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
