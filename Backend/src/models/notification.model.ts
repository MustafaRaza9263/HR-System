import { Schema, model, type InferSchemaType } from "mongoose";

export const NOTIFICATION_TYPES = ["interview_request", "new_application", "interview_completed"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const notificationSchema = new Schema(
  {
    type: { type: String, enum: NOTIFICATION_TYPES, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 500 },
    refId: { type: String, required: true, trim: true, maxlength: 64, index: true },
    targetRole: { type: String, enum: ["hr"], required: true, default: "hr", index: true },
    isRead: { type: Boolean, required: true, default: false, index: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

notificationSchema.index({ targetRole: 1, createdAt: -1 });
notificationSchema.index({ targetRole: 1, isRead: 1, createdAt: -1 });

export type NotificationDocument = InferSchemaType<typeof notificationSchema>;
export const Notification = model("Notification", notificationSchema);
