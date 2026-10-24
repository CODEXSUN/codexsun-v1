export interface CodeitErrorPayload {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown> | undefined;
}

export interface ApiResponseEnvelope<T = unknown> {
  success: boolean;
  data: T | null;
  error: CodeitErrorPayload | null;
  correlation_id: string;
}

export class CodeitError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    retryable = false,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "CodeitError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.details = details;
  }

  toPayload(): CodeitErrorPayload {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      details: this.details
    };
  }
}

export class UnauthorizedError extends CodeitError {
  constructor(
    message = "Missing or invalid pairing token / session cookie",
    details: Record<string, unknown> = {}
  ) {
    super("CODEIT_UNAUTHORIZED", message, 401, false, details);
  }
}

export class HostForbiddenError extends CodeitError {
  constructor(
    message = "Host rebinding or non-loopback host rejected",
    details: Record<string, unknown> = {}
  ) {
    super("CODEIT_HOST_FORBIDDEN", message, 403, false, details);
  }
}

export class CsrfMismatchError extends CodeitError {
  constructor(message = "CSRF token missing or mismatch", details: Record<string, unknown> = {}) {
    super("CODEIT_CSRF_MISMATCH", message, 403, false, details);
  }
}

export class NotFoundError extends CodeitError {
  constructor(
    message = "Referenced record UUID does not exist",
    details: Record<string, unknown> = {}
  ) {
    super("CODEIT_NOT_FOUND", message, 404, false, details);
  }
}

export class PathDeniedError extends CodeitError {
  constructor(
    message = "Path escapes canonical workspace root or matches protected patterns",
    details: Record<string, unknown> = {}
  ) {
    super("CODEIT_PATH_DENIED", message, 400, false, details);
  }
}

export class InvalidStateError extends CodeitError {
  constructor(
    message = "Requested action is invalid for current state",
    statusCode = 409,
    details: Record<string, unknown> = {}
  ) {
    super("CODEIT_INVALID_STATE", message, statusCode, false, details);
  }
}

export class ValidationError extends CodeitError {
  constructor(message = "Invalid input payload", details: Record<string, unknown> = {}) {
    super("CODEIT_VALIDATION_ERROR", message, 400, false, details);
  }
}
