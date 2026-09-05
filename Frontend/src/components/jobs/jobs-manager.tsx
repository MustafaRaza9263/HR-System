"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CirclePlus,
  Copy,
  Eye,
  FolderOpen,
  Pencil,
  Search,
  Trash2,
  UsersRound,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DateTimeDisplay } from "@/components/ui/date-time-display";
import { Dropdown } from "@/components/ui/dropdown";
import { FilterField, FilterSheet } from "@/components/ui/filter-sheet";
import { MetricCard } from "@/components/ui/metric-card";
import { Modal } from "@/components/ui/modal";
import { PaginationBar } from "@/components/ui/pagination";
import { StatusPills, type PillTone } from "@/components/ui/status-pills";
import { alerts } from "@/lib/alerts";
import { ApiClientError, apiRequest, pendingApplicationsCloseCount } from "@/lib/api";
import type { Job, JobListItem, JobStats, JobsListResponse } from "@/lib/jobs/types";
import { emptyPagination, LIST_PAGE_LIMIT, listQueryString } from "@/lib/pagination";
import { queryKeys } from "@/lib/query/query-keys";

interface Department {
  id: string;
  name: string;
  status: "active" | "inactive";
}

interface Role {
  id: string;
  name: string;
  departmentId: string;
  status: "active" | "inactive";
}

interface DepartmentResponse {
  data: { departments: Department[] };
}

interface RoleResponse {
  data: { roles: Role[] };
}

interface JobMutationResponse {
  data: { job: Job };
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    const fieldMessage = error.fields ? Object.values(error.fields).flat().find(Boolean) : undefined;
    return fieldMessage ?? error.message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function statusLabel(status: Job["status"]) {
  switch (status) {
    case "draft":
      return "Draft";
    case "open":
      return "Open";
    case "closed":
      return "Closed";
  }
}

function statusTone(status: Job["status"]): PillTone {
  switch (status) {
    case "open":
      return "success";
    case "draft":
      return "warning";
    case "closed":
      return "neutral";
  }
}

const emptyJobs: JobListItem[] = [];
const emptyStats: JobStats = {
  totalJobs: 0,
  totalOpened: 0,
  averageApplicants: 0,
  totalClosed: 0,
};

export function JobsManager() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [closeTarget, setCloseTarget] = useState<JobListItem | null>(null);
  const [closePendingCount, setClosePendingCount] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JobListItem | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const filters = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      departmentId: departmentId || undefined,
      roleId: roleId || undefined,
      status: status || undefined,
      page,
      limit: LIST_PAGE_LIMIT,
    }),
    [debouncedQuery, departmentId, page, roleId, status],
  );

  const jobsQuery = useQuery({
    queryKey: queryKeys.jobs.list(filters),
    queryFn: async () => apiRequest<JobsListResponse>(`/jobs${listQueryString(filters)}`),
    placeholderData: keepPreviousData,
  });

  const metaQuery = useQuery({
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

  const jobs = jobsQuery.data?.data.jobs ?? emptyJobs;
  const stats = jobsQuery.data?.data.stats ?? emptyStats;
  const pagination = jobsQuery.data?.data.pagination ?? emptyPagination(page);
  const departments = metaQuery.data?.departments ?? [];

  const filteredRoles = useMemo(() => {
    const roles = metaQuery.data?.roles ?? [];
    if (!departmentId) return roles;
    return roles.filter((role) => role.departmentId === departmentId);
  }, [metaQuery.data?.roles, departmentId]);

  const departmentOptions = [
    { value: "", label: "All departments" },
    ...departments.map((department) => ({ value: department.id, label: department.name })),
  ];
  const roleOptions = [
    { value: "", label: "All roles" },
    ...filteredRoles.map((role) => ({ value: role.id, label: role.name })),
  ];
  const statusOptions = [
    { value: "", label: "All statuses" },
    { value: "open", label: "Open" },
    { value: "closed", label: "Closed" },
    { value: "draft", label: "Draft" },
  ];

  const closeMutation = useMutation({
    mutationFn: async ({ jobId, closeReason }: { jobId: string; closeReason: string }) => {
      const result = await apiRequest<JobMutationResponse>(`/jobs/${jobId}/close`, {
        method: "POST",
        body: JSON.stringify({ closeReason }),
      });
      return result.data.job;
    },
    onSuccess: () => {
      setCloseTarget(null);
      setClosePendingCount(null);
      alerts.success("Job closed.");
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
    onError: (error) => {
      const count = pendingApplicationsCloseCount(error);
      setClosePendingCount(count);
      if (count === null) alerts.error(errorMessage(error, "Job could not be closed."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await apiRequest<void>(`/jobs/${jobId}`, { method: "DELETE" });
      return jobId;
    },
    onSuccess: () => {
      setDeleteTarget(null);
      alerts.success("Draft job deleted.");
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
    onError: (error) => alerts.error(errorMessage(error, "Job could not be deleted.")),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const result = await apiRequest<JobMutationResponse>(`/jobs/${jobId}/duplicate`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      return result.data.job;
    },
    onSuccess: (job) => {
      alerts.success("Job duplicated as draft.");
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      router.push(`/dashboard/jobs/${job.id}/edit`);
    },
    onError: (error) => alerts.error(errorMessage(error, "Job could not be duplicated.")),
  });

  const pageCount = Math.max(1, pagination.pages);
  if (page > pageCount) {
    setPage(pageCount);
  }

  return (
    <div className="min-h-full p-4 text-gray-900 sm:p-6 md:p-8 dark:text-gray-100">
      <div className="w-full space-y-6">
        <section aria-label="Job metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <MetricCard icon={BriefcaseBusiness} label="Total jobs" supporting="All statuses" value={stats.totalJobs} />
          <MetricCard icon={FolderOpen} label="Total opened jobs" supporting="Currently accepting applications" value={stats.totalOpened} />
          <MetricCard icon={UsersRound} label="Average applicants on a job" supporting="Across all jobs" value={stats.averageApplicants} />
          <MetricCard icon={XCircle} label="Total closed jobs" supporting="Manually closed postings" value={stats.totalClosed} />
        </section>

        <section aria-labelledby="jobs-table-title">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search jobs</span>
                <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  className="h-12 w-full rounded-xl border border-gray-300 bg-white pl-12 pr-4 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by title, description, or job id…"
                  value={query}
                />
              </label>
              <FilterSheet active={Boolean(departmentId || roleId || status)} title="Job filters" triggerSize="md">
                <FilterField label="Department">
                  <Dropdown
                    aria-label="Filter by department"
                    className="w-full"
                    onChange={(next) => {
                      setDepartmentId(next);
                      setRoleId("");
                      setPage(1);
                    }}
                    options={departmentOptions}
                    size="md"
                    value={departmentId}
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
                    options={statusOptions}
                    size="md"
                    value={status}
                  />
                </FilterField>
              </FilterSheet>
            </div>
            <div className="hidden md:contents">
              <Dropdown
                aria-label="Filter by department"
                className="w-full xl:w-48"
                onChange={(next) => {
                  setDepartmentId(next);
                  setRoleId("");
                  setPage(1);
                }}
                options={departmentOptions}
                size="md"
                value={departmentId}
              />
              <Dropdown
                aria-label="Filter by role"
                className="w-full xl:w-48"
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
                className="w-full xl:w-44"
                onChange={(next) => {
                  setStatus(next);
                  setPage(1);
                }}
                options={statusOptions}
                size="md"
                value={status}
              />
            </div>
            <Link
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              href="/dashboard/jobs/new"
            >
              <CirclePlus aria-hidden className="h-4 w-4" />
              Create job
            </Link>
          </div>

          <h2 className="sr-only" id="jobs-table-title">
            Jobs
          </h2>

          <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            {jobsQuery.isPending ? <LoadingState /> : null}
            {jobsQuery.isError ? <LoadError onRetry={() => void jobsQuery.refetch()} /> : null}
            {jobsQuery.isSuccess && jobs.length === 0 ? (
              <EmptyState hasQuery={Boolean(debouncedQuery || departmentId || roleId || status)} />
            ) : null}
            {jobsQuery.isSuccess && jobs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Created At</th>
                      <th className="px-4 py-3">Applicants</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {jobs.map((job) => (
                      <tr className="hover:bg-gray-50/80 dark:hover:bg-gray-900/40" key={job.id}>
                        <td className="max-w-[220px] truncate px-4 py-3 font-bold text-gray-950 dark:text-white">{job.title}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{job.departmentName ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{job.roleName ?? "—"}</td>
                        <td className="px-4 py-3">
                          <StatusPills items={[{ label: statusLabel(job.status), tone: statusTone(job.status) }]} />
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{job.jobType ?? "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <DateTimeDisplay value={job.createdAt} />
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{job.applicationCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {job.status === "draft" ? (
                              <>
                                <Link
                                  aria-label={`Continue editing ${job.title}`}
                                  className="icon-button"
                                  href={`/dashboard/jobs/${job.id}/edit`}
                                >
                                  <Pencil aria-hidden className="h-4 w-4" />
                                </Link>
                                {job.applicationCount === 0 ? (
                                  <button
                                    aria-label={`Delete ${job.title}`}
                                    className="icon-button"
                                    onClick={() => setDeleteTarget(job)}
                                    type="button"
                                  >
                                    <Trash2 aria-hidden className="h-4 w-4" />
                                  </button>
                                ) : null}
                              </>
                            ) : null}
                            {job.status === "open" ? (
                              <>
                                <Link aria-label={`View ${job.title}`} className="icon-button" href={`/dashboard/jobs/${job.id}`}>
                                  <Eye aria-hidden className="h-4 w-4" />
                                </Link>
                                <button
                                  aria-label={`Close ${job.title}`}
                                  className="icon-button"
                                  onClick={() => {
                                    setClosePendingCount(null);
                                    setCloseTarget(job);
                                  }}
                                  type="button"
                                >
                                  <XCircle aria-hidden className="h-4 w-4" />
                                </button>
                              </>
                            ) : null}
                            {job.status === "closed" ? (
                              <>
                                <Link aria-label={`View ${job.title}`} className="icon-button" href={`/dashboard/jobs/${job.id}`}>
                                  <Eye aria-hidden className="h-4 w-4" />
                                </Link>
                                <button
                                  aria-label={`Duplicate ${job.title}`}
                                  className="icon-button"
                                  disabled={duplicateMutation.isPending}
                                  onClick={() => duplicateMutation.mutate(job.id)}
                                  type="button"
                                >
                                  <Copy aria-hidden className="h-4 w-4" />
                                </button>
                              </>
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
          {jobsQuery.isSuccess && pagination.total > 0 ? (
            <div className="mt-4">
              <PaginationBar onPageChange={setPage} pagination={pagination} />
            </div>
          ) : null}
        </section>
      </div>

      {closeTarget ? (
        <CloseJobModal
          job={closeTarget}
          pending={closeMutation.isPending}
          pendingCount={closePendingCount}
          onCancel={() => {
            setCloseTarget(null);
            setClosePendingCount(null);
          }}
          onConfirm={(closeReason) => closeMutation.mutate({ jobId: closeTarget.id, closeReason })}
        />
      ) : null}
      {deleteTarget ? (
        <DeleteJobModal
          job={deleteTarget}
          pending={deleteMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        />
      ) : null}
    </div>
  );
}

function LoadingState() {
  return (
    <div aria-label="Loading jobs" className="space-y-3 p-4" role="status">
      {[1, 2, 3].map((item) => (
        <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-900" key={item} />
      ))}
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="px-6 py-12 text-center">
      <AlertTriangle aria-hidden className="mx-auto h-8 w-8 text-red-500" />
      <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">Jobs could not be loaded</h3>
      <button className="mt-3 text-sm font-bold text-indigo-600 dark:text-indigo-400" onClick={onRetry} type="button">
        Try again
      </button>
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="px-6 py-16 text-center">
      <BriefcaseBusiness aria-hidden className="mx-auto h-9 w-9 text-gray-400" />
      <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">{hasQuery ? "No jobs match your filters" : "Create your first job"}</h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {hasQuery ? "Try another search or clear filters." : "Publish openings after departments and roles are set up."}
      </p>
      {!hasQuery ? (
        <Link className="mt-4 inline-block text-sm font-bold text-indigo-600 dark:text-indigo-400" href="/dashboard/jobs/new">
          Create job
        </Link>
      ) : null}
    </div>
  );
}

function CloseJobModal({
  job,
  pending,
  pendingCount,
  onCancel,
  onConfirm,
}: {
  job: JobListItem;
  pending: boolean;
  pendingCount: number | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = reason.trim();
    if (!clean) {
      alerts.error("Enter a close reason.");
      return;
    }
    onConfirm(clean);
  }

  return (
    <Modal
      as="form"
      closeDisabled={pending}
      footer={(close) => (
        <div className="grid grid-cols-2 gap-3">
          <button
            className="h-11 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-white"
            disabled={pending}
            onClick={close}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-11 rounded-xl bg-amber-600 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            {pending ? "Closing..." : "Close job"}
          </button>
        </div>
      )}
      onClose={onCancel}
      onSubmit={submit}
      subtitle={
        <>
          Closing <span className="font-semibold text-gray-800 dark:text-gray-200">{job.title}</span> removes it from
          open listings. A reason is required.
        </>
      }
      title="Close job?"
    >
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-200">
          Close reason <span className="text-red-500">*</span>
        </span>
        <textarea
          autoFocus
          className="min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Hiring freeze, role filled externally…"
          value={reason}
        />
      </label>
      {pendingCount ? (
        <p className="mt-3 text-sm font-semibold text-amber-800 dark:text-amber-200">
          {pendingCount} application{pendingCount === 1 ? "" : "s"} still need a decision
        </p>
      ) : null}
    </Modal>
  );
}

function DeleteJobModal({
  job,
  pending,
  onCancel,
  onConfirm,
}: {
  job: JobListItem;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      closeDisabled={pending}
      footer={(close) => (
        <div className="grid grid-cols-2 gap-3">
          <button
            className="h-11 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-white"
            disabled={pending}
            onClick={close}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-11 rounded-xl bg-red-600 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
            disabled={pending}
            onClick={onConfirm}
            type="button"
          >
            {pending ? "Deleting..." : "Delete"}
          </button>
        </div>
      )}
      onClose={onCancel}
      subtitle={
        <>
          This permanently deletes <span className="font-semibold text-gray-800 dark:text-gray-200">{job.title}</span>.
          This cannot be undone.
        </>
      }
      title="Delete draft?"
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
        <Trash2 aria-hidden className="h-5 w-5" />
      </span>
    </Modal>
  );
}
