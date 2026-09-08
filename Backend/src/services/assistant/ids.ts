import { Types } from "mongoose";

const OBJECT_ID = /^[a-f0-9]{24}$/i;

export function asObjectId(value: string | undefined): Types.ObjectId | null {
  if (!value || !OBJECT_ID.test(value)) return null;
  return new Types.ObjectId(value);
}

export function idString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toString" in value) return String(value);
  return String(value);
}

export function isoDate(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
