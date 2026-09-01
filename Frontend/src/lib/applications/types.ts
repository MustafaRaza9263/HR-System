import type { CustomField, FieldSection, JobStatus, JobType, RichTextDoc } from "@/lib/jobs/types";

export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "interview_scheduled"
  | "interviewed"
  | "approved"
  | "rejected"
  | "trial";

export interface PublicJobDetail {
  id: string;
  slug: string | null;
  title: string;
  departmentId: string;
  departmentName: string;
  roleId: string;
  roleName: string;
  description: RichTextDoc;
  jobType: JobType | null;
  positionsAvailable: number;
  salaryMin: number | null;
  salaryMax: number | null;
  fieldsConfig: { customFields: CustomField[] };
  status: JobStatus;
}

export interface PublicJobDetailResponse {
  data: { job: PublicJobDetail };
}

export interface ApplyResponse {
  data: { applicationId: string };
}

export interface ApplicationAnswer {
  fieldId: string;
  label: string;
  type: CustomField["type"];
  section: FieldSection;
  value: string | number | boolean | null;
  fileName: string | null;
  hasFile: boolean;
}

export interface ExperienceEntry {
  company: string;
  title: string;
  startDate: string;
  endDate: string | null;
  description: string;
}

export interface EducationEntry {
  school: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string | null;
  endDate: string | null;
}

export interface ApplicationListItem {
  id: string;
  jobId: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  departmentName: string;
  roleName: string;
  status: ApplicationStatus;
  createdAt: string;
}

export interface ApplicationStats {
  total: number;
  scheduled: number;
  rejected: number;
  approved: number;
}

export interface ApplicationsListResponse {
  data: {
    applications: ApplicationListItem[];
    stats: ApplicationStats;
  };
}

export interface ApplicationDetail {
  id: string;
  jobId: string;
  roleSnapshot: {
    departmentId: string;
    roleId: string;
    departmentName: string;
    roleName: string;
    title: string;
  };
  answers: ApplicationAnswer[];
  experienceEntries: ExperienceEntry[];
  educationEntries: EducationEntry[];
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  resumeFileName: string;
  hasResume: boolean;
  status: ApplicationStatus;
  source: string;
  campaign: string | null;
  rejectionReason: string | null;
  rejectedAt: string | null;
  completedInterviewCount: number;
  aiScore: number | null;
  aiSummary: string | null;
  aiScoredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationDetailResponse {
  data: { application: ApplicationDetail };
}

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "submitted",
  "under_review",
  "interview_scheduled",
  "interviewed",
  "approved",
  "rejected",
  "trial",
];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_ACCEPT = ".pdf,.doc,.docx";
