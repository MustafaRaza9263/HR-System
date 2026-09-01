"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Clock3,
  Search,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { InterviewActions } from "@/components/applications/application-interviews";
import { InviteInterviewersModal } from "@/components/interviews/invite-interviewers-modal";
import { ScheduleInterviewModal } from "@/components/interviews/schedule-interview-modal";
import { Dropdown } from "@/components/ui/dropdown";
import { MetricCard } from "@/components/ui/metric-card";
import { alerts } from "@/lib/alerts";
import { ApiClientError, apiRequest } from "@/lib/api";
import { formatInterviewWhen } from "@/lib/interviews/format";
import type {
  DisplayStatus,
  InterviewAction,
  InterviewBoardStats,
  InterviewListItem,
  InterviewResponse,
  InterviewsBoardResponse,
  InterviewStatus,
  PendingLinksResponse,
} from "@/lib/interviews/types";
import type { JobsListResponse } from "@/lib/jobs/types";
import { queryKeys } from "@/lib/query/query-keys";

const emptyStats: InterviewBoardStats = { scheduled: 0, today: 0, tomorrow: 0, overdue: 0 };
const emptyInterviews: InterviewListItem[] = [];

const STATUS_OPTIONS: Array<{ value: InterviewStatus | "overdue" | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No-show" },
  { value: "cancelled", label: "Cancelled" },
];

function statusBadge(status: DisplayStatus) {
  switch (status) {
    case "scheduled":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300";
    case "overdue":
      return "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300";
    case "completed":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "no_show":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

export function InterviewsManager() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("");
  const [bucket, setBucket] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<InterviewListItem | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (searchParams.get("pending") === "1") setInviteOpen(true);
  }, [searchParams]);

  const filters = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      jobId: jobId || undefined,
      status: status || undefined,
      bucket: bucket || undefined,
    }),
    [debouncedQuery, jobId, status, bucket],
  );

  const listQuery = useQuery({
    queryKey: queryKeys.interviews.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.jobId) params.set("jobId", filters.jobId);
      if (filters.status) params.set("status", filters.status);
      if (filters.bucket) params.set("bucket", filters.bucket);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return apiRequest<InterviewsBoardResponse>(`/interviews${suffix}`);
    },
  });

  const jobsQuery = useQuery({
    queryKey: queryKeys.jobs.list(),
    queryFn: async () => apiRequest<JobsListResponse>("/jobs"),
  });

  const pendingQuery = useQuery({
    queryKey: queryKeys.interviews.pendingLinks,
    queryFn: async () => apiRequest<PendingLinksResponse>("/department-links/pending"),
  });

  const interviews = listQuery.data?.data.interviews ?? emptyInterviews;
  const stats = listQuery.data?.data.stats ?? emptyStats;
  const jobs = jobsQuery.data?.data.jobs ?? [];
  const hasPending = (pendingQuery.data?.data.requests.length ?? 0) > 0;

  function invalidateBoard() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.interviews.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
  }

  const actionMutation = useMutation({
    mutationFn: async ({ interviewId, action }: { interviewId: string; action: Exclude<InterviewAction, "reschedule"> }) => {
      const path =
        action === "mark_complete"
          ? `/interviews/${interviewId}/complete`
          : action === "no_show"
            ? `/interviews/${interviewId}/no-show`
            : `/interviews/${interviewId}/cancel`;
      return apiRequest<InterviewResponse>(path, { method: "PATCH" });
    },
    onSuccess: (_result, variables) => {
      const labels = { mark_complete: "Interview marked complete.", no_show: "Marked as no-show.", cancel: "Interview cancelled." };
      alerts.success(labels[variables.action]);
      invalidateBoard();
    },
    onError: (error) => alerts.error(errorMessage(error, "Action could not be completed.")),
  });

  function toggleBucket(next: string) {
    setBucket((current) => (current === next ? "" : next));
  }

  return (
    <div className="min-h-full bg-gray-50 p-4 text-gray-900 sm:p-6 md:p-8 dark:bg-gray-900 dark:text-gray-100">
      <div className="w-full space-y-6">
        <section aria-label="Interview metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button className="text-left" onClick={() => toggleBucket("scheduled")} type="button">
            <MetricCard icon={CalendarClock} label="Scheduled" supporting={bucket === "scheduled" ? "Filter on" : "Open interviews"} value={stats.scheduled} />
          </button>
          <button className="text-left" onClick={() => toggleBucket("today")} type="button">
            <MetricCard icon={CalendarDays} label="Today" supporting={bucket === "today" ? "Filter on" : "Scheduled today"} value={stats.today} />
          </button>
          <button className="text-left" onClick={() => toggleBucket("tomorrow")} type="button">
            <MetricCard icon={Clock3} label="Tomorrow" supporting={bucket === "tomorrow" ? "Filter on" : "Scheduled tomorrow"} value={stats.tomorrow} />
          </button>
          <button className="text-left" onClick={() => toggleBucket("overdue")} type="button">
            <MetricCard icon={TriangleAlert} label="Overdue" supporting={bucket === "overdue" ? "Filter on" : "Date has passed"} value={stats.overdue} />
          </button>
        </section>

        <section>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search interviews</span>
              <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                className="h-12 w-full rounded-xl border border-gray-300 bg-white pl-12 pr-4 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by candidate, email, or job…"
                value={query}
              />
            </label>
            <Dropdown
              aria-label="Filter by job"
              className="w-full xl:w-56"
              onChange={setJobId}
              options={[{ value: "", label: "All jobs" }, ...jobs.map((job) => ({ value: job.id, label: job.title }))]}
              size="md"
              value={jobId}
            />
            <Dropdown
              aria-label="Filter by status"
              className="w-full xl:w-48"
              onChange={setStatus}
              options={STATUS_OPTIONS}
              size="md"
              value={status}
            />
            <button
              aria-label={hasPending ? "Invitation, pending requests" : "Invitation"}
              className="relative inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              onClick={() => setInviteOpen(true)}
              type="button"
            >
              {hasPending ? (
                <span
                  aria-hidden
                  className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-indigo-600"
                />
              ) : null}
              <UserPlus aria-hidden className="h-4 w-4" />
              Invitation
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/70">
            {listQuery.isPending ? (
              <div aria-label="Loading interviews" className="space-y-3 p-4" role="status">
                {[1, 2, 3].map((item) => (
                  <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-900" key={item} />
                ))}
              </div>
            ) : null}
            {listQuery.isError ? (
              <div className="px-6 py-12 text-center">
                <AlertTriangle aria-hidden className="mx-auto h-8 w-8 text-red-500" />
                <h3 className="mt-3 text-sm font-bold">
                  {listQuery.error instanceof ApiClientError ? listQuery.error.message : "Interviews could not be loaded"}
                </h3>
                <button className="mt-3 text-sm font-bold text-indigo-600" onClick={() => void listQuery.refetch()} type="button">
                  Try again
                </button>
              </div>
            ) : null}
            {listQuery.isSuccess && interviews.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <CalendarClock aria-hidden className="mx-auto h-9 w-9 text-gray-400" />
                <h3 className="mt-3 text-sm font-bold">
                  {debouncedQuery || jobId || status || bucket ? "No interviews match your filters" : "No interviews yet"}
                </h3>
                <p className="mt-1 text-xs text-gray-500">Schedule interviews from an application.</p>
              </div>
            ) : null}
            {listQuery.isSuccess && interviews.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Candidate</th>
                      <th className="px-4 py-3">Job</th>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {interviews.map((interview) => (
                      <tr className="align-top hover:bg-gray-50/80 dark:hover:bg-gray-900/40" key={interview.id}>
                        <td className="px-4 py-3">
                          <Link className="font-bold text-gray-950 hover:text-indigo-600 dark:text-white" href={`/dashboard/applications/${interview.applicationId}`}>
                            {interview.candidateName}
                          </Link>
                          <p className="mt-0.5 text-xs text-gray-500">{interview.candidateEmail}</p>
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-gray-700 dark:text-gray-200">{interview.jobTitle}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                          {formatInterviewWhen(interview.date, interview.time)}
                          <span className="mt-0.5 block text-xs text-gray-400">{interview.durationMinutes} min</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusBadge(interview.displayStatus)}`}>
                            {interview.displayStatus.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <InterviewActions
                            actions={interview.actions}
                            pendingAction={
                              actionMutation.isPending && actionMutation.variables?.interviewId === interview.id
                                ? actionMutation.variables.action
                                : undefined
                            }
                            onAction={(action) => {
                              if (action === "reschedule") setRescheduleTarget(interview);
                              else actionMutation.mutate({ interviewId: interview.id, action });
                            }}
                          />
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

      {inviteOpen ? <InviteInterviewersModal onClose={() => setInviteOpen(false)} /> : null}
      {rescheduleTarget ? (
        <ScheduleInterviewModal
          applicant={{ name: rescheduleTarget.candidateName, email: rescheduleTarget.candidateEmail }}
          applicationId={rescheduleTarget.applicationId}
          interview={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSaved={() => {
            setRescheduleTarget(null);
            invalidateBoard();
          }}
        />
      ) : null}
    </div>
  );
}
