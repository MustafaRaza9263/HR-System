import type { RequestHandler } from "express";
import { styleText } from "node:util";

const useColor = Boolean(process.stdout.isTTY) && process.env.NO_COLOR !== "1";

type Style = Parameters<typeof styleText>[0];

function paint(color: Style, text: string) {
  return useColor ? styleText(color, text) : text;
}

function timestamp() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function methodColor(method: string): Style {
  switch (method) {
    case "GET":
      return "cyan";
    case "POST":
      return "green";
    case "PATCH":
    case "PUT":
      return "yellow";
    case "DELETE":
      return "red";
    default:
      return "white";
  }
}

function statusColor(status: number): Style {
  if (status >= 500) return "red";
  if (status >= 400) return "yellow";
  if (status >= 300) return "cyan";
  return "green";
}

function errorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "";
}

function line(level: string, levelColor: Style, message: string) {
  return `${paint("gray", timestamp())}  ${paint(levelColor, level.padEnd(5))}  ${message}`;
}

const quietExact = new Set(["/api/v1/health", "/health"]);
const quietPrefixes = ["/api/v1/notifications/stream"];

function shouldSkip(url: string, status: number) {
  if (status >= 400) return false;
  const path = url.split("?")[0] ?? url;
  if (quietExact.has(path)) return true;
  return quietPrefixes.some((prefix) => path.startsWith(prefix));
}

export const logger = {
  info(message: string) {
    console.log(line("INFO", "cyan", message));
  },
  warn(message: string) {
    console.warn(line("WARN", "yellow", message));
  },
  error(message: string, error?: unknown) {
    const detail = errorText(error);
    console.error(line("ERROR", "red", detail ? `${message}  ${paint("redBright", detail)}` : message));
  },
};

export const requestLogger: RequestHandler = (request, response, next) => {
  const started = process.hrtime.bigint();
  response.on("finish", () => {
    const url = request.originalUrl || request.url;
    if (shouldSkip(url, response.statusCode)) return;

    const ms = Math.max(1, Math.round(Number(process.hrtime.bigint() - started) / 1e6));
    const status = response.statusCode;
    const method = request.method.padEnd(6);
    const path = (url.split("?")[0] ?? url).replace(/\/$/, "") || "/";
    const failure = status >= 400 ? errorText(response.locals.error) : "";
    const message = [
      paint(methodColor(request.method), method),
      path,
      paint(statusColor(status), String(status)),
      paint("gray", `${ms}ms`),
      failure ? paint("redBright", failure) : "",
    ]
      .filter(Boolean)
      .join("  ");

    if (status >= 500) console.error(line("HTTP", "red", message));
    else if (status >= 400) console.warn(line("HTTP", "yellow", message));
    else console.log(line("HTTP", "green", message));
  });
  next();
};
