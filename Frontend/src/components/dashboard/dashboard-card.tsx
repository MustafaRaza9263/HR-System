"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

function DashboardScrollArea({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollFades, setScrollFades] = useState({ top: false, bottom: false });

  const updateScrollFades = useCallback(() => {
    const body = scrollRef.current;
    if (!body) return;
    const next = {
      top: body.scrollTop > 1,
      bottom: body.scrollTop + body.clientHeight < body.scrollHeight - 1,
    };
    setScrollFades((current) => (current.top === next.top && current.bottom === next.bottom ? current : next));
  }, []);

  useEffect(() => {
    const body = scrollRef.current;
    if (!body) return;
    const mutation = new MutationObserver(updateScrollFades);
    const resize = new ResizeObserver(updateScrollFades);
    body.addEventListener("scroll", updateScrollFades, { passive: true });
    mutation.observe(body, { childList: true, subtree: true, characterData: true });
    resize.observe(body);
    window.addEventListener("resize", updateScrollFades);
    const frame = requestAnimationFrame(updateScrollFades);
    return () => {
      cancelAnimationFrame(frame);
      body.removeEventListener("scroll", updateScrollFades);
      mutation.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", updateScrollFades);
    };
  }, [updateScrollFades]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-linear-to-b from-white to-transparent transition-opacity duration-200 dark:from-gray-800 ${
          scrollFades.top ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-linear-to-t from-white to-transparent transition-opacity duration-200 dark:from-gray-800 ${
          scrollFades.bottom ? "opacity-100" : "opacity-0"
        }`}
      />
      <div className="hr-hide-scrollbar h-full overflow-auto overscroll-contain px-5 pb-5 pt-4 sm:px-6" ref={scrollRef}>
        {children}
      </div>
    </div>
  );
}

export function DashboardCard({ title, subtitle, actions, className, children }: DashboardCardProps) {
  return (
    <section
      className={`flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/70 ${className ?? ""}`}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-950 dark:text-white">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div> : null}
      </div>
      <DashboardScrollArea>{children}</DashboardScrollArea>
    </section>
  );
}

export function DashboardEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-full place-items-center rounded-xl border border-dashed border-gray-200 px-4 text-center text-sm font-semibold text-gray-400 dark:border-gray-700">
      {children}
    </div>
  );
}

export function DashboardSkeleton() {
  return <div className="h-full animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />;
}
