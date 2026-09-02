import { formatDistanceToNow, isValid } from "date-fns";
import { Bell, CalendarClock, CircleCheck, ClipboardList, type LucideIcon } from "lucide-react";

import type { NotificationType } from "./types";

export const NOTIFICATION_PREVIEW_LIMIT = 20;
export const NOTIFICATION_PAGE_LIMIT = 20;

interface NotificationMeta {
  icon: LucideIcon;
  iconClass: string;
  label: string;
}

const META: Record<NotificationType, NotificationMeta> = {
  new_application: {
    icon: ClipboardList,
    iconClass: "text-indigo-500",
    label: "New application",
  },
  interview_request: {
    icon: CalendarClock,
    iconClass: "text-amber-500",
    label: "Interview access",
  },
  interview_completed: {
    icon: CircleCheck,
    iconClass: "text-emerald-500",
    label: "Interview completed",
  },
};

export function notificationMeta(type: NotificationType): NotificationMeta {
  return META[type] ?? { icon: Bell, iconClass: "text-gray-500", label: "Notification" };
}

export function relativeNotificationTime(value: string) {
  const date = new Date(value);
  if (!isValid(date)) return "";
  return formatDistanceToNow(date, { addSuffix: true });
}
