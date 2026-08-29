"use client";

import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  href?: string;
  unread?: boolean;
}

interface NotificationMenuProps {
  items?: NotificationItem[];
  onMarkAllRead?: () => void;
}

export function NotificationMenu({
  items = [],
  onMarkAllRead,
}: NotificationMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const unreadCount = items.filter((item) => item.unread).length;

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

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-xl text-gray-500 transition-all hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Bell aria-hidden className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex h-4 w-4">
            <span aria-hidden className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="fixed inset-x-3 top-17 z-[70] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-3 sm:w-96 dark:border-gray-700 dark:bg-gray-900"
          role="menu"
        >
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/40">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Notifications</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Updates from your HR workspace</p>
            </div>
            {unreadCount > 0 && onMarkAllRead ? (
              <button className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400" onClick={onMarkAllRead} type="button">
                <CheckCheck aria-hidden className="h-3.5 w-3.5" />
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((item) => (
                  <div className={item.unread ? "bg-indigo-50/60 p-4 dark:bg-gray-800/70" : "p-4"} key={item.id}>
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.unread ? "bg-indigo-500" : "bg-gray-300 dark:bg-gray-700"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{item.description}</p>
                        {item.href ? (
                          <Link className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400" href={item.href} onClick={() => setOpen(false)}>
                            View details
                            <ExternalLink aria-hidden className="h-3 w-3" />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                  <Bell aria-hidden className="h-6 w-6" />
                </span>
                <p className="mt-4 text-sm font-bold text-gray-900 dark:text-white">You are all caught up</p>
                <p className="mt-1 max-w-52 text-xs leading-5 text-gray-500 dark:text-gray-400">New hiring and workspace updates will appear here.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
