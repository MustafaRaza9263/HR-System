import { randomBytes } from "node:crypto";

import { Router } from "express";
import { Types } from "mongoose";

import { authenticate } from "../middleware/authenticate.js";
import { verifyBrowserOrigin } from "../middleware/origin.js";
import { Application } from "../models/application.model.js";
import { Department } from "../models/department.model.js";
import { Job } from "../models/job.model.js";
import { Role } from "../models/role.model.js";
import { TERMINAL_APPLICATION_STATUSES } from "../schemas/application.schema.js";
import {
  closeJobSchema,
  createJobDraftSchema,
  listJobsQuerySchema,
  updateJobDraftSchema,
} from "../schemas/job.schema.js";
import { ApiError } from "../utils/api-error.js";
import { escapeRegex } from "../utils/application-filter.js";
import { asyncHandler } from "../utils/async-handler.js";
import { paginationMeta } from "../utils/pagination.js";

export const jobRouter = Router();

interface SerializedNames {
  departmentName?: string;
  roleName?: string;
}

function assertObjectId(id: string, code: string, message: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(404, code, message);
  }
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function randomSuffix() {
  return randomBytes(2).toString("hex");
}

function namesFor(job: { departmentId: Types.ObjectId; roleId: Types.ObjectId }, maps: {
  departments: Map<string, string>;
  roles: Map<string, string>;
}): SerializedNames {
  const departmentName = maps.departments.get(job.departmentId.toString());
  const roleName = maps.roles.get(job.roleId.toString());
  const names: SerializedNames = {};
  if (departmentName !== undefined) names.departmentName = departmentName;
  if (roleName !== undefined) names.roleName = roleName;
  return names;
}

function serializeJob(
  job: {
    _id: Types.ObjectId;
    slug?: string | null;
    title: string;
    departmentId: Types.ObjectId;
    roleId: Types.ObjectId;
    description?: unknown;
    descriptionPlain?: string | null;
    jobType?: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    fieldsConfig?: { customFields?: unknown[] } | null;
    status: string;
    closeReason?: string | null;
    applicationCount: number;
    wizardStep: number;
    publishedAt?: Date | null;
    closedAt?: Date | null;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  },
  names: SerializedNames = {},
) {
  return {
    id: job._id.toString(),
    slug: job.slug ?? null,
    title: job.title,
    departmentId: job.departmentId.toString(),
    roleId: job.roleId.toString(),
    ...names,
    description: job.description ?? null,
    descriptionPlain: job.descriptionPlain ?? "",
    jobType: job.jobType ?? null,
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    fieldsConfig: { customFields: job.fieldsConfig?.customFields ?? [] },
    status: job.status,
    closeReason: job.closeReason ?? null,
    applicationCount: job.applicationCount,
    wizardStep: job.wizardStep,
    publishedAt: job.publishedAt ?? null,
    closedAt: job.closedAt ?? null,
    createdBy: job.createdBy.toString(),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function serializeJobListItem(
  job: {
    _id: Types.ObjectId;
    title: string;
    departmentId: Types.ObjectId;
    roleId: Types.ObjectId;
    jobType?: string | null;
    status: string;
    applicationCount: number;
    createdAt: Date;
  },
  names: SerializedNames = {},
) {
  return {
    id: job._id.toString(),
    title: job.title,
    departmentId: job.departmentId.toString(),
    roleId: job.roleId.toString(),
    ...names,
    jobType: job.jobType ?? null,
    status: job.status,
    applicationCount: job.applicationCount,
    createdAt: job.createdAt,
  };
}

const JOB_LIST_SELECT = "title departmentId roleId jobType status applicationCount createdAt";

async function jobListStats() {
  const [row] = await Job.aggregate<{
    totalJobs: number;
    totalOpened: number;
    totalClosed: number;
    applicantSum: number;
  }>([
    {
      $group: {
        _id: null,
        totalJobs: { $sum: 1 },
        totalOpened: { $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } },
        totalClosed: { $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] } },
        applicantSum: { $sum: "$applicationCount" },
      },
    },
  ]);
  const totalJobs = row?.totalJobs ?? 0;
  return {
    totalJobs,
    totalOpened: row?.totalOpened ?? 0,
    averageApplicants: totalJobs === 0 ? 0 : Math.round(((row?.applicantSum ?? 0) / totalJobs) * 10) / 10,
    totalClosed: row?.totalClosed ?? 0,
  };
}

async function loadNameMaps(jobs: Array<{ departmentId: Types.ObjectId; roleId: Types.ObjectId }>) {
  const departmentIds = [...new Set(jobs.map((job) => job.departmentId.toString()))];
  const roleIds = [...new Set(jobs.map((job) => job.roleId.toString()))];
  const [departments, roles] = await Promise.all([
    departmentIds.length
      ? Department.find({ _id: { $in: departmentIds } }).select("name").lean()
      : Promise.resolve([] as Array<{ _id: Types.ObjectId; name: string }>),
    roleIds.length
      ? Role.find({ _id: { $in: roleIds } }).select("name").lean()
      : Promise.resolve([] as Array<{ _id: Types.ObjectId; name: string }>),
  ]);
  return {
    departments: new Map(departments.map((item) => [item._id.toString(), item.name])),
    roles: new Map(roles.map((item) => [item._id.toString(), item.name])),
  };
}

async function assertDepartmentAndRole(departmentId: string, roleId: string) {
  const [department, role] = await Promise.all([
    Department.findById(departmentId).lean(),
    Role.findById(roleId).lean(),
  ]);
  if (!department) {
    throw new ApiError(422, "DEPARTMENT_NOT_FOUND", "Select a valid department.");
  }
  if (!role) {
    throw new ApiError(422, "ROLE_NOT_FOUND", "Select a valid role.");
  }
  if (role.departmentId.toString() !== departmentId) {
    throw new ApiError(422, "ROLE_DEPARTMENT_MISMATCH", "Selected role does not belong to that department.");
  }
  return { department, role };
}

function assertPublishReady(job: {
  title: string;
  jobType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  description?: unknown;
}) {
  if (!job.title.trim()) {
    throw new ApiError(422, "JOB_INCOMPLETE", "Add a job title before publishing.");
  }
  if (!job.jobType) {
    throw new ApiError(422, "JOB_INCOMPLETE", "Select a job type before publishing.");
  }
  if (job.salaryMin === null || job.salaryMin === undefined || job.salaryMax === null || job.salaryMax === undefined) {
    throw new ApiError(422, "JOB_INCOMPLETE", "Set salary min and max before publishing.");
  }
  if (job.salaryMax < job.salaryMin) {
    throw new ApiError(422, "JOB_INCOMPLETE", "Salary max must be greater than or equal to salary min.");
  }
  if (!job.description) {
    throw new ApiError(422, "JOB_INCOMPLETE", "Add a job description before publishing.");
  }
}

async function assertNoActiveConflict(departmentId: string, roleId: string, excludeJobId?: string) {
  const filter: Record<string, unknown> = {
    departmentId,
    roleId,
    status: { $in: ["draft", "open"] },
  };
  if (excludeJobId) {
    filter._id = { $ne: excludeJobId };
  }
  const conflict = await Job.findOne(filter).lean();
  if (!conflict) return;

  const slugPart = conflict.slug ? ` (slug: ${conflict.slug})` : "";
  throw new ApiError(
    409,
    "JOB_DEPARTMENT_ROLE_CONFLICT",
    `Cannot publish: another ${conflict.status} job already exists for this department and role — "${conflict.title}"${slugPart}.`,
  );
}

jobRouter.use(authenticate);

jobRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const query = listJobsQuerySchema.parse(request.query);
    const filter: Record<string, unknown> = {};

    if (query.departmentId) filter.departmentId = query.departmentId;
    if (query.roleId) filter.roleId = query.roleId;
    if (query.status) filter.status = query.status;

    if (query.q) {
      const escaped = escapeRegex(query.q);
      const or: Array<Record<string, unknown>> = [
        { title: { $regex: escaped, $options: "i" } },
        { descriptionPlain: { $regex: escaped, $options: "i" } },
      ];
      if (Types.ObjectId.isValid(query.q)) {
        or.push({ _id: query.q });
      }
      filter.$or = or;
    }

    const skip = (query.page - 1) * query.limit;
    const [jobs, total, stats] = await Promise.all([
      Job.find(filter).select(JOB_LIST_SELECT).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
      Job.countDocuments(filter),
      jobListStats(),
    ]);

    const maps = await loadNameMaps(jobs);
    response.status(200).json({
      data: {
        jobs: jobs.map((job) => serializeJobListItem(job, namesFor(job, maps))),
        stats,
        pagination: paginationMeta(total, query.page, query.limit),
      },
    });
  }),
);

jobRouter.get(
  "/options",
  asyncHandler(async (_request, response) => {
    const jobs = await Job.find().select("title status").sort({ createdAt: -1 }).lean();
    response.status(200).json({
      data: {
        jobs: jobs.map((job) => ({
          id: job._id.toString(),
          title: job.title,
          status: job.status,
        })),
      },
    });
  }),
);

jobRouter.get(
  "/:jobId",
  asyncHandler(async (request, response) => {
    const jobId = request.params.jobId;
    if (typeof jobId !== "string") {
      throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    }
    assertObjectId(jobId, "JOB_NOT_FOUND", "Job was not found.");
    const job = await Job.findById(jobId).lean();
    if (!job) {
      throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    }
    const maps = await loadNameMaps([job]);
    response.status(200).json({
      data: {
        job: serializeJob(job, namesFor(job, maps)),
      },
    });
  }),
);

jobRouter.post(
  "/",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const input = createJobDraftSchema.parse(request.body);
    await assertDepartmentAndRole(input.departmentId, input.roleId);

    const job = await Job.create({
      title: input.title.replace(/\s+/g, " "),
      departmentId: input.departmentId,
      roleId: input.roleId,
      description: input.description ?? null,
      descriptionPlain: input.descriptionPlain ?? "",
      jobType: input.jobType ?? null,
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      fieldsConfig: input.fieldsConfig ?? { customFields: [] },
      wizardStep: input.wizardStep,
      status: "draft",
      createdBy: request.auth!.user.id,
    });

    const lean = await Job.findById(job._id).lean();
    if (!lean) {
      throw new ApiError(500, "JOB_CREATE_FAILED", "Job was created but could not be loaded.");
    }
    const maps = await loadNameMaps([lean]);
    response.status(201).json({
      data: {
        job: serializeJob(lean, namesFor(lean, maps)),
      },
    });
  }),
);

jobRouter.patch(
  "/:jobId",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const jobId = request.params.jobId;
    if (typeof jobId !== "string") {
      throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    }
    assertObjectId(jobId, "JOB_NOT_FOUND", "Job was not found.");
    const input = updateJobDraftSchema.parse(request.body);
    const current = await Job.findById(jobId).lean();
    if (!current) {
      throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    }
    if (current.status !== "draft") {
      throw new ApiError(422, "JOB_NOT_DRAFT", "Only draft jobs can be edited in the wizard.");
    }

    const departmentId = input.departmentId ?? current.departmentId.toString();
    const roleId = input.roleId ?? current.roleId.toString();
    if (input.departmentId !== undefined || input.roleId !== undefined) {
      await assertDepartmentAndRole(departmentId, roleId);
    }

    const update: Record<string, unknown> = {};
    if (input.title !== undefined) update.title = input.title.replace(/\s+/g, " ");
    if (input.departmentId !== undefined) update.departmentId = input.departmentId;
    if (input.roleId !== undefined) update.roleId = input.roleId;
    if (input.description !== undefined) update.description = input.description;
    if (input.descriptionPlain !== undefined) update.descriptionPlain = input.descriptionPlain;
    if (input.jobType !== undefined) update.jobType = input.jobType;
    if (input.salaryMin !== undefined) update.salaryMin = input.salaryMin;
    if (input.salaryMax !== undefined) update.salaryMax = input.salaryMax;
    if (input.fieldsConfig !== undefined) update.fieldsConfig = input.fieldsConfig;
    if (input.wizardStep !== undefined) update.wizardStep = input.wizardStep;

    const salaryMin = (update.salaryMin as number | null | undefined) ?? current.salaryMin;
    const salaryMax = (update.salaryMax as number | null | undefined) ?? current.salaryMax;
    if (
      salaryMin !== null &&
      salaryMin !== undefined &&
      salaryMax !== null &&
      salaryMax !== undefined &&
      salaryMax < salaryMin
    ) {
      throw new ApiError(422, "INVALID_SALARY_RANGE", "Salary max must be greater than or equal to salary min.");
    }

    const job = await Job.findByIdAndUpdate(jobId, { $set: update }, { new: true, runValidators: true }).lean();
    if (!job) {
      throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    }

    const maps = await loadNameMaps([job]);
    response.status(200).json({
      data: {
        job: serializeJob(job, namesFor(job, maps)),
      },
    });
  }),
);

jobRouter.post(
  "/:jobId/publish",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const jobId = request.params.jobId;
    if (typeof jobId !== "string") {
      throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    }
    assertObjectId(jobId, "JOB_NOT_FOUND", "Job was not found.");
    const job = await Job.findById(jobId).lean();
    if (!job) {
      throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    }
    if (job.status !== "draft") {
      throw new ApiError(422, "JOB_NOT_DRAFT", "Only draft jobs can be published.");
    }

    assertPublishReady(job);
    await assertNoActiveConflict(job.departmentId.toString(), job.roleId.toString(), jobId);

    const base = slugify(job.title) || "job";
    let slug = `${base}-${randomSuffix()}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const exists = await Job.exists({ slug });
      if (!exists) break;
      slug = `${base}-${randomSuffix()}`;
    }

    const updated = await Job.findByIdAndUpdate(
      jobId,
      {
        $set: {
          status: "open",
          slug,
          publishedAt: new Date(),
          wizardStep: 4,
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) {
      throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    }

    const maps = await loadNameMaps([updated]);
    response.status(200).json({
      data: {
        job: serializeJob(updated, namesFor(updated, maps)),
      },
    });
  }),
);

jobRouter.post(
  "/:jobId/close",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const jobId = request.params.jobId;
    if (typeof jobId !== "string") {
      throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    }
    assertObjectId(jobId, "JOB_NOT_FOUND", "Job was not found.");
    const input = closeJobSchema.parse(request.body);
    const job = await Job.findById(jobId).lean();
    if (!job) {
      throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    }
    if (job.status !== "open") {
      throw new ApiError(422, "JOB_NOT_OPEN", "Only open jobs can be closed.");
    }

    const pendingCount = await Application.countDocuments({
      jobId: job._id,
      status: { $nin: [...TERMINAL_APPLICATION_STATUSES] },
    });
    if (pendingCount > 0) {
      throw new ApiError(
        409,
        "JOB_HAS_PENDING_APPLICATIONS",
        `${pendingCount} application${pendingCount === 1 ? "" : "s"} still need a decision before this job can be closed.`,
        { pendingCount },
      );
    }

    const updated = await Job.findByIdAndUpdate(
      jobId,
      {
        $set: {
          status: "closed",
          closeReason: input.closeReason.replace(/\s+/g, " "),
          closedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) {
      throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    }

    const maps = await loadNameMaps([updated]);
    response.status(200).json({
      data: {
        job: serializeJob(updated, namesFor(updated, maps)),
      },
    });
  }),
);

jobRouter.post(
  "/:jobId/duplicate",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const jobId = request.params.jobId;
    if (typeof jobId !== "string") {
      throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    }
    assertObjectId(jobId, "JOB_NOT_FOUND", "Job was not found.");
    const source = await Job.findById(jobId).lean();
    if (!source) {
      throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    }
    if (source.status !== "closed") {
      throw new ApiError(422, "JOB_NOT_DUPLICABLE", "Only closed jobs can be duplicated.");
    }

    const duplicatedDescription: unknown = source.description ?? null;
    const created = await Job.create({
      title: source.title,
      departmentId: source.departmentId,
      roleId: source.roleId,
      description: duplicatedDescription,
      descriptionPlain: source.descriptionPlain ?? "",
      jobType: source.jobType ?? null,
      salaryMin: source.salaryMin ?? null,
      salaryMax: source.salaryMax ?? null,
      fieldsConfig: {
        customFields: (source.fieldsConfig?.customFields ?? []).map((field) => ({
          id: field.id,
          label: field.label,
          type: field.type,
          required: field.required,
          section: field.section,
          constraint: field.constraint ?? undefined,
        })),
      },
      wizardStep: 1,
      status: "draft",
      createdBy: request.auth!.user.id,
    });

    const lean = await Job.findById(created._id).lean();
    if (!lean) {
      throw new ApiError(500, "JOB_CREATE_FAILED", "Job was duplicated but could not be loaded.");
    }
    const maps = await loadNameMaps([lean]);
    response.status(201).json({
      data: {
        job: serializeJob(lean, namesFor(lean, maps)),
      },
    });
  }),
);

jobRouter.delete(
  "/:jobId",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const jobId = request.params.jobId;
    if (typeof jobId !== "string") {
      throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    }
    assertObjectId(jobId, "JOB_NOT_FOUND", "Job was not found.");
    const job = await Job.findById(jobId).lean();
    if (!job) {
      throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    }
    if (job.status !== "draft") {
      throw new ApiError(422, "JOB_NOT_DRAFT", "Only draft jobs can be deleted.");
    }
    if ((job.applicationCount ?? 0) > 0) {
      throw new ApiError(422, "JOB_HAS_APPLICATIONS", "Jobs with applications cannot be deleted.");
    }

    await Job.deleteOne({ _id: jobId });
    response.status(204).send();
  }),
);
