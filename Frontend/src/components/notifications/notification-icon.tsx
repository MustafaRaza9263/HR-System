import type { NotificationType } from "@/lib/notifications/types";
import { notificationMeta } from "@/lib/notifications/meta";

export function NotificationTypeIcon({
  type,
  className,
}: {
  type: NotificationType;
  className?: string;
}) {
  const meta = notificationMeta(type);
  const Icon = meta.icon;
  return <Icon aria-hidden className={className ?? `h-4 w-4 ${meta.iconClass}`} />;
}
