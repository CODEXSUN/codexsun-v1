import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { capture, configurationName, inspectDeployment } from "./config.mjs";
import { LocalDocker } from "./docker.mjs";
import { privateWrite, readJson, withLock } from "./files.mjs";
import { parseLocalOptions } from "./options.mjs";
import { release } from "./release.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const [mode, ...arguments_] = process.argv.slice(2);
try {
  const options = parseLocalOptions(mode, arguments_);
  if (options.help) {
    const usage =
      mode === "update"
        ? "Usage: bash update-local.sh [--plan] [--check] [--configure]\n" +
          "  update: build and update the five services\n" +
          "  --plan: show the actions without changing anything\n" +
          "  --check: check the configuration without changes\n" +
          "  --configure: capture initial configuration"
        : "Usage: bash deploy-local.sh [--check | --configure]\n" +
          "  --check: check the configuration without changes\n" +
          "  --configure: capture the existing local configuration";
    console.log(usage);
  } else if (options.plan) {
    console.log("If a matching release is recorded: check health. Otherwise: build and update all five services, then check health.");
    console.log(
      "API startup may run platform database migrations. No backup or environment-file update is performed."
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
      if (options.check) {
        const config = existsSync(path) ? await readJson(path) : capture(docker, root);
        inspectDeployment(docker, config, mode);
        console.log(`Local ${mode} preflight passed. No files or containers changed.`);
      } else
        await withLock(root, async (base) => {
          const saved = existsSync(path);
          assert.ok(
            !options.configure || !saved,
            "Local configuration already exists. Review and back it up before changing it."
          );
          const config = saved ? await readJson(path) : capture(docker, root);
          // Configuration capture validates the running stack, even before a future fresh deployment.
          inspectDeployment(docker, config, options.configure ? "update" : mode);
          if (!saved) await privateWrite(path, config);
          if (options.configure)
            console.log(`Captured private local configuration: ${path}. Containers unchanged.`);
          else await release(docker, root, config, mode, base, options);
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
