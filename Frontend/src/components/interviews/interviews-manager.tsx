"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Phone,
  FilePlus,
  Search,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { COMPLETE_NOTE_REQUIRED, completeDisabledReasons, InterviewActions, notesWriteLocked } from "@/components/applications/application-interviews";
import { InterviewActionConfirmModal } from "@/components/interviews/interview-action-confirm-modal";
import { InterviewNoteModal } from "@/components/interviews/interview-note-modal";
import { InviteInterviewersModal } from "@/components/interviews/invite-interviewers-modal";
import { ScheduleInterviewModal } from "@/components/interviews/schedule-interview-modal";
import { Dropdown } from "@/components/ui/dropdown";
import { FilterField, FilterSheet } from "@/components/ui/filter-sheet";
import { MetricCard } from "@/components/ui/metric-card";
import { PaginationBar } from "@/components/ui/pagination";
import { StatusPills, type PillTone } from "@/components/ui/status-pills";
import { Tooltip } from "@/components/ui/tooltip";
import { UserProfile } from "@/components/ui/user-profile";
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
import type { JobOptionsResponse } from "@/lib/jobs/types";
import { emptyPagination, LIST_PAGE_LIMIT, listQueryString } from "@/lib/pagination";
import { queryKeys } from "@/lib/query/query-keys";

const emptyStats: InterviewBoardStats = { total: 0, scheduled: 0, today: 0, tomorrow: 0, overdue: 0 };
const emptyInterviews: InterviewListItem[] = [];

interface Department {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
  departmentId: string;
}

interface DepartmentResponse {
  data: { departments: Department[] };
}

interface RoleResponse {
  data: { roles: Role[] };
}

const STATUS_OPTIONS: Array<{ value: InterviewStatus | "overdue" | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No-show" },
  { value: "cancelled", label: "Cancelled" },
];

function statusLabel(status: DisplayStatus) {
  switch (status) {
    case "no_show":
      return "No-show";
    case "scheduled":
      return "Scheduled";
    case "overdue":
      return "Overdue";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function statusTone(status: DisplayStatus): PillTone {
  switch (status) {
    case "completed":
      return "success";
    case "overdue":
      return "danger";
    case "cancelled":
      return "neutral";
    case "no_show":
      return "warning";
    case "scheduled":
      return "info";
    default:
      return "neutral";
  }
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

export function InterviewsManager() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const pendingRequested = searchParams.get("pending") === "1";
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [jobId, setJobId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState("");
  const [bucket, setBucket] = useState("");
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(pendingRequested);
  const [consumedPending, setConsumedPending] = useState(pendingRequested);
  const [rescheduleTarget, setRescheduleTarget] = useState<InterviewListItem | null>(null);
  const [noteTarget, setNoteTarget] = useState<InterviewListItem | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    interview: InterviewListItem;
    action: "cancel" | "no_show" | "mark_complete";
  } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const filters = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      jobId: jobId || undefined,
      roleId: roleId || undefined,
      status: status || undefined,
      bucket: bucket || undefined,
      page,
      limit: LIST_PAGE_LIMIT,
    }),
    [bucket, debouncedQuery, jobId, page, roleId, status],
  );

  const listQuery = useQuery({
    queryKey: queryKeys.interviews.list(filters),
    queryFn: async () => apiRequest<InterviewsBoardResponse>(`/interviews${listQueryString(filters)}`),
    placeholderData: keepPreviousData,
  });

  const jobsQuery = useQuery({
    queryKey: queryKeys.jobs.options,
    queryFn: async () => apiRequest<JobOptionsResponse>("/jobs/options"),
  });

  const rolesQuery = useQuery({
    queryKey: queryKeys.jobRoles.list,
    queryFn: async () => {
      const [departments, roles] = await Promise.all([
        apiRequest<DepartmentResponse>("/departments"),
        apiRequest<RoleResponse>("/roles"),
      ]);
      return {
        departments: departments.data.departments,
        roles: roles.data.roles,
      };
    },
  });

  const pendingQuery = useQuery({
    queryKey: queryKeys.interviews.pendingLinks,
    queryFn: async () => apiRequest<PendingLinksResponse>("/department-links/pending"),
  });

  const interviews = listQuery.data?.data.interviews ?? emptyInterviews;
  const stats = listQuery.data?.data.stats ?? emptyStats;
  const pagination = listQuery.data?.data.pagination ?? emptyPagination(page);
  const jobs = jobsQuery.data?.data.jobs ?? [];
  const jobOptions = [{ value: "", label: "All jobs" }, ...jobs.map((job) => ({ value: job.id, label: job.title }))];
  const roleOptions = useMemo(() => {
    const roles = rolesQuery.data?.roles ?? [];
    const departments = rolesQuery.data?.departments ?? [];
    const departmentName = new Map(departments.map((department) => [department.id, department.name]));
    const nameCounts = new Map<string, number>();
    for (const role of roles) {
      nameCounts.set(role.name, (nameCounts.get(role.name) ?? 0) + 1);
    }
    const sorted = [...roles].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return [
      { value: "", label: "All roles" },
      ...sorted.map((role) => {
        const dept = departmentName.get(role.departmentId);
        const label =
          (nameCounts.get(role.name) ?? 0) > 1 && dept ? `${role.name} (${dept})` : role.name;
        return { value: role.id, label };
      }),
    ];
  }, [rolesQuery.data]);

  const hasPending = (pendingQuery.data?.data.requests.length ?? 0) > 0;
  const liveNoteTarget = noteTarget
    ? (interviews.find((item) => item.id === noteTarget.id) ?? noteTarget)
    : null;

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

  const noteMutation = useMutation({
    mutationFn: async ({ interviewId, content }: { interviewId: string; content: string }) =>
      apiRequest<InterviewResponse>(`/interviews/${interviewId}/notes`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSuccess: (result, variables) => {
      alerts.success("Note added.");
      invalidateBoard();
      setNoteTarget((current) =>
        current && current.id === variables.interviewId
          ? { ...current, notes: result.data.interview.notes }
          : current,
      );
    },
    onError: (error) => alerts.error(errorMessage(error, "Note could not be saved.")),
  });

  const pageCount = Math.max(1, pagination.pages);
  if (page > pageCount) {
    setPage(pageCount);
  }
  if (pendingRequested && !consumedPending) {
    setConsumedPending(true);
    setInviteOpen(true);
  } else if (!pendingRequested && consumedPending) {
    setConsumedPending(false);
  }

  function toggleBucket(next: string) {
    setBucket((current) => (current === next ? "" : next));
    setPage(1);
  }

  return (
    <div className="min-h-full p-4 text-gray-900 sm:p-6 md:p-8 dark:text-gray-100">
      <div className="w-full space-y-6">
        <section aria-label="Interview metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <MetricCard icon={ClipboardList} label="Total interviews" supporting="All statuses" value={stats.total} />
          <button className="h-full w-full text-left" onClick={() => toggleBucket("scheduled")} type="button">
            <MetricCard icon={CalendarClock} label="Scheduled" supporting={bucket === "scheduled" ? "Filter on" : "Open interviews"} value={stats.scheduled} />
          </button>
          <button className="h-full w-full text-left" onClick={() => toggleBucket("today")} type="button">
            <MetricCard
              icon={CalendarDays}
              label="Today"
              supporting={`${stats.tomorrow} scheduled tomorrow`}
              value={stats.today}
            />
          </button>
          <button className="h-full w-full text-left" onClick={() => toggleBucket("overdue")} type="button">
            <MetricCard icon={TriangleAlert} label="Overdue" supporting={bucket === "overdue" ? "Filter on" : "Date has passed"} value={stats.overdue} />
          </button>
        </section>

        <section>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search interviews</span>
                <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  className="h-12 w-full rounded-xl border border-gray-300 bg-white pl-12 pr-4 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by candidate, email, phone, job, or label…"
                  value={query}
                />
              </label>
              <FilterSheet active={Boolean(jobId || roleId || status)} title="Interview filters" triggerSize="md">
                <FilterField label="Job">
                  <Dropdown
                    aria-label="Filter by job"
                    className="w-full"
                    onChange={(next) => {
                      setJobId(next);
                      setPage(1);
                    }}
                    options={jobOptions}
                    size="md"
                    value={jobId}
                  />
                </FilterField>
                <FilterField label="Role">
                  <Dropdown
                    aria-label="Filter by role"
                    className="w-full"
                    onChange={(next) => {
                      setRoleId(next);
                      setPage(1);
                    }}
                    options={roleOptions}
                    size="md"
                    value={roleId}
                  />
                </FilterField>
                <FilterField label="Status">
                  <Dropdown
                    aria-label="Filter by status"
                    className="w-full"
                    onChange={(next) => {
                      setStatus(next);
                      setPage(1);
                    }}
                    options={STATUS_OPTIONS}
                    size="md"
                    value={status}
                  />
                </FilterField>
              </FilterSheet>
            </div>
            <div className="hidden md:contents">
              <Dropdown
                aria-label="Filter by job"
                className="w-full xl:w-52"
                onChange={(next) => {
                  setJobId(next);
                  setPage(1);
                }}
                options={jobOptions}
                size="md"
                value={jobId}
              />
              <Dropdown
                aria-label="Filter by role"
                className="w-full xl:w-52"
                onChange={(next) => {
                  setRoleId(next);
                  setPage(1);
                }}
                options={roleOptions}
                size="md"
                value={roleId}
              />
              <Dropdown
                aria-label="Filter by status"
                className="w-full xl:w-48"
                onChange={(next) => {
                  setStatus(next);
                  setPage(1);
                }}
                options={STATUS_OPTIONS}
                size="md"
                value={status}
              />
            </div>
            <button
              aria-label={hasPending ? "Invitation, pending requests" : "Invitation"}
              className="relative inline-flex h-12 shrink-0 items-center justify-center gap-2 overflow-visible rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              onClick={() => setInviteOpen(true)}
              type="button"
            >
              {hasPending ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_2px_rgba(251,191,36,0.75),0_0_12px_4px_rgba(251,191,36,0.4)]"
                />
              ) : null}
              <UserPlus aria-hidden className="h-4 w-4" />
              Invitation
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
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
                  {debouncedQuery || jobId || roleId || status || bucket ? "No interviews match your filters" : "No interviews yet"}
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
                      <th className="px-4 py-3">Label</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {interviews.map((interview) => (
                      <tr className="align-top hover:bg-gray-50/80 dark:hover:bg-gray-900/40" key={interview.id}>
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/applications/${interview.applicationId}`}>
                            <UserProfile email={interview.candidateEmail} name={interview.candidateName} />
                          </Link>
                        </td>
                        <td className="max-w-[220px] px-4 py-3 align-middle">
                          <span className="inline-flex max-w-full items-center gap-2 text-gray-700 dark:text-gray-200">
                            <Briefcase aria-hidden className="h-4 w-4 shrink-0 text-gray-400" />
                            <span className="truncate">{interview.jobTitle}</span>
                          </span>
                        </td>
                        <td className="max-w-[180px] px-4 py-3 align-middle">
                          <span className="block truncate font-medium text-gray-800 dark:text-gray-100">{interview.label}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle">
                          <span className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <Phone aria-hidden className="h-4 w-4 shrink-0 text-gray-400" />
                            {interview.candidatePhone || "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                          {formatInterviewWhen(interview.date, interview.time)}
                          <span className="mt-0.5 block text-xs text-gray-400">{interview.durationMinutes} min</span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <StatusPills
                            items={[{ label: statusLabel(interview.displayStatus), tone: statusTone(interview.displayStatus) }]}
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle">
                          <div className="flex flex-nowrap items-center gap-1">
                            <InterviewActions
                              actions={interview.actions}
                              disabledReasons={completeDisabledReasons(interview.notes.length)}
                              pendingAction={
                                actionMutation.isPending && actionMutation.variables?.interviewId === interview.id
                                  ? actionMutation.variables.action
                                  : undefined
                              }
                              onAction={(action) => {
                                if (action === "reschedule") setRescheduleTarget(interview);
                                else if (action === "cancel" || action === "no_show" || action === "mark_complete") {
                                  if (action === "mark_complete" && interview.notes.length === 0) {
                                    alerts.error(COMPLETE_NOTE_REQUIRED);
                                    return;
                                  }
                                  setConfirmTarget({ interview, action });
                                } else actionMutation.mutate({ interviewId: interview.id, action });
                              }}
                            />
                            <Tooltip label={notesWriteLocked(interview.status) ? "View notes" : "Add note"}>
                              <button
                                aria-label={notesWriteLocked(interview.status) ? "View notes" : "Add note"}
                                className="icon-button"
                                onClick={() => setNoteTarget(interview)}
                                type="button"
                              >
                                <FilePlus aria-hidden className="h-4 w-4" />
                              </button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
          {listQuery.isSuccess && pagination.total > 0 ? (
            <div className="mt-4">
              <PaginationBar onPageChange={setPage} pagination={pagination} />
            </div>
          ) : null}
        </section>
      </div>

      {inviteOpen ? <InviteInterviewersModal onClose={() => setInviteOpen(false)} /> : null}
      {confirmTarget ? (
        <InterviewActionConfirmModal
          action={confirmTarget.action}
          candidateName={confirmTarget.interview.candidateName}
          pending={actionMutation.isPending}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() =>
            actionMutation.mutate(
              { interviewId: confirmTarget.interview.id, action: confirmTarget.action },
              { onSuccess: () => setConfirmTarget(null) },
            )
          }
        />
      ) : null}
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
      {liveNoteTarget ? (
        <InterviewNoteModal
          candidateName={liveNoteTarget.candidateName}
          locked={notesWriteLocked(liveNoteTarget.status)}
          notes={liveNoteTarget.notes}
          onClose={() => setNoteTarget(null)}
          onSubmit={async (content) => {
            await noteMutation.mutateAsync({ interviewId: liveNoteTarget.id, content });
          }}
          pending={noteMutation.isPending}
        />
      ) : null}
    </div>
  );
}
