import { Router } from "express";

import { isDatabaseConnected } from "../config/database.js";
import { notificationRouter, userRouter } from "../notifications/index.js";
import { applicationRouter } from "./application.routes.js";
import { authRouter } from "./auth.routes.js";
import { careersRouter } from "./careers.routes.js";
import { departmentRouter } from "./department.routes.js";
import { departmentLinkRouter } from "./department-link.routes.js";
import { interviewAccessRouter } from "./interview-access.routes.js";
import { interviewRouter } from "./interview.routes.js";
import { jobRouter } from "./job.routes.js";
import { linkRegistrantRouter } from "./link-registrant.routes.js";
import { roleRouter } from "./role.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  const database = isDatabaseConnected() ? "connected" : "disconnected";
  response.status(database === "connected" ? 200 : 503).json({
    data: { status: database === "connected" ? "ok" : "degraded", database },
  });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/careers", careersRouter);
apiRouter.use("/departments", departmentRouter);
apiRouter.use("/roles", roleRouter);
apiRouter.use("/jobs", jobRouter);
apiRouter.use("/applications", applicationRouter);
apiRouter.use("/interviews", interviewRouter);
apiRouter.use("/department-links", departmentLinkRouter);
apiRouter.use("/link-registrants", linkRegistrantRouter);
apiRouter.use("/interview-access", interviewAccessRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/users", userRouter);
