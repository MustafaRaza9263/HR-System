import { Application } from "../../models/application.model.js";
import { Department } from "../../models/department.model.js";
import { DepartmentAccessLink } from "../../models/department-access-link.model.js";
import { Interview } from "../../models/interview.model.js";
import { InterviewNote } from "../../models/interview-note.model.js";
import { Job } from "../../models/job.model.js";
import { LinkRegistrant } from "../../models/link-registrant.model.js";
import { Notification } from "../../models/notification.model.js";
import { Role } from "../../models/role.model.js";
import { ApiError } from "../../utils/api-error.js";
import { getReadOnlyDb, isReadOnlyDatabaseConnected } from "../../config/readonly-database.js";

export const READ_COLLECTIONS = {
  applications: Application.collection.name,
  interviews: Interview.collection.name,
  interviewNotes: InterviewNote.collection.name,
  jobs: Job.collection.name,
  departments: Department.collection.name,
  roles: Role.collection.name,
  notifications: Notification.collection.name,
  departmentAccessLinks: DepartmentAccessLink.collection.name,
  linkRegistrants: LinkRegistrant.collection.name,
} as const;

export type ReadCollectionName = (typeof READ_COLLECTIONS)[keyof typeof READ_COLLECTIONS];

export type FindOptions = {
  projection?: Record<string, 0 | 1>;
  sort?: Record<string, 1 | -1>;
  skip?: number;
  limit?: number;
};

function db() {
  if (!isReadOnlyDatabaseConnected()) {
    throw new ApiError(503, "ASSISTANT_UNAVAILABLE", "The assistant is not connected to the database.");
  }
  const next = getReadOnlyDb();
  if (!next) {
    throw new ApiError(503, "ASSISTANT_UNAVAILABLE", "The assistant is not connected to the database.");
  }
  return next;
}

function collection(name: ReadCollectionName) {
  return db().collection(name);
}

/** Read-only Mongo access. Tools must use this — never the primary mongoose models. */
export const readDb = {
  find(name: ReadCollectionName, filter: object, options: FindOptions = {}) {
    let cursor = collection(name).find(filter);
    if (options.projection) cursor = cursor.project(options.projection);
    if (options.sort) cursor = cursor.sort(options.sort);
    if (typeof options.skip === "number") cursor = cursor.skip(options.skip);
    if (typeof options.limit === "number") cursor = cursor.limit(options.limit);
    return cursor.toArray();
  },
  countDocuments(name: ReadCollectionName, filter: object) {
    return collection(name).countDocuments(filter);
  },
  aggregate(name: ReadCollectionName, pipeline: object[]) {
    return collection(name).aggregate(pipeline).toArray();
  },
};
