import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CirclePlus,
  Clock3,
  ListChecks,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { MetricCard } from "@/components/ui/metric-card";

const metrics = [
  {
    label: "Active jobs",
    value: "0",
    supporting: "No published roles yet",
    icon: BriefcaseBusiness,
  },
  {
    label: "Candidates",
    value: "0",
    supporting: "Across all open jobs",
    icon: UsersRound,
  },
  {
    label: "Interviews",
    value: "0",
    supporting: "Nothing scheduled",
    icon: Clock3,
  },
  {
    label: "Hired",
    value: "0",
    supporting: "This month",
    icon: UserRoundCheck,
  },
] as const;

const setupSteps = [
  {
    title: "Create your departments",
    description: "Define the teams that make up your organization.",
    href: "/dashboard/configuration/job-roles",
    icon: Building2,
  },
  {
    title: "Define roles and scoring",
    description: "Standardize job responsibilities and evaluation criteria.",
    href: "/dashboard/configuration/job-roles",
    icon: ListChecks,
  },
  {
    title: "Publish your first job",
    description: "Create a complete opening for your candidate listing.",
    href: "/dashboard/jobs",
    icon: BriefcaseBusiness,
  },
] as const;

export default function DashboardPage() {
  return (
    <div className="min-h-full bg-white p-6 text-gray-900 md:p-8 dark:bg-gray-900 dark:text-gray-100">
      <div className="w-full space-y-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Overview</p>
            <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-gray-950 sm:text-3xl dark:text-white">Your hiring workspace</h1>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">Set up your organization and monitor hiring activity from one place.</p>
          </div>
          <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-bold text-gray-800 shadow-sm transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:hover:bg-gray-800" href="/dashboard/jobs/new">
            <CirclePlus aria-hidden className="h-4 w-4" />
            Create job
          </Link>
        </div>

        <section aria-label="Hiring metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ label, value, supporting, icon }) => (
            <MetricCard icon={icon} key={label} label={label} supporting={supporting} value={value} />
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6 dark:border-gray-800">
              <div>
                <h2 className="text-base font-bold text-gray-950 dark:text-white">Hiring pipeline</h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Candidate movement across active jobs</p>
              </div>
              <Link className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400" href="/dashboard/applications">
                View applications
                <ArrowRight aria-hidden className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid min-h-72 place-items-center px-6 py-12 text-center">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                  <UsersRound aria-hidden className="h-7 w-7" />
                </span>
                <h3 className="mt-4 text-sm font-bold text-gray-900 dark:text-white">Your pipeline is ready</h3>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-gray-500 dark:text-gray-400">Candidates will appear here after you publish a job and begin receiving applications.</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-gray-300 bg-white p-5 shadow-sm sm:p-6 dark:border-gray-800 dark:bg-gray-900">
            <div>
              <h2 className="text-base font-bold text-gray-950 dark:text-white">Workspace setup</h2>
              <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Complete these steps to start hiring.</p>
            </div>
            <div className="mt-5 space-y-3">
              {setupSteps.map(({ title, description, href, icon: Icon }, index) => (
                <Link className="group flex gap-3 rounded-xl border border-gray-200 p-3 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-900" href={href} key={title}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-500 group-hover:bg-indigo-600 group-hover:text-white dark:bg-gray-800 dark:text-gray-400 dark:group-hover:bg-gray-700">
                    <Icon aria-hidden className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                      <span className="text-[10px] font-bold text-gray-400">0{index + 1}</span>
                      {title}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-gray-500 dark:text-gray-400">{description}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
