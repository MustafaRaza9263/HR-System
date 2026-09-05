import { Schema, model, type InferSchemaType } from "mongoose";

const roleSnapshotSchema = new Schema(
  {
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    departmentName: { type: String, required: true, trim: true, maxlength: 100 },
    roleName: { type: String, required: true, trim: true, maxlength: 100 },
    title: { type: String, required: true, trim: true, maxlength: 160 },
  },
  { _id: false },
);

const applicationAnswerSchema = new Schema(
  {
    fieldId: { type: String, required: true, maxlength: 64 },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    type: {
      type: String,
      enum: ["text", "textarea", "number", "select", "date", "checkbox", "file"],
      required: true,
    },
    section: {
      type: String,
      enum: ["personal", "experience", "education"],
      required: true,
    },
    value: { type: Schema.Types.Mixed, default: null },
    fileName: { type: String, default: null, maxlength: 255 },
  },
  { _id: false },
);

const experienceEntrySchema = new Schema(
  {
    company: { type: String, required: true, trim: true, maxlength: 160 },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    startDate: { type: String, required: true, maxlength: 10 },
    endDate: { type: String, default: null, maxlength: 10 },
    currentlyWorking: { type: Boolean, default: false },
    salary: { type: Number, default: null, min: 0 },
    description: { type: String, default: "", maxlength: 2000 },
  },
  { _id: false },
);

const educationEntrySchema = new Schema(
  {
    school: { type: String, required: true, trim: true, maxlength: 160 },
    degree: { type: String, required: true, trim: true, maxlength: 160 },
    fieldOfStudy: { type: String, default: "", maxlength: 160 },
    cgpaPercentage: { type: String, default: "", maxlength: 40 },
    startDate: { type: String, default: null, maxlength: 10 },
    endDate: { type: String, default: null, maxlength: 10 },
  },
  { _id: false },
);

const applicationSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    roleSnapshot: { type: roleSnapshotSchema, required: true },
    answers: { type: [applicationAnswerSchema], default: [] },
    experienceEntries: { type: [experienceEntrySchema], default: [] },
    educationEntries: { type: [educationEntrySchema], default: [] },
    candidateName: { type: String, required: true, trim: true, maxlength: 120 },
    candidateEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    candidatePhone: { type: String, required: true, trim: true, maxlength: 30 },
    candidateDateOfBirth: { type: String, default: null, maxlength: 10 },
    candidateCnic: { type: String, default: null, maxlength: 15 },
    candidateMaritalStatus: { type: String, default: null, maxlength: 20 },
    candidateAlternativePhone: { type: String, default: null, maxlength: 30 },
    resumeUrl: { type: String, required: true, maxlength: 500 },
    resumeOriginalName: { type: String, required: true, maxlength: 255 },
    status: {
      type: String,
      enum: [
        "submitted",
        "under_review",
        "interview_scheduled",
        "interviewed",
        "approved",
        "rejected",
        "trial",
      ],
      required: true,
      default: "submitted",
    },
    rejectionReason: { type: String, default: null, maxlength: 500 },
    rejectedAt: { type: Date, default: null },
    decisionReason: { type: String, default: null, maxlength: 500 },
    approvedAt: { type: Date, default: null },
    trialAt: { type: Date, default: null },
    completedInterviewCount: { type: Number, required: true, default: 0, min: 0 },
    source: { type: String, required: true, default: "website", maxlength: 80 },
    campaign: { type: String, default: null, maxlength: 120 },
    aiScore: { type: Number, default: null, min: 0, max: 100 },
    aiSummary: { type: String, default: null, maxlength: 4000 },
    aiScoredAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

applicationSchema.index({ jobId: 1, createdAt: -1 });
applicationSchema.index({ candidateEmail: 1, createdAt: -1 });
applicationSchema.index({ status: 1, createdAt: -1 });
applicationSchema.index({ jobId: 1, candidateEmail: 1 });
applicationSchema.index({ jobId: 1, candidateCnic: 1 });

export type ApplicationDocument = InferSchemaType<typeof applicationSchema>;
export const Application = model("Application", applicationSchema);
