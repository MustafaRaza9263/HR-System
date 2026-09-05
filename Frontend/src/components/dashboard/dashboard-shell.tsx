"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { DashboardHeader } from "./dashboard-header";
import { DashboardSidebar } from "./dashboard-sidebar";

interface DashboardShellProps {
  children: ReactNode;
  user: { name: string; email: string };
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    void import("@/lib/notifications/fcm")
      .then(({ registerHrPush }) => registerHrPush())
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const mobileViewport = window.matchMedia("(max-width: 767px)");
    const resetDrawer = () => setMobileSidebarOpen(false);

    resetDrawer();
    mobileViewport.addEventListener("change", resetDrawer);
    return () => mobileViewport.removeEventListener("change", resetDrawer);
  }, []);

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

  useEffect(() => {
    const node = mainRef.current;
    if (!node) return;

    const update = () => setScrolled(node.scrollTop > 8);
    update();
    node.addEventListener("scroll", update, { passive: true });
    return () => node.removeEventListener("scroll", update);
  }, [pathname]);

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

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
        <main className="relative min-h-0 flex-1 overflow-y-auto" ref={mainRef}>
          <DashboardHeader
            onMenuClick={() => setMobileSidebarOpen(true)}
            scrolled={scrolled}
            user={user}
          />
          <div className="mx-auto w-full max-w-[100rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}
