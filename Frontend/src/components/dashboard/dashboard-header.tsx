"use client";

import { Menu } from "lucide-react";

import { ThemeToggle } from "@/components/theme/theme-toggle";

import { NotificationMenu } from "./notification-menu";
import { ProfileMenu } from "./profile-menu";

interface DashboardHeaderProps {
  user: { name: string; email: string };
  onMenuClick: () => void;
}

export function DashboardHeader({ user, onMenuClick }: DashboardHeaderProps) {
  return (
    <header className="relative z-30 shrink-0 border-b border-gray-200 bg-white dark:border-gray-800/60 dark:bg-gray-900">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          aria-label="Open navigation"
          className="grid h-10 w-10 place-items-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 md:hidden dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
          onClick={onMenuClick}
          type="button"
        >
          <Menu aria-hidden className="h-5 w-5" />
        </button>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <NotificationMenu />
          <ThemeToggle variant="header" />
          <ProfileMenu email={user.email} name={user.name} />
        </div>
      </div>
    </header>
  );
}
