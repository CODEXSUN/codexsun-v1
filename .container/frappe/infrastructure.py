"""Inspect and back up retained infrastructure without replacing it."""

from contextlib import contextmanager
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import tempfile
from urllib.parse import quote, unquote, urlparse

from configuration import read_settings, validate_settings, write_settings


@contextmanager
def deployment_lock(root=None):
    """Use the v1 deployment lock filename on the current execution host."""
    path = Path(tempfile.gettempdir(), "codexsun-v1-deployment.lock")
    with path.open("a+b") as stream:
        if os.name == "nt":
            import msvcrt
            if path.stat().st_size == 0:
                stream.write(b"0")
                stream.flush()
            stream.seek(0)
            try:
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError:
                raise ValueError("Another CODEXSUN deployment operation holds the host lock.")
        else:
            import fcntl
            try:
                fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise ValueError("Another CODEXSUN deployment operation holds the host lock.")
        compatibility = None
        try:
            if root and (Path(root).parent / "codexsun-v1" / "local").is_dir():
                candidate = Path(root).parent / "backups" / "local" / "operation.lock"
                candidate.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                try:
                    candidate.mkdir()
                except FileExistsError:
                    raise ValueError("A local CODEXSUN deployment holds operation.lock. Finish it before Frappe installation.") from None
                compatibility = candidate
                (candidate / "owner.json").write_text(json.dumps({"pid": os.getpid(), "operation": "frappe-install"}))
            yield
        finally:
            if compatibility:
                (compatibility / "owner.json").unlink(missing_ok=True)
                compatibility.rmdir()
            if os.name == "nt":
                stream.seek(0)
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream, fcntl.LOCK_UN)


def command(args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, timeout=kwargs.pop("timeout", 60), **kwargs)


def inspect(name):
    return json.loads(command(["docker", "inspect", name]).stdout)[0]


def environment(info):
    return dict(item.split("=", 1) for item in info["Config"]["Env"] if "=" in item)


def configure(path, db_name, redis_name, network, site, port, *, db_schema="codexsun_frappe",
              cache_db=10, queue_db=11, entry_network=None, db_password=None,
              redis_password=None, admin_password=None):
    if path.exists():
        raise ValueError("Private environment already exists. Refusing to replace credentials.")
    db, redis = inspect(db_name), inspect(redis_name)
    for info in (db, redis):
        if network not in info["NetworkSettings"]["Networks"]:
            raise ValueError("Both shared services must already belong to the selected network.")
    db_password = db_password if db_password is not None else environment(db).get("MARIADB_ROOT_PASSWORD")
    redis_password = redis_password if redis_password is not None else environment(redis).get("REDIS_PASSWORD")
    if not db_password or redis_password is None:
        raise ValueError("Cannot discover shared credentials. Use setup.py to enter them privately.")
    auth = ":" + quote(redis_password, safe="") + "@" if redis_password else ""
    base = "redis://" + auth + redis_name + ":6379/"
    settings = {
        "CODEXSUN_FRAPPE_SITE": site, "CODEXSUN_FRAPPE_PORT": str(port),
        "CODEXSUN_FRAPPE_NETWORK": network,
        "CODEXSUN_FRAPPE_DB_HOST": db_name, "CODEXSUN_FRAPPE_DB_PORT": "3306",
        "CODEXSUN_FRAPPE_DB_NAME": db_schema,
        "CODEXSUN_FRAPPE_DB_PASSWORD": db_password,
        "CODEXSUN_FRAPPE_REDIS_HOST": redis_name,
        "CODEXSUN_FRAPPE_REDIS_CACHE": base + str(cache_db),
        "CODEXSUN_FRAPPE_REDIS_QUEUE": base + str(queue_db),
        "CODEXSUN_FRAPPE_ADMIN_PASSWORD": admin_password or secrets.token_urlsafe(30),
    }
    selected = json.loads(command(["docker", "network", "inspect", network]).stdout)[0]
    if entry_network:
        if json.loads(command(["docker", "network", "inspect", entry_network]).stdout)[0]["Internal"]:
            raise ValueError("Select an existing non-internal entry network.")
        settings["CODEXSUN_FRAPPE_ENTRY_NETWORK"] = entry_network
    elif selected["Internal"]:
        candidates = [name for name in db["NetworkSettings"]["Networks"] if name != network
                      and not json.loads(command(["docker", "network", "inspect", name]).stdout)[0]["Internal"]]
        if len(candidates) != 1:
            raise ValueError("The internal network needs one existing host-accessible database network for published ports.")
        settings["CODEXSUN_FRAPPE_ENTRY_NETWORK"] = candidates[0]
    write_settings(path, settings)
    print("Created private frappe.env using retained infrastructure. No credentials printed.")


class Infrastructure:
    def __init__(self, settings):
        self.settings = settings
        self.db = settings["CODEXSUN_FRAPPE_DB_HOST"]
        self.redis = settings["CODEXSUN_FRAPPE_REDIS_HOST"]

    def redis_command(self, *args):
        url = urlparse(self.settings["CODEXSUN_FRAPPE_REDIS_QUEUE"])
        password = unquote(url.password or "")
        user = ["--user", unquote(url.username)] if url.username else []
        return command(["docker", "exec", "-i", self.redis, "sh", "-ec",
                        'IFS= read -r REDISCLI_AUTH; if [ -n "$REDISCLI_AUTH" ]; then export REDISCLI_AUTH; '
                        'else unset REDISCLI_AUTH; fi; exec redis-cli "$@"',
                        "codexsun-frappe", *user, *args], input=(password + "\n").encode(), timeout=300).stdout.decode().strip()

    def sql(self, sql):
        return command(["docker", "exec", "-i", self.db, "sh", "-ec",
                        'IFS= read -r MYSQL_PWD; export MYSQL_PWD; exec mariadb --no-defaults -uroot '
                        '--protocol=tcp -h127.0.0.1 -P "$1" -N -B', "codexsun-frappe",
                        self.settings.get("CODEXSUN_FRAPPE_DB_PORT", "3306")],
                       input=(self.settings["CODEXSUN_FRAPPE_DB_PASSWORD"] + "\n" + sql).encode()).stdout.decode().strip()

    def preflight(self):
        validate_settings(self.settings)
        network = self.settings["CODEXSUN_FRAPPE_NETWORK"]
        selected = json.loads(command(["docker", "network", "inspect", network]).stdout)[0]
        entry = self.settings.get("CODEXSUN_FRAPPE_ENTRY_NETWORK")
        if selected["Internal"] and not entry:
            raise ValueError("Set CODEXSUN_FRAPPE_ENTRY_NETWORK to an existing non-internal network for host access.")
        if entry and json.loads(command(["docker", "network", "inspect", entry]).stdout)[0]["Internal"]:
            raise ValueError("The entry network must allow host access.")
        for name in (self.db, self.redis):
            info = inspect(name)
            if not info["State"].get("Running") or info["State"].get("Health", {}).get("Status", "healthy") != "healthy":
                raise ValueError(f"Shared service {name} is not healthy.")
            if network not in info["NetworkSettings"]["Networks"]:
                raise ValueError(f"Shared service {name} is outside the selected network.")
            destination = "/var/lib/mysql" if name == self.db else "/data"
            if not any(mount["Type"] in ("volume", "bind") and mount["Destination"] == destination for mount in info["Mounts"]):
                raise ValueError(f"Shared service {name} has no persistent storage.")
        version = self.sql("SELECT VERSION();")
        match = re.match(r"(\d+)\.(\d+)", version)
        if "MariaDB" not in version or not match or tuple(map(int, match.groups())) < (11, 8):
            raise ValueError("ERPNext v16 requires retained MariaDB 11.8 or later. This installer will not upgrade shared infrastructure.")
        db_name = self.settings["CODEXSUN_FRAPPE_DB_NAME"]
        if not re.fullmatch(r"codexsun_[a-z0-9_]+", db_name):
            raise ValueError("Use a new codexsun_ database name.")
        if self.sql(f"SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{db_name}';"):
            raise ValueError("Frappe database already exists. Refusing adoption or replacement.")
        urls = [urlparse(self.settings[key]) for key in
                ("CODEXSUN_FRAPPE_REDIS_CACHE", "CODEXSUN_FRAPPE_REDIS_QUEUE")]
        if any(url.scheme != "redis" or url.hostname != self.redis or url.port != 6379 for url in urls):
            raise ValueError("Both Redis URLs must use the selected shared Redis service on port 6379.")
        indexes = [url.path.lstrip("/") for url in urls]
        if len(set(indexes)) != 2 or any(not index.isdigit() or int(index) == 0 for index in indexes):
            raise ValueError("Reserve two distinct nonzero Redis databases.")
        if self.redis_command("PING") != "PONG":
            raise ValueError("Shared Redis authentication or connectivity failed.")
        version = re.search(r"redis_version:(\d+)\.", self.redis_command("INFO", "server"))
        if not version or int(version.group(1)) < 6:
            raise ValueError("The retained Redis server must be version 6 or later.")
        maximum = int(self.redis_command("--raw", "CONFIG", "GET", "databases").splitlines()[-1])
        for index in indexes:
            if int(index) >= maximum:
                raise ValueError(f"Redis database {index} is outside this server's configured database range.")
            if self.redis_command("-n", index, "DBSIZE") != "0":
                raise ValueError(f"Redis database {index} already contains data.")
        names = command(["docker", "ps", "-aq"]).stdout.decode().split()
        for name in names:
            info = inspect(name)
            for value in environment(info).values():
                if value.startswith(("redis://", "rediss://")):
                    parsed = urlparse(value)
                    configured_index = parsed.path.lstrip("/") or "0"
                    if parsed.hostname == self.redis and configured_index.isdigit() and str(int(configured_index)) in indexes:
                        raise ValueError("A requested Redis database is configured by another service.")
        policy = self.redis_command("--raw", "CONFIG", "GET", "maxmemory-policy").splitlines()[-1]
        if policy != "noeviction":
            raise ValueError("Shared Redis must use noeviction to preserve job queues.")
        print("Shared infrastructure preflight passed. New database and Redis databases are unused.")

    def backup(self, root):
        from backup import Backup
        return Backup(self).create(root)
