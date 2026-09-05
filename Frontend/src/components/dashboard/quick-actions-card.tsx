import { BriefcaseBusiness, Building2, CalendarClock, ClipboardList, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { DashboardCard } from "@/components/dashboard/dashboard-card";

const ACTIONS: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/dashboard/jobs/new", label: "Post a job", icon: BriefcaseBusiness },
  { href: "/dashboard/interviews?pending=1", label: "Invite interviewer", icon: CalendarClock },
  { href: "/dashboard/applications", label: "Review applications", icon: ClipboardList },
  { href: "/dashboard/configuration/job-roles", label: "Manage departments", icon: Building2 },
];

export function QuickActionsCard() {
  return (
    <DashboardCard className="h-[360px]" subtitle="Jump straight into a task" title="Quick actions">
      <div className="grid h-full grid-cols-2 gap-3">
        {ACTIONS.map(({ href, label, icon: Icon }) => (
          <Link
            className="flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-gray-600 dark:hover:bg-gray-900"
            href={href}
            key={href}
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <Icon aria-hidden className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold text-gray-950 dark:text-white">{label}</span>
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}
