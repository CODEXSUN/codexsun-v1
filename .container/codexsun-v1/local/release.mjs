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
import { digest, privateDirectory, privateWrite, readJson } from "./files.mjs";
import { createSourceSnapshot, verifySourceSnapshot } from "./source-snapshot.mjs";
import { currentRelease } from "./current-release.mjs";
import { backup, verifyBackup } from "./backup.mjs";
import {
  createIsolatedRestoreProof,
  createReusedIsolatedRestoreProof
} from "./isolated-restore.mjs";
import {
  assertInfrastructurePortsUnpublished,
  assertLocalDatabaseTargets,
  runDatabaseCommand,
  runMasterStartupProof,
  verifyMasterStartupEvidence
} from "./database.mjs";
import { prepareDatabase, withMigrationRecovery } from "./migration-sequence.mjs";
import { DatabaseRelayLease } from "./database-relay.mjs";
import { fetchReady } from "./runtime-health.mjs";
import { findReusableBackup } from "./reusable-backup.mjs";

export async function release(docker, root, config, mode, base, options = {}) {
  const stamp = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const directory = await privateDirectory(join(base, stamp));
  const initial = inspectDeployment(docker, config, mode);
  assertInfrastructurePortsUnpublished(initial);
  if (mode === "update") {
    const checksum = await sourceChecksum(root);
    const previous = await currentRelease(base, initial.model, checksum);
    if (previous) {
      const candidateFile = join(directory, "candidate.private.json");
      await privateWrite(candidateFile, initial.model);
      await verifyRuntime(docker, initial.model);
      await privateWrite(join(directory, "result.json"), {
        success: true,
        noChanges: true,
        sourceChecksum: checksum,
        reusedRelease: previous,
        databasePreserved: initial.database.Id,
        redisPreserved: initial.redis.Id
      });
      console.log(
        "No new source changes. All five running app images and health checks are current. No build or restart was needed."
      );
      return;
    }
  }
  const previousBackup = options.noBackup
    ? await findReusableBackup(base, initial, new Date(), directory)
    : null;
  if (previousBackup) {
    console.warn(
      `--nobackup will reuse the backup from ${previousBackup.createdAt}. Changes since that backup cannot be recovered from it.`
    );
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
  const relay = current.relay ? new DatabaseRelayLease(docker, current.relay) : null;
  const previousFile = join(directory, "previous.private.json");
  await withMigrationRecovery(
    async (markDatabaseChangesPossible) => {
      await privateWrite(previousFile, current.model);
      console.log("Stopping only the five app containers. MariaDB and Redis remain running.");
      for (const item of current.containers) {
        stopped.push(item.Id);
        await docker.stop(item.Id);
      }
      if (relay) {
        console.log("Stopping the local database relay and reserving its host port.");
        await relay.isolate();
      }
      assertRetainedState(docker, current);
      const backupDirectory = previousBackup?.directory ?? join(directory, "before-migration");
      const preliminaryDirectory = join(directory, "before-startup-proof");
      let backedUpDatabases;
      let proof;
      await prepareDatabase(
        {
          guard: () => {
            assertRetainedState(docker, current);
            relay?.assertIsolated();
            assertLocalDatabaseTargets(docker, current, backedUpDatabases);
          },
          preliminaryBackup: async () => {
            console.log("Creating a verified backup before the master startup proof.");
            await backup(docker, current, preliminaryDirectory);
            await verifyBackup(preliminaryDirectory);
          },
          startupProof: previousBackup
            ? undefined
            : () => runMasterStartupProof(docker, config.project, candidateFile, directory),
          backup: async () => {
            if (previousBackup) {
              const verified = await findReusableBackup(base, current, new Date(), directory);
              assert.equal(
                verified.directory,
                backupDirectory,
                "The reusable backup changed during the build."
              );
              await verifyMasterStartupEvidence(docker, config.project, candidateFile, directory);
              await privateWrite(join(directory, "reuse-attempt.json"), {
                baseline: previousBackup.operation
              });
              console.log("Reusing the verified earlier backup. Later changes are not included.");
            } else {
              console.log("Creating and verifying a local database, Redis, and storage backup.");
              await backup(docker, current, backupDirectory);
              await verifyBackup(backupDirectory);
            }
            backedUpDatabases = await readJson(join(backupDirectory, "databases.private.json"));
            assertLocalDatabaseTargets(docker, current, backedUpDatabases);
            console.log("Restoring and comparing the backup on a network-isolated MariaDB.");
            proof = await (
              previousBackup ? createReusedIsolatedRestoreProof : createIsolatedRestoreProof
            )(docker, current, backupDirectory, join(directory, "isolated-proof"));
          },
          verify: () => verifyBackup(backupDirectory),
          preflight: () =>
            runDatabaseCommand(
              docker,
              config.project,
              candidateFile,
              directory,
              "migrations:preflight",
              proof
            ),
          migrate: () =>
            runDatabaseCommand(
              docker,
              config.project,
              candidateFile,
              directory,
              "migrations:run",
              proof
            ),
          seed: () =>
            runDatabaseCommand(docker, config.project, candidateFile, directory, "seed", proof)
        },
        markDatabaseChangesPossible
      );
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
      if (relay) await relay.restore();
      docker.assertActive?.();
      const next = capture(docker, root, config);
      inspectDeployment(docker, next, "update");
      await privateWrite(join(root, configurationName), next);
      await privateWrite(join(directory, "result.json"), {
        success: true,
        sourceChecksum: fingerprint,
        workingTreeChangedDuringBuild,
        databasePreserved: current.database.Id,
        redisPreserved: current.redis.Id,
        backupDirectory,
        noBackup: !!previousBackup,
        ...(previousBackup ? { reusedBackupCreatedAt: previousBackup.createdAt } : {})
      });
      console.log(`Local deployment passed. Private logs: ${directory}`);
    },
    async () => {
      try {
        await recover(docker, config, mode, replaced, candidate, previousFile, stopped, directory);
      } finally {
        if (relay) await relay.restore();
      }
    },
    async () => {
      docker.resumeForRecovery?.();
      await privateWrite(join(directory, "result.json"), {
        success: false,
        databaseChangesPossible: true,
        applicationRecoveryCompleted: false,
        databaseRollbackAttempted: false
      });
      if (relay) await relay.keepStopped();
      for (const name of applications) {
        if (!docker.exists(name)) continue;
        const item = docker.inspect(name);
        if (item.State.Running && item.Image === candidate.services[name].image)
          await docker.stop(name);
      }
      console.error(
        `Database changes may have occurred. Previous images were not restarted. Review backup and logs in ${directory}.`
      );
    }
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
    `${web}/api/app/public/runtime-config`
  ]) {
    const response = await fetchReady(url);
    if (response.headers.get("content-type")?.includes("application/json"))
      assert.notEqual((await response.json()).success, false, "Local API returned an error.");
  }
  await verifyStorefront(`${shop}/api/platform/storefront/bootstrap`);
}

export async function verifyStorefront(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const body = await response.json();
  if (
    response.status === 404 &&
    body.success === false &&
    body.error?.code === "NOT_FOUND" &&
    body.error?.message === "The public application is not available for this domain."
  ) {
    console.warn(
      "Storefront proxy reached the API; loopback has no active storefront. Verify a configured storefront domain separately."
    );
    return;
  }
  assert.equal(response.status, 200, "Local storefront bootstrap failed.");
  assert.notEqual(body.success, false, "Local storefront bootstrap returned an error.");
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
