"""Private deployment configuration and rollback snapshots. Never print secrets."""
import json
import os
import re
import sys
from pathlib import Path


def environment(path):
    result = {}
    for line in Path(path).read_text(encoding="utf-8-sig").splitlines():
        if not line or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if value.startswith('"') and value.endswith('"'):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                value = value[1:-1]
        elif value.startswith("'") and value.endswith("'"):
            value = value[1:-1].replace("\\'", "'")
        result[key.strip()] = value
    return result


def validate(path, fresh=False):
    values = environment(path)
    for key in ["DB_PASSWORD", "DB_USER", "DB_MASTER_NAME", "JWT_SECRET",
                "CODEXSUN_MARIADB_CONTAINER", "CODEXSUN_REDIS_CONTAINER",
                "CODEXSUN_DATA_VOLUME", "CODEXSUN_DOCKER_NETWORK", "CODEXSUN_IMAGE_REGISTRY"]:
        value = values.get(key, "")
        if not value or value.startswith("change_this"):
            raise ValueError(f"Configure {key} before deployment")
    for key in ["CODEXSUN_DB_FRESH_ON_START", "CODEXSUN_ALLOW_PRODUCTION_DB_RESET", "CODEXSUN_ALLOW_LIVE_RESTORE"]:
        if values.get(key) != "0":
            raise ValueError(f"{key} must remain 0")
    for key in ["CODEXSUN_MARIADB_CONTAINER", "CODEXSUN_REDIS_CONTAINER", "CODEXSUN_DATA_VOLUME", "CODEXSUN_DOCKER_NETWORK"]:
        if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}", values[key]):
            raise ValueError(f"Invalid resource name: {key}")
    media = values.get("CODEXSUN_MEDIA_DATA_VOLUME", "")
    if media:
        if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}", media):
            raise ValueError("Invalid CODEXSUN_MEDIA_DATA_VOLUME")
        if media in {values.get(key) for key in ["CODEXSUN_DATA_VOLUME", "REDIS_DATA_VOLUME", "MARIADB_DATA_VOLUME", "MARIADB_BACKUP_VOLUME"]}:
            raise ValueError("Media storage must remain separate from application, Redis and database volumes")
    if values.get("DB_HOST") != values["CODEXSUN_MARIADB_CONTAINER"]:
        raise ValueError("DB_HOST must identify CODEXSUN_MARIADB_CONTAINER on the Docker network")
    if values.get("NODE_ENV") != "production":
        raise ValueError("NODE_ENV must be production")
    if values.get("DB_DRIVER") != "mariadb" or values.get("DB_PORT") != "3306":
        raise ValueError("VPS deployment requires MariaDB on its declared internal port 3306")
    if not re.fullmatch(r"[a-zA-Z0-9_]+", values["DB_MASTER_NAME"]):
        raise ValueError("Invalid DB_MASTER_NAME")
    if values["DB_MASTER_NAME"] == values.get("DEFAULT_TENANT_DB_NAME"):
        raise ValueError("Master and tenant databases must remain separate")
    if values.get("DEFAULT_TENANT_DB_NAME") and not re.fullmatch(r"[a-zA-Z0-9_]+", values["DEFAULT_TENANT_DB_NAME"]):
        raise ValueError("Invalid DEFAULT_TENANT_DB_NAME")
    applications = {f"codexsun-{item}" for item in ["api", "web", "shop", "worker", "chatb"]}
    if values["CODEXSUN_MARIADB_CONTAINER"] in applications or values["CODEXSUN_REDIS_CONTAINER"] in applications:
        raise ValueError("Infrastructure cannot use an application container name")
    if values["CODEXSUN_MARIADB_CONTAINER"] == values["CODEXSUN_REDIS_CONTAINER"]:
        raise ValueError("MariaDB and Redis must use different container names")
    if fresh:
        if not values.get("DEFAULT_TENANT_DB_NAME"):
            raise ValueError("Fresh installation requires an explicit DEFAULT_TENANT_DB_NAME")
        for prefix in ["SUPER_ADMIN", "SOFTWARE_ADMIN", "TENANT_ADMIN", "DEFAULT_TENANT_ADMIN"]:
            for suffix in ["NAME", "EMAIL", "PASSWORD"]:
                key = f"{prefix}_{suffix}"
                if not values.get(key) or values[key].startswith("change_this"):
                    raise ValueError(f"Fresh installation requires {key}")
    if values.get("CODEXSUN_REALTIME_ENABLED", "0") not in {"0", "1"}:
        raise ValueError("CODEXSUN_REALTIME_ENABLED must be 0 or 1")
    if values.get("CODEXSUN_REALTIME_ENABLED", "0") == "1":
        if len(values.get("CODEXSUN_WORKER_CONTROL_TOKEN", "")) < 32:
            raise ValueError("Realtime Worker requires a control token of at least 32 characters")
        if not values.get("CODEXSUN_REDIS_URL", "").startswith(("redis://", "rediss://")):
            raise ValueError("Realtime Worker requires a Redis URL")


def compose_literals(value):
    if isinstance(value, str):
        return value.replace("$", "$$")
    if isinstance(value, list):
        return [compose_literals(item) for item in value]
    if isinstance(value, dict):
        return {key: compose_literals(item) for key, item in value.items()}
    return value


def snapshot(running_names=None):
    model = {"name": "codexsun", "services": {}, "networks": {}, "volumes": {}}
    for item in json.load(sys.stdin):
        cfg = item["Config"]
        name = item["Name"].lstrip("/")
        service = {"image": item["Image"], "container_name": name,
                   "environment": dict(v.split("=", 1) for v in cfg.get("Env", []) if "=" in v),
                   "restart": item["HostConfig"]["RestartPolicy"]["Name"] or "no"}
        service["x-codexsun-running"] = name in running_names if running_names is not None else item.get("State", {}).get("Running", True)
        for source, target in [("Entrypoint", "entrypoint"), ("Cmd", "command"), ("User", "user"), ("WorkingDir", "working_dir"), ("StopSignal", "stop_signal")]:
            if cfg.get(source):
                service[target] = cfg[source]
        host = item["HostConfig"]
        if host["RestartPolicy"].get("MaximumRetryCount"):
            service["restart"] += f":{host['RestartPolicy']['MaximumRetryCount']}"
        if cfg.get("StopTimeout") is not None:
            service["stop_grace_period"] = f"{cfg['StopTimeout']}s"
        for source, target in [("ReadonlyRootfs", "read_only"), ("CapAdd", "cap_add"), ("CapDrop", "cap_drop"), ("SecurityOpt", "security_opt"), ("Init", "init"), ("Privileged", "privileged")]:
            if host.get(source):
                service[target] = host[source]
        if cfg.get("Healthcheck"):
            health = cfg["Healthcheck"]
            service["healthcheck"] = {"test": health["Test"]}
            for source, target in [("Interval", "interval"), ("Timeout", "timeout"), ("StartPeriod", "start_period"), ("StartInterval", "start_interval")]:
                if health.get(source):
                    service["healthcheck"][target] = f"{health[source]}ns"
            if health.get("Retries"):
                service["healthcheck"]["retries"] = health["Retries"]
        service["networks"] = {}
        for network, settings in item["NetworkSettings"]["Networks"].items():
            model["networks"][network] = {"external": True, "name": network}
            service["networks"][network] = {"aliases": settings.get("Aliases") or []}
        service["volumes"] = []
        for mount in item["Mounts"]:
            if mount["Type"] not in ["volume", "bind"]:
                raise ValueError(f"Unsupported rollback mount for {name}: {mount['Type']}")
            source = mount.get("Name", mount["Source"])
            if mount["Type"] == "volume":
                model["volumes"][source] = {"external": True, "name": source}
            service["volumes"].append({"type": mount["Type"], "source": source,
                                       "target": mount["Destination"], "read_only": not mount["RW"]})
        service["ports"] = []
        for port, bindings in (item["HostConfig"].get("PortBindings") or {}).items():
            target, protocol = port.split("/")
            for binding in bindings or []:
                service["ports"].append({"target": int(target), "published": binding["HostPort"],
                                         "host_ip": binding["HostIp"] or "0.0.0.0", "protocol": protocol})
        model["services"][name] = service
    json.dump(compose_literals(model), sys.stdout, indent=2)


def metadata(directory, status, version, commit):
    path = Path(directory) / "release.json"
    value = json.loads(path.read_text()) if path.exists() else {}
    value.update(status=status, layout="codexsun-v1", version=version, commit=commit)
    value["backup"] = "SHA256SUMS"
    temporary = path.with_suffix(".partial")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    os.replace(temporary, path)


def main():
    sys.stdout.reconfigure(newline="\n")
    try:
        command, *args = sys.argv[1:]
        if command == "env":
            print(environment(args[0]).get(args[1], ""))
        elif command == "validate":
            validate(args[0], "fresh" in args[1:])
        elif command == "package":
            value = json.loads(Path(args[0]).read_text())
            for key in args[1].split("."):
                value = value[key]
            if args[1].startswith("engines."):
                value = value.removeprefix(">=")
            if not re.fullmatch(r"\d+\.\d+\.\d+", value):
                raise ValueError("Deployment requires an exact numeric runtime/package version")
            print(value)
        elif command == "network":
            if args[0] not in json.load(sys.stdin)[0]["NetworkSettings"]["Networks"]:
                raise ValueError("Infrastructure is not attached to the configured network")
        elif command == "snapshot":
            snapshot(set(args[1:]) if args and args[0] == "--running" else None)
        elif command == "services":
            model = json.loads(Path(args[0]).read_text())
            for name, service in model["services"].items():
                running = service.get("x-codexsun-running", True)
                if len(args) == 1 or (args[1] == "running") == running:
                    print(name)
        elif command == "pin":
            model = json.load(sys.stdin)
            for argument in args:
                name, identity = argument.split("=", 1)
                model["services"][name]["image"] = identity
                model["services"][name].pop("build", None)
            # Compose config output has already escaped literal dollars for reuse.
            json.dump(model, sys.stdout, indent=2)
        elif command == "protect":
            item = json.load(sys.stdin)[0]
            if args[0] in [mount.get("Name") for mount in item["Mounts"]]:
                raise ValueError("Cleanup volume is mounted by MariaDB and is protected")
        elif command == "adoption":
            item = json.load(sys.stdin)[0]
            mounts = item["Mounts"]
            expected = {"/storage": args[0]}
            if len(args) > 1 and args[1]:
                expected["/storage/media"] = args[1]
            actual = {mount["Destination"]: mount.get("Name") for mount in mounts}
            if len(mounts) != len(expected) or actual != expected or any(mount.get("Type") != "volume" or not mount.get("RW") for mount in mounts):
                raise ValueError("Existing application mounts differ from v1. Review storage/Media adoption before update")
        elif command == "metadata":
            metadata(*args)
        else:
            raise ValueError("Unknown deployment configuration operation")
    except (ValueError, KeyError, OSError) as error:
        sys.exit(str(error))


if __name__ == "__main__":
    main()
