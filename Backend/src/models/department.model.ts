import { Schema, model, type InferSchemaType } from "mongoose";

const departmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    normalizedName: { type: String, required: true, unique: true, select: false },
    icon: { type: String, required: true, default: "building-2", maxlength: 64 },
    status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  },
  { timestamps: true, versionKey: false },
);

departmentSchema.index({ status: 1, name: 1 });

export type DepartmentDocument = InferSchemaType<typeof departmentSchema>;
export const Department = model("Department", departmentSchema);
