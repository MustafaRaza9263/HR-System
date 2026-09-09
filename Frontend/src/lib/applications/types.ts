import type { CustomField, FieldSection, JobStatus, JobType, RichTextDoc } from "@/lib/jobs/types";
import type { ListPagination } from "@/lib/pagination";

import type { ScoringStatus } from "./scoring";

export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "interview_scheduled"
  | "interviewed"
  | "approved"
  | "rejected"
  | "trial";

export interface StatusHistoryEntry {
  status: ApplicationStatus;
  at: string;
}

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
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
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
  currentlyWorking: boolean;
  salary: number | null;
  salaryCurrency: string | null;
  description: string;
}

export interface EducationEntry {
  school: string;
  degree: string;
  fieldOfStudy: string;
  cgpaPercentage: string;
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
  score: number | null;
  scoringStatus: ScoringStatus | null;
  source: string;
  campaign: string | null;
  createdAt: string;
  resumeFileName: string;
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
    pagination: ListPagination;
  };
}

export interface ApplicationScoring {
  status: ScoringStatus | null;
  score: number | null;
  summary: string | null;
  strengths: string[];
  gaps: string[];
  provider: string | null;
  model: string | null;
  linksAttempted: number;
  linksUsed: number;
  scoredAt: string | null;
}

export interface ApplicationScoredEvent extends ApplicationScoring {
  id: string;
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
  candidateDateOfBirth: string | null;
  candidateCnic: string | null;
  candidateMaritalStatus: string | null;
  candidateAlternativePhone: string | null;
  expectedSalary: number | null;
  expectedSalaryCurrency: string | null;
  resumeFileName: string;
  hasResume: boolean;
  status: ApplicationStatus;
  source: string;
  campaign: string | null;
  rejectionReason: string | null;
  rejectedAt: string | null;
  decisionReason: string | null;
  approvedAt: string | null;
  trialAt: string | null;
  completedInterviewCount: number;
  scoring: ApplicationScoring | null;
  createdAt: string;
  updatedAt: string;
  statusHistory: StatusHistoryEntry[];
}

export interface ApplicationDetailResponse {
  data: { application: ApplicationDetail };
}

export interface ApplicationSourceCampaign {
  key: string;
  label: string;
}

export interface ApplicationSourceOption {
  source: string;
  label: string;
  campaigns: ApplicationSourceCampaign[];
}

export interface ApplicationSourcesResponse {
  data: { sources: ApplicationSourceOption[] };
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

export const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_ACCEPT = ".pdf,.doc,.docx";

export interface ResumeAutofillExperience {
  company?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  currentlyWorking?: boolean;
  salary?: number;
  salaryCurrency?: string;
  description?: string;
}

export interface ResumeAutofillEducation {
  school?: string;
  degree?: string;
  fieldOfStudy?: string;
  cgpaPercentage?: string;
  startDate?: string;
  endDate?: string;
}

export interface ResumeAutofillFields {
  candidateName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  candidateDateOfBirth?: string;
  candidateCnic?: string;
  candidateMaritalStatus?: string;
  candidateAlternativePhone?: string;
  expectedSalary?: number;
  expectedSalaryCurrency?: string;
  experience?: ResumeAutofillExperience[];
  education?: ResumeAutofillEducation[];
  answers?: Record<string, string | number | boolean>;
}

export interface ResumeAutofillResponse {
  data: {
    fields: ResumeAutofillFields;
    extractedFieldCount: number;
  };
}
