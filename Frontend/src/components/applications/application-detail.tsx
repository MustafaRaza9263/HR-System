"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, FileText, FlaskConical, XCircle } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { ApplicationInterviews } from "@/components/applications/application-interviews";
import { ApplicationProfile } from "@/components/applications/application-profile";
import {
  applicationStatusLabel,
  applicationStatusTone,
} from "@/components/applications/application-status-timeline";
import { ReasonModal } from "@/components/applications/reason-modal";
import { ResumeViewerModal } from "@/components/applications/resume-viewer-modal";
import { DateTimeDisplay } from "@/components/ui/date-time-display";
import { StatusPills } from "@/components/ui/status-pills";
import { getInitials } from "@/components/ui/user-profile";
import { alerts } from "@/lib/alerts";
import { ApiClientError, apiRequest } from "@/lib/api";
import type { ApplicationDetail as ApplicationDetailModel, ApplicationDetailResponse } from "@/lib/applications/types";
import { queryKeys } from "@/lib/query/query-keys";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

function interviewSummary(application: ApplicationDetailModel) {
  const completed = application.completedInterviewCount;
  const scheduled = application.status === "interview_scheduled";
  if (scheduled && completed > 0) return `${completed} completed · scheduled`;
  if (scheduled) return "Scheduled";
  if (completed === 1) return "1 completed";
  if (completed > 1) return `${completed} completed`;
  return "None";
}

function sourceLabel(application: ApplicationDetailModel) {
  return application.campaign ? `${application.source} · ${application.campaign}` : application.source;
}

export function ApplicationDetail({ applicationId }: { applicationId: string }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"profile" | "interviews">("profile");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: queryKeys.applications.detail(applicationId),
    queryFn: async () => apiRequest<ApplicationDetailResponse>(`/applications/${applicationId}`),
  });

  const application = detailQuery.data?.data.application;
  const canReject = application && application.status !== "rejected" && application.status !== "approved";

  const rejectMutation = useMutation({
    mutationFn: async ({ reason, sendEmail }: { reason: string; sendEmail: boolean }) =>
      apiRequest<ApplicationDetailResponse>(`/applications/${applicationId}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason, sendEmail }),
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

  return (
    <div className="min-h-full bg-gray-50 p-4 text-gray-900 sm:p-6 md:p-8 dark:bg-gray-900 dark:text-gray-100">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-semibold text-gray-600 hover:bg-white hover:text-gray-950 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            href="/dashboard/applications"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Applications
          </Link>
          <span aria-hidden className="text-gray-300 dark:text-gray-600">
            /
          </span>
          <span className="font-medium text-gray-400">Application detail</span>
        </nav>

        {detailQuery.isPending ? (
          <div aria-label="Loading application" className="space-y-4" role="status">
            <div className="h-20 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
            <div className="h-20 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="h-64 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
              <div className="h-48 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
            </div>
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
            <header className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex min-w-0 items-center gap-4">
                <span
                  aria-hidden
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-indigo-100 text-lg font-bold tracking-tight text-indigo-700 dark:bg-[#2a2150] dark:text-indigo-300"
                >
                  {getInitials(application.candidateName)}
                </span>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold tracking-[-0.03em] text-gray-950 dark:text-white">
                    {application.candidateName}
                  </h1>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-gray-500">
                    <a className="font-medium hover:text-indigo-600 hover:underline dark:hover:text-indigo-400" href={`mailto:${application.candidateEmail}`}>
                      {application.candidateEmail}
                    </a>
                    {application.candidatePhone ? (
                      <>
                        <span aria-hidden className="text-gray-300 dark:text-gray-600">
                          ·
                        </span>
                        <a className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400" href={`tel:${application.candidatePhone}`}>
                          {application.candidatePhone}
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start gap-2 sm:items-end sm:text-right">
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <StatusPills
                    items={[{ label: applicationStatusLabel(application.status), tone: applicationStatusTone(application.status) }]}
                  />
                  {canReject ? (
                    <button
                      className="h-8 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10"
                      onClick={() => setRejectOpen(true)}
                      type="button"
                    >
                      Reject
                    </button>
                  ) : null}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Applied for</p>
                  <Link
                    className="mt-0.5 block text-sm font-semibold text-gray-950 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
                    href={`/dashboard/jobs/${application.jobId}`}
                  >
                    {application.roleSnapshot.title}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {application.roleSnapshot.departmentName} · {application.roleSnapshot.roleName}
                  </p>
                </div>
              </div>
            </header>

            <section
              aria-label="Application summary"
              className="grid grid-cols-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:grid-cols-4 dark:border-gray-700 dark:bg-gray-800/70"
            >
              <QuickFact label="Applied">
                <DateTimeDisplay value={application.createdAt} />
              </QuickFact>
              <QuickFact label="Source">
                <span className="text-sm font-semibold text-gray-950 dark:text-white">{sourceLabel(application)}</span>
              </QuickFact>
              <QuickFact label="Interviews">
                <span className="text-sm font-semibold text-gray-950 dark:text-white">{interviewSummary(application)}</span>
              </QuickFact>
              <QuickFact label="Resume">
                {application.hasResume ? (
                  <button
                    className="inline-flex items-center gap-1.5 text-left text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                    onClick={() => setResumeOpen(true)}
                    type="button"
                  >
                    <FileText aria-hidden className="h-4 w-4 shrink-0" />
                    <span className="break-all">{application.resumeFileName}</span>
                  </button>
                ) : (
                  <span className="text-sm font-semibold text-gray-950 dark:text-white">—</span>
                )}
              </QuickFact>
            </section>

            <DecisionBanner application={application} />

            <div className="flex gap-6 border-b border-gray-200 dark:border-gray-700" role="tablist" aria-label="Application sections">
              <TabButton active={tab === "profile"} onClick={() => setTab("profile")}>
                Profile
              </TabButton>
              <TabButton active={tab === "interviews"} onClick={() => setTab("interviews")}>
                Interviews
              </TabButton>
            </div>

            {tab === "interviews" ? (
              <ApplicationInterviews
                applicant={{ name: application.candidateName, email: application.candidateEmail }}
                applicationId={application.id}
                canSchedule={application.status !== "rejected" && application.status !== "approved"}
              />
            ) : (
              <ApplicationProfile application={application} />
            )}
          </>
        ) : null}
      </div>

      {rejectOpen ? (
        <ReasonModal
          confirmLabel="Reject"
          description="Any scheduled interviews will be cancelled."
          pending={rejectMutation.isPending}
          title="Reject application?"
          onCancel={() => setRejectOpen(false)}
          onConfirm={(reason, sendEmail) => rejectMutation.mutate({ reason, sendEmail })}
        />
      ) : null}

      {resumeOpen && application ? (
        <ResumeViewerModal
          applicationId={application.id}
          candidateEmail={application.candidateEmail}
          candidateName={application.candidateName}
          resumeFileName={application.resumeFileName}
          onClose={() => setResumeOpen(false)}
        />
      ) : null}
    </div>
  );
}

function QuickFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-gray-200 px-5 py-4 max-lg:odd:border-r max-lg:[&:nth-child(-n+2)]:border-b lg:border-r lg:last:border-r-0 dark:border-gray-700">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={`-mb-px border-b-2 px-1 pb-2.5 text-sm font-bold ${
        active
          ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
          : "border-transparent text-gray-500 hover:text-gray-950 dark:hover:text-white"
      }`}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {children}
    </button>
  );
}

function DecisionBanner({ application }: { application: ApplicationDetailModel }) {
  if (application.status === "approved") {
    return (
      <section className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <p className="text-[15px] font-bold text-gray-950 dark:text-white">Approved</p>
          {application.decisionReason ? (
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{application.decisionReason}</p>
          ) : null}
          {application.approvedAt ? <DateTimeDisplay className="mt-1.5" size="sm" value={application.approvedAt} /> : null}
        </div>
      </section>
    );
  }

  if (application.status === "rejected") {
    return (
      <section className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 dark:border-red-500/30 dark:bg-red-500/10">
        <XCircle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <div>
          <p className="text-[15px] font-bold text-gray-950 dark:text-white">Rejected</p>
          {application.rejectionReason ? (
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{application.rejectionReason}</p>
          ) : null}
          {application.rejectedAt ? <DateTimeDisplay className="mt-1.5" size="sm" value={application.rejectedAt} /> : null}
        </div>
      </section>
    );
  }

  if (application.status === "trial") {
    return (
      <section className="flex gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 dark:border-violet-500/30 dark:bg-violet-500/10">
        <FlaskConical aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
        <div>
          <p className="text-[15px] font-bold text-gray-950 dark:text-white">Trial</p>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">This candidate is on a trial.</p>
          {application.trialAt ? <DateTimeDisplay className="mt-1.5" size="sm" value={application.trialAt} /> : null}
        </div>
      </section>
    );
  }

  return null;
}
