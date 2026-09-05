"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { DashboardCard, DashboardEmpty, DashboardSkeleton } from "@/components/dashboard/dashboard-card";
import { apiRequest } from "@/lib/api";
import { DASHBOARD_STALE_TIME, type DashboardInterviewDay, type DashboardUpcomingResponse } from "@/lib/dashboard/types";
import { queryKeys } from "@/lib/query/query-keys";

function DayToggle({
  value,
  onChange,
}: {
  value: DashboardInterviewDay;
  onChange: (value: DashboardInterviewDay) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      {(["today", "tomorrow"] as const).map((day) => (
        <button
          className={`px-3 py-1.5 text-xs font-semibold ${
            value === day
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          }`}
          key={day}
          onClick={() => onChange(day)}
          type="button"
        >
          {day === "today" ? "Today" : "Tomorrow"}
        </button>
      ))}
    </div>
  );
}

export function UpcomingInterviewsCard() {
  const [day, setDay] = useState<DashboardInterviewDay>("today");
  const query = useQuery({
    queryKey: queryKeys.dashboard.upcoming(day),
    queryFn: async () =>
      apiRequest<DashboardUpcomingResponse>(`/dashboard/upcoming-interviews?day=${day}`),
    staleTime: DASHBOARD_STALE_TIME,
    placeholderData: keepPreviousData,
  });

  const interviews = query.data?.data.interviews ?? [];

  return (
    <DashboardCard
      actions={<DayToggle onChange={setDay} value={day} />}
      className="h-[440px]"
      subtitle="Scheduled, by day"
      title="Upcoming interviews"
    >
      {query.isPending && !query.data ? (
        <DashboardSkeleton />
      ) : interviews.length === 0 ? (
        <DashboardEmpty>No interviews {day}.</DashboardEmpty>
      ) : (
        <div>
          {interviews.map((interview) => (
            <div className="flex gap-3 border-b border-gray-100 py-2.5 last:border-b-0 dark:border-gray-800" key={interview.id}>
              <p className="w-14 shrink-0 text-sm font-bold text-indigo-600 dark:text-indigo-400">{interview.time}</p>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-950 dark:text-white">{interview.candidateName}</p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{interview.jobTitle}</p>
                <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">{interview.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
