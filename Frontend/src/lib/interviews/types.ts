import type { ListPagination } from "@/lib/pagination";

export type InterviewStatus = "scheduled" | "completed" | "no_show" | "cancelled";
export type DisplayStatus = InterviewStatus | "overdue";
export type DateState = "future" | "today" | "passed";
export type InterviewAction = "reschedule" | "cancel" | "no_show" | "mark_complete";
export type RegistrantStatus = "pending_approval" | "approved" | "rejected" | "revoked";

export interface InterviewNote {
  id: string;
  authorName: string;
  authorEmail: string;
  content: string;
  createdAt: string;
}

export interface Interview {
  id: string;
  applicationId: string;
  departmentId: string;
  label: string;
  date: string;
  time: string;
  durationMinutes: number;
  status: InterviewStatus;
  displayStatus: DisplayStatus;
  dateState: DateState;
  actions: InterviewAction[];
  notes: InterviewNote[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewsListResponse {
  data: { interviews: Interview[] };
}

export interface InterviewListItem extends Interview {
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  jobTitle: string;
  jobId: string;
  departmentName: string;
}

export interface InterviewBoardStats {
  scheduled: number;
  today: number;
  tomorrow: number;
  overdue: number;
}

export interface InterviewsBoardResponse {
  data: {
    interviews: InterviewListItem[];
    stats: InterviewBoardStats;
    pagination: ListPagination;
  };
}

export interface InterviewResponse {
  data: { interview: Interview };
}

export interface RequesterCounts {
  pending: number;
  approved: number;
  rejected: number;
  revoked: number;
}

export interface DepartmentLink {
  token: string;
  departmentId: string;
  departmentName?: string;
  accessDate: string;
  url: string;
  expired: boolean;
  createdAt: string;
  requesters: RequesterCounts;
}

export interface DepartmentLinkResponse {
  data: { link: DepartmentLink };
}

export interface PendingAccessRequest {
  id: string;
  token: string;
  name: string;
  email: string;
  departmentName: string;
  requestedAt: string;
}

export interface PendingLinksResponse {
  data: { requests: PendingAccessRequest[] };
}

export interface DepartmentLinksListResponse {
  data: { links: DepartmentLink[] };
}

export interface LinkRegistrant {
  id: string;
  token: string;
  name: string;
  email: string;
  status: RegistrantStatus;
  requestedAt: string;
  approvedAt: string | null;
}

export interface LinkRegistrantsResponse {
  data: { registrants: LinkRegistrant[] };
}

export interface AccessSession {
  registrantId: string;
  name: string;
  email: string;
  status: RegistrantStatus;
}

export interface AccessState {
  token: string;
  accessDate: string;
  expiresAt: string;
  departmentName: string | null;
  session: AccessSession | null;
}

export interface AccessLinkResponse {
  data: { expired: boolean; state: AccessState };
}

export interface AccessInterview extends Interview {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  resumeOriginalName: string;
  resumePath: string;
}

export interface AccessInterviewsResponse {
  data: {
    interviews: AccessInterview[];
    registrant: { name: string | null; email: string | null };
  };
}
