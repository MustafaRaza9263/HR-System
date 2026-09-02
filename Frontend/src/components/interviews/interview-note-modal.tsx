"use client";

import { format, isValid } from "date-fns";
import { Calendar, Clock } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { UserProfile } from "@/components/ui/user-profile";
import type { InterviewNote } from "@/lib/interviews/types";

function NoteStamp({ value }: { value: string }) {
  const date = new Date(value);
  if (!isValid(date)) return <span className="mt-3 text-[10px] text-gray-400">—</span>;
  return (
    <time
      className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400"
      dateTime={date.toISOString()}
    >
      <Calendar aria-hidden className="h-3 w-3" />
      {format(date, "MMM d, yyyy")}
      <span aria-hidden>•</span>
      <Clock aria-hidden className="h-3 w-3" />
      {format(date, "hh:mm a")}
    </time>
  );
}

function NoteCard({ note }: { note: InterviewNote }) {
  return (
    <article className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800">
      <UserProfile email={note.authorEmail} name={note.authorName} size="sm" />
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-100">{note.content}</p>
      <NoteStamp value={note.createdAt} />
    </article>
  );
}

export function InterviewNoteModal({
  candidateName,
  notes,
  pending,
  locked = false,
  onClose,
  onSubmit,
}: {
  candidateName: string;
  notes: InterviewNote[];
  pending: boolean;
  locked?: boolean;
  onClose: () => void;
  onSubmit?: (content: string) => Promise<void> | void;
}) {
  const [content, setContent] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = content.trim();
    if (!clean || locked) return;
    await onSubmit?.(clean);
    setContent("");
  }

  const footer = (close: () => void) => (
    <div className="flex w-full gap-3">
      <button
        className="hr-secondary-btn h-11 min-w-0 flex-[1_1_0%] rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        disabled={pending}
        onClick={close}
        type="button"
      >
        Close
      </button>
      {locked ? null : (
        <button
          className="h-11 min-w-0 flex-[1_1_0%] rounded-xl bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          disabled={pending || !content.trim()}
          type="submit"
        >
          {pending ? "Saving…" : "Add note"}
        </button>
      )}
    </div>
  );

  const body = (
    <div className="space-y-3">
      {notes.length === 0 ? (
        <p className="text-sm text-gray-500">No notes yet.</p>
      ) : (
        notes.map((note) => <NoteCard key={note.id} note={note} />)
      )}
      {locked ? (
        <p className="text-xs text-gray-400">Notes cannot be added to cancelled or no-show interviews.</p>
      ) : (
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-200">Add a note</span>
          <textarea
            autoFocus
            className="min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            maxLength={2000}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Add a note…"
            value={content}
          />
          <span className="mt-1 block text-xs text-gray-400">{content.trim().length}/2000</span>
        </label>
      )}
    </div>
  );

  if (locked) {
    return (
      <Modal
        closeDisabled={pending}
        footer={footer}
        maxWidth="max-w-lg"
        onClose={onClose}
        subtitle="Notes cannot be added to a cancelled or no-show interview."
        title={`Notes · ${candidateName}`}
      >
        {body}
      </Modal>
    );
  }

  return (
    <Modal
      as="form"
      closeDisabled={pending}
      footer={footer}
      maxWidth="max-w-lg"
      onClose={onClose}
      onSubmit={submit}
      subtitle="Notes are saved to this interview and cannot be edited later."
      title={`Notes · ${candidateName}`}
    >
      {body}
    </Modal>
  );
}
