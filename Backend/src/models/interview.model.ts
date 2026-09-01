import { Schema, model, type InferSchemaType } from "mongoose";

export const INTERVIEW_STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

const interviewSchema = new Schema(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: "Application", required: true, index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
    time: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    durationMinutes: { type: Number, required: true, min: 15, max: 240 },
    status: {
      type: String,
      enum: INTERVIEW_STATUSES,
      required: true,
      default: "scheduled",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, versionKey: false },
);

interviewSchema.index({ applicationId: 1, status: 1 });
interviewSchema.index({ departmentId: 1, date: 1, status: 1 });

export type InterviewDocument = InferSchemaType<typeof interviewSchema>;
export const Interview = model("Interview", interviewSchema);
