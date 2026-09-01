export type NotificationType = "interview_request" | "new_application";

export interface HrNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  refId: string;
  href: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListFilters {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  q?: string;
}

export interface NotificationPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface NotificationsListResponse {
  data: {
    notifications: HrNotification[];
    unreadCount: number;
    pagination: NotificationPagination;
  };
}

export interface UnreadCountResponse {
  data: { count: number };
}
