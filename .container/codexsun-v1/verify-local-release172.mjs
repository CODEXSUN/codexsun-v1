import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { decryptBackupTo, verifyEncrypted } from "./lib/local-backup-crypto.mjs";

const pins = JSON.parse(
  await readFile(new URL("./lib/release172-pins.json", import.meta.url), "utf8")
);
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const need = (condition, message) => {
  if (!condition) throw new Error(message);
};
const json = (bytes) => JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));

export async function verifyLocalRelease172(proofPath, outputPath) {
  need(
    process.platform === "win32",
    "Use the authorized Windows backup profile for DPAPI verification"
  );
  const root = await realpath(dirname(resolve(proofPath)));
  const authorized = await realpath("D:/workspace/backups/26-10-2023");
  need(
    root.startsWith(authorized + "\\") && dirname(resolve(outputPath)) === root,
    "Keep verification beside the fresh proof under the authorized backup directory"
  );
  const proofBytes = await readFile(proofPath),
    proof = json(proofBytes);
  const scope = json(await readFile(within(root, proof.scopeFile)));
  validateIdentity(proof, scope);
  const protectedKey = await readFile(within(root, proof.keyFile));
  const key = unprotectKey(protectedKey);
  try {
    need(key.length === 32, "Unexpected encryption key length");
    const artifacts = [...proof.backups, proof.configuration, ...(proof.tenantStorage ?? [])];
    for (const artifact of artifacts) {
      fresh(artifact.completedAt);
      need(
        Date.parse(artifact.completedAt) >= Date.parse(proof.captureStartedAt) &&
          Date.parse(artifact.completedAt) <= Date.parse(proof.completedAt),
        "Artifact capture timing differs"
      );
      const file = within(root, artifact.path);
      need((await realpath(file)) === resolve(file), "Backup references cannot traverse links");
      need((await stat(file)).size === artifact.bytes, "Encrypted backup size differs");
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(file)) hash.update(chunk);
      need(hash.digest("hex") === artifact.sha256, "Encrypted backup checksum differs");
      need(artifact.encryption === "AES-256-GCM", "Unexpected encrypted backup format");
      let expected = null;
      if (proof.backups.includes(artifact)) {
        need(artifact.identity.role === "scoped-sql", "SQL backup role differs");
        expected = scope.tables
          .filter((row) => row.db === artifact.database && row.kind === "BASE TABLE")
          .map((row) => row.name);
        need(
          expected.length > 0 &&
            artifact.identity.database === artifact.database &&
            artifact.identity.tenantUuid === (artifact.uuid ?? null),
          "SQL identity or schema inventory differs"
        );
      } else if ((proof.tenantStorage ?? []).includes(artifact)) {
        need(artifact.identity.role === "scoped-storage", "Storage backup role differs");
        need(
          scope.tenants.some(
            (row) =>
              row.uuid === artifact.uuid &&
              row.db_name === artifact.identity.database &&
              row.tenant_code === artifact.code
          ),
          "Storage tenant identity differs"
        );
        need(
          JSON.stringify(artifact.allowedPrefixes) ===
            JSON.stringify([artifact.code.toLowerCase()]),
          "Storage archive prefix differs from its approved tenant"
        );
        expected = { archive: true };
      } else
        need(
          artifact === proof.configuration &&
            artifact.identity.role === "codexsun-application-configuration" &&
            artifact.identity.database === null &&
            artifact.identity.tenantUuid === null,
          "Unexpected configuration identity"
        );
      need(artifact.identity.runId === proof.runId, "Backup belongs to another run");
      const verified = await verifyEncrypted(file, key, artifact.identity, expected);
      need(
        verified.plaintextSha256 === artifact.integrity.plaintextSha256 &&
          verified.plaintextBytes === artifact.integrity.plaintextBytes,
        "Decrypted backup differs from captured proof"
      );
      if (expected?.archive) await verifyTar(file, key, artifact);
    }
    const result = {
      format: "codexsun-release172-local-verification-v1",
      source: pins.source,
      humanExceptionSha256: pins.humanExceptionSha256,
      proofSha256: createHash("sha256").update(proofBytes).digest("hex"),
      scopeSha256: pins.scopeSha256,
      backupScopeSha256: pins.backupScopeSha256,
      targetsSha256: pins.targetsSha256,
      verifiedAt: new Date().toISOString(),
      scopeCapturedAt: scope.capturedAt,
      captureStartedAt: proof.captureStartedAt,
      quiescedContainers: proof.quiescedContainers,
      integrityVerified: true,
      restorePerformed: false,
      artifacts: artifacts.map((row) => [row.sha256, row.bytes, row.identity])
    };
    const bytes = Buffer.from(JSON.stringify(result, null, 2) + "\n");
    await writeFile(outputPath, bytes, { flag: "wx", mode: 0o600 });
    return {
      sha256: createHash("sha256").update(bytes).digest("hex"),
      verifiedArtifacts: artifacts.length,
      restorePerformed: false
    };
  } finally {
    key.fill(0);
  }
}

function validateIdentity(proof, scope) {
  need(
    proof.format === "codexsun-local-backup-proof-v1" && proof.quiesced === true,
    "Fresh final backup proof must bind gracefully quiesced writers"
  );
  const normalized = [
    scope.master,
    scope.tenants
      .map((row) => [
        row.id,
        row.uuid,
        row.tenant_code,
        row.db_name,
        row.db_host,
        row.db_port,
        row.storage_root ?? null,
        row.storage_private_root ?? null,
        row.storage_public_root ?? null
      ])
      .sort((a, b) => (a[1] < b[1] ? -1 : 1))
  ];
  need(
    digest(normalized) === pins.scopeSha256 &&
      scope.activeTenantCount === 13 &&
      scope.cxappDatabasesExcluded === true &&
      scope.mariaDbContainerLifecycleUnchanged === true,
    "Approved registry scope differs"
  );
  const rows = proof.backups
    .map((row) => ({
      database: row.database,
      uuid: row.uuid ?? null,
      code: row.code,
      master: row.master === true
    }))
    .sort((a, b) => (a.database < b.database ? -1 : 1));
  need(
    rows.length === 14 &&
      new Set(rows.map((row) => row.database)).size === 14 &&
      digest(rows) === pins.backupScopeSha256 &&
      digest(["master", ...rows.filter((row) => !row.master).map((row) => row.database)].sort()) ===
        pins.targetsSha256,
    "Expected the exact approved master plus 13 tenant identities"
  );
  for (const field of [
    "restoreRehearsalVerified",
    "completeRecovery",
    "crossDatabaseAtomicityVerified",
    "filesCoverageVerified"
  ])
    need(proof[field] === false, "Preserve actual false recovery proof values");
  need(
    proof.cxappDatabasesExcluded === true && proof.mariaDbContainerLifecycleChanges === false,
    "Protected resource proof differs"
  );
  fresh(proof.completedAt);
  fresh(proof.captureStartedAt);
  fresh(scope.capturedAt);
  need(
    Date.parse(proof.captureStartedAt) <= Date.parse(proof.completedAt),
    "Capture timing differs"
  );
  need(
    JSON.stringify(Object.keys(proof.quiescedContainers ?? {}).sort()) ===
      JSON.stringify(["codexsun-api", "codexsun-shop", "codexsun-web"]),
    "Expected the exact previous application writer set"
  );
  for (const state of Object.values(proof.quiescedContainers))
    need(
      typeof state.id === "string" &&
        state.id.length > 0 &&
        Date.parse(proof.captureStartedAt) >= Date.parse(state.finishedAt),
      "Backup capture preceded writer shutdown"
    );
}

function fresh(value) {
  need(
    typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(value),
    "Backup timestamps require a timezone"
  );
  const age = Date.now() - Date.parse(value);
  need(age >= 0 && age <= 3600000, "Backup or registry evidence is stale or future-dated");
}

function within(root, file) {
  need(typeof file === "string", "Missing backup reference");
  const result = resolve(isAbsolute(file) ? file : join(root, file));
  need(result.startsWith(root + "\\"), "Backup reference exceeds its run directory");
  return result;
}

function unprotectKey(bytes) {
  const command =
    "Add-Type -AssemblyName System.Security; $protected=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $plain=[Security.Cryptography.ProtectedData]::Unprotect($protected,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($plain))";
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { input: bytes.toString("base64"), encoding: "utf8", windowsHide: true }
  );
  need(result.status === 0, "DPAPI key retrieval failed");
  return Buffer.from(result.stdout.trim(), "base64");
}

async function verifyTar(file, key, artifact) {
  const child = spawn(
    "python",
    [
      "-B",
      fileURLToPath(new URL("./lib/verify-local-tar.py", import.meta.url)),
      JSON.stringify(artifact.allowedPrefixes)
    ],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }
  );
  child.stdout.resume();
  child.stderr.resume();
  const closed = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error("Tenant archive scope verification failed"))
    );
  });
  await Promise.all([decryptBackupTo(file, key, artifact.identity, child.stdin), closed]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    need(
      process.argv.length === 4,
      "Usage: node verify-local-release172.mjs PROOF_JSON NEW_OUTPUT_JSON"
    );
    console.log(JSON.stringify(await verifyLocalRelease172(process.argv[2], process.argv[3])));
  } catch {
    console.error("Local encrypted backup verification failed; no restore was performed");
    process.exitCode = 1;
  }
}
