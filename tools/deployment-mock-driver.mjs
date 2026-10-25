// Executed only by isolated deployment tests. Never calls Docker or Git.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const statePath = process.env.CODEXSUN_MOCK_STATE;
const fixtureRoot = resolve(import.meta.dirname, "../dist/deployment-tests");
const relativeState = statePath ? relative(fixtureRoot, resolve(statePath)) : "..";
if (!statePath || relativeState.startsWith("..") || relativeState.includes(":"))
  throw new Error("Mock driver requires an isolated fixture");
const state = JSON.parse(readFileSync(statePath));
if (resolve(state.directory) !== dirname(resolve(statePath)))
  throw new Error("Fixture state escaped its directory");
const [tool, ...args] = process.argv.slice(2);
const has = (word) => args.includes(word);
const id = (role) => `sha256:${createHash("sha256").update(role).digest("hex")}`;
const output = (value) =>
  process.stdout.write(typeof value === "string" ? value + "\n" : JSON.stringify(value));
function fail(message) {
  process.stderr.write(message);
  process.exit(23);
}
function save() {
  writeFileSync(statePath, JSON.stringify(state));
}
function image(role) {
  return {
    Id: id(`${role}-${state.sourceVersion}`),
    Config: {
      Labels: {
        "org.opencontainers.image.version": state.sourceVersion,
        "org.opencontainers.image.revision": state.commit
      }
    }
  };
}
function format(item, expression) {
  if (expression.includes("Config.StopSignal")) return item.Config.StopSignal || "";
  if (expression.includes("com.docker.compose.project"))
    return item.Config.Labels["com.docker.compose.project"];
  if (expression.includes("com.docker.compose.service"))
    return item.Config.Labels["com.docker.compose.service"];
  if (expression.includes("State.Running")) return String(item.State.Running);
  if (expression.includes("State.Health")) return item.State.Health.Status;
  if (expression.includes(".Image")) return item.Image;
  return fail(`Unhandled container format: ${expression}`);
}
function compose() {
  const action = args.find((value) =>
    ["version", "config", "build", "images", "run", "up", "create", "stop", "rm"].includes(value)
  );
  const file = has("-f") ? args[args.indexOf("-f") + 1] : "";
  const infrastructure = /database[\\/]mariadb/.test(file)
    ? "mariadb"
    : /database[\\/]redis/.test(file)
      ? "redis"
      : "";
  const roles = ["api", "web", "shop", ...(state.realtime ? ["worker", "chatb"] : [])];
  if (action === "version") return output("Docker Compose version fixture");
  if (action === "config") {
    if (has("--quiet")) return;
    return output({
      name: "codexsun",
      services: Object.fromEntries(
        roles.map((role) => [
          `codexsun-${role}`,
          {
            image: `codexsun/${role}:${state.sourceVersion}`,
            build: { target: role },
            container_name: `codexsun-${role}`
          }
        ])
      )
    });
  }
  if (action === "build") {
    state.builds = (state.builds || 0) + 1;
    save();
    return;
  }
  if (action === "images") return output([]);
  if (action === "run") {
    const model = JSON.parse(readFileSync(file));
    if (model.services["codexsun-api"].image !== image("api").Id)
      fail("Migration image is not pinned");
    const command = args.at(-1);
    state.migrations ??= [];
    state.migrations.push(command);
    if (command === "migrations:preflight" && !state.tableCount) fail("Tenant registry is missing");
    if (command === "migrations:run") state.tableCount = 1;
    save();
    if (state.failMigration && command === "migrations:run") fail("Fixture migration failed");
    return;
  }
  if (infrastructure && action === "up") {
    state.containers[`codexsun-${infrastructure}`] = state.templates[`codexsun-${infrastructure}`];
    state.volumes.push(
      infrastructure === "mariadb" ? "codexsun-mariadb-data" : "codexsun-redis-data"
    );
    save();
    return;
  }
  if (["up", "create", "stop", "rm"].includes(action)) {
    const targets = args
      .slice(args.indexOf(action) + 1)
      .filter((value) => value.startsWith("codexsun-"));
    const model = ["up", "create"].includes(action) ? JSON.parse(readFileSync(file)) : null;
    for (const name of targets) {
      if (action === "rm") {
        delete state.containers[name];
        continue;
      }
      if (action === "stop") {
        if (state.containers[name]) state.containers[name].State.Running = false;
        continue;
      }
      const old = state.containers[name] || structuredClone(state.templates["codexsun-api"]);
      old.Name = `/${name}`;
      old.Config.Labels["com.docker.compose.service"] = name;
      old.Image = model.services[name].image;
      old.State.Running = action === "up";
      state.containers[name] = old;
    }
    save();
    if (state.failReplacement && action === "up" && file.endsWith("candidate.json"))
      fail("Fixture partial replacement");
    return;
  }
  fail(`Unhandled Compose call: ${args.join(" ")}`);
}
function docker() {
  if (args[0] === "info")
    return output(
      has("--format")
        ? args.at(-1).includes("DockerRootDir")
          ? state.directory
          : "Linux fixture"
        : "ready"
    );
  if (args[0] === "compose") return compose();
  if (args[0] === "ps") {
    if (state.failInventory) fail("Fixture inventory unavailable");
    const filter = args.find((value) => value.startsWith("volume="));
    return output(
      Object.entries(state.containers)
        .filter(
          ([, item]) => !filter || item.Mounts.some((mount) => mount.Name === filter.slice(7))
        )
        .map(([name]) => name)
        .join("\n")
    );
  }
  if (args[0] === "network") return output({});
  if (args[0] === "volume") {
    if (args[1] === "ls") {
      if (state.failVolumeInventory) fail("Fixture volume inventory unavailable");
      return output(state.volumes.join("\n"));
    }
    const name = args.at(-1);
    if (args[1] === "inspect") {
      if (!state.volumes.includes(name)) process.exit(1);
      return output([
        {
          Labels: {
            "com.docker.compose.project": name.includes("mariadb")
              ? "codexsun-mariadb"
              : name.includes("redis")
                ? "codexsun-redis"
                : "codexsun"
          }
        }
      ]);
    }
    if (args[1] === "create") state.volumes.push(name);
    else if (args[1] === "rm") state.volumes = state.volumes.filter((value) => value !== name);
    else fail("Unhandled volume operation");
    save();
    return;
  }
  if (args[0] === "image") {
    if (args[1] === "save") {
      if (state.failImageArchive) fail("Fixture image export failed");
      return process.stdout.write(gunzipSync(readFileSync(state.archive)));
    }
    if (args[1] === "rm") {
      state.removedImages ??= [];
      state.removedImages.push(args.at(-1));
      save();
      return;
    }
    if (args[1] !== "inspect") fail("Unhandled image operation");
    const expression = has("-f") ? args[args.indexOf("-f") + 1] : "";
    const role = /\/(api|web|shop|worker|chatb):/.exec(args.at(-1))?.[1] || "api";
    const value = image(role);
    return output(
      !expression
        ? [value]
        : expression.includes("revision")
          ? state.commit
          : expression.includes("version")
            ? state.sourceVersion
            : value.Id
    );
  }
  if (args[0] === "inspect" || (args[0] === "container" && args[1] === "inspect")) {
    const start = args[0] === "inspect" ? 1 : 2;
    const names = has("-f") ? [args.at(-1)] : args.slice(start);
    const items = names.map((name) => state.containers[name]);
    if (items.some((item) => !item)) process.exit(1);
    return output(has("-f") ? format(items[0], args[args.indexOf("-f") + 1]) : items);
  }
  if (args[0] === "exec") {
    if (has("mariadb-dump")) {
      if (state.failDump) fail("Fixture dump failed");
      if (state.failVolumeInventoryAfterDump) {
        state.failVolumeInventory = true;
        save();
      }
      return output(
        `-- MariaDB dump\n-- retained records: ${JSON.stringify(state.records)}\n-- Dump completed on fixture`
      );
    }
    if (has("mariadb")) {
      if (!args.at(-1).startsWith("SELECT COUNT(*) FROM information_schema.tables"))
        fail("Unexpected database statement");
      return output(
        String(
          args.at(-1).includes("table_schema='codexsun_db'")
            ? state.tenantTableCount || 0
            : state.tableCount || 0
        )
      );
    }
    if (has("node") && args.at(-1).includes("/ready")) return;
    if (has("wget") && /\/(health|ready)$/.test(args.at(-1))) return;
    if (has("sh") && args.at(-1).includes("redis-cli SAVE")) return;
    fail("Unhandled container exec");
  }
  if (args[0] === "run") {
    if (args[args.indexOf("--entrypoint") + 1] === "tar")
      return process.stdout.write(readFileSync(state.archive));
    if (
      args[args.indexOf("--entrypoint") + 1] === "sh" &&
      args.at(-1).startsWith("mkdir -p /storage/")
    )
      return;
    fail("Unhandled helper container");
  }
  if (["stop", "kill", "start", "rm"].includes(args[0])) {
    for (const name of args.filter((value) => state.containers[value])) {
      if (args[0] === "rm") delete state.containers[name];
      else state.containers[name].State.Running = args[0] === "start";
    }
    save();
    return;
  }
  fail(`Unhandled Docker call: ${args.join(" ")}`);
}
function git() {
  if (has("status") || has("merge-base")) return;
  if (has("branch")) return output("main");
  if (has("remote")) return output("https://github.com/CODEXSUN/fixture.git");
  if (has("fetch")) return;
  if (has("rev-parse"))
    return output(
      args.at(-1) === "FETCH_HEAD" && state.targetVersion ? "b".repeat(40) : state.commit
    );
  if (has("show")) return output({ version: state.targetVersion });
  if (has("merge")) {
    if (!has("--ff-only")) fail("Unsafe Git merge");
    state.sourceVersion = state.targetVersion;
    state.commit = "b".repeat(40);
    const path = join(state.directory, "package.json");
    const pkg = JSON.parse(readFileSync(path));
    pkg.version = state.sourceVersion;
    writeFileSync(path, JSON.stringify(pkg));
    save();
    return;
  }
  if (has("archive")) return output("fixture committed source");
  fail("Unhandled Git operation");
}
if (tool === "docker") docker();
else if (tool === "git") git();
else fail("Unknown mock tool");
