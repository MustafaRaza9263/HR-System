import { format, isValid } from "date-fns";
import { Calendar, Clock } from "lucide-react";

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

export function NoteCard({ note }: { note: InterviewNote }) {
  return (
    <article className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800">
      <UserProfile email={note.authorEmail} name={note.authorName} size="sm" />
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-100">{note.content}</p>
      <NoteStamp value={note.createdAt} />
    </article>
  );
}
