"use client";

import type { ReactNode } from "react";

import { AlertProvider } from "@/components/alerts/alert-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AlertProvider>{children}</AlertProvider>
    </ThemeProvider>
  );
}
