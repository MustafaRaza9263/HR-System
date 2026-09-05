"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, StickyNote } from "lucide-react";

import { NoteCard } from "@/components/interviews/interview-note-card";
import { Modal } from "@/components/ui/modal";
import { ApiClientError, apiRequest } from "@/lib/api";
import { formatInterviewWhen } from "@/lib/interviews/format";
import type { InterviewsListResponse } from "@/lib/interviews/types";
import { queryKeys } from "@/lib/query/query-keys";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

export function ApplicationNotesModal({
  applicationId,
  candidateName,
  onClose,
}: {
  applicationId: string;
  candidateName: string;
  onClose: () => void;
}) {
  const notesQuery = useQuery({
    queryKey: queryKeys.applications.interviews(applicationId),
    queryFn: async () => apiRequest<InterviewsListResponse>(`/applications/${applicationId}/interviews`),
  });

  const interviewsWithNotes = (notesQuery.data?.data.interviews ?? []).filter((interview) => interview.notes.length > 0);

  return (
    <Modal
      bodyClassName="hr-hide-scrollbar"
      maxWidth="max-w-2xl"
      onClose={onClose}
      subtitle="Notes from every interview for this application."
      title={`Notes · ${candidateName}`}
    >
      {notesQuery.isPending ? (
        <div aria-label="Loading notes" className="space-y-3" role="status">
          {[1, 2, 3].map((item) => (
            <div className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-900" key={item} />
          ))}
        </div>
      ) : null}

      {notesQuery.isError ? (
        <div className="py-6 text-center">
          <AlertTriangle aria-hidden className="mx-auto h-8 w-8 text-red-500" />
          <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">
            {errorMessage(notesQuery.error, "Notes could not be loaded.")}
          </h3>
          <button
            className="mt-3 text-sm font-bold text-indigo-600 dark:text-indigo-400"
            onClick={() => void notesQuery.refetch()}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : null}

      {notesQuery.isSuccess && interviewsWithNotes.length === 0 ? (
        <div className="py-6 text-center">
          <StickyNote aria-hidden className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-3 text-sm text-gray-500">No notes yet.</p>
        </div>
      ) : null}

      {notesQuery.isSuccess && interviewsWithNotes.length > 0 ? (
        <div className="space-y-6">
          {interviewsWithNotes.map((interview) => (
            <section key={interview.id}>
              <h3 className="text-sm font-bold text-gray-950 dark:text-white">{interview.label}</h3>
              <p className="mt-0.5 text-xs text-gray-500">{formatInterviewWhen(interview.date, interview.time)}</p>
              <div className="mt-3 space-y-3">
                {interview.notes.map((note) => (
                  <NoteCard key={note.id} note={note} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </Modal>
  );
}
