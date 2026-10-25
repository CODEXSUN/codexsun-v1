import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { applications } from "./config.mjs";
import { readJson } from "./files.mjs";

export async function currentRelease(base, model, checksum) {
  const candidates = (await readdir(base))
    .filter((name) => /^\d+-[a-f0-9]+$/u.test(name))
    .sort()
    .reverse();
  for (const name of candidates) {
    try {
      const directory = join(base, name);
      const result = await readJson(join(directory, "result.json"));
      if (!result.success || result.sourceChecksum !== checksum) continue;
      const previous = await readJson(join(directory, "candidate.private.json"));
      if (
        applications.every(
          (application) =>
            previous.services[application].image === model.services[application].image
        )
      )
        return directory;
    } catch {
      /* Failed or incomplete runs are never reused. */
    }
  }
  return null;
}
