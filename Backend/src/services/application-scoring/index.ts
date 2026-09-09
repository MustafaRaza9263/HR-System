import { readFile } from "node:fs/promises";
import { extname } from "node:path";

import { env } from "../../config/env.js";
import { Application } from "../../models/application.model.js";
import { Job } from "../../models/job.model.js";
import { publishHrEvent } from "../../notifications/stream.js";
import { discoverUrls, extractLinkText } from "../../utils/extract-link-text.js";
import { extractResumeText } from "../../utils/extract-resume-text.js";
import { parseHttpUrl } from "../../utils/http-url.js";
import { logger } from "../../utils/logger.js";
import { serializeScoring } from "../../utils/serialize-application.js";
import { resolveUploadPath } from "../../utils/uploads.js";
import { getLlmProvider } from "../llm/index.js";

import { sanitizeScoringResult } from "./sanitize.js";
import { SCORING_JSON_SCHEMA, SCORING_SYSTEM_PROMPT } from "./schema.js";

const SOURCE_CHAR_CAP = 8_000;

type StoredAnswer = {
  label?: string;
  type?: string;
  value?: unknown;
};

type ScoringApplication = {
  _id: { toString(): string };
  jobId: { toString(): string };
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  candidateDateOfBirth?: string | null;
  candidateCnic?: string | null;
  candidateMaritalStatus?: string | null;
  candidateAlternativePhone?: string | null;
  expectedSalary?: number | null;
  expectedSalaryCurrency?: string | null;
  resumeUrl: string;
  resumeOriginalName: string;
  answers?: StoredAnswer[];
  experienceEntries?: Array<Record<string, unknown>>;
  educationEntries?: Array<Record<string, unknown>>;
  roleSnapshot: { title: string; departmentName: string; roleName: string };
  scoring?: { status?: string } | null;
};

function clip(text: string, max = SOURCE_CHAR_CAP) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}\n\n[truncated]`;
}

function mimeFor(filename: string) {
  const ext = extname(filename).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

function scalarToString(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function line(label: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  return `${label}: ${String(value)}`;
}

function urlAnswers(answers: StoredAnswer[]) {
  const urls: string[] = [];
  for (const answer of answers) {
    if (answer.type !== "url" || typeof answer.value !== "string") continue;
    const url = parseHttpUrl(answer.value);
    if (url) urls.push(url);
  }
  return urls;
}

function formatAnswers(answers: StoredAnswer[]) {
  const lines: string[] = [];
  for (const answer of answers) {
    if (answer.type === "file") continue;
    const label = answer.label?.trim() || "Field";
    if (answer.type === "checkbox") {
      lines.push(`${label}: ${answer.value === true ? "Yes" : "No"}`);
      continue;
    }
    if (answer.value === null || answer.value === undefined || answer.value === "") continue;
    const text = scalarToString(answer.value);
    if (!text) continue;
    lines.push(`${label}: ${text}`);
  }
  return lines.join("\n");
}

function formatEntries(label: string, rows: Array<Record<string, unknown>> | undefined) {
  if (!rows || rows.length === 0) return "";
  const blocks = rows.map((row, index) => {
    const body = Object.entries(row)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => {
        const text = scalarToString(value);
        return text ? `${key}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n");
    return `${label} ${index + 1}\n${body}`;
  });
  return blocks.join("\n\n");
}

async function loadResumeText(application: ScoringApplication) {
  try {
    const absolute = resolveUploadPath(application.resumeUrl);
    const buffer = await readFile(absolute);
    return extractResumeText({
      buffer,
      originalname: application.resumeOriginalName,
      mimetype: mimeFor(application.resumeOriginalName),
    });
  } catch {
    return null;
  }
}

function dumpContext(applicationId: string, sections: Array<[string, string]>) {
  const lines = [`--- scoring context ${applicationId} ---`];
  for (const [title, body] of sections) {
    lines.push(`## ${title}`, body.trim() || "(empty)", "");
  }
  lines.push("--- end scoring context ---");
  console.log(lines.join("\n"));
}

export const emptyScoring = {
  status: "pending" as const,
  score: null,
  summary: null,
  strengths: [] as string[],
  gaps: [] as string[],
  provider: null,
  model: null,
  linksAttempted: 0,
  linksUsed: 0,
  scoredAt: null,
};

function publishApplicationScored(applicationId: string, scoring: Parameters<typeof serializeScoring>[0]) {
  publishHrEvent("application.scored", { id: applicationId, ...serializeScoring(scoring) });
}

export async function markScoringFailed(applicationId: string) {
  const scoredAt = new Date();
  const write = await Application.updateOne(
    { _id: applicationId, "scoring.status": { $ne: "completed" } },
    {
      $set: {
        "scoring.status": "failed",
        "scoring.score": null,
        "scoring.summary": null,
        "scoring.strengths": [],
        "scoring.gaps": [],
        "scoring.scoredAt": scoredAt,
      },
    },
  );
  if (write.modifiedCount > 0) {
    publishApplicationScored(applicationId, {
      status: "failed",
      score: null,
      summary: null,
      strengths: [],
      gaps: [],
      scoredAt,
    });
  }
}

export async function failStaleScoring() {
  const result = await Application.updateMany(
    { "scoring.status": "pending" },
    {
      $set: {
        "scoring.status": "failed",
        "scoring.scoredAt": new Date(),
      },
    },
  );
  if (result.modifiedCount > 0) {
    logger.info(`scoring  marked ${String(result.modifiedCount)} stale pending as failed`);
  }
}

export async function scoreApplication(applicationId: string) {
  const application = (await Application.findById(applicationId).lean()) as ScoringApplication | null;
  if (!application) {
    logger.warn(`scoring ${applicationId}  skipped  application missing`);
    return;
  }
  if (application.scoring?.status === "completed") {
    logger.info(`scoring ${applicationId}  skipped  already completed`);
    return;
  }

  logger.info(`scoring ${applicationId}  started  ${application.candidateName}`);

  logger.info(`scoring ${applicationId}  resume  reading ${application.resumeOriginalName}`);
  const resumeText = await loadResumeText(application);
  logger.info(
    `scoring ${applicationId}  resume  ${resumeText ? `${String(resumeText.length)} chars` : "unreadable (continuing)"}`,
  );

  const answers = application.answers ?? [];
  const fromFields = urlAnswers(answers);
  const discovered = discoverUrls(resumeText ?? "", fromFields);
  logger.info(
    `scoring ${applicationId}  links  ${String(discovered.length)} to fetch  (${String(fromFields.length)} from url fields)`,
  );

  const linkBlocks: Array<{ url: string; text: string }> = [];
  for (const url of discovered) {
    const text = await extractLinkText(url);
    if (!text) {
      logger.info(`scoring ${applicationId}  link dropped  ${url}`);
      continue;
    }
    linkBlocks.push({ url, text });
    logger.info(`scoring ${applicationId}  link used  ${url}  ${String(text.length)} chars`);
  }

  const job = await Job.findById(application.jobId).select("title descriptionPlain").lean();
  const jobTitle = job?.title || application.roleSnapshot.title;
  const jobBlock = [
    line("Title", jobTitle),
    line("Department", application.roleSnapshot.departmentName),
    line("Role", application.roleSnapshot.roleName),
    "",
    clip(job?.descriptionPlain ?? ""),
  ]
    .filter((entry) => entry !== null)
    .join("\n");
  logger.info(`scoring ${applicationId}  job  ${jobTitle}`);

  const applicationBlock = [
    line("Name", application.candidateName),
    line("Email", application.candidateEmail),
    line("Phone", application.candidatePhone),
    line("Date of birth", application.candidateDateOfBirth),
    line("CNIC", application.candidateCnic),
    line("Marital status", application.candidateMaritalStatus),
    line("Alternative phone", application.candidateAlternativePhone),
    line(
      "Expected salary",
      application.expectedSalary != null
        ? `${application.expectedSalaryCurrency ?? ""} ${String(application.expectedSalary)}`.trim()
        : null,
    ),
    "",
    formatAnswers(answers),
    "",
    formatEntries("Experience", application.experienceEntries),
    "",
    formatEntries("Education", application.educationEntries),
  ]
    .filter((entry) => entry !== null)
    .join("\n");

  const resumeBlock = resumeText ? clip(resumeText) : "";
  const linkSection = linkBlocks
    .map((item) => `URL: ${item.url}\n${clip(item.text)}`)
    .join("\n\n");

  dumpContext(applicationId, [
    ["Job", jobBlock],
    ["Application", clip(applicationBlock)],
    ["Resume", resumeBlock],
    ["Linked pages", linkSection],
  ]);

  const provider = getLlmProvider();
  logger.info(`scoring ${applicationId}  model  ${provider.id}/${env.LLM_MODEL}`);

  const userPrompt = [
    "Rank this candidate against the job. Use only the materials below.",
    "",
    "## Job",
    jobBlock || "(none)",
    "",
    "## Application",
    clip(applicationBlock) || "(none)",
    "",
    "## Resume",
    resumeBlock || "(none)",
    "",
    "## Linked pages",
    linkSection || "(none)",
  ].join("\n");

  const raw = await provider.generateStructured({
    systemPrompt: SCORING_SYSTEM_PROMPT,
    userPrompt,
    jsonSchema: SCORING_JSON_SCHEMA,
  });
  const result = sanitizeScoringResult(raw);
  if (!result) {
    throw new Error("scoring output was empty or invalid");
  }

  const scoring = {
    status: "completed" as const,
    score: result.score,
    summary: result.summary,
    strengths: result.strengths,
    gaps: result.gaps,
    provider: provider.id,
    model: env.LLM_MODEL,
    linksAttempted: discovered.length,
    linksUsed: linkBlocks.length,
    scoredAt: new Date(),
  };
  const write = await Application.updateOne(
    { _id: applicationId, "scoring.status": { $ne: "completed" } },
    { $set: { scoring } },
  );
  if (write.modifiedCount > 0) publishApplicationScored(applicationId, scoring);
  logger.info(`scoring ${applicationId}  completed  score ${String(result.score)}`);
}
