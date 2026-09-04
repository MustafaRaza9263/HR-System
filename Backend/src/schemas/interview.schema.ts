import { z } from "zod";

import { listPaginationQuerySchema } from "../utils/pagination.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Select a valid id.");
const calendarDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");
const clockTime = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "Enter a valid time.");
const durationMinutes = z.coerce
  .number()
  .int()
  .min(15, "Duration must be at least 15 minutes.")
  .max(240, "Duration cannot exceed 240 minutes.");
const interviewLabel = z
  .string()
  .trim()
  .min(1, "Enter a label.")
  .max(80, "Label cannot exceed 80 characters.");

export const createInterviewSchema = z.object({
  label: interviewLabel,
  date: calendarDate,
  time: clockTime,
  durationMinutes,
});

export const rescheduleInterviewSchema = z.object({
  label: interviewLabel,
  date: calendarDate,
  time: clockTime,
  durationMinutes,
  sendEmail: z.boolean().optional().default(true),
});

export const interviewNoteSchema = z.object({
  content: z.string().trim().min(1, "Enter a note.").max(2000, "Note cannot exceed 2000 characters."),
});

export const listInterviewsQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    jobId: objectId.optional(),
    status: z.enum(["scheduled", "completed", "no_show", "cancelled", "overdue"]).optional(),
    bucket: z.enum(["scheduled", "today", "tomorrow", "overdue"]).optional(),
  })
  .extend(listPaginationQuerySchema.shape);

export const createDepartmentLinkSchema = z.object({
  departmentId: objectId,
  email: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().email("Enter a valid email.").max(254).optional(),
  ),
});

export const sendDepartmentLinkEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email.").max(254),
});

export const listDepartmentLinksQuerySchema = z.object({
  date: calendarDate.optional(),
  departmentId: objectId.optional(),
  department_id: objectId.optional(),
});

export const registerAccessSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.string().trim().email("Enter a valid email.").max(254),
});
