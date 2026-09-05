"use client";

import { useQuery } from "@tanstack/react-query";

import { DashboardCard, DashboardEmpty, DashboardSkeleton } from "@/components/dashboard/dashboard-card";
import { StatusPill } from "@/components/ui/status-pills";
import { getInitials } from "@/components/ui/user-profile";
import { apiRequest } from "@/lib/api";
import { DASHBOARD_STALE_TIME, type DashboardInterviewersResponse } from "@/lib/dashboard/types";
import { queryKeys } from "@/lib/query/query-keys";

export function ActiveInterviewersCard() {
  const query = useQuery({
    queryKey: queryKeys.dashboard.interviewers,
    queryFn: async () => apiRequest<DashboardInterviewersResponse>("/dashboard/interviewers"),
    staleTime: DASHBOARD_STALE_TIME,
  });

  const interviewers = query.data?.data.interviewers ?? [];

  return (
    <DashboardCard className="h-[420px]" subtitle="Approved guest access" title="Active interviewers">
      {query.isPending ? (
        <DashboardSkeleton />
      ) : interviewers.length === 0 ? (
        <DashboardEmpty>No guest interviewers today.</DashboardEmpty>
      ) : (
        <div>
          {interviewers.map((person) => (
            <div className="flex items-center gap-3 border-b border-gray-100 py-2.5 last:border-b-0 dark:border-gray-800" key={person.id}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-[#2a2150] dark:text-indigo-300">
                {getInitials(person.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-950 dark:text-white">{person.name}</p>
                <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">{person.departmentName}</p>
              </div>
              <StatusPill
                label={person.status === "approved" ? "Active" : "Pending"}
                tone={person.status === "approved" ? "success" : "warning"}
              />
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
