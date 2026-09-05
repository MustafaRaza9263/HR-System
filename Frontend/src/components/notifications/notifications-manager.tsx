"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, Check, ExternalLink, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { NotificationTypeIcon } from "@/components/notifications/notification-icon";
import { PaginationBar } from "@/components/ui/pagination";
import { alerts } from "@/lib/alerts";
import { ApiClientError, apiRequest } from "@/lib/api";
import { fetchNotifications } from "@/lib/notifications/api";
import { markAllNotificationsReadInCache, markNotificationReadInCache } from "@/lib/notifications/cache";
import { NOTIFICATION_PAGE_LIMIT, relativeNotificationTime } from "@/lib/notifications/meta";
import type { HrNotification } from "@/lib/notifications/types";
import { queryKeys } from "@/lib/query/query-keys";

export function NotificationsManager() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filters = useMemo(
    () => ({
      page,
      limit: NOTIFICATION_PAGE_LIMIT,
      unreadOnly: unreadOnly || undefined,
      q: debouncedSearch || undefined,
    }),
    [debouncedSearch, page, unreadOnly],
  );

  const feed = useQuery({
    queryKey: queryKeys.notifications.list(filters),
    queryFn: async () => fetchNotifications(filters),
    placeholderData: keepPreviousData,
  });

  const notifications = feed.data?.data.notifications ?? [];
  const unreadCount = feed.data?.data.unreadCount ?? 0;
  const pagination = feed.data?.data.pagination ?? { total: 0, page, limit: NOTIFICATION_PAGE_LIMIT, pages: 1 };
  const loading = feed.isPending || feed.isFetching;

  const readMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: (_result, id) => {
      markNotificationReadInCache(queryClient, id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
    onError: (error) => {
      alerts.error(error instanceof ApiClientError ? error.message : "Notification could not be marked as read.");
    },
  });

  const readAllMutation = useMutation({
    mutationFn: async () => apiRequest("/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => {
      markAllNotificationsReadInCache(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      alerts.success("All notifications marked as read.");
    },
    onError: (error) => {
      alerts.error(error instanceof ApiClientError ? error.message : "Notifications could not be marked as read.");
    },
  });

  function handleOpen(notification: HrNotification) {
    if (!notification.isRead) readMutation.mutate(notification.id);
  }

  return (
    <div className="min-h-full p-4 text-gray-900 sm:p-6 md:p-8 dark:text-gray-100">
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
              : "All notifications are read"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                unreadOnly
                  ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              }`}
              onClick={() => {
                setUnreadOnly((value) => !value);
                setPage(1);
              }}
              type="button"
            >
              Unread only
            </button>
            <button
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              disabled={unreadCount === 0 || readAllMutation.isPending}
              onClick={() => readAllMutation.mutate()}
              type="button"
            >
              Mark all as read
            </button>
            <button
              aria-label="Refresh notifications"
              className="rounded-xl border border-gray-200 bg-white p-2 text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              onClick={() => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })}
              type="button"
            >
              <RefreshCw aria-hidden className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/70">
          <label className="relative block">
            <span className="sr-only">Search notifications</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 dark:border-gray-700 dark:bg-transparent dark:text-white dark:focus:border-indigo-500"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search notifications..."
              type="search"
              value={search}
            />
          </label>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/70">
          {feed.isPending && notifications.length === 0 ? (
            <div aria-label="Loading notifications" className="space-y-3 p-4" role="status">
              {[1, 2, 3].map((item) => (
                <div className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-900" key={item} />
              ))}
            </div>
          ) : null}

          {feed.isError ? (
            <div className="px-6 py-12 text-center">
              <AlertTriangle aria-hidden className="mx-auto h-8 w-8 text-red-500" />
              <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">
                {feed.error instanceof ApiClientError ? feed.error.message : "Notifications could not be loaded"}
              </h3>
              <button className="mt-3 text-sm font-bold text-indigo-600 dark:text-indigo-400" onClick={() => void feed.refetch()} type="button">
                Try again
              </button>
            </div>
          ) : null}

          {!feed.isPending && !feed.isError && notifications.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {notifications.map((notification) => (
                <article
                  className={`flex flex-col gap-3 p-4 transition sm:flex-row sm:items-start sm:gap-4 ${
                    notification.isRead ? "hover:bg-gray-50 dark:hover:bg-gray-800/50" : "bg-gray-100/70 dark:bg-gray-800/70"
                  }`}
                  key={notification.id}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-gray-200 dark:bg-transparent dark:ring-gray-700">
                    <NotificationTypeIcon type={notification.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p className="text-sm font-medium leading-6 text-gray-900 dark:text-white">{notification.body}</p>
                      {!notification.isRead ? <span className="h-2 w-2 shrink-0 rounded-full bg-gray-900 dark:bg-white" /> : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span>{relativeNotificationTime(notification.createdAt)}</span>
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {notification.title}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 sm:flex-col">
                    <Link
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 sm:flex-none"
                      href={notification.href}
                      onClick={() => handleOpen(notification)}
                    >
                      View details <ExternalLink aria-hidden className="h-3 w-3" />
                    </Link>
                    {!notification.isRead ? (
                      <button
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 sm:flex-none"
                        onClick={() => readMutation.mutate(notification.id)}
                        type="button"
                      >
                        <Check aria-hidden className="h-3 w-3" />
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {!feed.isPending && !feed.isError && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Bell aria-hidden className="h-10 w-10 text-gray-300 dark:text-gray-600" />
              <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">No notifications found</p>
              <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">
                New applications and interview access requests will appear here.
              </p>
            </div>
          ) : null}
        </div>

        {pagination.total > 0 ? <PaginationBar onPageChange={setPage} pagination={pagination} /> : null}
      </div>
    </div>
  );
}
