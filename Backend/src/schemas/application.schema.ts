import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Select a valid id.");

export const applicationStatusEnum = z.enum([
  "submitted",
  "under_review",
  "interview_scheduled",
  "interviewed",
  "approved",
  "rejected",
  "trial",
]);

export const TERMINAL_APPLICATION_STATUSES = ["approved", "rejected"] as const;

export const decisionReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Enter a reason of at least 10 characters.")
    .max(500, "Reason cannot exceed 500 characters."),
});

export const rejectApplicationSchema = decisionReasonSchema;
export const approveApplicationSchema = decisionReasonSchema;

export const bulkRejectSchema = z.object({
  jobId: objectId,
  q: z.string().trim().max(200).optional(),
  status: applicationStatusEnum.optional(),
  applicationIds: z.array(objectId).max(500, "Select at most 500 applications.").optional(),
  reason: z
    .string()
    .trim()
    .min(10, "Enter a reason of at least 10 characters.")
    .max(500, "Reason cannot exceed 500 characters.")
    .optional(),
  dryRun: z.boolean().optional(),
});

export const applySystemFieldsSchema = z.object({
  candidateName: z.string().trim().min(1, "Enter your name.").max(120),
  candidateEmail: z.string().trim().email("Enter a valid email.").max(254),
  candidatePhone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number.")
    .max(30)
    .regex(/^[+\d][\d\s().-]*$/, "Enter a valid phone number."),
});

export const submittedAnswerSchema = z.object({
  fieldId: z.string().trim().min(1).max(64),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export const submittedAnswersSchema = z.array(submittedAnswerSchema).max(50);

const optionalDate = z
  .string()
  .trim()
  .max(10)
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Enter a valid date.");

export const experienceEntrySchema = z
  .object({
    company: z.string().trim().min(1, "Enter a company.").max(160),
    title: z.string().trim().min(1, "Enter a job title.").max(160),
    startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a start date."),
    endDate: optionalDate.optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .superRefine((entry, context) => {
    const endDate = entry.endDate?.trim() ?? "";
    if (endDate && endDate < entry.startDate) {
      context.addIssue({
        code: "custom",
        message: "End date must be on or after the start date.",
        path: ["endDate"],
      });
    }
  });

export const educationEntrySchema = z
  .object({
    school: z.string().trim().min(1, "Enter a school.").max(160),
    degree: z.string().trim().min(1, "Enter a degree.").max(160),
    fieldOfStudy: z.string().trim().max(160).optional(),
    startDate: optionalDate.optional(),
    endDate: optionalDate.optional(),
  })
  .superRefine((entry, context) => {
    const startDate = entry.startDate?.trim() ?? "";
    const endDate = entry.endDate?.trim() ?? "";
    if (startDate && endDate && endDate < startDate) {
      context.addIssue({
        code: "custom",
        message: "End date must be on or after the start date.",
        path: ["endDate"],
      });
    }
  });

export const experienceEntriesSchema = z.array(experienceEntrySchema).min(1, "Add at least one experience.").max(8);
export const educationEntriesSchema = z.array(educationEntrySchema).min(1, "Add at least one education.").max(8);

export const listApplicationsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  jobId: objectId.optional(),
  status: applicationStatusEnum.optional(),
});
