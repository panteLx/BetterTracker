import { NextResponse } from "next/server";
import { HttpError } from "@/lib/errors";

function isZodError(error: unknown): error is Error {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "ZodError"
  );
}

/**
 * Maps errors thrown by a service function to an HTTP response. Recognizes
 * `HttpError` subclasses (thrown deliberately for domain/validation failures)
 * and Zod validation errors as 4xx; anything else is an unexpected 500.
 */
export function mapServiceError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (isZodError(error)) {
    return badRequest(error.message);
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

export function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
