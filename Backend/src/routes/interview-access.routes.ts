import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { extname } from "node:path";

import { Router, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";

import { GUEST_ACCESS_COOKIE_NAME } from "../constants/auth.js";
import { Application } from "../models/application.model.js";
import { Department } from "../models/department.model.js";
import { DepartmentAccessLink } from "../models/department-access-link.model.js";
import { Interview } from "../models/interview.model.js";
import { InterviewNote } from "../models/interview-note.model.js";
import { LinkRegistrant } from "../models/link-registrant.model.js";
import { notifyHR } from "../notifications/index.js";
import { interviewNoteSchema, registerAccessSchema } from "../schemas/interview.schema.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { setGuestAccessCookie } from "../utils/cookies.js";
import { endOfAccessInstant, isAccessDateExpired, todayCalendarDate } from "../utils/date-state.js";
import { logger } from "../utils/logger.js";
import { assertObjectId } from "../utils/object-id.js";
import { serializeInterview } from "../utils/serialize-interview.js";
import { signGuestAccessToken, verifyGuestAccessToken } from "../utils/token.js";
import { contentDispositionFilename, resolveUploadPath } from "../utils/uploads.js";

export const interviewAccessRouter = Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." },
  },
});

function mimeFor(filename: string) {
  const ext = extname(filename).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

async function loadLiveLink(token: string) {
  const link = await DepartmentAccessLink.findOne({ token });
  if (!link) {
    throw new ApiError(404, "LINK_NOT_FOUND", "Access link was not found.");
  }
  if (isAccessDateExpired(link.accessDate) || link.accessDate !== todayCalendarDate()) {
    throw new ApiError(410, "LINK_EXPIRED", "This link has expired.");
  }
  return link;
}

async function readGuestSession(request: Request, linkToken: string) {
  const cookie = request.cookies?.[GUEST_ACCESS_COOKIE_NAME];
  if (typeof cookie !== "string" || !cookie) return null;
  try {
    const payload = await verifyGuestAccessToken(cookie);
    if (payload.linkToken !== linkToken) return null;
    const registrant = await LinkRegistrant.findById(payload.registrantId);
    if (!registrant || registrant.linkToken !== linkToken) return null;
    return registrant;
  } catch {
    return null;
  }
}

async function attachGuestCookie(response: Response, registrantId: string, linkToken: string, accessDate: string) {
  const expiresAt = endOfAccessInstant(accessDate);
  const token = await signGuestAccessToken({ registrantId, linkToken }, expiresAt);
  setGuestAccessCookie(response, token, expiresAt);
}

function publicState(input: {
  token: string;
  accessDate: string;
  departmentName?: string | null;
  registrant?: { id: string; name: string; email: string; status: string } | null;
}) {
  return {
    token: input.token,
    accessDate: input.accessDate,
    departmentName: input.departmentName ?? null,
    session: input.registrant
      ? {
          registrantId: input.registrant.id,
          name: input.registrant.name,
          email: input.registrant.email,
          status: input.registrant.status,
        }
      : null,
  };
}

interviewAccessRouter.get(
  "/:token",
  asyncHandler(async (request, response) => {
    const token = request.params.token;
    if (typeof token !== "string") {
      throw new ApiError(404, "LINK_NOT_FOUND", "Access link was not found.");
    }
    const link = await DepartmentAccessLink.findOne({ token }).lean();
    if (!link) {
      throw new ApiError(404, "LINK_NOT_FOUND", "Access link was not found.");
    }
    const department = await Department.findById(link.departmentId).select("name").lean();
    const registrant = await readGuestSession(request, token);
    const expired = isAccessDateExpired(link.accessDate);

    response.status(200).json({
      data: {
        expired,
        state: publicState({
          token: link.token,
          accessDate: link.accessDate,
          departmentName: department?.name ?? null,
          registrant: registrant
            ? {
                id: registrant._id.toString(),
                name: registrant.name,
                email: registrant.email,
                status: registrant.status,
              }
            : null,
        }),
      },
    });
  }),
);

interviewAccessRouter.post(
  "/:token/register",
  registerLimiter,
  asyncHandler(async (request, response) => {
    const token = request.params.token;
    if (typeof token !== "string") {
      throw new ApiError(404, "LINK_NOT_FOUND", "Access link was not found.");
    }
    const input = registerAccessSchema.parse(request.body);
    const link = await loadLiveLink(token);

    const registrant = await LinkRegistrant.create({
      linkToken: link.token,
      name: input.name.replace(/\s+/g, " "),
      email: input.email.toLowerCase(),
      status: "pending_approval",
      requestedAt: new Date(),
    });

    await attachGuestCookie(response, registrant._id.toString(), link.token, link.accessDate);

    void notifyHR("interview_request", registrant._id.toString()).catch((error) => {
      logger.error("notifyHR interview_request failed", error);
    });

    const department = await Department.findById(link.departmentId).select("name").lean();
    response.status(200).json({
      data: {
        expired: false,
        state: publicState({
          token: link.token,
          accessDate: link.accessDate,
          departmentName: department?.name ?? null,
          registrant: {
            id: registrant._id.toString(),
            name: registrant.name,
            email: registrant.email,
            status: registrant.status,
          },
        }),
      },
    });
  }),
);

async function requireApprovedRegistrant(request: Request) {
  const token = request.params.token;
  if (typeof token !== "string") {
    throw new ApiError(404, "LINK_NOT_FOUND", "Access link was not found.");
  }
  const link = await loadLiveLink(token);
  const registrant = await readGuestSession(request, token);
  if (!registrant) {
    throw new ApiError(403, "LINK_NOT_APPROVED", "Sign in from this browser by requesting access.");
  }
  if (registrant.status === "revoked") {
    throw new ApiError(403, "LINK_REVOKED", "This access was revoked.");
  }
  if (registrant.status !== "approved") {
    throw new ApiError(403, "LINK_NOT_APPROVED", "This request is not approved yet.");
  }
  return { link, registrant };
}

interviewAccessRouter.get(
  "/:token/interviews",
  asyncHandler(async (request, response) => {
    const { link, registrant } = await requireApprovedRegistrant(request);
    const interviews = await Interview.find({
      departmentId: link.departmentId,
      date: link.accessDate,
      status: "scheduled",
    })
      .sort({ time: 1 })
      .lean();

    const applicationIds = interviews.map((item) => item.applicationId);
    const applications = await Application.find({ _id: { $in: applicationIds } })
      .select("candidateName candidateEmail roleSnapshot resumeOriginalName")
      .lean();
    const applicationById = new Map(applications.map((item) => [item._id.toString(), item]));
    const serialized = await Promise.all(
      interviews.map(async (interview) => {
        const application = applicationById.get(interview.applicationId.toString());
        return {
          ...(await serializeInterview(interview)),
          candidateName: application?.candidateName ?? "",
          candidateEmail: application?.candidateEmail ?? "",
          jobTitle: application?.roleSnapshot.title ?? "",
          resumeOriginalName: application?.resumeOriginalName ?? "resume.pdf",
          resumePath: `/interview-access/${link.token}/interviews/${interview._id.toString()}/resume`,
        };
      }),
    );

    response.status(200).json({
      data: {
        interviews: serialized,
        registrant: { name: registrant.name, email: registrant.email },
      },
    });
  }),
);

interviewAccessRouter.get(
  "/:token/interviews/:interviewId/resume",
  asyncHandler(async (request, response) => {
    const { link } = await requireApprovedRegistrant(request);
    const interviewId = request.params.interviewId;
    if (typeof interviewId !== "string") {
      throw new ApiError(404, "INTERVIEW_NOT_FOUND", "Interview was not found.");
    }
    assertObjectId(interviewId, "INTERVIEW_NOT_FOUND", "Interview was not found.");
    const interview = await Interview.findOne({
      _id: interviewId,
      departmentId: link.departmentId,
      date: link.accessDate,
      status: "scheduled",
    }).lean();
    if (!interview) {
      throw new ApiError(404, "INTERVIEW_NOT_FOUND", "Interview was not found.");
    }
    const application = await Application.findById(interview.applicationId)
      .select("resumeUrl resumeOriginalName")
      .lean();
    if (!application) {
      throw new ApiError(404, "APPLICATION_NOT_FOUND", "Application was not found.");
    }
    const absolute = resolveUploadPath(application.resumeUrl);
    try {
      await access(absolute);
    } catch {
      throw new ApiError(404, "RESUME_NOT_FOUND", "Resume file was not found.");
    }
    const filename = contentDispositionFilename(application.resumeOriginalName);
    response.setHeader("Content-Type", mimeFor(filename));
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    createReadStream(absolute).pipe(response);
  }),
);

interviewAccessRouter.post(
  "/:token/interviews/:interviewId/notes",
  asyncHandler(async (request, response) => {
    const { link, registrant } = await requireApprovedRegistrant(request);
    const interviewId = request.params.interviewId;
    if (typeof interviewId !== "string") {
      throw new ApiError(404, "INTERVIEW_NOT_FOUND", "Interview was not found.");
    }
    assertObjectId(interviewId, "INTERVIEW_NOT_FOUND", "Interview was not found.");
    const interview = await Interview.findOne({
      _id: interviewId,
      departmentId: link.departmentId,
      date: link.accessDate,
      status: "scheduled",
    });
    if (!interview) {
      throw new ApiError(404, "INTERVIEW_NOT_FOUND", "Interview was not found.");
    }
    if (interview.status === "completed") {
      throw new ApiError(403, "INTERVIEW_LOCKED", "Notes cannot be added to a completed interview.");
    }

    const input = interviewNoteSchema.parse(request.body);
    await InterviewNote.create({
      interviewId: interview._id,
      authorName: registrant.name,
      authorEmail: registrant.email,
      content: input.content,
    });

    response.status(201).json({ data: { interview: await serializeInterview(interview.toObject()) } });
  }),
);
