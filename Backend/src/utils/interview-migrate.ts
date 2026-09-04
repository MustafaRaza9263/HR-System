import type { Types } from "mongoose";

import { Application } from "../models/application.model.js";
import { DepartmentAccessLink } from "../models/department-access-link.model.js";
import { Interview } from "../models/interview.model.js";
import { LinkRegistrant, type RegistrantStatus } from "../models/link-registrant.model.js";
import { User } from "../models/user.model.js";
import { calendarDateInZone, clockTimeInZone, todayCalendarDate } from "./date-state.js";

type LegacyInterview = {
  _id: Types.ObjectId;
  applicationId?: unknown;
  scheduledAt?: unknown;
  createdAt?: unknown;
  date?: unknown;
  time?: unknown;
  duration?: unknown;
  durationMinutes?: unknown;
  createdBy?: unknown;
  createdByEmail?: unknown;
  status?: unknown;
};

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

export async function migrateInterviewDocuments(): Promise<void> {
  await Interview.collection.updateMany(
    { $or: [{ label: { $exists: false } }, { label: null }, { label: "" }] },
    { $set: { label: "Interview" } },
  );

  const legacy = (await Interview.collection
    .find({
      $or: [{ date: { $exists: false } }, { date: null }, { departmentId: { $exists: false } }, { departmentId: null }],
    })
    .toArray()) as LegacyInterview[];

  if (legacy.length === 0) return;

  const fallbackHr = await User.findOne({ role: "hr", active: true }).select("_id").lean();

  for (const doc of legacy) {
    const application = await Application.findById(doc.applicationId).select("roleSnapshot").lean();
    if (!application) continue;

    const scheduledAt = asDate(doc.scheduledAt) ?? asDate(doc.createdAt);
    const date =
      typeof doc.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(doc.date)
        ? doc.date
        : scheduledAt
          ? calendarDateInZone(scheduledAt)
          : todayCalendarDate();
    const time =
      typeof doc.time === "string" && /^\d{2}:\d{2}$/.test(doc.time)
        ? doc.time
        : scheduledAt
          ? clockTimeInZone(scheduledAt)
          : "09:00";
    const durationMinutes =
      typeof doc.durationMinutes === "number"
        ? doc.durationMinutes
        : typeof doc.duration === "number"
          ? doc.duration
          : 45;

    let createdBy = doc.createdBy;
    if (!createdBy && typeof doc.createdByEmail === "string") {
      const owner = await User.findOne({ email: doc.createdByEmail }).select("_id").lean();
      createdBy = owner?._id;
    }
    createdBy ??= fallbackHr?._id;
    if (!createdBy) continue;

    await Interview.collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          date,
          time,
          durationMinutes,
          departmentId: application.roleSnapshot.departmentId,
          createdBy,
          status: typeof doc.status === "string" ? doc.status : "scheduled",
        },
        $unset: {
          scheduledAt: "",
          duration: "",
          assignees: "",
          createdByEmail: "",
          roundNumber: "",
          notes: "",
          cancelReason: "",
        },
      },
    );
  }
}

type LegacyAccessLink = {
  token?: unknown;
  linkStatus?: unknown;
  registrantName?: unknown;
  registrantEmail?: unknown;
  requestedAt?: unknown;
  approvedAt?: unknown;
};

const REGISTRANT_FROM_LINK = new Set(["pending_approval", "approved", "rejected", "revoked"]);

export async function migrateAccessLinkRegistrants(): Promise<void> {
  const legacy = (await DepartmentAccessLink.collection
    .find({
      $or: [
        { linkStatus: { $exists: true } },
        { registrantName: { $exists: true } },
        { registrantEmail: { $exists: true } },
        { requestedAt: { $exists: true } },
        { approvedAt: { $exists: true } },
      ],
    })
    .toArray()) as LegacyAccessLink[];

  if (legacy.length === 0) return;

  for (const doc of legacy) {
    const token = typeof doc.token === "string" ? doc.token : "";
    const status = typeof doc.linkStatus === "string" ? doc.linkStatus : "";
    const name = typeof doc.registrantName === "string" ? doc.registrantName.trim() : "";
    const email = typeof doc.registrantEmail === "string" ? doc.registrantEmail.trim().toLowerCase() : "";
    if (token && name && email && REGISTRANT_FROM_LINK.has(status)) {
      const mappedStatus = status as RegistrantStatus;
      const existing = await LinkRegistrant.findOne({ linkToken: token, email, status: mappedStatus });
      if (!existing) {
        await LinkRegistrant.create({
          linkToken: token,
          name,
          email,
          status: mappedStatus,
          requestedAt: doc.requestedAt instanceof Date ? doc.requestedAt : new Date(),
          approvedAt: doc.approvedAt instanceof Date ? doc.approvedAt : null,
        });
      }
    }
  }

  await DepartmentAccessLink.collection.updateMany(
    {},
    { $unset: { linkStatus: "", registrantName: "", registrantEmail: "", requestedAt: "", approvedAt: "" } },
  );
  try {
    await DepartmentAccessLink.collection.dropIndex("linkStatus_1_accessDate_1");
  } catch {
    // Index may already be gone after the schema change.
  }
}
