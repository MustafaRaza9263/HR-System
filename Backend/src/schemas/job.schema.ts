import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Select a valid id.");

export const jobTypeEnum = z.enum([
  "Full-time",
  "Part-time",
  "Contract",
  "Temporary",
  "Internship",
  "Fresher",
]);

export const fieldTypeEnum = z.enum([
  "text",
  "textarea",
  "number",
  "select",
  "date",
  "checkbox",
  "file",
]);

export const fieldSectionEnum = z.enum(["personal", "experience", "education"]);

const customFieldConstraintSchema = z
  .object({
    maxLength: z.number().int().min(1).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    options: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  })
  .optional();

export const customFieldSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    label: z.string().trim().min(1, "Enter a field label.").max(120),
    type: fieldTypeEnum,
    required: z.boolean(),
    constraint: customFieldConstraintSchema,
    section: fieldSectionEnum,
  })
  .superRefine((field, context) => {
    if (field.type === "select") {
      const options = field.constraint?.options ?? [];
      if (options.length < 1) {
        context.addIssue({
          code: "custom",
          message: "Select fields need at least one option.",
          path: ["constraint", "options"],
        });
      }
    }
    if (
      field.type === "number" &&
      field.constraint?.min !== undefined &&
      field.constraint?.max !== undefined &&
      field.constraint.max < field.constraint.min
    ) {
      context.addIssue({
        code: "custom",
        message: "Number max must be greater than or equal to min.",
        path: ["constraint", "max"],
      });
    }
  });

export const fieldsConfigSchema = z.object({
  customFields: z.array(customFieldSchema).max(50).default([]),
});

export const richTextDescriptionSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough()
  .nullable();

export const createJobDraftSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a job title.").max(160),
    departmentId: objectId,
    roleId: objectId,
    description: richTextDescriptionSchema.optional(),
    descriptionPlain: z.string().max(50000).optional(),
    jobType: jobTypeEnum.nullable().optional(),
    positionsAvailable: z.number().int().min(1).default(1),
    salaryMin: z.number().min(0).nullable().optional(),
    salaryMax: z.number().min(0).nullable().optional(),
    fieldsConfig: fieldsConfigSchema.optional(),
    wizardStep: z.number().int().min(1).max(4).default(1),
  })
  .superRefine((value, context) => {
    if (
      value.salaryMin !== null &&
      value.salaryMin !== undefined &&
      value.salaryMax !== null &&
      value.salaryMax !== undefined &&
      value.salaryMax < value.salaryMin
    ) {
      context.addIssue({
        code: "custom",
        message: "Salary max must be greater than or equal to salary min.",
        path: ["salaryMax"],
      });
    }
  });

export const updateJobDraftSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    departmentId: objectId.optional(),
    roleId: objectId.optional(),
    description: richTextDescriptionSchema.optional(),
    descriptionPlain: z.string().max(50000).optional(),
    jobType: jobTypeEnum.nullable().optional(),
    positionsAvailable: z.number().int().min(1).optional(),
    salaryMin: z.number().min(0).nullable().optional(),
    salaryMax: z.number().min(0).nullable().optional(),
    fieldsConfig: fieldsConfigSchema.optional(),
    wizardStep: z.number().int().min(1).max(4).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one value to update.")
  .superRefine((value, context) => {
    if (
      value.salaryMin !== null &&
      value.salaryMin !== undefined &&
      value.salaryMax !== null &&
      value.salaryMax !== undefined &&
      value.salaryMax < value.salaryMin
    ) {
      context.addIssue({
        code: "custom",
        message: "Salary max must be greater than or equal to salary min.",
        path: ["salaryMax"],
      });
    }
  });

export const publishJobSchema = z.object({}).strict();

export const closeJobSchema = z.object({
  closeReason: z.string().trim().min(1, "Enter a close reason.").max(500),
});

export const listJobsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  departmentId: objectId.optional(),
  roleId: objectId.optional(),
  status: z.enum(["draft", "open", "filled", "closed"]).optional(),
});
