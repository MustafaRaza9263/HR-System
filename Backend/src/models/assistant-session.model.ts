import { Schema, model, type InferSchemaType } from "mongoose";

const assistantStepSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, maxlength: 120 },
    status: { type: String, enum: ["done"], required: true },
  },
  { _id: false },
);

const assistantTableSchema = new Schema(
  {
    columns: {
      type: [
        {
          key: { type: String, required: true, maxlength: 40 },
          label: { type: String, required: true, maxlength: 40 },
          type: { type: String, enum: ["text", "status", "person", "datetime"], required: true },
        },
      ],
      default: [],
    },
    rows: { type: [[String]], default: [] },
  },
  { _id: false },
);

const assistantMessageSchema = new Schema(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, default: "", maxlength: 8000 },
    steps: { type: [assistantStepSchema], default: [] },
    table: { type: assistantTableSchema, default: undefined },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const assistantModelTurnSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant", "tool"], required: true },
    text: { type: String, required: true, maxlength: 12000 },
  },
  { _id: false },
);

const assistantSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    messages: { type: [assistantMessageSchema], default: [] },
    modelHistory: { type: [assistantModelTurnSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

assistantSessionSchema.index({ userId: 1, updatedAt: -1 });

export type AssistantSessionDocument = InferSchemaType<typeof assistantSessionSchema>;
export const AssistantSession = model("AssistantSession", assistantSessionSchema);
