import { NextResponse } from "next/server";
import { isHttpError } from "@/lib/errors";

type ZodIssue = { message?: unknown; path?: unknown };

function isZodError(error: unknown): error is Error & { issues?: ZodIssue[] } {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "ZodError"
  );
}

/**
 * `ZodError.message` is the serialized issue array, which is unreadable in the
 * toast the UI shows it in. Surface the first issue instead, prefixed with the
 * field it belongs to.
 */
function formatZodError(error: Error & { issues?: ZodIssue[] }) {
  const issue = error.issues?.[0];
  if (!issue || typeof issue.message !== "string") {
    return "Invalid request body";
  }

  const path = Array.isArray(issue.path)
    ? issue.path.filter((part) => typeof part === "string" || typeof part === "number").join(".")
    : "";

  return path ? `${path}: ${issue.message}` : issue.message;
}

/**
 * Maps errors thrown by a service function to an HTTP response. Recognizes
 * `HttpError` subclasses (thrown deliberately for domain/validation failures)
 * and Zod validation errors as 4xx; anything else is an unexpected 500.
 */
export function mapServiceError(error: unknown) {
  if (isHttpError(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (isZodError(error)) {
    return badRequest(formatZodError(error));
  }

  return serverError(error);
}

export async function parseRequestJson<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created(data: unknown) {
  return NextResponse.json(data, { status: 201 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

/**
 * Unexpected errors here are usually driver-level (SQLite constraint names,
 * table and column names), so the real error is logged server-side and the
 * client only ever sees a generic body. Deliberate domain failures should be
 * thrown as an `HttpError` and go through `mapServiceError` instead.
 */
export function serverError(error: unknown) {
  console.error("[api] unhandled error", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
