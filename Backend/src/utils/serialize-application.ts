import { Types } from "mongoose";

export interface ApplicationLike {
  _id: Types.ObjectId;
  jobId: Types.ObjectId;
  roleSnapshot: {
    departmentId: Types.ObjectId;
    roleId: Types.ObjectId;
    departmentName: string;
    roleName: string;
    title: string;
  };
  answers: Array<{
    fieldId: string;
    label: string;
    type: string;
    section: string;
    value?: unknown;
    fileName?: string | null;
  }>;
  experienceEntries?: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate?: string | null;
    currentlyWorking?: boolean | null;
    salary?: number | null;
    description?: string | null;
  }>;
  educationEntries?: Array<{
    school: string;
    degree: string;
    fieldOfStudy?: string | null;
    cgpaPercentage?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }>;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  candidateDateOfBirth?: string | null;
  candidateCnic?: string | null;
  candidateMaritalStatus?: string | null;
  candidateAlternativePhone?: string | null;
  resumeOriginalName: string;
  status: string;
  source: string;
  campaign?: string | null;
  rejectionReason?: string | null;
  rejectedAt?: Date | null;
  decisionReason?: string | null;
  approvedAt?: Date | null;
  trialAt?: Date | null;
  completedInterviewCount?: number;
  aiScore?: number | null;
  aiSummary?: string | null;
  aiScoredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeApplication(application: ApplicationLike) {
  return {
    id: application._id.toString(),
    jobId: application.jobId.toString(),
    roleSnapshot: {
      departmentId: application.roleSnapshot.departmentId.toString(),
      roleId: application.roleSnapshot.roleId.toString(),
      departmentName: application.roleSnapshot.departmentName,
      roleName: application.roleSnapshot.roleName,
      title: application.roleSnapshot.title,
    },
    answers: application.answers.map((answer) => ({
      fieldId: answer.fieldId,
      label: answer.label,
      type: answer.type,
      section: answer.section,
      value: answer.type === "file" ? null : (answer.value ?? null),
      fileName: answer.fileName ?? null,
      hasFile: answer.type === "file" && Boolean(answer.value),
    })),
    experienceEntries: (application.experienceEntries ?? []).map((entry) => ({
      company: entry.company,
      title: entry.title,
      startDate: entry.startDate,
      endDate: entry.endDate ?? null,
      currentlyWorking: Boolean(entry.currentlyWorking),
      salary: typeof entry.salary === "number" ? entry.salary : null,
      description: entry.description ?? "",
    })),
    educationEntries: (application.educationEntries ?? []).map((entry) => ({
      school: entry.school,
      degree: entry.degree,
      fieldOfStudy: entry.fieldOfStudy ?? "",
      cgpaPercentage: entry.cgpaPercentage ?? "",
      startDate: entry.startDate ?? null,
      endDate: entry.endDate ?? null,
    })),
    candidateName: application.candidateName,
    candidateEmail: application.candidateEmail,
    candidatePhone: application.candidatePhone,
    candidateDateOfBirth: application.candidateDateOfBirth ?? null,
    candidateCnic: application.candidateCnic ?? null,
    candidateMaritalStatus: application.candidateMaritalStatus ?? null,
    candidateAlternativePhone: application.candidateAlternativePhone ?? null,
    resumeFileName: application.resumeOriginalName,
    hasResume: true,
    status: application.status,
    source: application.source,
    campaign: application.campaign ?? null,
    rejectionReason: application.rejectionReason ?? null,
    rejectedAt: application.rejectedAt ?? null,
    decisionReason: application.decisionReason ?? null,
    approvedAt: application.approvedAt ?? null,
    trialAt: application.trialAt ?? null,
    completedInterviewCount: application.completedInterviewCount ?? 0,
    aiScore: application.aiScore ?? null,
    aiSummary: application.aiSummary ?? null,
    aiScoredAt: application.aiScoredAt ?? null,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

export function serializeListItem(application: {
  _id: Types.ObjectId;
  jobId: Types.ObjectId;
  candidateName: string;
  candidateEmail: string;
  roleSnapshot: { title: string; departmentName: string; roleName: string };
  status: string;
  createdAt: Date;
  resumeOriginalName: string;
}) {
  return {
    id: application._id.toString(),
    jobId: application.jobId.toString(),
    candidateName: application.candidateName,
    candidateEmail: application.candidateEmail,
    jobTitle: application.roleSnapshot.title,
    departmentName: application.roleSnapshot.departmentName,
    roleName: application.roleSnapshot.roleName,
    status: application.status,
    createdAt: application.createdAt,
    resumeFileName: application.resumeOriginalName,
  };
}
