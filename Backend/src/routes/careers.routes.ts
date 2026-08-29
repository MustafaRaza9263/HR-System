import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type { Types } from "mongoose";
import type { ZodError } from "zod";

import { handleApplyUpload } from "../middleware/apply-upload.js";
import { verifyBrowserOrigin } from "../middleware/origin.js";
import { Application } from "../models/application.model.js";
import { Department } from "../models/department.model.js";
import { Job } from "../models/job.model.js";
import { Role } from "../models/role.model.js";
import { applySystemFieldsSchema, educationEntriesSchema, experienceEntriesSchema } from "../schemas/application.schema.js";
import { enqueueApplicationSideEffects } from "../services/application-side-effects.js";
import { ApiError } from "../utils/api-error.js";
import { parseAnswersJson, validateCustomFieldAnswers, type JobCustomField } from "../utils/application-answers.js";
import { asyncHandler } from "../utils/async-handler.js";
import { saveUpload } from "../utils/uploads.js";

export const careersRouter = Router();

const applyLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: { code: "RATE_LIMITED", message: "Too many applications. Try again later." },
  },
});

function parsePrefixed<T>(schema: { parse: (value: unknown) => T; safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: ZodError } }, raw: unknown, prefix: string): T {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = [prefix, ...issue.path.map(String)].join(".");
    const current = fields[path] ?? [];
    current.push(issue.message);
    fields[path] = current;
  }
  throw new ApiError(422, "VALIDATION_ERROR", "The request contains invalid values.", { fields });
}

function filesByField(files: Express.Multer.File[] | undefined) {
  const map = new Map<string, Express.Multer.File>();
  for (const file of files ?? []) {
    if (file.fieldname === "resume") {
      map.set("resume", file);
      continue;
    }
    if (file.fieldname.startsWith("file_")) {
      map.set(file.fieldname.slice("file_".length), file);
    }
  }
  return map;
}

function toCustomFields(job: { fieldsConfig?: { customFields?: unknown[] } | null }): JobCustomField[] {
  const raw = job.fieldsConfig?.customFields ?? [];
  return raw as JobCustomField[];
}

function serializePublicJob(
  job: {
    _id: Types.ObjectId;
    slug?: string | null;
    title: string;
    departmentId: Types.ObjectId;
    roleId: Types.ObjectId;
    description?: unknown;
    jobType?: string | null;
    positionsAvailable: number;
    salaryMin?: number | null;
    salaryMax?: number | null;
    fieldsConfig?: { customFields?: unknown[] } | null;
    status: string;
  },
  names: { departmentName: string; roleName: string },
) {
  return {
    id: job._id.toString(),
    slug: job.slug ?? null,
    title: job.title,
    departmentId: job.departmentId.toString(),
    departmentName: names.departmentName,
    roleId: job.roleId.toString(),
    roleName: names.roleName,
    description: job.description ?? null,
    jobType: job.jobType ?? null,
    positionsAvailable: job.positionsAvailable,
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    fieldsConfig: { customFields: job.fieldsConfig?.customFields ?? [] },
    status: job.status,
  };
}

async function namesForJob(job: { departmentId: Types.ObjectId; roleId: Types.ObjectId }) {
  const [department, role] = await Promise.all([
    Department.findById(job.departmentId).select("name").lean(),
    Role.findById(job.roleId).select("name").lean(),
  ]);
  return {
    departmentName: department?.name ?? "Team",
    roleName: role?.name ?? "Role",
  };
}

careersRouter.get(
  "/jobs",
  asyncHandler(async (_request, response) => {
    const jobs = await Job.find({ status: "open" })
      .select("slug title departmentId roleId jobType positionsAvailable publishedAt")
      .sort({ publishedAt: -1, createdAt: -1 })
      .lean();

    const departmentIds = [...new Set(jobs.map((job) => job.departmentId.toString()))];
    const departments = departmentIds.length
      ? await Department.find({ _id: { $in: departmentIds } }).select("name").lean()
      : [];
    const departmentNames = new Map(departments.map((item) => [item._id.toString(), item.name]));

    const teams = [...departmentNames.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    response.status(200).json({
      data: {
        jobs: jobs.map((job) => ({
          id: job._id.toString(),
          slug: job.slug,
          title: job.title,
          departmentId: job.departmentId.toString(),
          departmentName: departmentNames.get(job.departmentId.toString()) ?? "Team",
          jobType: job.jobType ?? null,
          positionsAvailable: job.positionsAvailable,
          publishedAt: job.publishedAt ?? null,
        })),
        teams,
      },
    });
  }),
);

careersRouter.get(
  "/jobs/:slug",
  asyncHandler(async (request, response) => {
    const slug = request.params.slug;
    if (typeof slug !== "string" || !slug.trim()) {
      throw new ApiError(404, "JOB_NOT_FOUND", "This role was not found.");
    }

    const job = await Job.findOne({ slug: slug.trim() }).lean();
    if (!job || !job.slug || job.status === "draft") {
      throw new ApiError(404, "JOB_NOT_FOUND", "This role was not found.");
    }

    const names = await namesForJob(job);
    response.status(200).json({
      data: {
        job: serializePublicJob(job, names),
      },
    });
  }),
);

careersRouter.post(
  "/jobs/:slug/apply",
  verifyBrowserOrigin,
  applyLimiter,
  handleApplyUpload,
  asyncHandler(async (request, response) => {
    const slug = request.params.slug;
    if (typeof slug !== "string" || !slug.trim()) {
      throw new ApiError(404, "JOB_NOT_FOUND", "This role was not found.");
    }

    const job = await Job.findOne({ slug: slug.trim() }).lean();
    if (!job || !job.slug || job.status === "draft") {
      throw new ApiError(404, "JOB_NOT_FOUND", "This role was not found.");
    }
    if (job.status !== "open") {
      throw new ApiError(409, "JOB_NOT_OPEN", "This role is no longer accepting applications.");
    }

    const body = request.body as Record<string, unknown>;
    const system = applySystemFieldsSchema.parse({
      candidateName: body.candidateName,
      candidateEmail: body.candidateEmail,
      candidatePhone: body.candidatePhone,
    });

    const uploaded = filesByField(request.files as Express.Multer.File[] | undefined);
    const resume = uploaded.get("resume");
    if (!resume) {
      throw new ApiError(422, "VALIDATION_ERROR", "Upload a resume.", {
        fields: { resume: ["Upload a resume."] },
      });
    }

    const customFields = toCustomFields(job);
    const submitted = parseAnswersJson(body.answers);
    const answers = validateCustomFieldAnswers(customFields, submitted, uploaded);

    let experienceRaw: unknown = body.experience;
    let educationRaw: unknown = body.education;
    try {
      if (typeof body.experience === "string") experienceRaw = JSON.parse(body.experience);
      if (typeof body.education === "string") educationRaw = JSON.parse(body.education);
    } catch {
      throw new ApiError(422, "VALIDATION_ERROR", "Experience or education could not be parsed.", {
        fields: { experience: ["Experience or education could not be parsed."] },
      });
    }
    const experienceEntries = parsePrefixed(experienceEntriesSchema, experienceRaw, "experience").map((entry) => ({
      company: entry.company.replace(/\s+/g, " "),
      title: entry.title.replace(/\s+/g, " "),
      startDate: entry.startDate,
      endDate: entry.endDate?.trim() ? entry.endDate.trim() : null,
      description: entry.description?.trim() ?? "",
    }));
    const educationEntries = parsePrefixed(educationEntriesSchema, educationRaw, "education").map((entry) => ({
      school: entry.school.replace(/\s+/g, " "),
      degree: entry.degree.replace(/\s+/g, " "),
      fieldOfStudy: entry.fieldOfStudy?.trim() ?? "",
      startDate: entry.startDate?.trim() ? entry.startDate.trim() : null,
      endDate: entry.endDate?.trim() ? entry.endDate.trim() : null,
    }));

    const names = await namesForJob(job);
    const savedResume = await saveUpload(resume, "resumes");

    const storedAnswers = [];
    for (const answer of answers) {
      if (answer.type === "file") {
        const file = uploaded.get(answer.fieldId);
        if (!file) continue;
        const saved = await saveUpload(file, "fields");
        storedAnswers.push({
          ...answer,
          value: saved.relative,
          fileName: saved.originalName,
        });
      } else {
        storedAnswers.push(answer);
      }
    }

    const created = await Application.create({
      jobId: job._id,
      roleSnapshot: {
        departmentId: job.departmentId,
        roleId: job.roleId,
        departmentName: names.departmentName,
        roleName: names.roleName,
        title: job.title,
      },
      answers: storedAnswers,
      experienceEntries,
      educationEntries,
      candidateName: system.candidateName.replace(/\s+/g, " "),
      candidateEmail: system.candidateEmail.toLowerCase(),
      candidatePhone: system.candidatePhone.replace(/\s+/g, " "),
      resumeUrl: savedResume.relative,
      resumeOriginalName: savedResume.originalName,
      status: "submitted",
      source: "website",
      campaign: null,
      aiScore: null,
      aiSummary: null,
      aiScoredAt: null,
    });

    const incremented = await Job.updateOne(
      { _id: job._id, status: "open" },
      { $inc: { applicationCount: 1 } },
    );
    if (incremented.matchedCount === 0) {
      await Application.deleteOne({ _id: created._id });
      throw new ApiError(409, "JOB_NOT_OPEN", "This role is no longer accepting applications.");
    }

    enqueueApplicationSideEffects(created._id.toString());

    response.status(201).json({
      data: {
        applicationId: created._id.toString(),
      },
    });
  }),
);
