"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Copy,
  Pencil,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { RichTextViewer } from "@/components/jobs/rich-text-viewer";
import { Modal } from "@/components/ui/modal";
import { alerts } from "@/lib/alerts";
import { ApiClientError, apiRequest } from "@/lib/api";
import type { Job, JobResponse } from "@/lib/jobs/types";
import { queryKeys } from "@/lib/query/query-keys";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    const fieldMessage = error.fields ? Object.values(error.fields).flat().find(Boolean) : undefined;
    return fieldMessage ?? error.message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function statusBadgeClass(status: Job["status"]) {
  switch (status) {
    case "open":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "draft":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
    case "closed":
      return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    case "filled":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export function JobDetail({ jobId }: { jobId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");

  const jobQuery = useQuery({
    queryKey: queryKeys.jobs.detail(jobId),
    queryFn: async () => apiRequest<JobResponse>(`/jobs/${jobId}`),
  });

  const closeMutation = useMutation({
    mutationFn: async (reason: string) =>
      apiRequest<JobResponse>(`/jobs/${jobId}/close`, {
        method: "POST",
        body: JSON.stringify({ closeReason: reason }),
      }),
    onSuccess: (result) => {
      setCloseOpen(false);
      alerts.success("Job closed.");
      queryClient.setQueryData(queryKeys.jobs.detail(jobId), result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
    onError: (error) => alerts.error(errorMessage(error, "Job could not be closed.")),
  });

  const duplicateMutation = useMutation({
    mutationFn: async () =>
      apiRequest<JobResponse>(`/jobs/${jobId}/duplicate`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: (result) => {
      alerts.success("Job duplicated as draft.");
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      router.push(`/dashboard/jobs/${result.data.job.id}/edit`);
    },
    onError: (error) => alerts.error(errorMessage(error, "Job could not be duplicated.")),
  });

  if (jobQuery.isPending) {
    return (
      <div className="p-8">
        <div className="mx-auto h-40 max-w-3xl animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
      </div>
    );
  }

  if (jobQuery.isError || !jobQuery.data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm font-bold">Job could not be loaded.</p>
        <Link className="mt-3 inline-block text-sm font-bold text-indigo-600" href="/dashboard/jobs">
          Back to jobs
        </Link>
      </div>
    );
  }

  const job = jobQuery.data.data.job;

  return (
    <div className="min-h-full bg-gray-50 p-4 text-gray-900 sm:p-6 md:p-8 dark:bg-gray-900 dark:text-gray-100">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            href="/dashboard/jobs"
          >
            <ArrowLeft className="h-4 w-4" />
            Jobs
          </Link>
          <div className="flex flex-wrap gap-2">
            {job.status === "draft" ? (
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white"
                href={`/dashboard/jobs/${job.id}/edit`}
              >
                <Pencil className="h-4 w-4" />
                Continue editing
              </Link>
            ) : null}
            {job.status === "open" ? (
              <button
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-300 px-4 text-sm font-bold text-amber-700 dark:border-amber-500/40 dark:text-amber-400"
                onClick={() => setCloseOpen(true)}
                type="button"
              >
                <XCircle className="h-4 w-4" />
                Close
              </button>
            ) : null}
            {job.status === "filled" || job.status === "closed" ? (
              <button
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-300 px-4 text-sm font-bold dark:border-gray-600"
                disabled={duplicateMutation.isPending}
                onClick={() => duplicateMutation.mutate()}
                type="button"
              >
                <Copy className="h-4 w-4" />
                Duplicate job
              </button>
            ) : null}
          </div>
        </div>

        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(job.status)}`}>
                {job.status}
              </span>
              <h1 className="mt-3 text-2xl font-bold text-gray-950 dark:text-white">{job.title}</h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {job.departmentName} · {job.roleName}
                {job.slug ? ` · /${job.slug}` : ""}
              </p>
            </div>
            <p className="text-xs text-gray-500">
              Created {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
            </p>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <DetailItem label="Job type" value={job.jobType ?? "—"} />
            <DetailItem label="Positions" value={`${job.positionsFilled}/${job.positionsAvailable}`} />
            <DetailItem
              label="Salary"
              value={
                job.salaryMin !== null && job.salaryMax !== null
                  ? `${job.salaryMin} – ${job.salaryMax}`
                  : "—"
              }
            />
            <DetailItem label="Applicants" value={String(job.applicationCount)} />
            <DetailItem label="Job id" value={job.id} />
            {job.closeReason ? <DetailItem label="Close reason" value={job.closeReason} /> : null}
          </dl>

          <div className="mt-6 border-t border-gray-100 pt-5 dark:border-gray-800">
            <h2 className="text-sm font-bold">Description</h2>
            <div className="mt-3">
              <RichTextViewer value={job.description} />
            </div>
          </div>

          {job.fieldsConfig.customFields.length > 0 ? (
            <div className="mt-6 border-t border-gray-100 pt-5 dark:border-gray-800">
              <h2 className="text-sm font-bold">Custom application fields</h2>
              <ul className="mt-3 space-y-2">
                {job.fieldsConfig.customFields.map((field) => (
                  <li className="rounded-xl bg-gray-50 px-4 py-3 text-sm dark:bg-gray-900/60" key={field.id}>
                    <span className="font-bold text-gray-900 dark:text-white">{field.label}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {field.type} · {field.section}
                      {field.required ? " · required" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      </div>

      {closeOpen ? (
        <Modal
          as="form"
          closeDisabled={closeMutation.isPending}
          footer={(close) => (
            <div className="grid grid-cols-2 gap-3">
              <button
                className="h-11 rounded-xl border border-gray-300 text-sm font-bold dark:border-gray-600"
                disabled={closeMutation.isPending}
                onClick={close}
                type="button"
              >
                Cancel
              </button>
              <button
                className="h-11 rounded-xl bg-amber-600 text-sm font-bold text-white disabled:opacity-50"
                disabled={closeMutation.isPending}
                type="submit"
              >
                {closeMutation.isPending ? "Closing..." : "Close job"}
              </button>
            </div>
          )}
          onClose={() => setCloseOpen(false)}
          onSubmit={(event) => {
            event.preventDefault();
            const clean = closeReason.trim();
            if (!clean) {
              alerts.error("Enter a close reason.");
              return;
            }
            closeMutation.mutate(clean);
          }}
          subtitle="A close reason is required."
          title="Close job?"
        >
          <textarea
            autoFocus
            className="min-h-24 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            onChange={(event) => setCloseReason(event.target.value)}
            value={closeReason}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}
