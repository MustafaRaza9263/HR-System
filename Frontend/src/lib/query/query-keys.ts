import type { NotificationListFilters } from "@/lib/notifications/types";

export const queryKeys = {
  jobRoles: {
    all: ["job-roles"] as const,
    list: ["job-roles", "list"] as const,
  },
  jobs: {
    all: ["jobs"] as const,
    list: (filters?: { q?: string; departmentId?: string; roleId?: string }) =>
      ["jobs", "list", filters?.q ?? "", filters?.departmentId ?? "", filters?.roleId ?? ""] as const,
    detail: (jobId: string) => ["jobs", "detail", jobId] as const,
  },
  careers: {
    all: ["careers"] as const,
    openJobs: ["careers", "open-jobs"] as const,
    job: (slug: string) => ["careers", "job", slug] as const,
  },
  applications: {
    all: ["applications"] as const,
    list: (filters?: { q?: string; jobId?: string; status?: string }) =>
      ["applications", "list", filters?.q ?? "", filters?.jobId ?? "", filters?.status ?? ""] as const,
    detail: (applicationId: string) => ["applications", "detail", applicationId] as const,
    interviews: (applicationId: string) => ["applications", "interviews", applicationId] as const,
    resume: (applicationId: string) => ["application-resume", applicationId] as const,
  },
  interviews: {
    all: ["interviews"] as const,
    list: (filters?: { q?: string; jobId?: string; status?: string; bucket?: string }) =>
      [
        "interviews",
        "list",
        filters?.q ?? "",
        filters?.jobId ?? "",
        filters?.status ?? "",
        filters?.bucket ?? "",
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
