import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { capture, configurationName, inspectDeployment } from "./config.mjs";
import { LocalDocker } from "./docker.mjs";
import { privateWrite, readJson, withLock } from "./files.mjs";
import { release } from "./release.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const [mode, ...options] = process.argv.slice(2);
try {
  assert.ok(["deploy", "update"].includes(mode), "Choose deploy or update.");
  assert.ok(
    options.length <= 1 &&
      options.every((item) => ["--check", "--configure", "--help", "-h"].includes(item)),
    "Use one of --check, --configure, or --help."
  );
  if (options.includes("--help") || options.includes("-h")) {
    console.log(
      `Usage: bash ${mode}-local.sh [--check | --configure]\nLocal Docker Desktop only. Build the current working tree and preserve local MariaDB and Redis.\n--configure captures the existing five-app local configuration without changing containers.\n--check validates configuration and ownership without writing, building, or replacing containers.\nDeploy requires no app containers. Update requires all five healthy app containers.\nNo Git pull, version bump, database reset, image pruning, or VPS operations.`
    );
  } else {
    process.chdir(root);
    const docker = new LocalDocker();
    docker.checkTarget();
    const interrupt = () => {
      console.error(
        docker.recovering
          ? "Recovery is in progress. Wait for it to finish."
          : "Interrupt requested. Cancelling the local operation safely."
      );
      docker.interrupt();
    };
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", interrupt);
    try {
      const path = resolve(root, configurationName);
      if (options.includes("--check")) {
        const config = existsSync(path) ? await readJson(path) : capture(docker, root);
        inspectDeployment(docker, config, mode);
        console.log(`Local ${mode} preflight passed. No files or containers changed.`);
      } else
        await withLock(root, async (base) => {
          const saved = existsSync(path);
          assert.ok(
            !options.includes("--configure") || !saved,
            "Local configuration already exists. Review and back it up before changing it."
          );
          const config = saved ? await readJson(path) : capture(docker, root);
          // Configuration capture validates the running stack, even before a future fresh deployment.
          inspectDeployment(docker, config, options.includes("--configure") ? "update" : mode);
          if (!saved) await privateWrite(path, config);
          if (options.includes("--configure"))
            console.log(`Captured private local configuration: ${path}. Containers unchanged.`);
          else await release(docker, root, config, mode, base);
        });
    } finally {
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", interrupt);
    }
  }
} catch (error) {
  console.error(
    error instanceof assert.AssertionError ? error.message.split("\n")[0] : error.message
  );
  process.exitCode = 1;
}
