export function isolatedEvidenceRequested(command: string, nodeEnv: string, args: string[]) {
  if (args.length > 1 || (args.length === 1 && args[0] !== "--isolated-evidence"))
    throw new Error("Unsupported database CLI argument.");
  if (args.length === 0) return false;
  if (
    nodeEnv !== "production" ||
    !["migrations:preflight", "migrations:run", "seed"].includes(command)
  )
    throw new Error(
      "Isolated evidence is only supported for production preflight, migration, or seed commands."
    );
  return true;
}
