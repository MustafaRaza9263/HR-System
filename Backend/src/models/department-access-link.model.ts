import { Schema, model, type InferSchemaType } from "mongoose";

const departmentAccessLinkSchema = new Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    accessDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, versionKey: false },
);

departmentAccessLinkSchema.index({ departmentId: 1, accessDate: 1 }, { unique: true });

export type DepartmentAccessLinkDocument = InferSchemaType<typeof departmentAccessLinkSchema>;
export const DepartmentAccessLink = model("DepartmentAccessLink", departmentAccessLinkSchema);
