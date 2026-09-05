"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme/theme-toggle";

import { NotificationMenu } from "./notification-menu";
import { ProfileMenu } from "./profile-menu";

interface DashboardHeaderProps {
  user: { name: string; email: string };
  scrolled?: boolean;
  onMenuClick: () => void;
}

export function DashboardHeader({ user, scrolled = false, onMenuClick }: DashboardHeaderProps) {
  const pathname = usePathname();
  const title = resolveTitle(pathname);

  return (
    <header className="hr-dashboard-header" data-scrolled={scrolled ? "true" : "false"}>
      <div aria-hidden className="hr-dashboard-header__glass" />
      <div className="relative flex h-16 shrink-0 items-center gap-3 px-4 md:px-6">
        <button
          aria-label="Open navigation"
          className="hr-header-icon relative z-10 grid md:hidden"
          onClick={onMenuClick}
          type="button"
        >
          <Menu aria-hidden className="h-5 w-5" />
        </button>
        {title ? (
          <h1 className="relative z-10 min-w-0 flex-1 truncate text-[15px] font-bold tracking-[-0.02em] text-gray-950 md:pointer-events-none md:absolute md:inset-x-0 md:flex-none md:px-36 md:text-center md:text-lg dark:text-white">
            {title}
          </h1>
        ) : null}
        <div className="z-10 ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
          <NotificationMenu />
          <ThemeToggle variant="header" />
          <ProfileMenu email={user.email} name={user.name} />
        </div>
      </div>
    </header>
  );
}

function resolveTitle(pathname: string) {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/dashboard/configuration/job-roles") || pathname === "/dashboard/job-roles") {
    return "Job Roles";
  }
  if (pathname.startsWith("/dashboard/configuration")) return "Configuration";
  if (pathname.startsWith("/dashboard/notifications")) return "Notifications";
  if (pathname.startsWith("/dashboard/interviews")) return "Interviews";
  if (pathname.startsWith("/dashboard/applications")) return "Applications";
  if (pathname === "/dashboard/jobs/new") return "Create job";
  if (pathname.startsWith("/dashboard/jobs/") && pathname.endsWith("/edit")) return "Edit job";
  if (pathname.startsWith("/dashboard/jobs/") && pathname !== "/dashboard/jobs") return "Job detail";
  if (pathname === "/dashboard/jobs") return "Jobs";
  return undefined;
}
