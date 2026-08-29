"use client";

import { type ReactNode, useEffect, useState } from "react";

import { DashboardHeader } from "./dashboard-header";
import { DashboardSidebar } from "./dashboard-sidebar";

interface DashboardShellProps {
  children: ReactNode;
  user: { name: string; email: string };
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!mobileSidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileSidebarOpen]);

  return (
    <div className="flex h-svh overflow-hidden bg-white text-gray-900 dark:bg-gray-950 dark:text-white">
      <DashboardSidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        user={user}
      />

      {mobileSidebarOpen ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardHeader
          onMenuClick={() => setMobileSidebarOpen(true)}
          user={user}
        />
        <main className="min-h-0 flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="mx-auto min-h-full w-full max-w-[100rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}
