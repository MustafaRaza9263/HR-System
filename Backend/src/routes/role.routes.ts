import { Router } from "express";
import { Types } from "mongoose";

import { authenticate } from "../middleware/authenticate.js";
import { verifyBrowserOrigin } from "../middleware/origin.js";
import { Department } from "../models/department.model.js";
import { Role } from "../models/role.model.js";
import { createRoleSchema, updateRoleSchema } from "../schemas/job-role.schema.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

export const roleRouter = Router();

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function assertObjectId(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(404, "ROLE_NOT_FOUND", "Role was not found.");
  }
}

async function requireActiveDepartment(departmentId: string) {
  const department = await Department.findOne({ _id: departmentId, status: "active" }).lean();
  if (!department) {
    throw new ApiError(422, "ACTIVE_DEPARTMENT_REQUIRED", "Select an active department for this role.");
  }
  return department;
}

roleRouter.use(authenticate);

roleRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const departmentId = typeof request.query.departmentId === "string" ? request.query.departmentId : undefined;
    if (departmentId && !Types.ObjectId.isValid(departmentId)) {
      throw new ApiError(422, "INVALID_DEPARTMENT", "Select a valid department.");
    }

    const roles = await Role.find(departmentId ? { departmentId } : {}).sort({ createdAt: 1 }).lean();
    response.status(200).json({
      data: {
        roles: roles.map((role) => ({
          id: role._id.toString(),
          name: role.name,
          departmentId: role.departmentId.toString(),
          icon: role.icon,
          status: role.status,
          createdBy: role.createdBy.toString(),
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        })),
      },
    });
  }),
);

roleRouter.post(
  "/",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const input = createRoleSchema.parse(request.body);
    await requireActiveDepartment(input.departmentId);
    const normalizedName = normalizeName(input.name);
    const duplicate = await Role.exists({ departmentId: input.departmentId, normalizedName });
    if (duplicate) {
      throw new ApiError(409, "ROLE_NAME_EXISTS", "This department already has a role with that name.");
    }

    const role = await Role.create({
      name: input.name.replace(/\s+/g, " "),
      normalizedName,
      departmentId: input.departmentId,
      icon: input.icon ?? "briefcase-business",
      createdBy: request.auth!.user.id,
    });

    response.status(201).json({
      data: {
        role: {
          id: role._id.toString(),
          name: role.name,
          departmentId: role.departmentId.toString(),
          icon: role.icon,
          status: role.status,
          createdBy: role.createdBy.toString(),
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        },
      },
    });
  }),
);

roleRouter.patch(
  "/:roleId",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const roleId = request.params.roleId;
    if (typeof roleId !== "string") {
      throw new ApiError(404, "ROLE_NOT_FOUND", "Role was not found.");
    }
    assertObjectId(roleId);
    const input = updateRoleSchema.parse(request.body);
    const current = await Role.findById(roleId).select("+normalizedName").lean();
    if (!current) {
      throw new ApiError(404, "ROLE_NOT_FOUND", "Role was not found.");
    }

    const departmentId = input.departmentId ?? current.departmentId.toString();
    if (input.departmentId !== undefined) await requireActiveDepartment(departmentId);
    const normalizedName = input.name === undefined ? current.normalizedName : normalizeName(input.name);
    if (input.name !== undefined || input.departmentId !== undefined) {
      const duplicate = await Role.exists({
        _id: { $ne: current._id },
        departmentId,
        normalizedName,
      });
      if (duplicate) {
        throw new ApiError(409, "ROLE_NAME_EXISTS", "This department already has a role with that name.");
      }
    }

    const update: Record<string, string> = {};
    if (input.name !== undefined) {
      update.name = input.name.replace(/\s+/g, " ");
      update.normalizedName = normalizedName;
    }
    if (input.departmentId !== undefined) update.departmentId = input.departmentId;
    if (input.icon !== undefined) update.icon = input.icon;
    if (input.status !== undefined) update.status = input.status;

    const role = await Role.findByIdAndUpdate(current._id, { $set: update }, { new: true, runValidators: true }).lean();
    if (!role) throw new ApiError(404, "ROLE_NOT_FOUND", "Role was not found.");

    response.status(200).json({
      data: {
        role: {
          id: role._id.toString(),
          name: role.name,
          departmentId: role.departmentId.toString(),
          icon: role.icon,
          status: role.status,
          createdBy: role.createdBy.toString(),
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        },
      },
    });
  }),
);
