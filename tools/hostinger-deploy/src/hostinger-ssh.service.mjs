import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class HostingerSshService {
  constructor(target) {
    this.target = target;
  }

  async status() {
    const alias = await this.checkLocalConfig();
    const { stdout } = await execFileAsync(
      "ssh",
      [
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=12",
        "-o",
        "StrictHostKeyChecking=yes",
        alias,
        probeCommand(this.target.deploymentRoot)
      ],
      { timeout: 25_000, windowsHide: true }
    );
    const remote = parseLines(stdout);
    if (remote.host !== this.target.hostname || remote.user !== this.target.user) {
      throw new Error("The SSH connection reached a different Hostinger VPS identity.");
    }
    if (
      !remote.docker?.startsWith("Docker version ") ||
      !remote.compose?.startsWith("Docker Compose version ")
    ) {
      throw new Error("The Hostinger VPS is missing Docker or Docker Compose.");
    }
    return {
      alias,
      host: this.target.host,
      hostname: remote.host,
      user: remote.user,
      virtualMachineId: this.target.virtualMachineId,
      docker: remote.docker,
      compose: remote.compose,
      deploymentRoot: this.target.deploymentRoot,
      deploymentRootPresent: remote.deploymentRoot === "present"
    };
  }

  async checkLocalConfig() {
    const alias = process.env.CODEXSUN_DEPLOY_SSH_ALIAS?.trim() || this.target.alias;
    if (!/^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/u.test(alias)) {
      throw new Error("CODEXSUN_DEPLOY_SSH_ALIAS must name one SSH host alias.");
    }
    const { stdout } = await execFileAsync("ssh", ["-G", alias], {
      timeout: 10_000,
      windowsHide: true
    });
    const config = parseLines(stdout, " ");
    if (
      config.hostname !== this.target.host ||
      config.user !== this.target.user ||
      Number(config.port) !== this.target.port ||
      !["yes", "true"].includes(config.stricthostkeychecking)
    ) {
      throw new Error("SSH alias does not match the pinned Hostinger VPS target.");
    }
    if (!config.identityfile || !config.userknownhostsfile) {
      throw new Error("SSH alias needs an identity file and a known-hosts file.");
    }
    await Promise.all([access(config.identityfile), access(config.userknownhostsfile)]);
    return alias;
  }
}

function probeCommand(deploymentRoot) {
  const root = validatedDeploymentRoot(deploymentRoot);
  return [
    "printf 'host=%s\\n' \"$(hostname)\"",
    "printf 'user=%s\\n' \"$(id -un)\"",
    "printf 'docker=%s\\n' \"$(docker --version)\"",
    "printf 'compose=%s\\n' \"$(docker compose version)\"",
    `test -d '${root}' && printf 'deploymentRoot=present\\n' || printf 'deploymentRoot=missing\\n'`
  ].join("; ");
}

function validatedDeploymentRoot(value) {
  if (!/^\/home\/[a-z0-9-]+$/u.test(value)) {
    throw new Error("The deployment checkout must be a simple path under /home.");
  }
  return value;
}

function parseLines(value, separator = "=") {
  return Object.fromEntries(
    value
      .trim()
      .split(/\r?\n/u)
      .flatMap((line) => {
        const index = line.indexOf(separator);
        if (index < 0) return [];
        return [[line.slice(0, index), line.slice(index + separator.length).trim()]];
      })
  );
}
