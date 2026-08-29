import { createServer } from "node:http";

import { app } from "./app.js";
import { connectToDatabase, disconnectFromDatabase } from "./config/database.js";
import { env } from "./config/env.js";

await connectToDatabase();

const server = createServer(app);
server.listen(env.PORT, () => {
  console.info(`HR API listening on http://localhost:${env.PORT}`);
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`${signal} received; shutting down gracefully.`);

  server.close(async (error) => {
    try {
      await disconnectFromDatabase();
    } finally {
      if (error) console.error(error);
      process.exit(error ? 1 : 0);
    }
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
