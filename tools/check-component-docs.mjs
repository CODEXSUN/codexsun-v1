import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

export class ComponentDocumentationAudit {
  constructor(root) {
    this.root = root;
    this.failures = [];
    this.owners = new Set();
  }

  run() {
    for (const area of ["apps", "packages", "devkits", "addons"])
      for (const directory of this.children(area)) this.owners.add(directory);
    for (const directory of this.children("tools"))
      if (existsSync(join(directory, "package.json"))) this.owners.add(directory);
    this.requireExternalAddonGuides();
    for (const owner of this.owners) this.checkFile(owner, "README.md");
    return { owners: this.owners.size, failures: this.failures };
  }

  children(area) {
    const directory = join(this.root, area);
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => join(directory, entry.name));
  }

  requireExternalAddonGuides() {
    const lockPath = join(this.root, "package-lock.json");
    if (!existsSync(lockPath)) return;
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    for (const [path, metadata] of Object.entries(lock.packages ?? {})) {
      const match = /^node_modules\/@codexsun\/([a-z0-9-]+)$/u.exec(path);
      if (match && !metadata.link) this.owners.add(join(this.root, "addons", match[1]));
    }
  }

  checkFile(owner, file) {
    const path = join(owner, file);
    const label = relative(this.root, path).replaceAll("\\", "/");
    const directory = dirname(path);
    if (!existsSync(directory) || !readdirSync(directory).includes(basename(path))) {
      this.failures.push(`${label}: missing file or incorrect filename case`);
      return;
    }
    const body = readFileSync(path, "utf8").trim();
    if (!body.startsWith("# ")) this.failures.push(`${label}: add a Markdown heading`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const result = new ComponentDocumentationAudit(resolve(import.meta.dirname, "..")).run();
  if (result.failures.length) {
    console.error("Component documentation check failed:");
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else
    console.log(
      `Component documentation verified: ${result.owners} owners, README required for each.`
    );
}
