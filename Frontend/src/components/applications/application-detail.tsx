"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ApplicationInterviews } from "@/components/applications/application-interviews";
import { ReasonModal } from "@/components/applications/reason-modal";
import { alerts } from "@/lib/alerts";
import { ApiClientError, apiDownload, apiRequest } from "@/lib/api";
import type { ApplicationAnswer, ApplicationDetailResponse, ApplicationStatus } from "@/lib/applications/types";
import { queryKeys } from "@/lib/query/query-keys";

function statusBadgeClass(status: ApplicationStatus) {
  switch (status) {
    case "submitted":
      return "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400";
    case "under_review":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
    case "interview_scheduled":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300";
    case "interviewed":
      return "bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300";
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

function formatAnswerValue(answer: ApplicationAnswer) {
  if (answer.type === "checkbox") return answer.value === true ? "Yes" : "No";
  if (answer.value === null || answer.value === undefined || answer.value === "") return "—";
  return String(answer.value);
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

export function ApplicationDetail({ applicationId }: { applicationId: string }) {
  const queryClient = useQueryClient();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [tab, setTab] = useState<"profile" | "interviews">("profile");
  const [rejectOpen, setRejectOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: queryKeys.applications.detail(applicationId),
    queryFn: async () => apiRequest<ApplicationDetailResponse>(`/applications/${applicationId}`),
  });

  const application = detailQuery.data?.data.application;
  const experienceEntries = application?.experienceEntries ?? [];
  const educationEntries = application?.educationEntries ?? [];
  const canReject = application && application.status !== "rejected" && application.status !== "approved";

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) =>
      apiRequest<ApplicationDetailResponse>(`/applications/${applicationId}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.applications.detail(applicationId), result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.interviews(applicationId) });
      setRejectOpen(false);
      alerts.success("Application rejected.");
    },
    onError: (error) => {
      alerts.error(errorMessage(error, "Application could not be rejected."));
    },
  });

  async function download(path: string, filename: string, key: string) {
    setDownloading(key);
    try {
      await apiDownload(path, filename);
    } catch (error) {
      alerts.error(errorMessage(error, "File could not be downloaded."));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="min-h-full bg-gray-50 p-4 text-gray-900 sm:p-6 md:p-8 dark:bg-gray-900 dark:text-gray-100">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white"
          href="/dashboard/applications"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Applications
        </Link>

        {detailQuery.isPending ? (
          <div aria-label="Loading application" className="space-y-4" role="status">
            <div className="h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
            <div className="h-64 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
          </div>
        ) : null}

        {detailQuery.isError ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-800/70">
            <h1 className="text-lg font-bold">Application not found</h1>
            <p className="mt-2 text-sm text-gray-500">It may have been removed, or the link is incorrect.</p>
          </div>
        ) : null}

        {application ? (
          <>
            <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-800/70">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold tracking-[-0.03em] text-gray-950 dark:text-white">
                    {application.candidateName}
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    Applied {formatDistanceToNow(new Date(application.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(application.status)}`}>
                  {application.status.replaceAll("_", " ")}
                </span>
              </div>
              {canReject ? (
                <button
                  className="mt-4 h-10 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:bg-transparent dark:text-red-300"
                  onClick={() => setRejectOpen(true)}
                  type="button"
                >
                  Reject
                </button>
              ) : null}

              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Email</dt>
                  <dd className="mt-1 text-sm font-medium">{application.candidateEmail}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Phone</dt>
                  <dd className="mt-1 text-sm font-medium">{application.candidatePhone}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Job</dt>
                  <dd className="mt-1 text-sm font-medium">
                    <Link className="text-indigo-600 hover:underline dark:text-indigo-400" href={`/dashboard/jobs/${application.jobId}`}>
                      {application.roleSnapshot.title}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Department / role</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {application.roleSnapshot.departmentName} / {application.roleSnapshot.roleName}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Source</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {application.source}
                    {application.campaign ? ` · ${application.campaign}` : ""}
                  </dd>
                </div>
                {application.rejectionReason ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Rejection reason</dt>
                    <dd className="mt-1 text-sm font-medium">{application.rejectionReason}</dd>
                  </div>
                ) : null}
              </dl>

              {application.hasResume ? (
                <button
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
                  disabled={downloading === "resume"}
                  onClick={() =>
                    void download(
                      `/applications/${application.id}/resume`,
                      application.resumeFileName,
                      "resume",
                    )
                  }
                  type="button"
                >
                  <Download aria-hidden className="h-4 w-4" />
                  {downloading === "resume" ? "Downloading…" : `Resume · ${application.resumeFileName}`}
                </button>
              ) : null}
            </header>

            <div className="flex gap-2">
              <button
                className={`h-10 rounded-xl px-4 text-sm font-bold ${tab === "profile" ? "bg-indigo-600 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700"}`}
                onClick={() => setTab("profile")}
                type="button"
              >
                Profile
              </button>
              <button
                className={`h-10 rounded-xl px-4 text-sm font-bold ${tab === "interviews" ? "bg-indigo-600 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700"}`}
                onClick={() => setTab("interviews")}
                type="button"
              >
                Interviews
              </button>
            </div>

            {tab === "interviews" ? (
              <ApplicationInterviews
                applicant={{ name: application.candidateName, email: application.candidateEmail }}
                applicationId={application.id}
                canSchedule={application.status !== "rejected" && application.status !== "approved"}
              />
            ) : (
              <>
            {application.answers.some((item) => item.section === "personal") ? (
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-800/70">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Personal</h2>
                <dl className="mt-4 space-y-4">
                  {application.answers
                    .filter((item) => item.section === "personal")
                    .map((answer) => (
                      <AnswerRow
                        answer={answer}
                        applicationId={application.id}
                        downloading={downloading}
                        key={answer.fieldId}
                        onDownload={(path, filename, key) => void download(path, filename, key)}
                      />
                    ))}
                </dl>
              </section>
            ) : null}

            {experienceEntries.length > 0 ||
            application.answers.some((item) => item.section === "experience") ? (
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-800/70">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Experience</h2>
                <div className="mt-4 space-y-5">
                  {experienceEntries.map((entry, index) => (
                    <div className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0 dark:border-gray-800" key={`${entry.company}-${index}`}>
                      <p className="text-sm font-bold text-gray-950 dark:text-white">
                        {entry.title} · {entry.company}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {entry.startDate}
                        {" – "}
                        {entry.endDate ?? "Present"}
                      </p>
                      {entry.description ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{entry.description}</p>
                      ) : null}
                    </div>
                  ))}
                  {application.answers
                    .filter((item) => item.section === "experience")
                    .map((answer) => (
                      <dl key={answer.fieldId}>
                        <AnswerRow
                          answer={answer}
                          applicationId={application.id}
                          downloading={downloading}
                          onDownload={(path, filename, key) => void download(path, filename, key)}
                        />
                      </dl>
                    ))}
                </div>
              </section>
            ) : null}

            {educationEntries.length > 0 ||
            application.answers.some((item) => item.section === "education") ? (
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-800/70">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Education</h2>
                <div className="mt-4 space-y-5">
                  {educationEntries.map((entry, index) => (
                    <div className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0 dark:border-gray-800" key={`${entry.school}-${index}`}>
                      <p className="text-sm font-bold text-gray-950 dark:text-white">
                        {entry.degree} · {entry.school}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {[
                          entry.fieldOfStudy,
                          [entry.startDate, entry.endDate].filter(Boolean).join(" – ") || null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  ))}
                  {application.answers
                    .filter((item) => item.section === "education")
                    .map((answer) => (
                      <dl key={answer.fieldId}>
                        <AnswerRow
                          answer={answer}
                          applicationId={application.id}
                          downloading={downloading}
                          onDownload={(path, filename, key) => void download(path, filename, key)}
                        />
                      </dl>
                    ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-800/70">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">AI scoring</h2>
              {application.aiScore === null && !application.aiSummary ? (
                <p className="mt-3 text-sm text-gray-500">Not scored yet</p>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  <p>
                    <span className="font-semibold">Score: </span>
                    {application.aiScore === null ? "Not scored yet" : application.aiScore}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {application.aiSummary ?? "Not scored yet"}
                  </p>
                </div>
              )}
            </section>
              </>
            )}
          </>
        ) : null}
      </div>

      {rejectOpen ? (
        <ReasonModal
          confirmLabel="Reject"
          description="The candidate will be notified. Any scheduled interviews will be cancelled."
          pending={rejectMutation.isPending}
          title="Reject application?"
          onCancel={() => setRejectOpen(false)}
          onConfirm={(reason) => rejectMutation.mutate(reason)}
        />
      ) : null}
    </div>
  );
}

function AnswerRow({
  answer,
  applicationId,
  downloading,
  onDownload,
}: {
  answer: ApplicationAnswer;
  applicationId: string;
  downloading: string | null;
  onDownload: (path: string, filename: string, key: string) => void;
}) {
  return (
    <>
      <dt className="text-sm font-semibold text-gray-700 dark:text-gray-200">{answer.label}</dt>
      <dd className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        {answer.type === "file" && answer.hasFile ? (
          <button
            className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
            disabled={downloading === answer.fieldId}
            onClick={() =>
              onDownload(
                `/applications/${applicationId}/files/${answer.fieldId}`,
                answer.fileName ?? "attachment",
                answer.fieldId,
              )
            }
            type="button"
          >
            <Download aria-hidden className="h-3.5 w-3.5" />
            {downloading === answer.fieldId ? "Downloading…" : (answer.fileName ?? "Download file")}
          </button>
        ) : (
          formatAnswerValue(answer)
        )}
      </dd>
    </>
  );
}
