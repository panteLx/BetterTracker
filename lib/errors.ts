export class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
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
