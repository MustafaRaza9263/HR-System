import type { NotificationListFilters } from "@/lib/notifications/types";
import { LIST_PAGE_LIMIT } from "@/lib/pagination";

export const queryKeys = {
  jobRoles: {
    all: ["job-roles"] as const,
    list: ["job-roles", "list"] as const,
  },
  jobs: {
    all: ["jobs"] as const,
    list: (filters?: { q?: string; departmentId?: string; roleId?: string; page?: number; limit?: number }) =>
      [
        "jobs",
        "list",
        filters?.q ?? "",
        filters?.departmentId ?? "",
        filters?.roleId ?? "",
        filters?.page ?? 1,
        filters?.limit ?? LIST_PAGE_LIMIT,
      ] as const,
    options: ["jobs", "options"] as const,
    detail: (jobId: string) => ["jobs", "detail", jobId] as const,
  },
  careers: {
    all: ["careers"] as const,
    openJobs: ["careers", "open-jobs"] as const,
    job: (slug: string) => ["careers", "job", slug] as const,
  },
  applications: {
    all: ["applications"] as const,
    list: (filters?: { q?: string; jobId?: string; status?: string; page?: number; limit?: number }) =>
      [
        "applications",
        "list",
        filters?.q ?? "",
        filters?.jobId ?? "",
        filters?.status ?? "",
        filters?.page ?? 1,
        filters?.limit ?? LIST_PAGE_LIMIT,
      ] as const,
    detail: (applicationId: string) => ["applications", "detail", applicationId] as const,
    interviews: (applicationId: string) => ["applications", "interviews", applicationId] as const,
    resume: (applicationId: string) => ["application-resume", applicationId] as const,
  },
  interviewAccess: {
    state: (token: string) => ["interview-access", token] as const,
    interviews: (token: string) => ["interview-access", token, "interviews"] as const,
    application: (token: string, interviewId: string) =>
      ["interview-access", token, "application", interviewId] as const,
    resume: (token: string, interviewId: string) => ["interview-access", token, "resume", interviewId] as const,
  },
  interviews: {
    all: ["interviews"] as const,
    list: (filters?: { q?: string; jobId?: string; status?: string; bucket?: string; page?: number; limit?: number }) =>
      [
        "interviews",
        "list",
        filters?.q ?? "",
        filters?.jobId ?? "",
        filters?.status ?? "",
        filters?.bucket ?? "",
        filters?.page ?? 1,
        filters?.limit ?? LIST_PAGE_LIMIT,
      ] as const,
    pendingLinks: ["interviews", "pending-links"] as const,
    departmentLinksAll: ["interviews", "department-links"] as const,
    departmentLinks: (filters?: { date?: string; departmentId?: string }) =>
      ["interviews", "department-links", filters?.date ?? "", filters?.departmentId ?? ""] as const,
    linkRegistrants: (token: string) => ["interviews", "link-registrants", token] as const,
  },
  departments: {
    list: ["departments", "list"] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    summary: ["dashboard", "summary"] as const,
    trend: (job: string, granularity: string) => ["dashboard", "trend", job, granularity] as const,
    pipeline: (job: string) => ["dashboard", "pipeline", job] as const,
    sources: (job: string) => ["dashboard", "sources", job] as const,
    upcoming: (day: string) => ["dashboard", "upcoming", day] as const,
    interviewers: ["dashboard", "interviewers"] as const,
    activity: ["dashboard", "activity"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (filters?: NotificationListFilters) =>
      [
        "notifications",
        "list",
        filters?.page ?? 1,
        filters?.limit ?? 20,
        filters?.unreadOnly ? "unread" : "all",
        filters?.q ?? "",
      ] as const,
    unread: ["notifications", "unread"] as const,
  },
} as const;
