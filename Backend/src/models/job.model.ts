import { Schema, model, type InferSchemaType } from "mongoose";

const customFieldConstraintSchema = new Schema(
  {
    maxLength: { type: Number, min: 1 },
    min: { type: Number },
    max: { type: Number },
    options: { type: [String], default: undefined },
  },
  { _id: false },
);

const customFieldSchema = new Schema(
  {
    id: { type: String, required: true, maxlength: 64 },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    type: {
      type: String,
      enum: ["text", "textarea", "number", "select", "date", "checkbox", "file"],
      required: true,
    },
    required: { type: Boolean, required: true, default: false },
    constraint: { type: customFieldConstraintSchema, default: undefined },
    section: {
      type: String,
      enum: ["personal", "experience", "education"],
      required: true,
    },
  },
  { _id: false },
);

const jobSchema = new Schema(
  {
    slug: { type: String, default: null, maxlength: 200 },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    description: { type: Schema.Types.Mixed, default: null },
    descriptionPlain: { type: String, default: "", maxlength: 50000 },
    jobType: {
      type: String,
      enum: ["Full-time", "Part-time", "Contract", "Temporary", "Internship", "Fresher"],
      default: null,
    },
    positionsAvailable: { type: Number, required: true, default: 1, min: 1 },
    positionsFilled: { type: Number, required: true, default: 0, min: 0 },
    locations: { type: [String], default: [] },
    remote: { type: Boolean, required: true, default: false },
    salaryMin: { type: Number, default: null, min: 0 },
    salaryMax: { type: Number, default: null, min: 0 },
    fieldsConfig: {
      customFields: { type: [customFieldSchema], default: [] },
    },
    status: {
      type: String,
      enum: ["draft", "open", "filled", "closed"],
      required: true,
      default: "draft",
    },
    closeReason: { type: String, default: null, maxlength: 500 },
    applicationCount: { type: Number, required: true, default: 0, min: 0 },
    wizardStep: { type: Number, required: true, default: 1, min: 1, max: 4 },
    publishedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  },
  { timestamps: true, versionKey: false },
);

jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ departmentId: 1, roleId: 1, status: 1 });
jobSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: "string" } } });
jobSchema.index({ title: "text", descriptionPlain: "text" });

export type JobDocument = InferSchemaType<typeof jobSchema>;
export const Job = model("Job", jobSchema);
