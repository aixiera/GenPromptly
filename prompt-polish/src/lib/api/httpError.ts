export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Bad request", details?: unknown, code = "BAD_REQUEST") {
    super(400, code, message, details);
    this.name = "BadRequestError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Resource not found", details?: unknown, code = "NOT_FOUND") {
    super(404, code, message, details);
    this.name = "NotFoundError";
  }
}

export class InternalError extends HttpError {
  constructor(message = "Internal server error", details?: unknown, code = "INTERNAL_ERROR") {
    super(500, code, message, details);
    this.name = "InternalError";
  }
}
