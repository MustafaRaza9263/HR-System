"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarClock, CalendarPlus, CircleCheck, LoaderCircle, UserX, XCircle, type LucideIcon } from "lucide-react";
import { useState } from "react";

import { InterviewActionConfirmModal } from "@/components/interviews/interview-action-confirm-modal";
import { ScheduleInterviewModal } from "@/components/interviews/schedule-interview-modal";
import { Tooltip } from "@/components/ui/tooltip";
import { alerts } from "@/lib/alerts";
import { ApiClientError, apiRequest } from "@/lib/api";
import { formatInterviewWhen } from "@/lib/interviews/format";
import type { DisplayStatus, Interview, InterviewAction, InterviewResponse, InterviewsListResponse } from "@/lib/interviews/types";
import { queryKeys } from "@/lib/query/query-keys";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

function interviewBadge(status: DisplayStatus) {
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

type PendingAction = { kind: "reschedule"; interview: Interview } | null;
type ConfirmTarget = { interview: Interview; action: "cancel" | "no_show" };

export function ApplicationInterviews({
  applicationId,
  applicant,
  canSchedule,
}: {
  applicationId: string;
  applicant: { name: string; email: string };
  canSchedule: boolean;
}) {
  const queryClient = useQueryClient();
  const [scheduling, setScheduling] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const interviewsQuery = useQuery({
    queryKey: queryKeys.applications.interviews(applicationId),
    queryFn: async () => apiRequest<InterviewsListResponse>(`/applications/${applicationId}/interviews`),
  });

  const interviews = interviewsQuery.data?.data.interviews ?? [];

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.applications.interviews(applicationId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.applications.detail(applicationId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.interviews.all });
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
      invalidate();
    },
    onError: (error) => alerts.error(errorMessage(error, "Action could not be completed.")),
  });

  const noteMutation = useMutation({
    mutationFn: async ({ interviewId, content }: { interviewId: string; content: string }) =>
      apiRequest<InterviewResponse>(`/interviews/${interviewId}/notes`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSuccess: (_result, variables) => {
      setNoteDrafts((current) => ({ ...current, [variables.interviewId]: "" }));
      alerts.success("Note added.");
      invalidate();
    },
    onError: (error) => alerts.error(errorMessage(error, "Note could not be saved.")),
  });

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-800/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Interviews</h2>
        {canSchedule ? (
          <button
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700"
            onClick={() => setScheduling(true)}
            type="button"
          >
            <CalendarPlus aria-hidden className="h-4 w-4" />
            Schedule interview
          </button>
        ) : null}
      </div>

      {interviewsQuery.isPending ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-900" /> : null}
      {interviewsQuery.isError ? <p className="mt-4 text-sm text-red-600">Interviews could not be loaded.</p> : null}
      {interviewsQuery.isSuccess && interviews.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No interviews scheduled yet.</p>
      ) : null}

      <div className="mt-4 space-y-4">
        {interviews.map((interview) => {
          const locked = interview.status === "completed";
          return (
            <article className="rounded-xl border border-gray-200 p-4 dark:border-gray-700" key={interview.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-950 dark:text-white">
                    {formatInterviewWhen(interview.date, interview.time)} · {interview.durationMinutes} min
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${interviewBadge(interview.displayStatus)}`}>
                  {interview.displayStatus.replaceAll("_", " ")}
                </span>
              </div>

              <InterviewActions
                actions={interview.actions}
                className="mt-3"
                pendingAction={actionMutation.isPending ? actionMutation.variables?.action : undefined}
                onAction={(action) => {
                  if (action === "reschedule") setPending({ kind: "reschedule", interview });
                  else if (action === "cancel" || action === "no_show") {
                    setConfirmTarget({ interview, action });
                  } else actionMutation.mutate({ interviewId: interview.id, action });
                }}
              />

              <div className="mt-4 space-y-2">
                {interview.notes.map((note) => (
                  <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-gray-900/70" key={note.id}>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      {note.authorName} · {format(new Date(note.createdAt), "d MMM, HH:mm")}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-gray-300">{note.content}</p>
                  </div>
                ))}
                {locked ? (
                  <p className="text-xs text-gray-400">Notes are locked on completed interviews.</p>
                ) : (
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const content = (noteDrafts[interview.id] ?? "").trim();
                      if (!content) return;
                      noteMutation.mutate({ interviewId: interview.id, content });
                    }}
                  >
                    <input
                      className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      onChange={(event) => setNoteDrafts((current) => ({ ...current, [interview.id]: event.target.value }))}
                      placeholder="Add a note…"
                      value={noteDrafts[interview.id] ?? ""}
                    />
                    <button
                      className="h-10 rounded-lg bg-gray-900 px-3 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
                      disabled={noteMutation.isPending}
                      type="submit"
                    >
                      Add
                    </button>
                  </form>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {scheduling ? (
        <ScheduleInterviewModal
          applicant={applicant}
          applicationId={applicationId}
          onClose={() => setScheduling(false)}
          onSaved={() => {
            setScheduling(false);
            invalidate();
          }}
        />
      ) : null}

      {confirmTarget ? (
        <InterviewActionConfirmModal
          action={confirmTarget.action}
          candidateName={applicant.name}
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

      {pending?.kind === "reschedule" ? (
        <ScheduleInterviewModal
          applicant={applicant}
          applicationId={applicationId}
          interview={pending.interview}
          onClose={() => setPending(null)}
          onSaved={() => {
            setPending(null);
            invalidate();
          }}
        />
      ) : null}
    </section>
  );
}

const ACTION_LABELS: Record<InterviewAction, string> = {
  mark_complete: "Mark complete",
  no_show: "No show",
  reschedule: "Reschedule",
  cancel: "Cancel",
};

const ACTION_ICONS: Record<InterviewAction, LucideIcon> = {
  mark_complete: CircleCheck,
  no_show: UserX,
  reschedule: CalendarClock,
  cancel: XCircle,
};

export function InterviewActions({
  actions,
  pendingAction,
  onAction,
  className,
}: {
  actions: InterviewAction[];
  pendingAction?: InterviewAction;
  onAction: (action: InterviewAction) => void;
  className?: string;
}) {
  if (actions.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className ?? ""}`.trim()}>
      {actions.map((action) => {
        const Icon = ACTION_ICONS[action];
        const label = pendingAction === action ? "Saving…" : ACTION_LABELS[action];
        return (
          <Tooltip key={action} label={label}>
            <button
              aria-label={label}
              className="icon-button"
              disabled={Boolean(pendingAction)}
              onClick={() => onAction(action)}
              type="button"
            >
              {pendingAction === action ? (
                <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <Icon aria-hidden className="h-4 w-4" />
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
