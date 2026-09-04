import type { Types } from "mongoose";

import { Interview } from "../models/interview.model.js";
import { InterviewNote } from "../models/interview-note.model.js";
import { ApiError } from "./api-error.js";
import { getDateStateFromCalendarDate } from "./date-state.js";

export type InterviewAction = "reschedule" | "cancel" | "no_show" | "mark_complete";
export type DisplayStatus = "scheduled" | "overdue" | "completed" | "cancelled" | "no_show";

export function getDisplayStatus(interview: { status: string; date: string }, now = new Date()): DisplayStatus {
  if (interview.status !== "scheduled") {
    return interview.status as DisplayStatus;
  }
  if (getDateStateFromCalendarDate(interview.date, now) === "passed") {
    return "overdue";
  }
  return "scheduled";
}

export async function canMarkComplete(interview: { _id: { toString(): string }; status: string }): Promise<boolean> {
  if (interview.status !== "scheduled") return false;
  const count = await InterviewNote.countDocuments({ interviewId: interview._id.toString() });
  return count > 0;
}

export function getInterviewActions(interview: {
  _id: { toString(): string };
  status: string;
  date: string;
}): InterviewAction[] {
  if (interview.status !== "scheduled") return [];

  const dateState = getDateStateFromCalendarDate(interview.date);
  const actions: InterviewAction[] = ["reschedule", "cancel"];
  if (dateState === "future") return actions;

  actions.push("no_show", "mark_complete");
  return actions;
}

export function assertScheduled(status: string) {
  if (status !== "scheduled") {
    throw new ApiError(409, "INTERVIEW_NOT_ACTIVE", "This interview is no longer scheduled.");
  }
}

export function assertRescheduleChangesSlot(
  current: { date: string; time: string },
  next: { date: string; time: string },
) {
  if (current.date === next.date && current.time === next.time) {
    throw new ApiError(
      422,
      "INTERVIEW_UNCHANGED",
      "Change the date or the time to reschedule this interview.",
    );
  }
}

export async function assertNoDuplicateInterviewSlot(input: {
  applicationId: Types.ObjectId | string;
  date: string;
  time: string;
  excludeInterviewId?: Types.ObjectId | string;
}) {
  const filter: Record<string, unknown> = {
    applicationId: input.applicationId,
    date: input.date,
    time: input.time,
    status: "scheduled",
  };
  if (input.excludeInterviewId) {
    filter._id = { $ne: input.excludeInterviewId };
  }
  const exists = await Interview.exists(filter);
  if (exists) {
    throw new ApiError(
      409,
      "INTERVIEW_SLOT_TAKEN",
      "This candidate already has an interview scheduled at this date and time.",
    );
  }
}

export function assertNotCompleted(status: string) {
  if (status === "completed") {
    throw new ApiError(403, "INTERVIEW_LOCKED", "Completed interviews cannot be changed.");
  }
}

export function canWriteNotes(status: string) {
  return status === "scheduled" || status === "completed";
}

export function assertCanWriteNotes(status: string) {
  if (!canWriteNotes(status)) {
    throw new ApiError(403, "INTERVIEW_LOCKED", "Notes cannot be added to a cancelled or no-show interview.");
  }
}
