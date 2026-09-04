import mongoose from "mongoose";

import { Application } from "../models/application.model.js";
import { DepartmentAccessLink } from "../models/department-access-link.model.js";
import { Interview } from "../models/interview.model.js";
import { InterviewNote } from "../models/interview-note.model.js";
import { Job } from "../models/job.model.js";
import { LinkRegistrant } from "../models/link-registrant.model.js";
import { Notification } from "../models/notification.model.js";
import { Session } from "../models/session.model.js";
import { User } from "../models/user.model.js";
import { migrateAccessLinkRegistrants, migrateInterviewDocuments } from "../utils/interview-migrate.js";
import { env } from "./env.js";

export async function connectToDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: false,
    bufferCommands: false,
    serverSelectionTimeoutMS: 5_000,
  });
  await Application.collection.updateMany(
    { status: "interviewing" },
    { $set: { status: "interview_scheduled" } },
  );
  await Job.collection.updateMany({ status: "filled" }, { $set: { status: "closed" } });
  await Job.collection.updateMany({}, { $unset: { positionsAvailable: "", positionsFilled: "" } });
  await migrateInterviewDocuments();
  await migrateAccessLinkRegistrants();
  await Promise.all([
    Job.createIndexes(),
    User.createIndexes(),
    Session.createIndexes(),
    Application.createIndexes(),
    Interview.createIndexes(),
    InterviewNote.createIndexes(),
    DepartmentAccessLink.createIndexes(),
    LinkRegistrant.createIndexes(),
    Notification.createIndexes(),
  ]);
}

export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
