import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/query-keys";

import type { NotificationsListResponse, UnreadCountResponse } from "./types";

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
