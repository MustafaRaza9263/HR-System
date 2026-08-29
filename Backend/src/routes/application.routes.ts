import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { extname } from "node:path";

import { Router } from "express";
import { Types } from "mongoose";

import { authenticate } from "../middleware/authenticate.js";
import { Application } from "../models/application.model.js";
import { listApplicationsQuerySchema } from "../schemas/application.schema.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { contentDispositionFilename, resolveUploadPath } from "../utils/uploads.js";

export const applicationRouter = Router();

function assertObjectId(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(404, "APPLICATION_NOT_FOUND", "Application was not found.");
  }
}

function mimeFor(filename: string) {
  const ext = extname(filename).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

function serializeApplication(
  application: {
    _id: Types.ObjectId;
    jobId: Types.ObjectId;
    roleSnapshot: {
      departmentId: Types.ObjectId;
      roleId: Types.ObjectId;
      departmentName: string;
      roleName: string;
      title: string;
    };
    answers: Array<{
      fieldId: string;
      label: string;
      type: string;
      section: string;
      value?: unknown;
      fileName?: string | null;
    }>;
    experienceEntries?: Array<{
      company: string;
      title: string;
      startDate: string;
      endDate?: string | null;
      description?: string | null;
    }>;
    educationEntries?: Array<{
      school: string;
      degree: string;
      fieldOfStudy?: string | null;
      startDate?: string | null;
      endDate?: string | null;
    }>;
    candidateName: string;
    candidateEmail: string;
    candidatePhone: string;
    resumeOriginalName: string;
    status: string;
    source: string;
    campaign?: string | null;
    aiScore?: number | null;
    aiSummary?: string | null;
    aiScoredAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
) {
  return {
    id: application._id.toString(),
    jobId: application.jobId.toString(),
    roleSnapshot: {
      departmentId: application.roleSnapshot.departmentId.toString(),
      roleId: application.roleSnapshot.roleId.toString(),
      departmentName: application.roleSnapshot.departmentName,
      roleName: application.roleSnapshot.roleName,
      title: application.roleSnapshot.title,
    },
    answers: application.answers.map((answer) => ({
      fieldId: answer.fieldId,
      label: answer.label,
      type: answer.type,
      section: answer.section,
      value: answer.type === "file" ? null : (answer.value ?? null),
      fileName: answer.fileName ?? null,
      hasFile: answer.type === "file" && Boolean(answer.value),
    })),
    experienceEntries: (application.experienceEntries ?? []).map((entry) => ({
      company: entry.company,
      title: entry.title,
      startDate: entry.startDate,
      endDate: entry.endDate ?? null,
      description: entry.description ?? "",
    })),
    educationEntries: (application.educationEntries ?? []).map((entry) => ({
      school: entry.school,
      degree: entry.degree,
      fieldOfStudy: entry.fieldOfStudy ?? "",
      startDate: entry.startDate ?? null,
      endDate: entry.endDate ?? null,
    })),
    candidateName: application.candidateName,
    candidateEmail: application.candidateEmail,
    candidatePhone: application.candidatePhone,
    resumeFileName: application.resumeOriginalName,
    hasResume: true,
    status: application.status,
    source: application.source,
    campaign: application.campaign ?? null,
    aiScore: application.aiScore ?? null,
    aiSummary: application.aiSummary ?? null,
    aiScoredAt: application.aiScoredAt ?? null,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

function serializeListItem(
  application: Parameters<typeof serializeApplication>[0],
) {
  const full = serializeApplication(application);
  return {
    id: full.id,
    jobId: full.jobId,
    candidateName: full.candidateName,
    candidateEmail: full.candidateEmail,
    jobTitle: full.roleSnapshot.title,
    departmentName: full.roleSnapshot.departmentName,
    roleName: full.roleSnapshot.roleName,
    status: full.status,
    createdAt: full.createdAt,
  };
}

applicationRouter.use(authenticate);

applicationRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const query = listApplicationsQuerySchema.parse(request.query);
    const filter: Record<string, unknown> = {};

    if (query.jobId) filter.jobId = query.jobId;
    if (query.status) filter.status = query.status;

    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { candidateName: { $regex: escaped, $options: "i" } },
        { candidateEmail: { $regex: escaped, $options: "i" } },
      ];
    }

    const [applications, allForStats] = await Promise.all([
      Application.find(filter).sort({ createdAt: -1 }).lean(),
      Application.find().select("status").lean(),
    ]);

    response.status(200).json({
      data: {
        applications: applications.map((item) => serializeListItem(item)),
        stats: {
          total: allForStats.length,
          scheduled: allForStats.filter((item) => item.status === "interviewing").length,
          rejected: allForStats.filter((item) => item.status === "rejected").length,
          approved: allForStats.filter((item) => item.status === "approved").length,
        },
      },
    });
  }),
);

applicationRouter.get(
  "/:applicationId/resume",
  asyncHandler(async (request, response) => {
    const applicationId = request.params.applicationId;
    if (typeof applicationId !== "string") {
      throw new ApiError(404, "APPLICATION_NOT_FOUND", "Application was not found.");
    }
    assertObjectId(applicationId);

    const application = await Application.findById(applicationId).select("resumeUrl resumeOriginalName").lean();
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

applicationRouter.get(
  "/:applicationId/files/:fieldId",
  asyncHandler(async (request, response) => {
    const applicationId = request.params.applicationId;
    const fieldId = request.params.fieldId;
    if (typeof applicationId !== "string" || typeof fieldId !== "string") {
      throw new ApiError(404, "FILE_NOT_FOUND", "File was not found.");
    }
    assertObjectId(applicationId);

    const application = await Application.findById(applicationId).select("answers").lean();
    if (!application) {
      throw new ApiError(404, "APPLICATION_NOT_FOUND", "Application was not found.");
    }

    const answer = application.answers.find((item) => item.fieldId === fieldId && item.type === "file");
    if (!answer || typeof answer.value !== "string" || !answer.value) {
      throw new ApiError(404, "FILE_NOT_FOUND", "File was not found.");
    }

    const absolute = resolveUploadPath(answer.value);
    try {
      await access(absolute);
    } catch {
      throw new ApiError(404, "FILE_NOT_FOUND", "File was not found.");
    }

    const filename = contentDispositionFilename(answer.fileName ?? "attachment");
    response.setHeader("Content-Type", mimeFor(filename));
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    createReadStream(absolute).pipe(response);
  }),
);

applicationRouter.get(
  "/:applicationId",
  asyncHandler(async (request, response) => {
    const applicationId = request.params.applicationId;
    if (typeof applicationId !== "string") {
      throw new ApiError(404, "APPLICATION_NOT_FOUND", "Application was not found.");
    }
    assertObjectId(applicationId);

    const application = await Application.findById(applicationId).lean();
    if (!application) {
      throw new ApiError(404, "APPLICATION_NOT_FOUND", "Application was not found.");
    }

    response.status(200).json({
      data: {
        application: serializeApplication(application),
      },
    });
  }),
);
