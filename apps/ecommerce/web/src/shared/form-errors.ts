type ValidationIssue = {
  message: string;
  path: PropertyKey[];
};

export function fieldErrors(issues: ValidationIssue[]) {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "form");
    if (!result[field]) result[field] = issue.message;
  }
  return result;
}
