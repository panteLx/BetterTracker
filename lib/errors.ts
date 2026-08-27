export class HttpError extends Error {
  status: number;

  /**
   * Marker checked by `mapServiceError` instead of `instanceof`. The bundler
   * can emit this module into more than one chunk, and two copies of the class
   * are not the same constructor — a deliberate 4xx would then fall through to
   * a 500.
   */
  readonly isHttpError = true;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { isHttpError?: unknown }).isHttpError === true &&
    typeof (error as { status?: unknown }).status === "number"
  );
}

export class ValidationError extends HttpError {
  constructor(message: string) {
    super(message, 400);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(message, 409);
    this.name = "ConflictError";
  }
}
