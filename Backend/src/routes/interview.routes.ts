import { Router } from "express";
import { Types } from "mongoose";

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
import {
  sendCandidateInterviewCancelled,
  sendCandidateInterviewRescheduled,
} from "../services/email.js";
import { ApiError } from "../utils/api-error.js";
import { recomputeApplicationStatus } from "../utils/application-status.js";
import { asyncHandler } from "../utils/async-handler.js";
import { shiftCalendarDate, todayCalendarDate } from "../utils/date-state.js";
import { assertNotCompleted, assertScheduled, canMarkComplete } from "../utils/interview-rules.js";
import { assertObjectId } from "../utils/object-id.js";
import { serializeInterview, serializeInterviews } from "../utils/serialize-interview.js";

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
    const today = todayCalendarDate();
    const tomorrow = shiftCalendarDate(today, 1);

    const interviews = await Interview.find().sort({ date: 1, time: 1 }).lean();
    const serialized = await serializeInterviews(interviews);
    const applicationIds = [...new Set(interviews.map((item) => item.applicationId.toString()))];
    const applications = await Application.find({ _id: { $in: applicationIds } })
      .select("candidateName candidateEmail candidatePhone roleSnapshot jobId")
      .lean();
    const applicationById = new Map(applications.map((item) => [item._id.toString(), item]));

    const rows = serialized.flatMap((interview) => {
      const application = applicationById.get(interview.applicationId);
      if (!application) return [];
      return [
        {
          ...interview,
          candidateName: application.candidateName,
          candidateEmail: application.candidateEmail,
          candidatePhone: application.candidatePhone,
          jobTitle: application.roleSnapshot.title,
          jobId: application.jobId.toString(),
          departmentName: application.roleSnapshot.departmentName,
        },
      ];
    });

    const scheduledRows = rows.filter((item) => item.status === "scheduled");
    const stats = {
      scheduled: scheduledRows.length,
      today: scheduledRows.filter((item) => item.date === today).length,
      tomorrow: scheduledRows.filter((item) => item.date === tomorrow).length,
      overdue: scheduledRows.filter((item) => item.displayStatus === "overdue").length,
    };

    const listed = rows.filter((item) => {
      if (query.status === "overdue" && item.displayStatus !== "overdue") return false;
      if (query.status && query.status !== "overdue" && item.status !== query.status) return false;
      if (query.jobId && item.jobId !== query.jobId) return false;
      if (query.bucket === "scheduled" && item.status !== "scheduled") return false;
      if (query.bucket === "today" && !(item.status === "scheduled" && item.date === today)) return false;
      if (query.bucket === "tomorrow" && !(item.status === "scheduled" && item.date === tomorrow)) return false;
      if (query.bucket === "overdue" && item.displayStatus !== "overdue") return false;
      if (query.q) {
        const needle = query.q.toLocaleLowerCase();
        const haystack = `${item.candidateName} ${item.candidateEmail} ${item.candidatePhone} ${item.jobTitle}`.toLocaleLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    response.status(200).json({ data: { interviews: listed, stats } });
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

    interview.date = input.date;
    interview.time = input.time;
    interview.durationMinutes = input.durationMinutes;
    interview.status = "scheduled";
    await interview.save();
    await recomputeApplicationStatus(interview.applicationId);

    const application = await loadApplication(interview.applicationId);
    await sendCandidateInterviewRescheduled({
      to: application.candidateEmail,
      candidateName: application.candidateName,
      jobTitle: application.roleSnapshot.title,
      date: interview.date,
      time: interview.time,
      durationMinutes: interview.durationMinutes,
    });

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

    const application = await loadApplication(interview.applicationId);
    await sendCandidateInterviewCancelled({
      to: application.candidateEmail,
      candidateName: application.candidateName,
      jobTitle: application.roleSnapshot.title,
      date: interview.date,
      time: interview.time,
    });

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
    if (interview.status === "completed") {
      throw new ApiError(403, "INTERVIEW_LOCKED", "Notes cannot be added to a completed interview.");
    }
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
