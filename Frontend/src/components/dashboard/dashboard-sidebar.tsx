"use client";

import {
  Bot,
  BriefcaseBusiness,
  LayoutDashboard,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserRoundSearch,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { CollapsedTooltip } from "./collapsed-tooltip";

interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const navigation: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Job Roles", href: "/dashboard/job-roles", icon: BriefcaseBusiness },
  { label: "Jobs", href: "/dashboard/jobs", icon: BriefcaseBusiness },
  { label: "Candidates", href: "/dashboard/candidates", icon: UserRoundSearch },
  { label: "Scoring", href: "/dashboard/scoring", icon: ListChecks },
  { label: "Assistant", href: "/dashboard/assistant", icon: Bot },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

const SIDEBAR_COLLAPSED_KEY = "hr-sidebar-collapsed";

interface DashboardSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  user: { name: string; email: string };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "HR";
}

export function DashboardSidebar({
  mobileOpen,
  onMobileClose,
  user,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [isDesktop, setIsDesktop] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  useEffect(() => {
    const desktopViewport = window.matchMedia("(min-width: 768px)");
    const syncViewport = () => {
      setIsDesktop(desktopViewport.matches);
      setIsDesktopCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    };

    syncViewport();
    desktopViewport.addEventListener("change", syncViewport);
    return () => desktopViewport.removeEventListener("change", syncViewport);
  }, []);

  const collapsed = isDesktop && isDesktopCollapsed;

  function toggleCollapsed() {
    const next = !isDesktopCollapsed;
    setIsDesktopCollapsed(next);
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
  }

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <aside
      aria-label="Primary navigation"
      className={`fixed inset-y-0 left-0 z-50 flex h-svh w-72 max-w-[86vw] shrink-0 transform-gpu flex-col overflow-hidden border-r border-gray-200 bg-white text-gray-900 shadow-xl transition-[transform,width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none md:relative md:max-w-none md:translate-x-0 md:shadow-none dark:border-gray-800/60 dark:bg-gray-950 dark:text-white ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "md:w-20" : "md:w-72"}`}
    >
      <div className="relative h-16 shrink-0 border-b border-gray-200 dark:border-gray-800/60">
        <Link
          className={`absolute left-6 top-1/2 -translate-y-1/2 whitespace-nowrap text-lg font-bold tracking-tight text-indigo-600 transition-opacity dark:text-indigo-400 ${collapsed ? "md:pointer-events-none md:opacity-0" : "opacity-100"}`}
          href="/dashboard"
          onClick={onMobileClose}
        >
          HR System
        </Link>
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute right-6 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 md:grid dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
          onClick={toggleCollapsed}
          type="button"
        >
          {collapsed ? <PanelLeftOpen aria-hidden className="h-4 w-4" /> : <PanelLeftClose aria-hidden className="h-4 w-4" />}
        </button>
        <button
          aria-label="Close navigation"
          className="absolute right-4 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-gray-500 hover:bg-gray-100 md:hidden dark:text-gray-400 dark:hover:bg-gray-800"
          onClick={onMobileClose}
          type="button"
        >
          <X aria-hidden className="h-5 w-5" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3">
        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <CollapsedTooltip enabled={collapsed} key={item.href} label={item.label}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`group mx-2 flex h-12 items-center overflow-hidden rounded-xl text-sm font-semibold transition-colors ${active ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white"}`}
                  href={item.href}
                  onClick={onMobileClose}
                >
                  <span className="grid h-12 w-16 shrink-0 place-items-center">
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
                  </span>
                  <span aria-hidden={collapsed} className={`min-w-0 flex-1 truncate pr-3 transition-opacity ${collapsed ? "md:opacity-0" : "opacity-100"}`}>{item.label}</span>
                </Link>
              </CollapsedTooltip>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-gray-200 py-2 dark:border-gray-800/60">
        <CollapsedTooltip className="relative min-w-0" enabled={collapsed} label={user.name}>
          <Link
            className="mx-2 flex h-14 items-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 text-gray-900 transition-colors hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
            href="/dashboard/profile"
            onClick={onMobileClose}
          >
            <span className="grid h-14 w-16 shrink-0 place-items-center">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
                {getInitials(user.name)}
              </span>
            </span>
            <span aria-hidden={collapsed} className={`min-w-0 flex-1 pr-3 transition-opacity ${collapsed ? "md:opacity-0" : "opacity-100"}`}>
              <span className="block truncate text-xs font-bold">{user.name}</span>
              <span className="mt-0.5 block truncate text-[10px] font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">HR administrator</span>
            </span>
          </Link>
        </CollapsedTooltip>
      </div>
    </aside>
  );
}
