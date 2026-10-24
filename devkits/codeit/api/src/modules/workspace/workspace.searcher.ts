import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ValidationError } from "../../errors.js";
import { WorkspaceReader, isSecretOrProtected } from "./workspace.reader.js";
import type {
  WorkspaceSearchMatch,
  WorkspaceSearchOptions,
  WorkspaceSearchResult
} from "./workspace.types.js";

const DEFAULT_MAX_SEARCH_RESULTS = 100;
const DEFAULT_MAX_FILE_SIZE = 1024 * 1024; // 1MB

function isLikelyBinary(buffer: Buffer): boolean {
  // Check first 512 bytes for null bytes or control characters
  const len = Math.min(buffer.length, 512);
  for (let i = 0; i < len; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}

export class WorkspaceSearcher {
  constructor(private readonly reader: WorkspaceReader = new WorkspaceReader()) {}

  /**
   * Performs a bounded text search across files in the canonical workspace root.
   */
  public search(
    rootPath: string,
    query: string,
    options: WorkspaceSearchOptions = {}
  ): WorkspaceSearchResult {
    if (!query || typeof query !== "string") {
      throw new ValidationError("Search query must be a non-empty string");
    }

    const canonicalRoot = this.reader.getCanonicalRoot(rootPath);
    const maxResults = options.maxResults ?? DEFAULT_MAX_SEARCH_RESULTS;
    const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    const caseSensitive = options.caseSensitive ?? false;

    const matches: WorkspaceSearchMatch[] = [];
    let truncated = false;

    const traverse = (currentDir: string) => {
      if (matches.length >= maxResults) {
        truncated = true;
        return;
      }

      let dirents;
      try {
        dirents = readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const dirent of dirents) {
        if (matches.length >= maxResults) {
          truncated = true;
          break;
        }

        const name = dirent.name;
        // Skip ignored directories
        if (
          name === ".git" ||
          name === "node_modules" ||
          name === ".codeit" ||
          name === "dist" ||
          name === "build" ||
          name === ".cache"
        ) {
          continue;
        }

        const fullPath = join(currentDir, name);
        const relPath = relative(canonicalRoot, fullPath).replace(/\\/g, "/");

        // Filter out secrets and protected files
        if (isSecretOrProtected(relPath)) {
          continue;
        }

        if (dirent.isDirectory()) {
          traverse(fullPath);
        } else if (dirent.isFile()) {
          let stat;
          try {
            stat = statSync(fullPath);
          } catch {
            continue;
          }

          // Skip large files
          if (stat.size > maxFileSize || stat.size === 0) {
            continue;
          }

          let buf: Buffer;
          try {
            buf = readFileSync(fullPath);
          } catch {
            continue;
          }

          // Skip binary files
          if (isLikelyBinary(buf)) {
            continue;
          }

          const content = buf.toString("utf8");
          const lines = content.split(/\r?\n/);

          for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const lineText = lines[lineIdx]!;
            const matchIndex = caseSensitive
              ? lineText.indexOf(query)
              : lineText.toLowerCase().indexOf(query.toLowerCase());

            if (matchIndex !== -1) {
              matches.push({
                path: relPath,
                line: lineIdx + 1,
                column: matchIndex + 1,
                text: lineText.length > 300 ? lineText.slice(0, 300) + "..." : lineText
              });

              if (matches.length >= maxResults) {
                truncated = true;
                break;
              }
            }
          }
        }
      }
    };

    traverse(canonicalRoot);

    return {
      query,
      matches,
      totalMatches: matches.length,
      truncated
    };
  }
}
