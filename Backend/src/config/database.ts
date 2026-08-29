import mongoose from "mongoose";

import { env } from "./env.js";
import { Session } from "../models/session.model.js";
import { User } from "../models/user.model.js";

export async function connectToDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: false,
    bufferCommands: false,
    serverSelectionTimeoutMS: 5_000,
  });
  await Promise.all([User.createIndexes(), Session.createIndexes()]);
}

export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
