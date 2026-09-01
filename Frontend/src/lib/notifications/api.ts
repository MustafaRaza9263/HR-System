import { apiRequest } from "@/lib/api";

import type { NotificationListFilters, NotificationsListResponse } from "./types";
import { NOTIFICATION_PREVIEW_LIMIT } from "./meta";

export function notificationsPath(filters: NotificationListFilters = {}) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? NOTIFICATION_PREVIEW_LIMIT));
  if (filters.unreadOnly) params.set("unreadOnly", "true");
  if (filters.q) params.set("q", filters.q);
  return `/notifications?${params.toString()}`;
}

export function fetchNotifications(filters: NotificationListFilters = {}) {
  return apiRequest<NotificationsListResponse>(notificationsPath(filters));
}
