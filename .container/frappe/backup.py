"""Online snapshots with private files, bounded commands, and verified manifests."""

from datetime import datetime, timezone
import gzip
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


def verify_backup(folder, manifest=None):
    folder = Path(folder)
    if manifest is None:
        manifest = json.loads((folder / "manifest.json").read_text())
    files = manifest.get("files", manifest)
    if set(files) != {"mariadb.sql.gz", "redis.rdb"}:
        raise ValueError("Backup manifest must contain exactly the database dump and Redis snapshot.")
    for name, digest in files.items():
        path = folder / name
        if path.is_symlink() or not path.is_file():
            raise ValueError("A backup file is missing or is a symbolic link.")
        with path.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != digest:
                raise ValueError("Backup checksum verification failed for " + name)
    with gzip.open(folder / "mariadb.sql.gz", "rb") as stream:
        size = 0
        while chunk := stream.read(1024 * 1024):
            size += len(chunk)
    if size < 100:
        raise ValueError("MariaDB dump is empty.")
    with (folder / "redis.rdb").open("rb") as stream:
        if stream.read(5) != b"REDIS":
            raise ValueError("Redis snapshot has an invalid RDB header.")
    return manifest


class Backup:
    def __init__(self, infrastructure):
        self.infrastructure = infrastructure

    def create(self, root):
        target = Path(root, "backups", "frappe-preinstall-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ"))
        target.mkdir(mode=0o700, parents=True, exist_ok=False)
        estimate = int(self.infrastructure.sql(
            "SELECT COALESCE(SUM(DATA_LENGTH+INDEX_LENGTH),0) FROM information_schema.TABLES;") or "0")
        if shutil.disk_usage(target).free < max(2 * 1024**3, estimate * 3):
            raise ValueError("Insufficient backup disk space. Allow three times database size and at least 2 GiB.")
        settings = self.infrastructure.settings
        args = ["docker", "exec", "-i", self.infrastructure.db, "sh", "-ec",
                'IFS= read -r MYSQL_PWD; export MYSQL_PWD; exec mariadb-dump --no-defaults -uroot '
                '--protocol=tcp -h127.0.0.1 -P "$1" --all-databases --single-transaction '
                '--routines --events --triggers --hex-blob', "codexsun-frappe",
                settings.get("CODEXSUN_FRAPPE_DB_PORT", "3306")]
        # Real files prevent a full stderr pipe from deadlocking the database dump.
        with tempfile.TemporaryFile(dir=target) as raw, tempfile.TemporaryFile(dir=target) as errors:
            try:
                subprocess.run(args, input=(settings["CODEXSUN_FRAPPE_DB_PASSWORD"] + "\n").encode(),
                               stdout=raw, stderr=errors, check=True, timeout=7200)
            except subprocess.CalledProcessError:
                raise RuntimeError("MariaDB backup failed. No new site was created. Check root credentials and dump privileges.") from None
            raw.seek(0)
            with gzip.open(target / "mariadb.sql.gz", "wb") as compressed:
                shutil.copyfileobj(raw, compressed, 1024 * 1024)
        remote = "/tmp/codexsun-frappe-backup-" + target.name + ".rdb"
        self.infrastructure.redis_command("--rdb", remote)
        subprocess.run(["docker", "cp", self.infrastructure.redis + ":" + remote, str(target / "redis.rdb")],
                       check=True, capture_output=True, timeout=300)
        subprocess.run(["docker", "exec", self.infrastructure.redis, "rm", "--", remote],
                       check=True, capture_output=True, timeout=30)
        files = {}
        for name in ("mariadb.sql.gz", "redis.rdb"):
            path = target / name
            os.chmod(path, 0o600)
            with path.open("rb") as stream:
                files[name] = hashlib.file_digest(stream, "sha256").hexdigest()
        manifest = {"format": 2, "files": files, "scope": "online all-database and Redis snapshots",
                    "created_at": datetime.now(timezone.utc).isoformat()}
        verify_backup(target, manifest)
        pending = target / "manifest.json.partial"
        pending.write_text(json.dumps(manifest, indent=2) + "\n")
        pending.replace(target / "manifest.json")
        print(f"Verified database and Redis backups: {target}", flush=True)
        return str(target)
