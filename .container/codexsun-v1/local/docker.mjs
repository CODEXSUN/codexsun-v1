import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { applications, project } from "./config.mjs";

export class LocalDocker {
  context = "desktop-linux";
  children = new Set();
  interrupted = false;
  recovering = false;

  interrupt() {
    if (this.recovering) return;
    this.interrupted = true;
    for (const child of this.children) child.kill("SIGTERM");
  }

  resumeForRecovery() {
    this.recovering = true;
  }

  assertActive() {
    assert.ok(
      !this.interrupted || this.recovering,
      "Local operation interrupted. Previous app state will be recovered when needed."
    );
  }

  checkTarget() {
    assert.ok(!process.env.DOCKER_HOST, "Unset DOCKER_HOST before local deployment.");
    const [context] = this.json(["context", "inspect", this.context]);
    assert.match(
      context.Endpoints.docker.Host,
      /^(npipe:\/{4}\.\/pipe\/|unix:\/\/\/)/u,
      "A local Docker socket is required."
    );
    const info = this.json(["info", "--format", "{{json .}}"]);
    assert.match(info.OperatingSystem, /Docker Desktop/u, "Local scripts require Docker Desktop.");
    assert.equal(info.OSType, "linux", "Switch Docker Desktop to Linux containers.");
    this.run(["compose", "version"]);
  }

  run(args, options = {}) {
    this.assertActive();
    try {
      return execFileSync("docker", ["--context", this.context, ...args], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
        ...options
      });
    } catch {
      throw new Error(
        `Local Docker ${args[0]} failed. No secret-bearing command output was printed.`
      );
    }
  }

  json(args) {
    return JSON.parse(this.run(args));
  }

  inspect(name) {
    return this.json(["inspect", name])[0];
  }

  exists(name) {
    return this.run(["container", "ls", "-aq", "--filter", `name=^/${name}$`]).trim() !== "";
  }

  async output(args, path, environment = {}) {
    this.assertActive();
    const child = this.startProcess(args, environment);
    const diagnostics = pipeline(
      child.stderr,
      createWriteStream(`${path}.stderr.log`, { flags: "wx", mode: 0o600 })
    );
    const complete = new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`Docker ${args[0]} failed. Backup or build is incomplete.`))
      );
    });
    await Promise.all([
      pipeline(child.stdout, createWriteStream(path, { flags: "wx", mode: 0o600 })),
      diagnostics,
      complete
    ]);
  }

  async logged(args, path) {
    this.assertActive();
    const output = createWriteStream(path, { flags: "a", mode: 0o600 });
    const child = this.startProcess(args);
    child.stdout.pipe(output, { end: false });
    child.stderr.pipe(output, { end: false });
    await new Promise((resolve, reject) => {
      output.once("error", (error) => {
        child.kill("SIGTERM");
        reject(error);
      });
      child.once("error", (error) => {
        output.end();
        reject(error);
      });
      child.once("close", (code) =>
        output.end(() =>
          code === 0
            ? resolve()
            : reject(new Error(`Docker ${args[0]} failed. See private log: ${path}`))
        )
      );
    });
  }

  async stop(name) {
    const container = this.inspect(name);
    assert.ok(
      applications.includes(container.Name.slice(1)),
      "Only local app containers may be stopped."
    );
    assert.equal(container.Config.Labels?.["com.docker.compose.project"], project);
    if (!container.State.Running) return;
    const signal = container.Config.StopSignal || "SIGTERM";
    assert.ok(!["SIGKILL", "KILL", "9"].includes(signal), "Force-kill is forbidden.");
    // Docker stop marks the container manually stopped and suppresses its restart policy.
    const child = this.startProcess(["stop", "--timeout", "-1", container.Id]);
    child.stdout.resume();
    child.stderr.resume();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`${name} did not stop gracefully. Replacement was aborted.`));
      }, 90_000);
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`Graceful stop failed for ${name}.`));
      });
    });
    assert.equal(this.inspect(container.Id).State.Running, false, "An app writer did not stop.");
  }

  startProcess(args, environment = {}) {
    this.assertActive();
    const child = spawn("docker", ["--context", this.context, ...args], {
      env: { ...process.env, ...environment },
      stdio: ["ignore", "pipe", "pipe"]
    });
    this.track(child);
    return child;
  }

  track(child) {
    this.children.add(child);
    const remove = () => this.children.delete(child);
    child.once("close", remove);
    child.once("error", remove);
  }
}
