import { InterviewNote } from "../models/interview-note.model.js";
import { getDateStateFromCalendarDate } from "./date-state.js";
import { getDisplayStatus, getInterviewActions, type DisplayStatus, type InterviewAction } from "./interview-rules.js";

interface InterviewLike {
  _id: { toString(): string };
  applicationId: { toString(): string };
  departmentId: { toString(): string };
  label?: string | null;
  date: string;
  time: string;
  durationMinutes: number;
  status: string;
  createdBy: { toString(): string };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SerializedNote {
  id: string;
  authorName: string;
  authorEmail: string;
  content: string;
  createdAt: Date;
}

export interface SerializedInterview {
  id: string;
  applicationId: string;
  departmentId: string;
  label: string;
  date: string;
  time: string;
  durationMinutes: number;
  status: string;
  displayStatus: DisplayStatus;
  dateState: ReturnType<typeof getDateStateFromCalendarDate>;
  actions: InterviewAction[];
  notes: SerializedNote[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function loadNotesByInterviewIds(
  interviewIds: Array<{ toString(): string }>,
): Promise<Map<string, SerializedNote[]>> {
  if (interviewIds.length === 0) return new Map();
  const notes = await InterviewNote.find({ interviewId: { $in: interviewIds.map((id) => id.toString()) } })
    .sort({ createdAt: 1 })
    .lean();
  const grouped = new Map<string, SerializedNote[]>();
  for (const note of notes) {
    const key = note.interviewId.toString();
    const list = grouped.get(key) ?? [];
    list.push({
      id: note._id.toString(),
      authorName: note.authorName,
      authorEmail: note.authorEmail,
      content: note.content,
      createdAt: note.createdAt,
    });
    grouped.set(key, list);
  }
  return grouped;
}

export function isSerializableInterview(interview: {
  _id?: { toString(): string };
  applicationId?: { toString(): string } | null;
  departmentId?: { toString(): string } | null;
  label?: unknown;
  date?: unknown;
  time?: unknown;
  durationMinutes?: unknown;
  status?: unknown;
  createdBy?: { toString(): string } | null;
  createdAt?: Date;
  updatedAt?: Date;
}): interview is InterviewLike {
  return (
    interview._id != null &&
    interview.applicationId != null &&
    interview.departmentId != null &&
    interview.createdBy != null &&
    typeof interview.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(interview.date) &&
    typeof interview.time === "string" &&
    /^\d{2}:\d{2}$/.test(interview.time) &&
    typeof interview.status === "string" &&
    typeof interview.durationMinutes === "number"
  );
}

export async function serializeInterview(
  interview: InterviewLike,
  notes?: SerializedNote[],
): Promise<SerializedInterview> {
  const resolvedNotes =
    notes ??
    (await loadNotesByInterviewIds([interview._id])).get(interview._id.toString()) ??
    [];
  const actions = await getInterviewActions(interview);
  return {
    id: interview._id.toString(),
    applicationId: interview.applicationId.toString(),
    departmentId: interview.departmentId.toString(),
    label: typeof interview.label === "string" && interview.label.trim() ? interview.label.trim() : "Interview",
    date: interview.date,
    time: interview.time,
    durationMinutes: interview.durationMinutes,
    status: interview.status,
    displayStatus: getDisplayStatus(interview),
    dateState: getDateStateFromCalendarDate(interview.date),
    actions,
    notes: resolvedNotes,
    createdBy: interview.createdBy.toString(),
    createdAt: interview.createdAt ?? new Date(),
    updatedAt: interview.updatedAt ?? interview.createdAt ?? new Date(),
  };
}

export async function serializeInterviews(interviews: Array<Partial<InterviewLike>>): Promise<SerializedInterview[]> {
  const valid = interviews.filter(isSerializableInterview);
  const notesByInterview = await loadNotesByInterviewIds(valid.map((item) => item._id));
  return Promise.all(
    valid.map((interview) => serializeInterview(interview, notesByInterview.get(interview._id.toString()) ?? [])),
  );
}
