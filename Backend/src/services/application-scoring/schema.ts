import type { JsonSchema } from "../llm/types.js";

export const SCORING_JSON_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: {
      type: "number",
      description: "Fit vs the job description, 0-10, one decimal allowed",
      minimum: 0,
      maximum: 10,
    },
    summary: {
      type: "string",
      description: "Plain-text comparison of the candidate against this job",
      maxLength: 2000,
    },
    strengths: {
      type: "array",
      maxItems: 8,
      items: { type: "string", maxLength: 300 },
      description: "Short strengths relative to the job",
    },
    gaps: {
      type: "array",
      maxItems: 8,
      items: { type: "string", maxLength: 300 },
      description: "Short gaps relative to the job",
    },
  },
  required: ["score", "summary", "strengths", "gaps"],
};

export const SCORING_SYSTEM_PROMPT = `You rank a job applicant against one job description.
Return JSON matching the schema.
Score is 0-10 (one decimal allowed): how well this candidate fits THIS job, not jobs in general.
Summary is plain text, concise, candidate vs this JD.
Strengths and gaps are short factual bullets from the provided materials only.
Do not invent employers, degrees, or skills that are not in the materials.
Do not recommend hire, reject, or interview — advisory only.
Never add keys that are not in the schema.`;
