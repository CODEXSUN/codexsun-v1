"""Check actual Docker ownership and storage before any deployment mutation."""
import json
import sys
from config import environment

APPLICATIONS = {f"codexsun-{name}" for name in ["api", "web", "shop", "worker", "chatb"]}


def name(item):
    return item["Name"].lstrip("/")


def owner(item, project, service):
    labels = item.get("Config", {}).get("Labels") or {}
    return labels.get("com.docker.compose.project") == project and labels.get("com.docker.compose.service") == service


def database(item, configured):
    image = item.get("Config", {}).get("Image", "").lower()
    return name(item) == configured or any(
        mount["Destination"].rstrip("/") == "/var/lib/mysql" for mount in item.get("Mounts", [])
    ) or "mariadb" in image or "mysql" in image


def check(values, items, mode):
    db_name = values["CODEXSUN_MARIADB_CONTAINER"]
    redis_name = values["CODEXSUN_REDIS_CONTAINER"]
    app_volume = values["CODEXSUN_DATA_VOLUME"]
    redis_volume = values.get("REDIS_DATA_VOLUME", "")
    media_volume = values.get("CODEXSUN_MEDIA_DATA_VOLUME", "")
    reserved = {values.get(key) for key in ["MARIADB_DATA_VOLUME", "MARIADB_BACKUP_VOLUME"]} - {None, ""}
    if db_name in APPLICATIONS or redis_name in APPLICATIONS or db_name == redis_name:
        raise ValueError("Database/Redis names must be distinct from application containers and each other")
    if app_volume in reserved or redis_volume in reserved or app_volume == redis_volume:
        raise ValueError("Application, Redis, and MariaDB volumes must remain distinct")
    if media_volume and media_volume in reserved | {app_volume, redis_volume}:
        raise ValueError("Media storage must remain distinct from database/application/Redis storage")
    for item in items:
        is_database = database(item, db_name)
        if is_database and name(item) in APPLICATIONS | {redis_name}:
            raise ValueError("A cleanup/deployment container is a database server and is protected")
        for mount in item.get("Mounts", []):
            if is_database and mount.get("Name") in ({app_volume, redis_volume} | ({media_volume} if media_volume else set())):
                raise ValueError("Application/Redis volume is mounted by a database server and is protected")
            if mount.get("Name") == app_volume and not (name(item) in APPLICATIONS and owner(item, "codexsun", name(item))):
                raise ValueError("Application volume is used by another deployment")
        if mode == "setup":
            if db_name not in {name(entry) for entry in items}:
                if any(mount.get("Name") in reserved for mount in item.get("Mounts", [])):
                    raise ValueError("New MariaDB would reuse a volume attached to an existing container")
            if redis_name not in {name(entry) for entry in items}:
                if any(mount.get("Name") == redis_volume for mount in item.get("Mounts", [])):
                    raise ValueError("New Redis would reuse a volume attached to an existing container")
        if mode == "clean" and name(item) == redis_name and owner(item, "codexsun-redis", "redis"):
            mounts = item.get("Mounts", [])
            if len(mounts) != 1 or mounts[0].get("Name") != redis_volume or mounts[0]["Destination"] != "/data":
                raise ValueError("Owned Redis storage differs from the cleanup volume")


def volume(values, item, role, items):
    if item.get("Options") or item.get("Driver", "local") != "local":
        raise ValueError("Custom storage drivers or bind-backed volumes require reviewed adoption")
    labels = item.get("Labels") or {}
    project = labels.get("com.docker.compose.project", "")
    if "mariadb" in project.lower() or "mysql" in project.lower():
        raise ValueError("Database-owned volume cannot be used for application or Redis storage")
    if role == "volume-media":
        return
    if role == "volume-application":
        proven_mount = any(name(entry) in APPLICATIONS and owner(entry, "codexsun", name(entry)) and
                           any(mount.get("Name") == values["CODEXSUN_DATA_VOLUME"] for mount in entry.get("Mounts", [])) for entry in items)
        if not proven_mount and project != "codexsun" and labels.get("com.codexsun.deployment") != "codexsun-v1":
            raise ValueError("Unowned application volume requires reviewed adoption before use or deletion")
    elif project != "codexsun-redis" and not any(name(entry) == values["CODEXSUN_REDIS_CONTAINER"] and not database(entry, values["CODEXSUN_MARIADB_CONTAINER"]) for entry in items):
        raise ValueError("Unowned Redis volume requires reviewed adoption before use or deletion")


if __name__ == "__main__":
    try:
        values, payload, mode = environment(sys.argv[1]), json.load(sys.stdin), sys.argv[2]
        if mode.startswith("volume-"):
            from pathlib import Path
            volume(values, payload[0], mode, json.loads(Path(sys.argv[3]).read_text()))
        else:
            check(values, payload, mode)
    except (ValueError, KeyError, OSError) as error:
        sys.exit(str(error))
