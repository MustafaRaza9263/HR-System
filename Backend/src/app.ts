import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY);
app.use(
  pinoHttp({
    redact: {
      paths: [
        "req.headers.cookie",
        "req.headers.authorization",
        "req.body.password",
        "res.headers[\"set-cookie\"]",
      ],
      censor: "[REDACTED]",
    },
  }),
);
app.use(helmet());
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || env.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by CORS."));
    },
  }),
);
app.use(express.json({ limit: "16kb", strict: true }));
app.use(cookieParser());

app.use("/api/v1", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
