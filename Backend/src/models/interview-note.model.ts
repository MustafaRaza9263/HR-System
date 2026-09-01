import { Schema, model, type InferSchemaType } from "mongoose";

const interviewNoteSchema = new Schema(
  {
    interviewId: { type: Schema.Types.ObjectId, ref: "Interview", required: true, index: true },
    authorName: { type: String, required: true, trim: true, maxlength: 120 },
    authorEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

interviewNoteSchema.index({ interviewId: 1, createdAt: 1 });

export type InterviewNoteDocument = InferSchemaType<typeof interviewNoteSchema>;
export const InterviewNote = model("InterviewNote", interviewNoteSchema);
