import { Router } from "express";

import { isDatabaseConnected } from "../config/database.js";
import { authRouter } from "./auth.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  const database = isDatabaseConnected() ? "connected" : "disconnected";
  response.status(database === "connected" ? 200 : 503).json({
    data: { status: database === "connected" ? "ok" : "degraded", database },
  });
});

apiRouter.use("/auth", authRouter);
