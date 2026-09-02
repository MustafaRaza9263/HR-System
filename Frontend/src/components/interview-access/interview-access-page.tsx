"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, CalendarClock, Eye, FilePlus, FileText } from "lucide-react";
import { type ReactNode, useState } from "react";

import { COMPLETE_NOTE_REQUIRED, completeDisabledReasons, InterviewActions } from "@/components/applications/application-interviews";
import { ResumeViewerModal } from "@/components/applications/resume-viewer-modal";
import { ApplicationDetailsModal } from "@/components/interview-access/application-details-modal";
import { InterviewAccessHeader } from "@/components/interview-access/interview-access-header";
import { InterviewActionConfirmModal } from "@/components/interviews/interview-action-confirm-modal";
import { InterviewNoteModal } from "@/components/interviews/interview-note-modal";
import { Tooltip } from "@/components/ui/tooltip";
import { UserProfile } from "@/components/ui/user-profile";
import { alerts } from "@/lib/alerts";
import { ApiClientError, apiRequest } from "@/lib/api";
import type {
  AccessInterview,
  AccessInterviewsResponse,
  AccessLinkResponse,
  InterviewResponse,
} from "@/lib/interviews/types";
import { queryKeys } from "@/lib/query/query-keys";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

const shell =
  "mx-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900";

function CenteredMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-svh place-items-center bg-gray-50 px-4 py-10 text-gray-900 dark:bg-gray-950 dark:text-white">
      <div className={shell}>
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">{children}</p>
      </div>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button aria-label={label} className="icon-button" onClick={onClick} type="button">
        {children}
      </button>
    </Tooltip>
  );
}

export function InterviewAccessPage({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [resumeTarget, setResumeTarget] = useState<AccessInterview | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<AccessInterview | null>(null);
  const [noteTarget, setNoteTarget] = useState<AccessInterview | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AccessInterview | null>(null);

  const stateQuery = useQuery({
    queryKey: queryKeys.interviewAccess.state(token),
    queryFn: async () => apiRequest<AccessLinkResponse>(`/interview-access/${token}`),
    refetchInterval: (query) => {
      const status = query.state.data?.data.state.session?.status;
      if (status === "pending_approval") return 4000;
      if (status === "approved" && !query.state.data?.data.expired) return 5000;
      return false;
    },
  });

  const sessionStatus = stateQuery.data?.data.state.session?.status;
  const interviewsQuery = useQuery({
    queryKey: queryKeys.interviewAccess.interviews(token),
    enabled: sessionStatus === "approved" && !stateQuery.data?.data.expired,
    queryFn: async () => apiRequest<AccessInterviewsResponse>(`/interview-access/${token}/interviews`),
    refetchInterval: 5000,
    retry: (count, error) => {
      if (
        error instanceof ApiClientError &&
        (error.code === "LINK_REVOKED" || error.code === "LINK_EXPIRED" || error.code === "LINK_NOT_APPROVED")
      ) {
        return false;
      }
      return count < 2;
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () =>
      apiRequest<AccessLinkResponse>(`/interview-access/${token}/register`, {
        method: "POST",
        body: JSON.stringify({ name, email }),
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.interviewAccess.state(token), result);
    },
    onError: (error) => alerts.error(errorMessage(error, "Request could not be submitted.")),
  });

  const noteMutation = useMutation({
    mutationFn: async ({ interviewId, content }: { interviewId: string; content: string }) =>
      apiRequest<InterviewResponse>(`/interview-access/${token}/interviews/${interviewId}/notes`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSuccess: (result, variables) => {
      alerts.success("Note added.");
      void queryClient.invalidateQueries({ queryKey: queryKeys.interviewAccess.interviews(token) });
      setNoteTarget((current) =>
        current && current.id === variables.interviewId
          ? { ...current, notes: result.data.interview.notes }
          : current,
      );
    },
    onError: (error) => {
      alerts.error(errorMessage(error, "Note could not be saved."));
      if (error instanceof ApiClientError && (error.code === "LINK_REVOKED" || error.code === "LINK_EXPIRED")) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.interviewAccess.state(token) });
        setNoteTarget(null);
      }
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (interviewId: string) =>
      apiRequest<InterviewResponse>(`/interview-access/${token}/interviews/${interviewId}/complete`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      alerts.success("Interview marked complete.");
      setConfirmTarget(null);
      setNoteTarget(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.interviewAccess.interviews(token) });
    },
    onError: (error) => {
      alerts.error(errorMessage(error, "Interview could not be marked complete."));
      if (error instanceof ApiClientError && (error.code === "LINK_REVOKED" || error.code === "LINK_EXPIRED")) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.interviewAccess.state(token) });
        setConfirmTarget(null);
      }
    },
  });

  const payload = stateQuery.data?.data;

  if (stateQuery.isPending) {
    return (
      <div className="grid min-h-svh place-items-center bg-gray-50 px-4 dark:bg-gray-950">
        <div className="h-40 w-full max-w-md animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
      </div>
    );
  }
  if (stateQuery.isError) {
    return (
      <CenteredMessage title="Access link unavailable">
        {errorMessage(stateQuery.error, "This link is invalid.")}
      </CenteredMessage>
    );
  }
  if (!payload) return null;

  const interviewsErrorCode = interviewsQuery.error instanceof ApiClientError ? interviewsQuery.error.code : "";
  const session = payload.state.session;

  if (payload.expired || interviewsErrorCode === "LINK_EXPIRED") {
    return (
      <CenteredMessage title="This link has expired">Ask HR to generate a new access link for today.</CenteredMessage>
    );
  }

  const withHeader = (content: ReactNode) => (
    <div className="flex min-h-svh flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white">
      <InterviewAccessHeader expiresAt={payload.state.expiresAt} session={session} />
      {content}
    </div>
  );

  if (session?.status === "revoked" || interviewsErrorCode === "LINK_REVOKED") {
    return withHeader(
      <div className="grid flex-1 place-items-center px-4 py-10">
        <div className={shell}>
          <h1 className="text-lg font-bold">Access was revoked</h1>
          <p className="mt-2 text-sm text-gray-500">HR revoked your access. Ask them to approve you again if you still need it.</p>
        </div>
      </div>,
    );
  }

  if (session?.status === "rejected") {
    return withHeader(
      <div className="grid flex-1 place-items-center px-4 py-10">
        <div className={shell}>
          <h1 className="text-lg font-bold">Request not approved</h1>
          <p className="mt-2 text-sm text-gray-500">
            HR did not approve this access request. You can submit a new request from this browser if they send you the link
            again.
          </p>
        </div>
      </div>,
    );
  }

  if (session?.status === "pending_approval") {
    return withHeader(
      <div className="grid flex-1 place-items-center px-4 py-10">
        <div className={shell}>
          <h1 className="text-lg font-bold">Waiting for HR approval</h1>
          <p className="mt-2 text-sm text-gray-500">
            Your request{session.name ? ` as ${session.name}` : ""} is awaiting HR approval. This page updates automatically.
          </p>
        </div>
      </div>,
    );
  }

  if (session?.status !== "approved") {
    return withHeader(
      <div className="grid flex-1 place-items-center px-4 py-10">
        <form
          className={shell}
          onSubmit={(event) => {
            event.preventDefault();
            registerMutation.mutate();
          }}
        >
          <h1 className="text-lg font-bold">Request interview access</h1>
          <p className="mt-1 text-sm text-gray-500">
            {payload.state.departmentName ? `${payload.state.departmentName} · ` : ""}
            Submit your name and email. HR must approve before you can add notes.
          </p>
          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-bold">Name</span>
            <input
              className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-bold">Email</span>
            <input
              className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <button
            className="mt-5 h-11 w-full rounded-xl bg-indigo-600 text-sm font-bold text-white disabled:opacity-50"
            disabled={registerMutation.isPending}
            type="submit"
          >
            {registerMutation.isPending ? "Submitting…" : "Request access"}
          </button>
        </form>
      </div>,
    );
  }

  const interviews = interviewsQuery.data?.data.interviews ?? [];
  const liveNoteTarget = noteTarget
    ? (interviews.find((item) => item.id === noteTarget.id) ?? noteTarget)
    : null;

  return withHeader(
    <>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/70">
          {interviewsQuery.isPending ? (
            <div aria-label="Loading interviews" className="space-y-3 p-4" role="status">
              {[1, 2, 3].map((item) => (
                <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-900" key={item} />
              ))}
            </div>
          ) : null}
          {interviewsQuery.isError && interviewsErrorCode !== "LINK_REVOKED" && interviewsErrorCode !== "LINK_EXPIRED" ? (
            <div className="px-6 py-12 text-center">
              <h3 className="text-sm font-bold">Interviews could not be loaded</h3>
              <p className="mt-1 text-xs text-gray-500">{errorMessage(interviewsQuery.error, "Try again in a moment.")}</p>
              <button className="mt-3 text-sm font-bold text-indigo-600" onClick={() => void interviewsQuery.refetch()} type="button">
                Try again
              </button>
            </div>
          ) : null}
          {interviewsQuery.isSuccess && interviews.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <CalendarClock aria-hidden className="mx-auto h-9 w-9 text-gray-400" />
              <h3 className="mt-3 text-sm font-bold">No scheduled interviews</h3>
              <p className="mt-1 text-xs text-gray-500">
                No scheduled interviews for {payload.state.departmentName ?? "this department"} today.
              </p>
            </div>
          ) : null}
          {interviewsQuery.isSuccess && interviews.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Candidate</th>
                    <th className="px-4 py-3">Job</th>
                    <th className="px-4 py-3">Label</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {interviews.map((interview) => (
                    <tr className="align-top hover:bg-gray-50/80 dark:hover:bg-gray-900/40" key={interview.id}>
                      <td className="px-4 py-3">
                        <UserProfile email={interview.candidateEmail} name={interview.candidateName} />
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
                      <td className="whitespace-nowrap px-4 py-3 align-middle text-gray-600 dark:text-gray-300">
                        {interview.durationMinutes} min
                        <span className="mt-0.5 block text-xs text-gray-400">{interview.time}</span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex justify-end gap-1">
                          <InterviewActions
                            actions={interview.actions.filter((action) => action === "mark_complete")}
                            disabledReasons={completeDisabledReasons(interview.notes.length)}
                            pendingAction={
                              completeMutation.isPending && completeMutation.variables === interview.id
                                ? "mark_complete"
                                : undefined
                            }
                            onAction={(action) => {
                              if (action !== "mark_complete") return;
                              if (interview.notes.length === 0) {
                                alerts.error(COMPLETE_NOTE_REQUIRED);
                                return;
                              }
                              setConfirmTarget(interview);
                            }}
                          />
                          <IconAction label="View CV" onClick={() => setResumeTarget(interview)}>
                            <FileText aria-hidden className="h-4 w-4" />
                          </IconAction>
                          <IconAction label="View application" onClick={() => setDetailsTarget(interview)}>
                            <Eye aria-hidden className="h-4 w-4" />
                          </IconAction>
                          <IconAction label="Add note" onClick={() => setNoteTarget(interview)}>
                            <FilePlus aria-hidden className="h-4 w-4" />
                          </IconAction>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </main>

      {resumeTarget ? (
        <ResumeViewerModal
          applicationId={resumeTarget.applicationId}
          candidateEmail={resumeTarget.candidateEmail}
          candidateName={resumeTarget.candidateName}
          onClose={() => setResumeTarget(null)}
          resumeFileName={resumeTarget.resumeOriginalName}
          resumePath={resumeTarget.resumePath}
        />
      ) : null}
      {detailsTarget ? (
        <ApplicationDetailsModal
          candidateName={detailsTarget.candidateName}
          interviewId={detailsTarget.id}
          onClose={() => setDetailsTarget(null)}
          token={token}
        />
      ) : null}
      {liveNoteTarget ? (
        <InterviewNoteModal
          candidateName={liveNoteTarget.candidateName}
          notes={liveNoteTarget.notes}
          onClose={() => setNoteTarget(null)}
          onSubmit={async (content) => {
            await noteMutation.mutateAsync({ interviewId: liveNoteTarget.id, content });
          }}
          pending={noteMutation.isPending}
        />
      ) : null}
      {confirmTarget ? (
        <InterviewActionConfirmModal
          action="mark_complete"
          candidateName={confirmTarget.candidateName}
          pending={completeMutation.isPending}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => completeMutation.mutate(confirmTarget.id)}
        />
      ) : null}
    </>,
  );
}
