import { Router } from "express";

import { isDatabaseConnected } from "../config/database.js";
import { authRouter } from "./auth.routes.js";
import { careersRouter } from "./careers.routes.js";
import { departmentRouter } from "./department.routes.js";
import { jobRouter } from "./job.routes.js";
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
