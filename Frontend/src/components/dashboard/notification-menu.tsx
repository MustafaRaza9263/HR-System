"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { NotificationTypeIcon } from "@/components/notifications/notification-icon";
import { apiRequest, getApiBaseUrl } from "@/lib/api";
import { fetchNotifications } from "@/lib/notifications/api";
import { markAllNotificationsReadInCache, markNotificationReadInCache } from "@/lib/notifications/cache";
import { NOTIFICATION_PREVIEW_LIMIT, relativeNotificationTime } from "@/lib/notifications/meta";
import type { HrNotification, NotificationsListResponse, UnreadCountResponse } from "@/lib/notifications/types";
import { queryKeys } from "@/lib/query/query-keys";

const previewFilters = { page: 1, limit: NOTIFICATION_PREVIEW_LIMIT };

export function NotificationMenu() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewKey = queryKeys.notifications.list(previewFilters);

  const listQuery = useQuery({
    queryKey: previewKey,
    queryFn: async () => fetchNotifications(previewFilters),
  });
  const unreadQuery = useQuery({
    queryKey: queryKeys.notifications.unread,
    queryFn: async () => apiRequest<UnreadCountResponse>("/notifications/unread-count"),
  });

  const items = listQuery.data?.data.notifications ?? [];
  const unreadCount = unreadQuery.data?.data.count ?? listQuery.data?.data.unreadCount ?? items.filter((item) => !item.isRead).length;

  useEffect(() => {
    const source = new EventSource(`${getApiBaseUrl()}/notifications/stream`, { withCredentials: true });
    source.addEventListener("notification", (event) => {
      const incoming = JSON.parse((event as MessageEvent).data) as HrNotification;
      queryClient.setQueryData<NotificationsListResponse>(previewKey, (current) => {
        const existing = current?.data.notifications ?? [];
        if (existing.some((item) => item.id === incoming.id)) return current;
        const pagination = current?.data.pagination ?? { total: 0, page: 1, limit: NOTIFICATION_PREVIEW_LIMIT, pages: 1 };
        const nextTotal = pagination.total + 1;
        return {
          data: {
            notifications: [incoming, ...existing].slice(0, pagination.limit),
            unreadCount: (current?.data.unreadCount ?? 0) + (incoming.isRead ? 0 : 1),
            pagination: {
              ...pagination,
              total: nextTotal,
              pages: Math.max(1, Math.ceil(nextTotal / pagination.limit)),
            },
          },
        };
      });
      if (!incoming.isRead) {
        queryClient.setQueryData<UnreadCountResponse>(queryKeys.notifications.unread, (current) => ({
          data: { count: (current?.data.count ?? 0) + 1 },
        }));
      }
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "notifications" &&
          JSON.stringify(query.queryKey) !== JSON.stringify(previewKey) &&
          JSON.stringify(query.queryKey) !== JSON.stringify(queryKeys.notifications.unread),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.interviews.pendingLinks });
    });
    return () => source.close();
  }, [previewKey, queryClient]);

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

  const readMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: (_result, id) => {
      markNotificationReadInCache(queryClient, id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const readAllMutation = useMutation({
    mutationFn: async () => apiRequest("/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => {
      markAllNotificationsReadInCache(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

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
          className="fixed inset-x-3 top-16 z-[70] max-h-[calc(100vh-5rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-3 sm:w-96 dark:border-gray-700 dark:bg-gray-900"
          role="menu"
        >
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/30">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h2>
            {unreadCount > 0 ? (
              <button
                className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                onClick={() => readAllMutation.mutate()}
                type="button"
              >
                Mark all as read
              </button>
            ) : null}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {items.length ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((item) => (
                  <div
                    className={`group relative flex gap-4 p-4 transition-colors ${
                      item.isRead ? "hover:bg-gray-50 dark:hover:bg-gray-800/50" : "bg-gray-100/80 dark:bg-gray-800/70"
                    }`}
                    key={item.id}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        item.isRead ? "bg-gray-100 dark:bg-gray-800" : "bg-white dark:bg-gray-900"
                      }`}
                    >
                      <NotificationTypeIcon type={item.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium leading-tight text-gray-900 sm:text-sm dark:text-white">{item.body}</p>
                        {!item.isRead ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-900 dark:bg-white" /> : null}
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="text-[10px] text-gray-500 sm:text-xs dark:text-gray-400">
                          {relativeNotificationTime(item.createdAt)}
                        </span>
                        <Link
                          className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-gray-700 hover:underline sm:text-xs dark:text-gray-200"
                          href={item.href}
                          onClick={() => {
                            if (!item.isRead) readMutation.mutate(item.id);
                            setOpen(false);
                          }}
                        >
                          View details
                          <ExternalLink aria-hidden className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                    </div>
                    {!item.isRead ? (
                      <button
                        aria-label="Mark as read"
                        className="absolute right-2 bottom-2 rounded-lg p-1 text-gray-500 opacity-0 transition hover:bg-gray-100 group-hover:opacity-100 dark:hover:bg-gray-800"
                        onClick={() => readMutation.mutate(item.id)}
                        title="Mark as read"
                        type="button"
                      >
                        <Check aria-hidden className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gray-50 text-gray-300 dark:bg-gray-800 dark:text-gray-600">
                  <Bell aria-hidden className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">All caught up!</p>
                <p className="mt-1 max-w-[200px] text-xs text-gray-500 dark:text-gray-400">
                  You have no new notifications at the moment.
                </p>
              </div>
            )}
          </div>
          <div className="border-t border-gray-100 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-800/30">
            <div className="grid grid-cols-2 gap-2">
              <Link
                className="rounded-lg bg-gray-900 px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                href="/dashboard/notifications"
                onClick={() => setOpen(false)}
              >
                View all notifications
              </Link>
              <button
                className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
