"use client";

import type { ReactNode } from "react";

import { AlertProvider } from "@/components/alerts/alert-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { QueryProvider } from "@/lib/query/query-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <AlertProvider>{children}</AlertProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
