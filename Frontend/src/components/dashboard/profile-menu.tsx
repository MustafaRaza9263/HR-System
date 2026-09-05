"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { alerts } from "@/lib/alerts";
import { apiRequest } from "@/lib/api";

interface ProfileMenuProps {
  name: string;
  email: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProfileMenu({ name, email }: ProfileMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initials = getInitials(name) || "HR";

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  async function logout() {
    setSigningOut(true);
    try {
      await apiRequest<void>("/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      alerts.error("We could not sign you out. Please try again.", {
        title: "Sign out failed",
        dedupeKey: "logout-error",
      });
      setSigningOut(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open profile menu"
        className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-semibold text-white ring-1 ring-black/10 transition hover:ring-emerald-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:ring-white/20"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {initials}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-[70] mt-3 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900" role="menu">
          <div className="border-b border-gray-100 px-5 pb-4 pt-5 dark:border-gray-800">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-xl font-semibold text-white">{initials}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{name}</p>
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{email}</p>
                <span className="mt-1.5 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">HR administrator</span>
              </div>
            </div>
          </div>
          <div className="p-2">
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/30" disabled={signingOut} onClick={() => void logout()} role="menuitem" type="button">
              <LogOut aria-hidden className="h-4 w-4" />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
