import { Router } from "express";

import { Department } from "../models/department.model.js";
import { Job } from "../models/job.model.js";
import { asyncHandler } from "../utils/async-handler.js";

export const careersRouter = Router();

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
