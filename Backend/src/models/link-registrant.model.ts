import { Schema, model, type InferSchemaType } from "mongoose";

export const REGISTRANT_STATUSES = ["pending_approval", "approved", "rejected", "revoked"] as const;
export type RegistrantStatus = (typeof REGISTRANT_STATUSES)[number];

const linkRegistrantSchema = new Schema(
  {
    linkToken: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    status: {
      type: String,
      enum: REGISTRANT_STATUSES,
      required: true,
      default: "pending_approval",
      index: true,
    },
    requestedAt: { type: Date, required: true, default: Date.now },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

linkRegistrantSchema.index({ linkToken: 1, status: 1, requestedAt: 1 });

export type LinkRegistrantDocument = InferSchemaType<typeof linkRegistrantSchema>;
export const LinkRegistrant = model("LinkRegistrant", linkRegistrantSchema);
