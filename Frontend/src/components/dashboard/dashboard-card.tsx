"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

function wheelDeltaY(event: WheelEvent) {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * window.innerHeight;
  return event.deltaY;
}

function nearestVerticalScroller(start: HTMLElement) {
  let current = start.parentElement;
  while (current) {
    const overflowY = getComputedStyle(current).overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      current.scrollHeight - current.clientHeight > 1
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function DashboardScrollArea({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollY, setCanScrollY] = useState(false);
  const [scrollFades, setScrollFades] = useState({ top: false, bottom: false });

  const updateScrollState = useCallback(() => {
    const body = scrollRef.current;
    if (!body) return;
    const maxScroll = body.scrollHeight - body.clientHeight;
    const nextCanScroll = maxScroll > 1;
    const nextFades = {
      top: nextCanScroll && body.scrollTop > 1,
      bottom: nextCanScroll && body.scrollTop < maxScroll - 1,
    };
    setCanScrollY((current) => (current === nextCanScroll ? current : nextCanScroll));
    setScrollFades((current) =>
      current.top === nextFades.top && current.bottom === nextFades.bottom ? current : nextFades,
    );
  }, []);

  useEffect(() => {
    const body = scrollRef.current;
    if (!body) return;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.deltaY === 0) return;

      const maxScroll = body.scrollHeight - body.clientHeight;
      if (maxScroll <= 1) return;

      const deltaY = wheelDeltaY(event);
      const scrollingDown = deltaY > 0;
      const atTop = body.scrollTop <= 0;
      const atBottom = body.scrollTop >= maxScroll - 1;
      if ((scrollingDown && !atBottom) || (!scrollingDown && !atTop)) return;

      const ancestor = nearestVerticalScroller(body);
      if (!ancestor) return;
      ancestor.scrollTop += deltaY;
      event.preventDefault();
    };

    const mutation = new MutationObserver(updateScrollState);
    const resize = new ResizeObserver(updateScrollState);
    body.addEventListener("scroll", updateScrollState, { passive: true });
    body.addEventListener("wheel", onWheel, { passive: false });
    mutation.observe(body, { childList: true, subtree: true, characterData: true });
    resize.observe(body);
    window.addEventListener("resize", updateScrollState);
    const frame = requestAnimationFrame(updateScrollState);
    return () => {
      cancelAnimationFrame(frame);
      body.removeEventListener("scroll", updateScrollState);
      body.removeEventListener("wheel", onWheel);
      mutation.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
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
      <div
        className={`hr-hide-scrollbar flex min-h-0 flex-1 flex-col px-5 pb-5 sm:px-6 ${
          canScrollY ? "overflow-y-auto overflow-x-hidden" : "overflow-clip"
        }`}
        ref={scrollRef}
      >
        {children}
      </div>
    </div>
  );
}

export function DashboardCard({ title, subtitle, actions, className, children }: DashboardCardProps) {
  return (
    <section
      className={`flex flex-col overflow-clip rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className ?? ""}`}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-4 pt-5 sm:px-6">
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
