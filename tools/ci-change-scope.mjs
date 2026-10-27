import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function documentationOnly(paths) {
  return (
    paths.length > 0 &&
    paths.every((path) => /^assist\/documentation\/(?!.*(?:^|\/)\.)[^\n]+\.md$/u.test(path))
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let paths = [];
  try {
    if (!process.env.GITHUB_BASE_SHA) throw new Error("Missing base commit");
    paths = execFileSync(
      "git",
      ["diff", "--name-only", "--no-renames", "-z", `${process.env.GITHUB_BASE_SHA}...HEAD`],
      { encoding: "utf8" }
    )
      .split("\0")
      .filter(Boolean);
  } catch (error) {
    console.error(`Using full verification: ${error.message}`);
  }
  const fast = documentationOnly(paths);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `docs_only=${fast}\n`);
  console.log(fast ? "Documentation-only checks" : "Full repository checks");
}
