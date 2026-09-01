import { BriefcaseBusiness, ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

interface ConfigItem {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

interface ConfigGroup {
  label: string;
  items: ConfigItem[];
}

const groups: ConfigGroup[] = [
  {
    label: "Application settings",
    items: [
      {
        title: "Job Roles",
        description: "Define departments and reusable role titles used when creating jobs.",
        href: "/dashboard/configuration/job-roles",
        icon: BriefcaseBusiness,
      },
    ],
  },
];

export default function ConfigurationPage() {
  return (
    <div className="min-h-full w-full bg-gray-50 p-4 text-gray-900 sm:p-6 md:p-8 dark:bg-gray-900 dark:text-white">
      <div className="w-full space-y-8">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
              {group.label}
            </h2>
            <div className="space-y-2">
              {group.items.map(({ title, description, href, icon: Icon }) => (
                <Link
                  className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-4.5 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800/80 dark:hover:bg-gray-800"
                  href={href}
                  key={href}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gray-100 text-indigo-600 dark:bg-gray-900 dark:text-indigo-300">
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold tracking-tight text-gray-950 dark:text-white">
                      {title}
                    </span>
                    <span className="mt-0.5 block text-sm leading-5 text-gray-500 dark:text-gray-400">{description}</span>
                  </span>
                  <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
