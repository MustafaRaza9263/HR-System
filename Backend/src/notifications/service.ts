import { Notification, type NotificationType } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import { escapeRegex } from "../utils/application-filter.js";
import { hrefForNotification, resolveNotificationContent } from "./catalog.js";
import { sendHrPush } from "./fcm.js";
import { publishNotification, type NotificationEvent } from "./stream.js";

export function serializeNotification(item: {
  _id: { toString(): string };
  type: NotificationType;
  title: string;
  body: string;
  refId: string;
  isRead: boolean;
  createdAt: Date;
}): NotificationEvent {
  return {
    id: item._id.toString(),
    type: item.type,
    title: item.title,
    body: item.body,
    refId: item.refId,
    href: hrefForNotification(item.type, item.refId),
    isRead: item.isRead,
    createdAt: item.createdAt,
  };
}

export async function notifyHR(type: NotificationType, refId: string): Promise<void> {
  const content = await resolveNotificationContent(type, refId);
  const created = await Notification.create({
    type,
    title: content.title,
    body: content.body,
    refId,
    targetRole: "hr",
    isRead: false,
  });

  const event = serializeNotification(created.toObject());
  publishNotification(event);

  const users = await User.find({ role: "hr", active: true }).select("fcmTokens").lean();
  const tokens = users.flatMap((user) => user.fcmTokens ?? []);
  const stale = await sendHrPush(tokens, {
    title: content.title,
    body: content.body,
    href: content.href,
    type,
    refId,
  });
  if (stale.length > 0) {
    await User.updateMany({ fcmTokens: { $in: stale } }, { $pull: { fcmTokens: { $in: stale } } }).exec();
  }
}

export async function listHrNotifications(input: {
  page: number;
  limit: number;
  unreadOnly?: boolean;
  q?: string;
}) {
  const filter: Record<string, unknown> = { targetRole: "hr" };
  if (input.unreadOnly) filter.isRead = false;
  if (input.q) {
    const escaped = escapeRegex(input.q);
    filter.$or = [
      { title: { $regex: escaped, $options: "i" } },
      { body: { $regex: escaped, $options: "i" } },
    ];
  }

  const skip = (input.page - 1) * input.limit;
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(input.limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ targetRole: "hr", isRead: false }),
  ]);

  return {
    notifications: items.map(serializeNotification),
    unreadCount,
    pagination: {
      total,
      page: input.page,
      limit: input.limit,
      pages: Math.max(1, Math.ceil(total / input.limit) || 1),
    },
  };
}

export async function unreadHrCount(): Promise<number> {
  return Notification.countDocuments({ targetRole: "hr", isRead: false });
}

export async function markNotificationRead(id: string) {
  return Notification.findOneAndUpdate(
    { _id: id, targetRole: "hr" },
    { $set: { isRead: true } },
    { new: true },
  ).lean();
}

export async function markAllHrNotificationsRead(): Promise<number> {
  const result = await Notification.updateMany(
    { targetRole: "hr", isRead: false },
    { $set: { isRead: true } },
  ).exec();
  return result.modifiedCount;
}

export async function saveFcmToken(userId: string, token: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $addToSet: { fcmTokens: token } }).exec();
}
