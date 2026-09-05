"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  CircleCheck,
  FilePlus,
  LoaderCircle,
  UserX,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useState } from "react";

import { InterviewActionConfirmModal } from "@/components/interviews/interview-action-confirm-modal";
import { NoteCard } from "@/components/interviews/interview-note-card";
import { InterviewNoteModal } from "@/components/interviews/interview-note-modal";
import { ScheduleInterviewModal } from "@/components/interviews/schedule-interview-modal";
import { StatusPills, type PillTone } from "@/components/ui/status-pills";
import { Tooltip } from "@/components/ui/tooltip";
import { alerts } from "@/lib/alerts";
import { ApiClientError, apiRequest } from "@/lib/api";
import { formatInterviewWhen } from "@/lib/interviews/format";
import type { DisplayStatus, Interview, InterviewAction, InterviewResponse, InterviewStatus, InterviewsListResponse } from "@/lib/interviews/types";
import { queryKeys } from "@/lib/query/query-keys";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

function interviewStatusLabel(status: DisplayStatus) {
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

function interviewStatusTone(status: DisplayStatus): PillTone {
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

type PendingAction = { kind: "reschedule"; interview: Interview } | null;
type ConfirmTarget = { interview: Interview; action: "cancel" | "no_show" | "mark_complete" };

export const COMPLETE_NOTE_REQUIRED = "Add at least one note before marking this interview complete.";

export function completeDisabledReasons(notesCount: number): Partial<Record<InterviewAction, string>> | undefined {
  return notesCount === 0 ? { mark_complete: COMPLETE_NOTE_REQUIRED } : undefined;
}

export function notesWriteLocked(status: InterviewStatus) {
  return status === "cancelled" || status === "no_show";
}

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
  const [noteTarget, setNoteTarget] = useState<Interview | null>(null);
  const [openNotes, setOpenNotes] = useState<ReadonlySet<string>>(() => new Set());

  const interviewsQuery = useQuery({
    queryKey: queryKeys.applications.interviews(applicationId),
    queryFn: async () => apiRequest<InterviewsListResponse>(`/applications/${applicationId}/interviews`),
    staleTime: 30_000,
  });

  const interviews = interviewsQuery.data?.data.interviews ?? [];
  const liveNoteTarget = noteTarget
    ? (interviews.find((item) => item.id === noteTarget.id) ?? noteTarget)
    : null;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.applications.interviews(applicationId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.applications.detail(applicationId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.interviews.all });
  }

  function toggleNotes(interviewId: string) {
    setOpenNotes((current) => {
      const next = new Set(current);
      if (next.has(interviewId)) next.delete(interviewId);
      else next.add(interviewId);
      return next;
    });
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
    onSuccess: (result, variables) => {
      alerts.success("Note added.");
      invalidate();
      setNoteTarget((current) =>
        current && current.id === variables.interviewId
          ? { ...current, notes: result.data.interview.notes }
          : current,
      );
    },
    onError: (error) => alerts.error(errorMessage(error, "Note could not be saved.")),
  });

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Interviews scheduled for this application.</p>
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

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/70">
        {interviewsQuery.isPending ? <div className="h-24 animate-pulse bg-gray-100 dark:bg-gray-900" /> : null}
        {interviewsQuery.isError ? (
          <p className="px-6 py-10 text-center text-sm text-red-600">Interviews could not be loaded.</p>
        ) : null}
        {interviewsQuery.isSuccess && interviews.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-500">No interviews scheduled yet.</p>
        ) : null}

        {interviewsQuery.isSuccess && interviews.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {interviews.map((interview) => {
                  const locked = notesWriteLocked(interview.status);
                  const expanded = openNotes.has(interview.id);
                  return (
                    <Fragment key={interview.id}>
                      <tr className="align-middle hover:bg-gray-50/80 dark:hover:bg-gray-900/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              aria-expanded={expanded}
                              aria-label={expanded ? "Hide notes" : "Show notes"}
                              className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                              onClick={() => toggleNotes(interview.id)}
                              type="button"
                            >
                              <ChevronRight aria-hidden className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
                            </button>
                            <span className="font-medium text-gray-800 dark:text-gray-100">{interview.label}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                          {formatInterviewWhen(interview.date, interview.time)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                          {interview.durationMinutes} min
                        </td>
                        <td className="px-4 py-3">
                          <StatusPills
                            items={[{ label: interviewStatusLabel(interview.displayStatus), tone: interviewStatusTone(interview.displayStatus) }]}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <InterviewActions
                              actions={interview.actions}
                              disabledReasons={completeDisabledReasons(interview.notes.length)}
                              pendingAction={
                                actionMutation.isPending && actionMutation.variables?.interviewId === interview.id
                                  ? actionMutation.variables.action
                                  : undefined
                              }
                              onAction={(action) => {
                                if (action === "reschedule") setPending({ kind: "reschedule", interview });
                                else if (action === "cancel" || action === "no_show" || action === "mark_complete") {
                                  if (action === "mark_complete" && interview.notes.length === 0) {
                                    alerts.error(COMPLETE_NOTE_REQUIRED);
                                    return;
                                  }
                                  setConfirmTarget({ interview, action });
                                } else actionMutation.mutate({ interviewId: interview.id, action });
                              }}
                            />
                            <Tooltip label={locked ? "View notes" : "Add note"}>
                              <button
                                aria-label={locked ? "View notes" : "Add note"}
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
                      {expanded ? (
                        <tr className="bg-gray-50/80 dark:bg-gray-900/40">
                          <td className="px-4 py-4" colSpan={5}>
                            {interview.notes.length === 0 ? (
                              <p className="text-sm text-gray-500">No notes yet.</p>
                            ) : (
                              <div className="space-y-3">
                                {interview.notes.map((note) => (
                                  <NoteCard key={note.id} note={note} />
                                ))}
                              </div>
                            )}
                            {locked ? null : (
                              <div className="mt-3 flex justify-end">
                                <button
                                  className="inline-flex h-9 items-center rounded-xl bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-700"
                                  onClick={() => setNoteTarget(interview)}
                                  type="button"
                                >
                                  Add note
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-gray-400">
        Approve and trial decisions are made from the applications list. Reject is available on this page.
      </p>

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
      {liveNoteTarget ? (
        <InterviewNoteModal
          candidateName={applicant.name}
          locked={notesWriteLocked(liveNoteTarget.status)}
          notes={liveNoteTarget.notes}
          onClose={() => setNoteTarget(null)}
          onSubmit={async (content) => {
            await noteMutation.mutateAsync({ interviewId: liveNoteTarget.id, content });
          }}
          pending={noteMutation.isPending}
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
  disabledReasons,
  onAction,
  className,
}: {
  actions: InterviewAction[];
  pendingAction?: InterviewAction;
  disabledReasons?: Partial<Record<InterviewAction, string>>;
  onAction: (action: InterviewAction) => void;
  className?: string;
}) {
  if (actions.length === 0) return null;

  return (
    <div className={`flex flex-nowrap items-center gap-1 ${className ?? ""}`.trim()}>
      {actions.map((action) => {
        const Icon = ACTION_ICONS[action];
        const blocked = disabledReasons?.[action];
        const label = pendingAction === action ? "Saving…" : blocked ?? ACTION_LABELS[action];
        return (
          <Tooltip key={action} label={label}>
            <button
              aria-label={label}
              className="icon-button"
              disabled={Boolean(pendingAction) || Boolean(blocked)}
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
