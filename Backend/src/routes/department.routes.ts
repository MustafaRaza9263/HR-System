import { Router } from "express";
import { Types } from "mongoose";

import { authenticate } from "../middleware/authenticate.js";
import { verifyBrowserOrigin } from "../middleware/origin.js";
import { Department } from "../models/department.model.js";
import { Role } from "../models/role.model.js";
import { createDepartmentSchema, updateDepartmentSchema } from "../schemas/job-role.schema.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

export const departmentRouter = Router();

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function assertObjectId(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(404, "DEPARTMENT_NOT_FOUND", "Department was not found.");
  }
}

departmentRouter.use(authenticate);

departmentRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    const departments = await Department.find().sort({ createdAt: 1 }).lean();
    const roleCounts = await Role.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $group: { _id: "$departmentId", count: { $sum: 1 } } },
    ]);
    const counts = new Map(roleCounts.map((item) => [item._id.toString(), item.count]));

    response.status(200).json({
      data: {
        departments: departments.map((department) => ({
          id: department._id.toString(),
          name: department.name,
          icon: department.icon,
          status: department.status,
          createdBy: department.createdBy.toString(),
          createdAt: department.createdAt,
          updatedAt: department.updatedAt,
          roleCount: counts.get(department._id.toString()) ?? 0,
        })),
      },
    });
  }),
);

departmentRouter.post(
  "/",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const input = createDepartmentSchema.parse(request.body);
    const normalizedName = normalizeName(input.name);
    const duplicate = await Department.exists({ normalizedName });
    if (duplicate) {
      throw new ApiError(409, "DEPARTMENT_NAME_EXISTS", "A department with this name already exists.");
    }

    const department = await Department.create({
      name: input.name.replace(/\s+/g, " "),
      normalizedName,
      icon: input.icon ?? "building-2",
      createdBy: request.auth!.user.id,
    });

    response.status(201).json({
      data: {
        department: {
          id: department._id.toString(),
          name: department.name,
          icon: department.icon,
          status: department.status,
          createdBy: department.createdBy.toString(),
          createdAt: department.createdAt,
          updatedAt: department.updatedAt,
          roleCount: 0,
        },
      },
    });
  }),
);

departmentRouter.patch(
  "/:departmentId",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const departmentId = request.params.departmentId;
    if (typeof departmentId !== "string") {
      throw new ApiError(404, "DEPARTMENT_NOT_FOUND", "Department was not found.");
    }
    assertObjectId(departmentId);
    const input = updateDepartmentSchema.parse(request.body);
    const update: Record<string, string> = {};

    if (input.name !== undefined) {
      const normalizedName = normalizeName(input.name);
      const duplicate = await Department.exists({
        _id: { $ne: departmentId },
        normalizedName,
      });
      if (duplicate) {
        throw new ApiError(409, "DEPARTMENT_NAME_EXISTS", "A department with this name already exists.");
      }
      update.name = input.name.replace(/\s+/g, " ");
      update.normalizedName = normalizedName;
    }
    if (input.icon !== undefined) update.icon = input.icon;
    if (input.status !== undefined) update.status = input.status;

    const department = await Department.findByIdAndUpdate(
      departmentId,
      { $set: update },
      { new: true, runValidators: true },
    ).lean();
    if (!department) {
      throw new ApiError(404, "DEPARTMENT_NOT_FOUND", "Department was not found.");
    }

    const roleCount = await Role.countDocuments({ departmentId: department._id });
    response.status(200).json({
      data: {
        department: {
          id: department._id.toString(),
          name: department.name,
          icon: department.icon,
          status: department.status,
          createdBy: department.createdBy.toString(),
          createdAt: department.createdAt,
          updatedAt: department.updatedAt,
          roleCount,
        },
      },
    });
  }),
);
