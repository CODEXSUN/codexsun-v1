import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { verifyBackup } from "./backup.mjs";
import { readJson } from "./files.mjs";

export async function recentBackup(base, state) {
  for (const name of (await readdir(base))
    .filter((name) => /^\d+-[a-f0-9]+$/u.test(name))
    .sort()
    .reverse()) {
    const directory = join(base, name, "before-build");
    try {
      if (Date.now() - (await stat(join(directory, "databases.sql"))).mtimeMs > 30 * 60_000)
        continue;
      const model = await readJson(join(directory, "previous.private.json"));
      if (!isDeepStrictEqual(model, state.model)) continue;
      const metadata = await readJson(join(directory, "containers.private.json"));
      if (
        ![state.database, state.redis].every((item) =>
          metadata.some(
            (previous) =>
              previous.Id === item.Id && previous.State.StartedAt === item.State.StartedAt
          )
        )
      )
        continue;
      await verifyBackup(directory);
      return directory;
    } catch {
      /* An incomplete or changed backup cannot be reused. */
    }
  }
  return null;
}
