import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Compile TypeScript if needed before importing
const distPath = resolve(process.cwd(), "dist/devkits/codeit/api");
if (!existsSync(join(distPath, "modules/workspace/workspace.patch.js"))) {
  execSync("npx tsc -p devkits/codeit/api/tsconfig.json", { stdio: "inherit" });
}

const { WorkspacePatcher, PatchConflictError, computeUnifiedDiff, applyUnifiedDiff } = await import(
  pathToFileURL(join(distPath, "modules/workspace/workspace.patch.js")).href
);

const { ApplyPatchInputSchema, PatchResultSchema } = await import(
  pathToFileURL(join(distPath, "modules/workspace/workspace.patch.types.js")).href
);

const { PathDeniedError, InvalidStateError } = await import(
  pathToFileURL(join(distPath, "errors.js")).href
);

describe("T06: Safe Patches, Conflict Detection, and Diff Artifacts", () => {
  const testBaseDir = join(tmpdir(), `codeit-patch-test-${Date.now()}`);
  const projectRoot = join(testBaseDir, "fixture-project");
  const outsideDir = join(testBaseDir, "outside-project");

  let patcher = null;
  const createdArtifacts = [];

  const mockArtifactCallback = (input) => {
    const hash = createHash("sha256").update(input.content).digest("hex");
    const uuid = hash.slice(0, 8);
    const record = {
      uuid,
      run_uuid: input.run_uuid,
      artifact_type: input.artifact_type,
      content_hash: hash,
      content: input.content,
      media_type: input.media_type,
      provenance: input.provenance
    };
    createdArtifacts.push(record);
    return record;
  };

  before(() => {
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(outsideDir, { recursive: true });

    // Seed fixture project files
    writeFileSync(join(projectRoot, "sample.txt"), "line 1\nline 2 original\nline 3\n", "utf8");
    writeFileSync(
      join(projectRoot, "multi.txt"),
      "alpha\nbeta\ngamma\ndelta\nepsilon\nzeta\neta\ntheta\n",
      "utf8"
    );
    writeFileSync(join(outsideDir, "escaped.txt"), "sensitive external data", "utf8");

    patcher = new WorkspacePatcher({
      artifactCallback: mockArtifactCallback
    });
  });

  after(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe("1. Contract Schemas (CONTRACTS.md frozen)", () => {
    test("validates valid ApplyPatchInputSchema payload", () => {
      const valid = {
        run_uuid: "11223344",
        path: "src/index.ts",
        expected_hash: "a".repeat(64),
        patch: "new file content",
        expected_generation: 0
      };
      const parsed = ApplyPatchInputSchema.parse(valid);
      assert.equal(parsed.path, "src/index.ts");
    });

    test("rejects invalid hash format in ApplyPatchInputSchema", () => {
      const invalid = {
        run_uuid: "11223344",
        path: "src/index.ts",
        expected_hash: "too-short-hash",
        patch: "content"
      };
      assert.throws(() => ApplyPatchInputSchema.parse(invalid));
    });

    test("validates PatchResultSchema structure", () => {
      const result = {
        applied: true,
        new_hash: "b".repeat(64),
        path: "sample.txt",
        lines_added: 3,
        lines_deleted: 1,
        diff_artifact_uuid: "99887766"
      };
      const parsed = PatchResultSchema.parse(result);
      assert.equal(parsed.applied, true);
      assert.equal(parsed.new_hash, "b".repeat(64));
    });
  });

  describe("2. Canonical Workspace Root & Path Boundary (E03)", () => {
    test("rejects path traversal escape attempts (.. / ../escaped.txt)", () => {
      assert.throws(
        () => {
          patcher.applyPatch(projectRoot, {
            run_uuid: "11223344",
            path: "../outside-project/escaped.txt",
            expected_hash: "c".repeat(64),
            patch: "replacement"
          });
        },
        (err) => {
          assert.equal(err instanceof PathDeniedError, true);
          assert.equal(err.code, "CODEIT_PATH_DENIED");
          assert.match(err.message, /escapes canonical workspace root/);
          return true;
        }
      );
    });

    test("rejects absolute path pointing outside project root", () => {
      assert.throws(
        () => {
          patcher.applyPatch(projectRoot, {
            run_uuid: "11223344",
            path: join(outsideDir, "escaped.txt"),
            expected_hash: "d".repeat(64),
            patch: "replacement"
          });
        },
        (err) => {
          assert.equal(err instanceof PathDeniedError, true);
          assert.equal(err.code, "CODEIT_PATH_DENIED");
          return true;
        }
      );
    });

    test("rejects null byte injection", () => {
      assert.throws(
        () => {
          patcher.applyPatch(projectRoot, {
            run_uuid: "11223344",
            path: "sample.txt\0.js",
            expected_hash: "e".repeat(64),
            patch: "replacement"
          });
        },
        (err) => {
          assert.equal(err instanceof PathDeniedError, true);
          assert.match(err.message, /Null byte/);
          return true;
        }
      );
    });

    test("rejects symlink escaping canonical root", () => {
      const symlinkTarget = join(projectRoot, "symlink-escape.txt");
      try {
        symlinkSync(join(outsideDir, "escaped.txt"), symlinkTarget);
      } catch {
        // On systems without symlink creation rights, skip symlink creation
        return;
      }

      assert.throws(
        () => {
          patcher.applyPatch(projectRoot, {
            run_uuid: "11223344",
            path: "symlink-escape.txt",
            expected_hash: "f".repeat(64),
            patch: "replacement"
          });
        },
        (err) => {
          assert.equal(err instanceof PathDeniedError, true);
          assert.equal(err.code, "CODEIT_PATH_DENIED");
          return true;
        }
      );
    });
  });

  describe("3. Secret Canary Exclusion (E21)", () => {
    test("unconditionally rejects writes to .env file with CODEIT_PATH_DENIED", () => {
      assert.throws(
        () => {
          patcher.applyPatch(projectRoot, {
            run_uuid: "11223344",
            path: ".env",
            expected_hash: "0".repeat(64),
            patch: "SECRET=value"
          });
        },
        (err) => {
          assert.equal(err instanceof PathDeniedError, true);
          assert.equal(err.code, "CODEIT_PATH_DENIED");
          assert.match(err.message, /Access to secret or protected file denied/);
          return true;
        }
      );
    });

    test("unconditionally rejects writes to .env.production and nested .env", () => {
      assert.throws(
        () => {
          patcher.applyPatch(projectRoot, {
            run_uuid: "11223344",
            path: "config/.env.local",
            expected_hash: "0".repeat(64),
            patch: "KEY=123"
          });
        },
        (err) => {
          assert.equal(err instanceof PathDeniedError, true);
          assert.equal(err.code, "CODEIT_PATH_DENIED");
          return true;
        }
      );
    });

    test("unconditionally rejects writes to key / pem / crt files", () => {
      const deniedFiles = ["server.key", "cert.pem", "bundle.crt", "tls.pfx"];
      for (const file of deniedFiles) {
        assert.throws(
          () => {
            patcher.applyPatch(projectRoot, {
              run_uuid: "11223344",
              path: file,
              expected_hash: "0".repeat(64),
              patch: "CANARY_KEY_PAYLOAD"
            });
          },
          (err) => {
            assert.equal(err instanceof PathDeniedError, true);
            assert.equal(err.code, "CODEIT_PATH_DENIED");
            return true;
          }
        );
      }
    });

    test("unconditionally rejects writes to id_rsa / id_ed25519 files", () => {
      assert.throws(
        () => {
          patcher.applyPatch(projectRoot, {
            run_uuid: "11223344",
            path: "id_rsa",
            expected_hash: "0".repeat(64),
            patch: "SSH_PRIVATE_KEY"
          });
        },
        (err) => {
          assert.equal(err instanceof PathDeniedError, true);
          assert.equal(err.code, "CODEIT_PATH_DENIED");
          return true;
        }
      );
    });
  });

  describe("4. Exact Patch Application & Atomic Writes (E08)", () => {
    test("successfully applies exact patch with matching expected_hash", () => {
      const filePath = "sample.txt";
      const fullPath = join(projectRoot, filePath);
      const initialContent = readFileSync(fullPath, "utf8");
      const initialHash = createHash("sha256")
        .update(Buffer.from(initialContent, "utf8"))
        .digest("hex");

      const newContent = "line 1\nline 2 patched successfully\nline 3\nline 4 added\n";
      const expectedNewHash = createHash("sha256")
        .update(Buffer.from(newContent, "utf8"))
        .digest("hex");

      const result = patcher.applyPatch(projectRoot, {
        run_uuid: "00000001",
        path: filePath,
        expected_hash: initialHash,
        patch: newContent
      });

      assert.equal(result.applied, true);
      assert.equal(result.new_hash, expectedNewHash);
      assert.equal(result.previous_hash, initialHash);
      assert.equal(result.lines_added, 2);
      assert.equal(result.lines_deleted, 1);
      assert.ok(result.diff_artifact_uuid);

      // Verify file on disk matches new content and hash
      const onDisk = readFileSync(fullPath, "utf8");
      assert.equal(onDisk, newContent);
      const onDiskHash = createHash("sha256").update(Buffer.from(onDisk, "utf8")).digest("hex");
      assert.equal(onDiskHash, expectedNewHash);
    });

    test("stale / mismatched expected_hash rejects application with 409 CODEIT_INVALID_STATE (E08)", () => {
      const filePath = "sample.txt";
      const fullPath = join(projectRoot, filePath);
      const contentBefore = readFileSync(fullPath, "utf8");
      const wrongHash = "0".repeat(64);

      assert.throws(
        () => {
          patcher.applyPatch(projectRoot, {
            run_uuid: "00000001",
            path: filePath,
            expected_hash: wrongHash,
            patch: "malicious unexpected overwrite"
          });
        },
        (err) => {
          assert.equal(err instanceof PatchConflictError, true);
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, "CODEIT_INVALID_STATE");
          assert.match(err.message, /hash mismatch/i);
          return true;
        }
      );

      // Verify original file on disk is untouched
      const contentAfter = readFileSync(fullPath, "utf8");
      assert.equal(contentAfter, contentBefore);
    });

    test("rejects patch on non-existent target file with 409 conflict", () => {
      assert.throws(
        () => {
          patcher.applyPatch(projectRoot, {
            run_uuid: "00000001",
            path: "non-existent-file.txt",
            expected_hash: "a".repeat(64),
            patch: "content"
          });
        },
        (err) => {
          assert.equal(err instanceof PatchConflictError, true);
          assert.equal(err.statusCode, 409);
          assert.match(err.message, /does not exist/);
          return true;
        }
      );
    });
  });

  describe("5. Unified Diff Parsing, Application, and Hunk Matching (E22)", () => {
    test("computes unified diff with standard headers and hunks", () => {
      const oldStr = "alpha\nbeta\ngamma\n";
      const newStr = "alpha\nbeta modified\ngamma\ndelta\n";
      const diff = computeUnifiedDiff(oldStr, newStr, "test.txt");

      assert.equal(diff.path, "test.txt");
      assert.equal(diff.lines_added, 2);
      assert.equal(diff.lines_deleted, 1);
      assert.match(diff.unified_diff, /--- a\/test\.txt/);
      assert.match(diff.unified_diff, /\+\+\+ b\/test\.txt/);
      assert.match(diff.unified_diff, /@@ -1,3 \+1,4 @@/);
      assert.match(diff.unified_diff, /-beta/);
      assert.match(diff.unified_diff, /\+beta modified/);
      assert.match(diff.unified_diff, /\+delta/);
    });

    test("applies unified diff string to original file content", () => {
      const original = "one\ntwo\nthree\nfour\nfive\n";
      const diffText = `--- a/file.txt
+++ b/file.txt
@@ -2,3 +2,4 @@
 two
-three
+THREE MODIFIED
+THREE POINT FIVE
 four
`;
      const applied = applyUnifiedDiff(original, diffText);
      assert.equal(applied, "one\ntwo\nTHREE MODIFIED\nTHREE POINT FIVE\nfour\nfive\n");
    });

    test("applies patch to file using unified diff hunk payload", () => {
      const filePath = "multi.txt";
      const fullPath = join(projectRoot, filePath);
      const currentContent = readFileSync(fullPath, "utf8");
      const currentHash = createHash("sha256")
        .update(Buffer.from(currentContent, "utf8"))
        .digest("hex");

      const diffPatch = `--- a/multi.txt
+++ b/multi.txt
@@ -2,4 +2,5 @@
 beta
-gamma
+GAMMA MODIFIED
 delta
+delta extra
 epsilon
`;

      const result = patcher.applyPatch(projectRoot, {
        run_uuid: "00000002",
        path: filePath,
        expected_hash: currentHash,
        patch: diffPatch
      });

      assert.equal(result.applied, true);
      assert.equal(result.lines_added, 2);
      assert.equal(result.lines_deleted, 1);

      const updatedOnDisk = readFileSync(fullPath, "utf8");
      assert.match(updatedOnDisk, /GAMMA MODIFIED/);
      assert.match(updatedOnDisk, /delta extra/);
    });

    test("fails with 409 conflict when unified diff hunk context does not match (E08)", () => {
      const original = "first\nsecond\nthird\n";
      const staleDiff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 first
-WRONG_CONTEXT_LINE
+new line
 third
`;

      assert.throws(
        () => {
          applyUnifiedDiff(original, staleDiff);
        },
        (err) => {
          assert.equal(err instanceof PatchConflictError, true);
          assert.equal(err.statusCode, 409);
          assert.match(err.message, /Context mismatch|Deletion mismatch/);
          return true;
        }
      );
    });
  });

  describe("6. Generation Fencing & Process Cancellation (E10)", () => {
    test("rejects patch write when run is in cancelling or cancelled state", () => {
      const filePath = "multi.txt";
      const fullPath = join(projectRoot, filePath);
      const currentContent = readFileSync(fullPath, "utf8");
      const currentHash = createHash("sha256")
        .update(Buffer.from(currentContent, "utf8"))
        .digest("hex");

      const cancelledRunLookup = (_runUuid) => ({
        state: "cancelled",
        cancellation_generation: 1
      });

      assert.throws(
        () => {
          patcher.applyPatch(
            projectRoot,
            {
              run_uuid: "c0010001",
              path: filePath,
              expected_hash: currentHash,
              patch: "late patch write"
            },
            { runLookup: cancelledRunLookup }
          );
        },
        (err) => {
          assert.equal(err instanceof InvalidStateError, true);
          assert.equal(err.statusCode, 409);
          assert.match(err.message, /run c0010001 is cancelled/);
          return true;
        }
      );

      // Verify file content was not mutated
      const contentAfter = readFileSync(fullPath, "utf8");
      assert.equal(contentAfter, currentContent);
    });

    test("rejects patch write when run cancellation_generation has advanced past expected (E10)", () => {
      const filePath = "multi.txt";
      const fullPath = join(projectRoot, filePath);
      const currentContent = readFileSync(fullPath, "utf8");
      const currentHash = createHash("sha256")
        .update(Buffer.from(currentContent, "utf8"))
        .digest("hex");

      const advancedRunLookup = (_runUuid) => ({
        state: "running",
        cancellation_generation: 3 // Current is 3, but worker expected 1
      });

      assert.throws(
        () => {
          patcher.applyPatch(
            projectRoot,
            {
              run_uuid: "c0010002",
              path: filePath,
              expected_hash: currentHash,
              patch: "stale generation write",
              expected_generation: 1
            },
            { runLookup: advancedRunLookup }
          );
        },
        (err) => {
          assert.equal(err instanceof InvalidStateError, true);
          assert.equal(err.statusCode, 409);
          assert.match(err.message, /cancellation generation has advanced/);
          return true;
        }
      );
    });
  });

  describe("7. Revert / Recovery Support (E23)", () => {
    test("rolls back patched file to original state and restores original hash", () => {
      const filePath = "rollback-test.txt";
      const fullPath = join(projectRoot, filePath);
      const originalText = "Initial immutable baseline content\nVersion 1.0\n";
      writeFileSync(fullPath, originalText, "utf8");

      const originalHash = createHash("sha256")
        .update(Buffer.from(originalText, "utf8"))
        .digest("hex");

      // Apply first patch
      const patch1 = "Updated content\nVersion 2.0\n";
      const res1 = patcher.applyPatch(projectRoot, {
        run_uuid: "00000003",
        path: filePath,
        expected_hash: originalHash,
        patch: patch1
      });
      assert.equal(res1.applied, true);
      assert.equal(readFileSync(fullPath, "utf8"), patch1);

      // Rollback to original baseline
      const rollRes = patcher.rollback(projectRoot, filePath, originalText);
      assert.equal(rollRes.applied, true);
      assert.equal(rollRes.new_hash, originalHash);

      // Verify disk content restored
      assert.equal(readFileSync(fullPath, "utf8"), originalText);
    });
  });

  describe("8. Artifact Evidence Generation (E22)", () => {
    test("creates diff artifact with provenance metadata upon successful patch", () => {
      const filePath = "artifact-test.txt";
      const fullPath = join(projectRoot, filePath);
      const beforeText = "A\nB\nC\n";
      writeFileSync(fullPath, beforeText, "utf8");
      const beforeHash = createHash("sha256").update(Buffer.from(beforeText, "utf8")).digest("hex");

      const afterText = "A\nB MODIFIED\nC\nD ADDED\n";
      const res = patcher.applyPatch(projectRoot, {
        run_uuid: "a0000001",
        path: filePath,
        expected_hash: beforeHash,
        patch: afterText
      });

      assert.ok(res.diff_artifact_uuid);

      const foundArtifact = createdArtifacts.find((a) => a.uuid === res.diff_artifact_uuid);
      assert.ok(foundArtifact);
      assert.equal(foundArtifact.artifact_type, "diff");
      assert.equal(foundArtifact.media_type, "text/x-diff");
      assert.equal(foundArtifact.run_uuid, "a0000001");
      assert.equal(foundArtifact.provenance.creator, "WorkspacePatcher");
      assert.equal(foundArtifact.provenance.path, filePath);
      assert.equal(foundArtifact.provenance.lines_added, 2);
      assert.equal(foundArtifact.provenance.lines_deleted, 1);
    });
  });
});
