import { parseHttpUrl } from "./http-url.js";

const LINK_TIMEOUT_MS = 8_000;
const MAX_LINK_CHARS = 8_000;
const MAX_LINKS = 8;
const URL_IN_TEXT = /https?:\/\/[^\s<>"'()]+/gi;

function clip(text: string, max = MAX_LINK_CHARS) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}\n\n[truncated]`;
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDiscovered(raw: string) {
  return parseHttpUrl(raw.replace(/[.,;:]+$/g, ""));
}

/** Unique http(s) URLs from free text, capped. Invalid matches are dropped. */
export function discoverUrls(text: string, extra: string[] = []): string[] {
  const found = text.match(URL_IN_TEXT) ?? [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...extra, ...found]) {
    const url = normalizeDiscovered(raw);
    if (!url) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(url);
    if (unique.length >= MAX_LINKS) break;
  }
  return unique;
}

/**
 * Best-effort fetch of a page as plain text. Timeouts, blocked hosts, and
 * non-HTML responses return null — never throws.
 */
export async function extractLinkText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(LINK_TIMEOUT_MS),
      headers: {
        Accept: "text/html,text/plain;q=0.9,*/*;q=0.1",
        "User-Agent": "HR-System-Scoring/1.0",
      },
    });
    if (!response.ok) return null;
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (contentType && !/text\/(html|plain)|application\/xhtml/i.test(contentType)) return null;
    const body = await response.text();
    const text = htmlToText(body);
    return text ? clip(text) : null;
  } catch {
    return null;
  }
}
