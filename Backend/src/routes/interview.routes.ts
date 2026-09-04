import { Router } from "express";
import type { Types } from "mongoose";

import { authenticate } from "../middleware/authenticate.js";
import { verifyBrowserOrigin } from "../middleware/origin.js";
import { Application } from "../models/application.model.js";
import { Interview } from "../models/interview.model.js";
import { InterviewNote } from "../models/interview-note.model.js";
import {
  interviewNoteSchema,
  listInterviewsQuerySchema,
  rescheduleInterviewSchema,
} from "../schemas/interview.schema.js";
import { sendCandidateInterviewRescheduled } from "../services/email/index.js";
import { ApiError } from "../utils/api-error.js";
import { recomputeApplicationStatus } from "../utils/application-status.js";
import { asyncHandler } from "../utils/async-handler.js";
import { listHrInterviews } from "../utils/interview-list.js";
import {
  assertCanWriteNotes,
    assertNoDuplicateInterviewSlot,
    assertNotCompleted,
    assertRescheduleChangesSlot,
    assertScheduled,
    canMarkComplete,
} from "../utils/interview-rules.js";
import { assertObjectId } from "../utils/object-id.js";
import { serializeInterview } from "../utils/serialize-interview.js";

export const interviewRouter = Router();

async function loadInterview(interviewId: string) {
  assertObjectId(interviewId, "INTERVIEW_NOT_FOUND", "Interview was not found.");
  const interview = await Interview.findById(interviewId);
  if (!interview) {
    throw new ApiError(404, "INTERVIEW_NOT_FOUND", "Interview was not found.");
  }
  return interview;
}

async function loadApplication(applicationId: Types.ObjectId) {
  const application = await Application.findById(applicationId)
    .select("candidateName candidateEmail roleSnapshot jobId")
    .lean();
  if (!application) {
    throw new ApiError(404, "APPLICATION_NOT_FOUND", "Application was not found.");
  }
  return application;
}

interviewRouter.use(authenticate);

interviewRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const query = listInterviewsQuerySchema.parse(request.query);
    const result = await listHrInterviews(query);
    response.status(200).json({ data: result });
  }),
);

interviewRouter.patch(
  "/:interviewId/reschedule",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const interviewId = request.params.interviewId;
    if (typeof interviewId !== "string") {
      throw new ApiError(404, "INTERVIEW_NOT_FOUND", "Interview was not found.");
    }
    const input = rescheduleInterviewSchema.parse(request.body);
    const interview = await loadInterview(interviewId);
    assertScheduled(interview.status);
    assertRescheduleChangesSlot({ date: interview.date, time: interview.time }, { date: input.date, time: input.time });
    await assertNoDuplicateInterviewSlot({
      applicationId: interview.applicationId,
      date: input.date,
      time: input.time,
      excludeInterviewId: interview._id,
    });

    interview.label = input.label;
    interview.date = input.date;
    interview.time = input.time;
    interview.durationMinutes = input.durationMinutes;
    interview.status = "scheduled";
    await interview.save();
    await recomputeApplicationStatus(interview.applicationId);

    const application = await loadApplication(interview.applicationId);
    if (input.sendEmail) {
      sendCandidateInterviewRescheduled({
        to: application.candidateEmail,
        candidateName: application.candidateName,
        jobTitle: application.roleSnapshot.title,
        label: interview.label,
        date: interview.date,
        time: interview.time,
        durationMinutes: interview.durationMinutes,
      });
    }

    response.status(200).json({ data: { interview: await serializeInterview(interview.toObject()) } });
  }),
);

interviewRouter.patch(
  "/:interviewId/cancel",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const interviewId = request.params.interviewId;
    if (typeof interviewId !== "string") {
      throw new ApiError(404, "INTERVIEW_NOT_FOUND", "Interview was not found.");
    }
    const interview = await loadInterview(interviewId);
    assertNotCompleted(interview.status);
    assertScheduled(interview.status);

    interview.status = "cancelled";
    await interview.save();
    await recomputeApplicationStatus(interview.applicationId);

    response.status(200).json({ data: { interview: await serializeInterview(interview.toObject()) } });
  }),
);

interviewRouter.patch(
  "/:interviewId/no-show",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const interviewId = request.params.interviewId;
    if (typeof interviewId !== "string") {
      throw new ApiError(404, "INTERVIEW_NOT_FOUND", "Interview was not found.");
    }
    const interview = await loadInterview(interviewId);
    assertNotCompleted(interview.status);
    assertScheduled(interview.status);
    const actions = (await serializeInterview(interview.toObject())).actions;
    if (!actions.includes("no_show")) {
      throw new ApiError(400, "INTERVIEW_NO_SHOW_NOT_ALLOWED", "No-show can only be marked on or after the interview date.");
    }

    interview.status = "no_show";
    await interview.save();
    await recomputeApplicationStatus(interview.applicationId);

    response.status(200).json({ data: { interview: await serializeInterview(interview.toObject()) } });
  }),
);

interviewRouter.patch(
  "/:interviewId/complete",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const interviewId = request.params.interviewId;
    if (typeof interviewId !== "string") {
      throw new ApiError(404, "INTERVIEW_NOT_FOUND", "Interview was not found.");
    }
    const interview = await loadInterview(interviewId);
    assertScheduled(interview.status);
    if (!(await canMarkComplete(interview))) {
      throw new ApiError(
        400,
        "INTERVIEW_NOTES_REQUIRED",
        "Add at least one note before marking this interview complete.",
      );
    }

    interview.status = "completed";
    await interview.save();
    await Application.updateOne({ _id: interview.applicationId }, { $inc: { completedInterviewCount: 1 } }).exec();
    await recomputeApplicationStatus(interview.applicationId);

    response.status(200).json({ data: { interview: await serializeInterview(interview.toObject()) } });
  }),
);

interviewRouter.post(
  "/:interviewId/notes",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const interviewId = request.params.interviewId;
    if (typeof interviewId !== "string") {
      throw new ApiError(404, "INTERVIEW_NOT_FOUND", "Interview was not found.");
    }
    const interview = await loadInterview(interviewId);
    assertCanWriteNotes(interview.status);
    const input = interviewNoteSchema.parse(request.body);
    const hr = request.auth!.user;
    await InterviewNote.create({
      interviewId: interview._id,
      authorName: hr.name,
      authorEmail: hr.email,
      content: input.content,
    });

    response.status(201).json({ data: { interview: await serializeInterview(interview.toObject()) } });
  }),
);
