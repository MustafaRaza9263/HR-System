"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "./theme-provider";

interface ThemeToggleProps {
  className?: string;
  variant?: "default" | "header";
}

export function ThemeToggle({ className = "", variant = "default" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const isHeaderVariant = variant === "header";

  return (
    <button
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      className={`${isHeaderVariant ? "grid h-9 w-9 place-items-center rounded-xl text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-gray-400 dark:hover:bg-gray-800" : "grid h-10 w-10 place-items-center rounded-xl border border-gray-200 bg-white/80 text-gray-600 shadow-sm backdrop-blur transition hover:border-gray-300 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-white"} ${className}`}
      onClick={toggleTheme}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
      type="button"
    >
      {isDark ? (
        <Sun aria-hidden className={isHeaderVariant ? "h-5 w-5 text-yellow-400" : "h-4.5 w-4.5"} strokeWidth={2} />
      ) : (
        <Moon aria-hidden className={isHeaderVariant ? "h-5 w-5 fill-current text-gray-600" : "h-4.5 w-4.5"} />
      )}
    </button>
  );
}
