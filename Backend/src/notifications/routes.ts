import { Router } from "express";
import { Types } from "mongoose";

import { authenticate } from "../middleware/authenticate.js";
import { verifyBrowserOrigin } from "../middleware/origin.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { subscribeNotificationStream } from "./stream.js";
import { fcmTokenSchema, listNotificationsQuerySchema } from "./schemas.js";
import {
  listHrNotifications,
  markAllHrNotificationsRead,
  markNotificationRead,
  saveFcmToken,
  unreadHrCount,
} from "./service.js";

export const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const query = listNotificationsQuerySchema.parse(request.query);
    const result = await listHrNotifications({
      page: query.page,
      limit: query.limit,
      unreadOnly: query.unreadOnly === "true",
      ...(query.q ? { q: query.q } : {}),
    });
    response.status(200).json({ data: result });
  }),
);

notificationRouter.get(
  "/unread-count",
  asyncHandler(async (_request, response) => {
    const count = await unreadHrCount();
    response.status(200).json({ data: { count } });
  }),
);

notificationRouter.get(
  "/stream",
  (request, response) => {
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();
    response.write("event: ready\ndata: {}\n\n");

    request.socket.setTimeout(0);
    const unsubscribe = subscribeNotificationStream(response);
    const heartbeat = setInterval(() => {
      response.write(": keepalive\n\n");
    }, 25_000);

    request.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      response.end();
    });
  },
);

notificationRouter.patch(
  "/read-all",
  verifyBrowserOrigin,
  asyncHandler(async (_request, response) => {
    const count = await markAllHrNotificationsRead();
    response.status(200).json({ data: { count } });
  }),
);

notificationRouter.patch(
  "/:notificationId/read",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const notificationId = request.params.notificationId;
    if (typeof notificationId !== "string" || !Types.ObjectId.isValid(notificationId)) {
      throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "Notification was not found.");
    }
    const updated = await markNotificationRead(notificationId);
    if (!updated) {
      throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "Notification was not found.");
    }
    response.status(200).json({ data: { id: updated._id.toString(), isRead: true } });
  }),
);

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.post(
  "/fcm-token",
  verifyBrowserOrigin,
  asyncHandler(async (request, response) => {
    const input = fcmTokenSchema.parse(request.body);
    await saveFcmToken(request.auth!.user.id, input.token);
    response.status(204).send();
  }),
);
