import { z } from "zod";

const name = z.string().trim().min(1, "Enter a name.").max(100, "Name cannot exceed 100 characters.");
const icon = z.string().trim().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9-]*$/, "Select a valid icon.");
const status = z.enum(["active", "inactive"]);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Select a valid department.");

export const createDepartmentSchema = z.object({
  name,
  icon: icon.optional(),
});

export const updateDepartmentSchema = z.object({
  name: name.optional(),
  icon: icon.optional(),
  status: status.optional(),
}).refine((value) => Object.keys(value).length > 0, "Provide at least one value to update.");

export const createRoleSchema = z.object({
  name,
  departmentId: objectId,
  icon: icon.optional(),
});

export const updateRoleSchema = z.object({
  name: name.optional(),
  departmentId: objectId.optional(),
  icon: icon.optional(),
  status: status.optional(),
}).refine((value) => Object.keys(value).length > 0, "Provide at least one value to update.");
