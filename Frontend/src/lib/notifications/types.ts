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

export interface NotificationsListResponse {
  data: { notifications: HrNotification[] };
}

export interface UnreadCountResponse {
  data: { count: number };
}
