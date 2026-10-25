import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import {
  applications,
  buildModel,
  configurationName,
  inspectDeployment,
  literal,
  sourceChecksum
} from "./config.mjs";
import { backup, verifyBackup } from "./backup.mjs";
import { digest, privateDirectory, privateWrite } from "./files.mjs";
import { createSourceSnapshot, verifySourceSnapshot } from "./source-snapshot.mjs";
import { currentRelease } from "./current-release.mjs";
import { recentBackup } from "./recent-backup.mjs";

export async function release(docker, root, config, mode, base) {
  const stamp = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const directory = await privateDirectory(join(base, stamp));
  const initial = inspectDeployment(docker, config, mode);
  if (mode === "update") {
    const checksum = await sourceChecksum(root);
    const previous = await currentRelease(base, initial.model, checksum);
    if (previous) {
      await verifyRuntime(docker, initial.model);
      await privateWrite(join(directory, "candidate.private.json"), initial.model);
      await privateWrite(join(directory, "result.json"), {
        success: true,
        noChanges: true,
        sourceChecksum: checksum,
        reusedRelease: previous,
        databasePreserved: initial.database.Id,
        redisPreserved: initial.redis.Id
      });
      console.log(
        "No new source changes. All five running app images and health checks are current. No build, backup, or restart was needed."
      );
      return;
    }
  }
  const existingBackup = await recentBackup(base, initial);
  if (existingBackup)
    console.log(
      `Reusing recent checksum-verified pre-build backup: ${existingBackup}. A fresh quiesced backup is still required before replacement.`
    );
  else {
    console.log("Backing up local SQL, Redis, storage, and configuration before build.");
    await backup(docker, initial, join(directory, "before-build"));
  }
  console.log("Capturing and verifying a fixed snapshot of the current build sources.");
  const snapshot = await createSourceSnapshot(root, directory);
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
  const finalBackup = join(directory, "before-replacement");
  try {
    console.log(
      "Stopping app writers gracefully for the final backup. MariaDB and Redis remain running."
    );
    for (const item of current.containers) {
      stopped.push(item.Id);
      await docker.stop(item.Id);
    }
    await backup(docker, current, finalBackup);
    await verifyBackup(finalBackup);
    assertRetainedState(docker, current);
    assert.deepEqual(
      await bindingChecksums(initial.model),
      bindings,
      "Local proxy configuration changed before replacement."
    );
    replaced = true;
    await replaceApplications(
      docker,
      config.project,
      candidateFile,
      join(directory, "replace.log")
    );
    await verifyRuntime(docker, candidate);
    docker.assertActive?.();
    const next = { ...config, model: candidate };
    await privateWrite(join(root, configurationName), next);
    await privateWrite(join(directory, "result.json"), {
      success: true,
      sourceChecksum: fingerprint,
      workingTreeChangedDuringBuild,
      databasePreserved: current.database.Id,
      redisPreserved: current.redis.Id
    });
    console.log(`Local deployment passed. Backups and logs: ${directory}`);
  } catch (error) {
    await recover(docker, config, mode, replaced, candidate, finalBackup, stopped, directory);
    throw error;
  }
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
  finalBackup,
  stopped,
  directory
) {
  docker.resumeForRecovery?.();
  try {
    if (replaced && mode === "update") {
      await verifyBackup(finalBackup);
      await replaceApplications(
        docker,
        config.project,
        join(finalBackup, "previous.private.json"),
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
      `Local recovery needs attention. Keep all volumes and review private logs in ${directory}`
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
      assert.equal(current.Id, previous.Id, "An app changed during the final backup.");
      assert.equal(current.State.Running, false, "An app writer resumed during the final backup.");
    }
  }
}
