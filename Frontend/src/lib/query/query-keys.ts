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
  },
} as const;
