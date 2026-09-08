import mongoose from "mongoose";

import { env } from "./env.js";
import { logger } from "../utils/logger.js";

let connection: mongoose.Connection | undefined;

export async function connectReadOnlyDatabase(): Promise<void> {
  const uri = env.MONGODB_READONLY_URI ?? env.MONGODB_URI;
  if (!env.MONGODB_READONLY_URI) {
    logger.warn(
      "MONGODB_READONLY_URI is unset; assistant reads use MONGODB_URI. Set a read-only DB user in production.",
    );
  }

  const next = mongoose.createConnection(uri, {
    autoIndex: false,
    bufferCommands: false,
    serverSelectionTimeoutMS: 5_000,
  });

  try {
    await next.asPromise();
    connection = next;
  } catch (error) {
    logger.error("read-only database connection failed", error);
    await next.close().catch(() => undefined);
  }
}

export async function disconnectReadOnlyDatabase(): Promise<void> {
  if (!connection) return;
  await connection.close();
  connection = undefined;
}

export function isReadOnlyDatabaseConnected(): boolean {
  return connection?.readyState === mongoose.ConnectionStates.connected;
}

export function getReadOnlyDb() {
  const db = connection?.db;
  if (!db) return null;
  return db;
}
