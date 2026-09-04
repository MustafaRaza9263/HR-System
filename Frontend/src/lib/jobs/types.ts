import type { ListPagination } from "@/lib/pagination";

export type JobStatus = "draft" | "open" | "closed";

export type JobType =
  | "Full-time"
  | "Part-time"
  | "Contract"
  | "Temporary"
  | "Internship"
  | "Fresher";

export type CustomFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "date"
  | "checkbox"
  | "file";

export type FieldSection = "personal" | "experience" | "education";

export interface CustomFieldConstraint {
  maxLength?: number;
  min?: number;
  max?: number;
  options?: string[];
}

export interface CustomField {
  id: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  constraint?: CustomFieldConstraint;
  section: FieldSection;
}

export interface FieldsConfig {
  customFields: CustomField[];
}

/** TipTap-compatible document JSON */
export type RichTextDoc = {
  type: "doc";
  content?: Record<string, unknown>[];
} | null;

export interface Job {
  id: string;
  slug: string | null;
  title: string;
  departmentId: string;
  roleId: string;
  departmentName?: string;
  roleName?: string;
  description: RichTextDoc;
  descriptionPlain: string;
  jobType: JobType | null;
  salaryMin: number | null;
  salaryMax: number | null;
  fieldsConfig: FieldsConfig;
  status: JobStatus;
  closeReason: string | null;
  applicationCount: number;
  wizardStep: number;
  publishedAt: string | null;
  closedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobListItem {
  id: string;
  title: string;
  departmentId: string;
  roleId: string;
  departmentName?: string;
  roleName?: string;
  jobType: JobType | null;
  status: JobStatus;
  applicationCount: number;
  createdAt: string;
}

export interface JobOption {
  id: string;
  title: string;
  status: JobStatus;
}

export interface JobStats {
  totalJobs: number;
  totalOpened: number;
  averageApplicants: number;
  totalClosed: number;
}

export interface JobsListResponse {
  data: {
    jobs: JobListItem[];
    stats: JobStats;
    pagination: ListPagination;
  };
}

export interface JobOptionsResponse {
  data: { jobs: JobOption[] };
}

export interface JobResponse {
  data: {
    job: Job;
  };
}

export interface JobDraftPayload {
  title: string;
  departmentId: string;
  roleId: string;
  description?: RichTextDoc;
  descriptionPlain?: string;
  jobType?: JobType | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  fieldsConfig?: FieldsConfig;
  wizardStep?: number;
}

export const JOB_TYPES: JobType[] = [
  "Full-time",
  "Part-time",
  "Contract",
  "Temporary",
  "Internship",
  "Fresher",
];

export const FIELD_TYPES: CustomFieldType[] = [
  "text",
  "textarea",
  "number",
  "select",
  "date",
  "checkbox",
  "file",
];

export const FIELD_SECTIONS: FieldSection[] = ["personal", "experience", "education"];

export function emptyRichTextDoc(): Exclude<RichTextDoc, null> {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

export function createFieldId() {
  return `field_${Math.random().toString(36).slice(2, 10)}`;
}
