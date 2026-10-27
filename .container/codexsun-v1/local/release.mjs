import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import {
  applications,
  buildModel,
  capture,
  configurationName,
  inspectDeployment,
  literal,
  sourceChecksum
} from "./config.mjs";
import { digest, privateDirectory, privateWrite } from "./files.mjs";
import { createSourceSnapshot, verifySourceSnapshot } from "./source-snapshot.mjs";
import { currentRelease } from "./current-release.mjs";

export async function release(docker, root, config, mode, base, options = {}) {
  const stamp = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const directory = await privateDirectory(join(base, stamp));
  const initial = inspectDeployment(docker, config, mode);
  if (mode === "update") {
    const checksum = await sourceChecksum(root);
    const previous = await currentRelease(base, initial.model, checksum);
    if (previous) {
      const candidateFile = join(directory, "candidate.private.json");
      await privateWrite(candidateFile, initial.model);
      if (options.fix) {
        console.log("Syncing CRM permissions for active existing tenants.");
        await syncCrmPermissions(docker, config.project, candidateFile, directory);
      }
      await verifyRuntime(docker, initial.model);
      await privateWrite(join(directory, "result.json"), {
        success: true,
        noChanges: true,
        crmPermissionsSynchronized: Boolean(options.fix),
        sourceChecksum: checksum,
        reusedRelease: previous,
        databasePreserved: initial.database.Id,
        redisPreserved: initial.redis.Id
      });
      console.log(
        options.fix
          ? "CRM permission sync passed. No rebuild or restart was needed."
          : "No new source changes. All five running app images and health checks are current. No build or restart was needed."
      );
      return;
    }
  }
  console.log("Capturing and verifying a fixed snapshot of the current build sources.");
  const snapshot = await createSourceSnapshot(root, directory);
  assert.equal(
    snapshot.workspaceChangedDuringCapture,
    false,
    "Source changed during snapshot. Retry the update."
  );
  const candidate = await buildModel(snapshot.root, initial.model, stamp);
  const candidateFile = join(directory, "candidate.private.json");
  await privateWrite(candidateFile, candidate);
  const compose = (file, args) => ["compose", "-p", config.project, "-f", file, ...args];
  docker.run(compose(candidateFile, ["config", "--quiet"]));
  const fingerprint = snapshot.checksum;
  const bindings = await bindingChecksums(initial.model);
  console.log(`Building five local images. Private log: ${join(directory, "build.log")}`);
  await docker.logged(
    compose(candidateFile, ["build", ...applications]),
    join(directory, "build.log")
  );
  await verifySourceSnapshot(snapshot);
  const workingTreeChangedDuringBuild = (await sourceChecksum(root)) !== fingerprint;
  if (workingTreeChangedDuringBuild)
    console.log(
      "Newer working-tree edits will be included in the next local update. The verified build snapshot is unchanged."
    );
  assert.deepEqual(
    await bindingChecksums(initial.model),
    bindings,
    "Local proxy configuration changed during build."
  );
  const current = inspectDeployment(docker, config, mode);
  assert.deepEqual(
    current.containers.map((item) => item.Id),
    initial.containers.map((item) => item.Id),
    "Another operation changed app containers during build."
  );
  for (const name of applications) {
    candidate.services[name].image = docker.json([
      "image",
      "inspect",
      candidate.services[name].image
    ])[0].Id;
    delete candidate.services[name].build;
  }
  await privateWrite(candidateFile, candidate);
  const stopped = [];
  let replaced = false;
  const previousFile = join(directory, "previous.private.json");
  try {
    await privateWrite(previousFile, current.model);
    console.log("Stopping only the five app containers. MariaDB and Redis remain running.");
    for (const item of current.containers) {
      stopped.push(item.Id);
      await docker.stop(item.Id);
    }
    assertRetainedState(docker, current);
    assert.deepEqual(
      await bindingChecksums(initial.model),
      bindings,
      "Local proxy configuration changed before replacement."
    );
    if (mode === "update") {
      console.log("Syncing CRM permissions for active existing tenants.");
      await syncCrmPermissions(docker, config.project, candidateFile, directory);
    }
    replaced = true;
    await replaceApplications(
      docker,
      config.project,
      candidateFile,
      join(directory, "replace.log")
    );
    await verifyRuntime(docker, candidate);
    docker.assertActive?.();
    const next = capture(docker, root);
    inspectDeployment(docker, next, "update");
    await privateWrite(join(root, configurationName), next);
    await privateWrite(join(directory, "result.json"), {
      success: true,
      sourceChecksum: fingerprint,
      workingTreeChangedDuringBuild,
      crmPermissionsSynchronized: mode === "update",
      databasePreserved: current.database.Id,
      redisPreserved: current.redis.Id
    });
    console.log(`Local deployment passed. Private logs: ${directory}`);
  } catch (error) {
    await recover(docker, config, mode, replaced, candidate, previousFile, stopped, directory);
    throw error;
  }
}

export async function syncCrmPermissions(docker, project, file, directory) {
  await docker.logged(
    [
      "compose",
      "-p",
      project,
      "-f",
      file,
      "run",
      "--rm",
      "--no-deps",
      "--pull",
      "never",
      "--entrypoint",
      "node",
      "codexsun-api",
      "--import",
      "./tools/register-production-package-resolution.mjs",
      "dist/apps/platform/api/database/db-cli.js",
      "crm:permissions:sync"
    ],
    join(directory, "crm-permissions.log")
  );
}

export async function replaceApplications(docker, project, file, log) {
  await docker.logged(
    [
      "compose",
      "-p",
      project,
      "-f",
      file,
      "up",
      "-d",
      "--no-deps",
      "--no-build",
      "--wait",
      "--wait-timeout",
      "240",
      ...applications
    ],
    log
  );
}

export async function verifyRuntime(docker, model) {
  for (const name of applications) {
    const container = docker.inspect(name);
    assert.equal(container.State.Health?.Status, "healthy", `${name} is unhealthy.`);
    assert.equal(
      container.Image,
      model.services[name].image,
      `${name} image changed unexpectedly.`
    );
  }
  const web = localAddress(model.services["codexsun-web"]);
  const shop = localAddress(model.services["codexsun-shop"]);
  for (const url of [
    `${web}/health`,
    `${shop}/health`,
    `${web}/api/app/ready`,
    `${web}/api/app/public/runtime-config`,
    `${shop}/api/platform/storefront/bootstrap`
  ]) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, `Local endpoint failed: ${new URL(url).pathname}`);
    if (response.headers.get("content-type")?.includes("application/json"))
      assert.notEqual((await response.json()).success, false, "Local API returned an error.");
  }
}

export async function recover(
  docker,
  config,
  mode,
  replaced,
  candidate,
  previousFile,
  stopped,
  directory
) {
  docker.resumeForRecovery?.();
  try {
    if (replaced && mode === "update") {
      await replaceApplications(
        docker,
        config.project,
        previousFile,
        join(directory, "rollback.log")
      );
    } else if (replaced) {
      for (const name of applications) {
        if (!docker.exists(name)) continue;
        const item = docker.inspect(name);
        assert.equal(
          item.Image,
          candidate.services[name].image,
          "A different operation now owns the candidate container."
        );
        assert.equal(item.Config.Labels?.["com.docker.compose.project"], config.project);
        await docker.stop(name);
        docker.run(["rm", name]);
      }
    } else {
      const failures = [];
      for (const name of stopped) {
        try {
          docker.run(["start", name]);
        } catch {
          failures.push(name);
        }
      }
      assert.deepEqual(failures, [], "Some previous app writers could not resume.");
    }
    await privateWrite(join(directory, "result.json"), {
      success: false,
      applicationRecoveryCompleted: true,
      databaseRollbackAttempted: false
    });
    console.error(
      "Local replacement failed. Previous app state was recovered. Database data was not rolled back."
    );
  } catch {
    throw new Error(
      `Local app recovery needs attention. Keep all volumes and review private logs in ${directory}`
    );
  }
}

async function bindingChecksums(model) {
  const result = {};
  for (const service of Object.values(model.services))
    for (const mount of service.volumes ?? []) {
      if (mount.type === "bind") result[mount.source] = await digest(literal(mount.source));
    }
  return result;
}

function localAddress(service) {
  const port = service.ports.find(
    (item) => Number(item.target) === 80 && item.host_ip === "127.0.0.1"
  );
  assert.ok(port, "Web and Shop require an IPv4 loopback HTTP port.");
  assert.match(String(port.published), /^\d+$/u);
  return `http://127.0.0.1:${port.published}`;
}

function assertRetainedState(docker, state) {
  for (const previous of [state.database, state.redis]) {
    const current = docker.inspect(previous.Id);
    assert.equal(current.Id, previous.Id);
    assert.equal(
      current.State.StartedAt,
      previous.State.StartedAt,
      "Infrastructure restarted during deployment."
    );
    assert.equal(current.State.Health?.Status, "healthy", "Infrastructure became unhealthy.");
  }
  for (const name of applications) {
    const previous = state.containers.find((item) => item.Name === `/${name}`);
    if (!previous) assert.ok(!docker.exists(name), "An app appeared during fresh deployment.");
    else {
      const current = docker.inspect(name);
      assert.equal(current.Id, previous.Id, "An app changed before replacement.");
      assert.equal(current.State.Running, false, "An app writer resumed before replacement.");
    }
  }
}
