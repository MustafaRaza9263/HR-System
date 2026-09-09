import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/query-keys";

import { NOTIFICATION_PREVIEW_LIMIT } from "./meta";
import type { HrNotification, NotificationsListResponse, UnreadCountResponse } from "./types";

const previewKey = queryKeys.notifications.list({ page: 1, limit: NOTIFICATION_PREVIEW_LIMIT });

export function applyIncomingNotification(queryClient: QueryClient, incoming: HrNotification) {
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
}

export function markNotificationReadInCache(queryClient: QueryClient, id: string) {
  let wasUnread = false;
  queryClient.setQueriesData<NotificationsListResponse>({ queryKey: ["notifications", "list"] }, (current) => {
    if (!current) return current;
    const itemUnread = current.data.notifications.some((item) => item.id === id && !item.isRead);
    if (itemUnread) wasUnread = true;
    return {
      data: {
        ...current.data,
        notifications: current.data.notifications.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
        unreadCount: itemUnread ? Math.max(0, (current.data.unreadCount ?? 1) - 1) : (current.data.unreadCount ?? 0),
      },
    };
  });
  if (!wasUnread) return;
  queryClient.setQueryData<UnreadCountResponse>(queryKeys.notifications.unread, (current) => ({
    data: { count: Math.max(0, (current?.data.count ?? 1) - 1) },
  }));
}

export function markAllNotificationsReadInCache(queryClient: QueryClient) {
  queryClient.setQueriesData<NotificationsListResponse>({ queryKey: ["notifications", "list"] }, (current) => {
    if (!current) return current;
    return {
      data: {
        ...current.data,
        notifications: current.data.notifications.map((item) => ({ ...item, isRead: true })),
        unreadCount: 0,
      },
    };
  });
  queryClient.setQueryData<UnreadCountResponse>(queryKeys.notifications.unread, { data: { count: 0 } });
}
