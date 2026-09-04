"use client";

import { format, isValid } from "date-fns";
import { ArrowUp, Calendar, Clock, LoaderCircle } from "lucide-react";
import { type FormEvent, useId, useLayoutEffect, useRef, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { UserProfile } from "@/components/ui/user-profile";
import type { InterviewNote } from "@/lib/interviews/types";

const NOTE_COMPOSER_MAX_PX = 160;

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
  const composerId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = !pending && !locked && content.trim().length > 0;

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, NOTE_COMPOSER_MAX_PX)}px`;
  }, [content]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = content.trim();
    if (!clean || locked || pending) return;
    await onSubmit?.(clean);
    setContent("");
  }

  const footer = locked ? undefined : (
    <div className="relative rounded-2xl border border-gray-200 bg-white focus-within:border-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:focus-within:border-indigo-500">
      <label className="sr-only" htmlFor={composerId}>
        Add a note
      </label>
      <textarea
        className="hr-hide-scrollbar max-h-40 min-h-18 w-full resize-none overflow-y-auto bg-transparent px-4 pb-12 pt-3 text-sm leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-500"
        data-autofocus
        disabled={pending}
        id={composerId}
        maxLength={2000}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey) || !canSubmit) return;
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }}
        placeholder="Add a note…"
        ref={textareaRef}
        rows={2}
        value={content}
      />
      <button
        aria-label={pending ? "Saving note" : "Add note"}
        className="absolute bottom-2.5 right-2.5 grid h-9 w-9 place-items-center rounded-full bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-600/40 disabled:text-white/80"
        disabled={!canSubmit}
        type="submit"
      >
        {pending ? <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" /> : <ArrowUp aria-hidden className="h-4 w-4" strokeWidth={2.5} />}
      </button>
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
      ) : null}
    </div>
  );

  if (locked) {
    return (
      <Modal
        bodyClassName="hr-hide-scrollbar"
        closeDisabled={pending}
        footer={footer}
        maxWidth="max-w-2xl"
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
      bodyClassName="hr-hide-scrollbar"
      closeDisabled={pending}
      footer={footer}
      maxWidth="max-w-2xl"
      onClose={onClose}
      onSubmit={submit}
      subtitle="Notes are saved to this interview and cannot be edited later."
      title={`Notes · ${candidateName}`}
    >
      {body}
    </Modal>
  );
}
