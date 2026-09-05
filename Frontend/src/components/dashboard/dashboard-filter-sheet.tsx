"use client";

import type { ReactNode } from "react";

import { FilterField, FilterSheet } from "@/components/ui/filter-sheet";

interface DashboardFilterSheetProps {
  title: string;
  desktop: ReactNode;
  children: ReactNode;
}

export function DashboardFilterSheet({ title, desktop, children }: DashboardFilterSheetProps) {
  return (
    <>
      <div className="hidden items-center justify-end gap-2 md:flex">{desktop}</div>
      <FilterSheet title={title}>{children}</FilterSheet>
    </>
  );
}

export function DashboardFilterField({ label, children }: { label: string; children: ReactNode }) {
  return <FilterField label={label}>{children}</FilterField>;
}
