import { Schema, model, type InferSchemaType } from "mongoose";

const roleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    normalizedName: { type: String, required: true, select: false },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    icon: { type: String, required: true, default: "briefcase-business", maxlength: 64 },
    status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  },
  { timestamps: true, versionKey: false },
);

roleSchema.index({ departmentId: 1, normalizedName: 1 }, { unique: true });
roleSchema.index({ status: 1, departmentId: 1, name: 1 });

export type RoleDocument = InferSchemaType<typeof roleSchema>;
export const Role = model("Role", roleSchema);
