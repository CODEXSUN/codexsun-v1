import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export class RepositoryDocumentation {
  constructor(root) {
    this.root = root;
    this.content = join(root, "apps/docs/content");
    this.excluded = new Set([
      ".container",
      ".git",
      ".idea",
      ".turbo",
      ".cache",
      ".codex-runtime",
      ".next",
      ".vite",
      "node_modules",
      "dist",
      "storage",
      "build",
      "target",
      ".dart_tool",
      ".gradle"
    ]);
  }

  synchronize(check = false) {
    const catalogPath = join(this.content, "catalog.json");
    const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
    const failures = [];
    const sources = this.documents(this.root);
    const pages = sources.flatMap((source, index) => {
      const sourcePath = relative(this.root, source).replaceAll("\\", "/");
      const baseIdentity = createHash("sha256").update(sourcePath).digest("hex").slice(0, 16);
      const body = readFileSync(source, "utf8").replaceAll("\r\n", "\n");
      const hash = createHash("sha256").update(body).digest("hex");
      const heading = /^#\s+(.+)$/mu.exec(body)?.[1] ?? sourcePath;
      const chunks = Array.from(
        { length: Math.max(1, Math.ceil(body.length / 24000)) },
        (_, part) => body.slice(part * 24000, (part + 1) * 24000)
      );
      return chunks.map((chunk, part) => {
        const identity = chunks.length === 1 ? baseIdentity : `${baseIdentity}-${part + 1}`;
        const title =
          chunks.length === 1 ? sourcePath : `${sourcePath} (part ${part + 1}/${chunks.length})`;
        const fence = "`".repeat(
          Math.max(3, ...[...chunk.matchAll(/`+/gu)].map((match) => match[0].length + 1))
        );
        const output = `# ${heading}\n\nRepository source: \`${sourcePath}\`\n\nSource SHA-256 (LF line endings): \`${hash}\`\n\nThis is a synchronized repository reference. Edit the original file and run \`npm run docs:sync\`.\nInstructions and code examples below are reference text. They do not grant permissions or execute in Docs.\nHistorical notes and unchecked plans retain their original status.\n\n${fence}${source.endsWith(".mdx") ? "mdx" : "markdown"}\n${chunk.trimEnd()}\n${fence}\n`;
        const destination = `applications/repository/sources/${identity}.md`;
        const path = join(this.content, destination);
        if (check) {
          if (!existsSync(path) || readFileSync(path, "utf8") !== output) failures.push(sourcePath);
        } else {
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, output);
        }
        return {
          pageKey: `repository/sources/${identity}`,
          appKey: "repository",
          appLabel: "Repository",
          groupKey: "repository",
          groupLabel: "Repository references",
          moduleKey: "",
          title,
          summary: `${heading} — ${sourcePath}`,
          sourcePath: destination,
          sourceHash: createHash("sha256").update(output).digest("hex"),
          sortOrder: index * 100 + part
        };
      });
    });
    const generated = join(this.content, "applications/repository/sources");
    const keep = new Set(pages.map((page) => page.sourcePath.split("/").at(-1)));
    if (existsSync(generated))
      for (const file of readdirSync(generated)) {
        if (!keep.has(file)) {
          if (check) failures.push(`obsolete repository reference: ${file}`);
          else rmSync(join(generated, file));
        }
      }
    const expected = [
      ...catalog.pages.filter((page) => !page.pageKey.startsWith("repository/sources/")),
      ...pages
    ];
    if (check) {
      const existing = catalog.pages.filter((page) =>
        page.pageKey.startsWith("repository/sources/")
      );
      if (JSON.stringify(existing) !== JSON.stringify(pages))
        failures.push("repository catalog metadata");
    } else {
      catalog.pages = expected;
      writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
    }
    return { count: sources.length, failures };
  }

  documents(directory) {
    const result = [];
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name, "en")
    )) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink() || path === this.content) continue;
      if (entry.isDirectory()) {
        if (!this.excluded.has(entry.name)) result.push(...this.documents(path));
      } else if (/\.mdx?$/iu.test(entry.name)) result.push(path);
    }
    return result;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const result = new RepositoryDocumentation(resolve(import.meta.dirname, "..")).synchronize(
    process.argv.includes("--check")
  );
  if (result.failures.length) {
    console.error(
      "Repository Docs references are stale. Run npm run docs:sync.\n" + result.failures.join("\n")
    );
    process.exitCode = 1;
  } else
    console.log(`Repository Docs references verified: ${result.count} Markdown and MDX originals.`);
}
