import type { Response } from "express";

import type { NotificationType } from "../models/notification.model.js";

export interface NotificationEvent {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  refId: string;
  href: string;
  isRead: boolean;
  createdAt: Date;
}

const clients = new Set<Response>();

export function subscribeNotificationStream(response: Response): () => void {
  clients.add(response);
  return () => {
    clients.delete(response);
  };
}

export function publishNotification(event: NotificationEvent): void {
  const payload = `event: notification\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}
