"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { DashboardCard, DashboardEmpty, DashboardSkeleton } from "@/components/dashboard/dashboard-card";
import { apiRequest } from "@/lib/api";
import { DASHBOARD_STALE_TIME, type DashboardActivityResponse } from "@/lib/dashboard/types";
import { relativeNotificationTime } from "@/lib/notifications/meta";
import type { NotificationType } from "@/lib/notifications/types";
import { queryKeys } from "@/lib/query/query-keys";

const DOT_CLASS: Record<NotificationType, string> = {
  new_application: "bg-indigo-500",
  interview_request: "bg-amber-500",
  interview_completed: "bg-emerald-500",
};

export function RecentActivityCard() {
  const query = useQuery({
    queryKey: queryKeys.dashboard.activity,
    queryFn: async () => apiRequest<DashboardActivityResponse>("/dashboard/activity"),
    staleTime: DASHBOARD_STALE_TIME,
  });

  const events = query.data?.data.events ?? [];

  return (
    <DashboardCard className="h-[360px]" subtitle="Latest events across the workspace" title="Recent activity">
      {query.isPending ? (
        <DashboardSkeleton />
      ) : events.length === 0 ? (
        <DashboardEmpty>No recent activity.</DashboardEmpty>
      ) : (
        <div>
          {events.map((event) => (
            <Link
              className="flex gap-3 border-b border-gray-100 py-2.5 last:border-b-0 hover:bg-gray-50/80 dark:border-gray-800 dark:hover:bg-gray-900/40"
              href={event.href}
              key={event.id}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[event.type]}`} />
              <div className="min-w-0">
                <p className="text-sm text-gray-900 dark:text-gray-100">{event.body}</p>
                <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">{relativeNotificationTime(event.createdAt)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
