"use client";

import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { Check, Clock, Search, Trash2 } from "lucide-react";
import { type MouseEvent, useEffect, useMemo, useState } from "react";

import { apiRequest } from "@/lib/api";
import { fetchAssistantSessions } from "@/lib/assistant/api";
import type { AssistantSessionListItem } from "@/lib/assistant/types";

const KARACHI = "Asia/Karachi";

function calendarKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KARACHI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function shiftKey(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return key;
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

type SessionBucket = "today" | "yesterday" | "week" | "older";

const BUCKET_LABEL: Record<SessionBucket, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "Previous 7 days",
  older: "Older",
};

function bucketFor(iso: string, today: string): SessionBucket {
  const key = calendarKey(iso);
  if (key === today) return "today";
  if (key === shiftKey(today, -1)) return "yesterday";
  if (key > shiftKey(today, -7)) return "week";
  return "older";
}

interface AssistantSessionsMenuProps {
  currentId: string | null;
  disabled?: boolean;
  onSelect: (session: AssistantSessionListItem) => void;
  onDeleted: (sessionId: string) => void;
}

export function AssistantSessionsMenu({
  currentId,
  disabled = false,
  onSelect,
  onDeleted,
}: AssistantSessionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState<AssistantSessionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { refs, floatingStyles, context } = useFloating({
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    onOpenChange: (next) => {
      if (disabled && next) return;
      setOpen(next);
    },
    open,
    placement: "bottom-end",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context, { enabled: !disabled });
  const dismiss = useDismiss(context, { ancestorScroll: true, enabled: !disabled, escapeKey: false });
  const role = useRole(context, { role: "menu" });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void fetchAssistantSessions()
      .then((items) => {
        if (!cancelled) setSessions(items);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      setOpen(false);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  const today = calendarKey(new Date().toISOString());
  const grouped = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const visible = needle
      ? sessions.filter((item) => item.title.toLocaleLowerCase().includes(needle))
      : sessions;
    const buckets: Record<SessionBucket, AssistantSessionListItem[]> = {
      today: [],
      yesterday: [],
      week: [],
      older: [],
    };
    for (const item of visible) buckets[bucketFor(item.updatedAt, today)].push(item);
    return (["today", "yesterday", "week", "older"] as const).flatMap((bucket) => {
      const items = buckets[bucket];
      if (items.length === 0) return [];
      return [{ bucket, items }];
    });
  }, [query, sessions, today]);

  async function removeSession(event: MouseEvent, sessionId: string) {
    event.preventDefault();
    event.stopPropagation();
    setDeletingId(sessionId);
    try {
      await apiRequest(`/assistant/sessions/${sessionId}`, { method: "DELETE" });
      setSessions((current) => current.filter((item) => item.id !== sessionId));
      onDeleted(sessionId);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Previous sessions"
        className="icon-button"
        data-active={open ? "true" : undefined}
        disabled={disabled}
        type="button"
        {...getReferenceProps({ ref: refs.setReference })}
      >
        <Clock aria-hidden className="h-4 w-4" />
      </button>

      {open ? (
        <FloatingPortal>
          <div
            className="z-80 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
            {...getFloatingProps({ ref: refs.setFloating, style: floatingStyles })}
          >
            <div className="border-b border-gray-100 p-3 dark:border-gray-800">
              <label className="sr-only" htmlFor="assistant-session-search">
                Search sessions
              </label>
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:ring-3 focus:ring-indigo-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-800"
                  id="assistant-session-search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search sessions…"
                  value={query}
                />
              </div>
            </div>
            <div className="hr-hide-scrollbar max-h-80 overflow-y-auto py-2">
              {loading ? (
                <p className="px-4 py-8 text-center text-xs font-semibold text-gray-400">Loading sessions…</p>
              ) : grouped.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs font-semibold text-gray-400">
                  {query.trim() ? "No matching sessions." : "No previous sessions yet."}
                </p>
              ) : (
                grouped.map(({ bucket, items }) => (
                  <section key={bucket}>
                    <h3 className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">
                      {BUCKET_LABEL[bucket]}
                    </h3>
                    {items.map((item) => {
                      const active = item.id === currentId;
                      return (
                        <div className="group relative flex items-center gap-2 px-2" key={item.id}>
                          <button
                            className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl py-2 pl-2 pr-10 text-left text-sm transition-colors ${
                              active
                                ? "bg-gray-100 text-gray-950 dark:bg-gray-800 dark:text-white"
                                : "text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/70"
                            }`}
                            onClick={() => {
                              onSelect(item);
                              setOpen(false);
                            }}
                            role="menuitem"
                            type="button"
                          >
                            <span
                              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                                active
                                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                                  : "bg-gray-100 text-gray-400 dark:bg-gray-800"
                              }`}
                            >
                              <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />
                            </span>
                            <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                          </button>
                          <button
                            aria-label={`Delete ${item.title}`}
                            className="icon-button absolute right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                            disabled={deletingId === item.id}
                            onClick={(event) => void removeSession(event, item.id)}
                            type="button"
                          >
                            <Trash2 aria-hidden className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </section>
                ))
              )}
            </div>
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
}
