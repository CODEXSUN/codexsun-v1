export class RequestError extends Error {
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, input: { code?: string; details?: unknown } = {}) {
    super(message);
    this.name = "RequestError";
    if (input.code !== undefined) this.code = input.code;
    if (input.details !== undefined) this.details = input.details;
  }
}

export function requestFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof RequestError)) return {};
  const details = error.details;
  if (!details || typeof details !== "object" || !("issues" in details)) return {};
  const issues = (details as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return {};
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    if (!issue || typeof issue !== "object") continue;
    const path = (issue as { path?: unknown }).path;
    const message = (issue as { message?: unknown }).message;
    if (!Array.isArray(path) || typeof message !== "string") continue;
    const field = path.filter((part) => typeof part === "string").join(".");
    if (field && !errors[field]) errors[field] = message;
  }
  return errors;
}
