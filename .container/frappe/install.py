#!/usr/bin/env python3
"""Manual, fresh ERPNext v16 installation using retained Docker infrastructure."""

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import urllib.request

if sys.version_info < (3, 11):
    sys.exit("Python 3.11 or later is required.")

from configuration import read_settings, secrets, validate_settings
from execution import Runner, Transcript
from infrastructure import Infrastructure, configure, deployment_lock, inspect


def latest_release():
    stable = []
    for page in range(1, 11):
        request = urllib.request.Request(
            f"https://api.github.com/repos/frappe/erpnext/releases?per_page=100&page={page}",
            headers={"User-Agent": "codexsun-frappe-installer", "Accept": "application/vnd.github+json"})
        with urllib.request.urlopen(request, timeout=30) as response:
            releases = json.load(response)
        stable += [release["tag_name"] for release in releases
                   if not release["draft"] and not release["prerelease"]
                   and re.fullmatch(r"v16\.\d+\.\d+", release["tag_name"])]
        if stable or len(releases) < 100:
            break
    else:
        raise ValueError("Release listing exceeded ten pages. Review the GitHub release list before deploying.")
    if not stable:
        raise ValueError("No stable ERPNext v16 release was found. No older major will be used.")
    return max(stable, key=lambda tag: tuple(map(int, tag[1:].split("."))))


class Installer:
    def __init__(self, env_file):
        self.root = Path(__file__).resolve().parent
        self.env_file = Path(env_file).resolve()
        self.settings = read_settings(self.env_file) if self.env_file.is_file() else {}
        self.environment = {key: value for key, value in os.environ.items()
                            if not key.startswith(("CODEXSUN_FRAPPE_", "COMPOSE_"))}
        self.environment.update(self.settings)
        self.environment.update(CODEXSUN_FRAPPE_BASE_IMAGE="frappe/erpnext:unresolved",
                                CODEXSUN_FRAPPE_IMAGE="codexsun/frappe:unresolved")
        self.record_path = self.root / "deployment.private.json"
        self.compose = ["docker", "compose", "--project-name", "codexsun-frappe",
                        "--env-file", str(self.root / "compose.env"),
                        "-f", str(self.root / "docker-compose.yml")]
        if self.settings.get("CODEXSUN_FRAPPE_ENTRY_NETWORK"):
            self.compose += ["-f", str(self.root / "docker-compose.entry.yml")]
        self.transcript = None

    def run(self, args, capture=False, input=None, timeout=7200):
        return Runner(self.root, self.environment, self.transcript).run(args, capture, input, timeout)

    def emit(self, message):
        (self.transcript.write if self.transcript else print)(message)

    def load_record(self):
        record = json.loads(self.record_path.read_text())
        if record.get("site") != self.settings.get("CODEXSUN_FRAPPE_SITE"):
            raise ValueError("Deployment metadata belongs to another site. Do not copy private metadata between machines.")
        if not re.fullmatch(r"codexsun/frappe:v16\.\d+\.\d+(?:-(?:logicx|suite)-[a-f0-9]{12})?", record.get("image", "")):
            raise ValueError("Invalid recorded image. Inspect deployment.private.json before continuing.")
        if not re.fullmatch(r"frappe/erpnext@sha256:[a-f0-9]{64}", record.get("base_image", "")):
            raise ValueError("Invalid recorded upstream image digest.")
        self.environment.update(CODEXSUN_FRAPPE_BASE_IMAGE=record["base_image"],
                                CODEXSUN_FRAPPE_IMAGE=record["image"])
        return record

    def validate(self):
        if not self.env_file.is_file():
            raise ValueError("Run setup.py or configure frappe.env before installation.")
        validate_settings(self.settings, existing=self.record_path.is_file())
        model = json.loads(self.run(self.compose + ["config", "--format", "json"], True, timeout=60).stdout)
        if set(model["services"]) != {"frappe"}:
            raise ValueError("Only the Frappe container may be declared.")
        if not all(network.get("external") for network in model["networks"].values()):
            raise ValueError("All networks must already exist and be external.")
        return self.settings

    def guard_fresh(self):
        for resource, fields in (("container", "{{.Names}}"), ("volume", "{{.Name}}")):
            args = ["docker", resource, "ls"] + (["--all"] if resource == "container" else [])
            names = self.run(args + ["--format", fields], True, timeout=60).stdout.splitlines()
            if any(name == "codexsun-frappe" or name.startswith(("codexsun-frappe-", "codexsun-frappe_"))
                   for name in names):
                raise ValueError("Existing Frappe resources found. Refusing replacement. Use --status or --verify.")

    def preflight(self):
        self.validate()
        self.run(["docker", "info"], True, timeout=60)
        engine = self.run(["docker", "info", "--format", "{{.OSType}}"], True, timeout=60).stdout.strip()
        if engine != "linux":
            raise ValueError("Select a Linux-container Docker Engine before installation.")
        version = self.run(["docker", "compose", "version", "--short"], True, timeout=60).stdout.strip().lstrip("v")
        match = re.match(r"(\d+)\.(\d+)", version)
        if not match or tuple(map(int, match.groups())) < (2, 20):
            raise ValueError("Docker Compose 2.20 or later is required for the health-gated installer.")
        self.guard_fresh()
        Infrastructure(self.settings).preflight()
        with socket.socket() as listener:
            try:
                listener.bind(("127.0.0.1", int(self.settings.get("CODEXSUN_FRAPPE_PORT", "8088"))))
            except OSError:
                raise ValueError("The configured host port is unavailable. Select another CODEXSUN_FRAPPE_PORT.") from None

    def save(self, record, phase):
        record.update(phase=phase, updated_at=datetime.now(timezone.utc).isoformat())
        temporary = self.record_path.with_suffix(".json.partial")
        temporary.write_text(json.dumps(record, indent=2) + "\n")
        os.chmod(temporary, 0o600)
        temporary.replace(self.record_path)

    def install(self, assume_yes=False):
        self.preflight()
        tag = latest_release()
        self.emit(f"Latest stable ERPNext v16: {tag}")
        if not assume_yes and input(f"Deploy ERPNext {tag} using the retained services? [y/N] ").strip().lower() != "y":
            self.emit("Installation canceled.")
            return
        lock = self.root / ".install.lock"
        try:
            lock.mkdir()
        except FileExistsError:
            raise ValueError("An installation lock exists. Inspect --status and logs before manual recovery.") from None
        record = {"release": tag, "site": self.settings["CODEXSUN_FRAPPE_SITE"]}
        try:
            self.preflight()
            infrastructure = Infrastructure(self.settings)
            baseline = {name: inspect(name) for name in (infrastructure.db, infrastructure.redis)}
            self.emit("Backing up the retained services. Existing applications remain online.")
            record["backup"] = infrastructure.backup(self.root)
            self.emit("Backup manifest verified: " + record["backup"])
            self.run(["docker", "pull", "frappe/erpnext:" + tag])
            base = json.loads(self.run(["docker", "image", "inspect", "frappe/erpnext:" + tag], True).stdout)[0]
            digest = next(value for value in base["RepoDigests"] if value.startswith("frappe/erpnext@sha256:"))
            self.environment.update(CODEXSUN_FRAPPE_BASE_IMAGE=digest, CODEXSUN_FRAPPE_IMAGE="codexsun/frappe:" + tag)
            record.update(base_image=digest, image="codexsun/frappe:" + tag,
                          shared_container_ids={name: info["Id"] for name, info in baseline.items()},
                          network=self.settings["CODEXSUN_FRAPPE_NETWORK"],
                          entry_network=self.settings.get("CODEXSUN_FRAPPE_ENTRY_NETWORK"),
                          log=str(self.transcript.path) if self.transcript else None)
            self.save(record, "backup-verified")
            self.run(self.compose + ["build", "frappe"])
            infrastructure.preflight()
            self.guard_fresh()
            self.save(record, "initializing")
            initialize = self.compose + ["-f", str(self.root / "docker-compose.init.yml"),
                                        "run", "--rm", "--no-deps", "-T", "--name", "codexsun-frappe-init",
                                        "frappe", "python", "/opt/codexsun/init_frappe.py"]
            self.emit("Creating the site. Full DocType installation can take 30 minutes or longer on slow storage.")
            self.run(initialize, input=json.dumps(self.settings))
            self.save(record, "starting")
            self.run(self.compose + ["up", "-d", "--no-build", "--wait", "--wait-timeout", "360", "frappe"])
            for name, before in baseline.items():
                after = inspect(name)
                if before["Id"] != after["Id"] or before["Mounts"] != after["Mounts"]:
                    raise ValueError(f"Shared service {name} changed identity or storage.")
            record.update(installed_at=datetime.now(timezone.utc).isoformat())
            self.save(record, "installed")
            self.verify()
            self.emit("Installation complete. Open the local URL and finish company setup in your browser.")
        except BaseException:
            if "base_image" in record:
                self.save(record, "needs-review")
            raise
        finally:
            lock.rmdir()

    def verify(self):
        from verify import verify
        self.validate()
        record = self.load_record()
        result = verify(self.settings, record=record, run=self.run)
        verification = record.get("verification", {})
        verification.update(result)
        record.update(verification=verification, verified_at=datetime.now(timezone.utc).isoformat())
        self.save(record, "verified")
        self.emit("Verification passed: ERPNext, queues, websocket, authenticated session, and Desk.")

    def status(self):
        names = ["codexsun-frappe", "codexsun-frappe-init",
                 self.settings.get("CODEXSUN_FRAPPE_DB_HOST"), self.settings.get("CODEXSUN_FRAPPE_REDIS_HOST")]
        existing = self.run(["docker", "ps", "-a", "--format", "{{.Names}}"], True, timeout=60).stdout.splitlines()
        for name in filter(None, names):
            if name not in existing:
                self.emit(f"{name}: absent")
                continue
            info = inspect(name)
            self.emit(f"{name}: {info['State']['Status']}, health={info['State'].get('Health', {}).get('Status', 'not configured')}")
        if self.record_path.exists():
            record = json.loads(self.record_path.read_text())
            self.emit("Recorded phase: " + record.get("phase", "legacy installation"))
        self.emit("Private logs: " + str(self.root / "logs"))


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", default=str(Path(__file__).with_name("frappe.env")))
    modes = parser.add_mutually_exclusive_group()
    for flag, help_text in (("check", "Validate configuration only"), ("preflight", "Read-only fresh-install preflight"),
                            ("verify", "Check installed processes, queues, and Administrator login"),
                            ("latest", "Print the latest stable v16 release"), ("status", "Show installation and service status"),
                            ("logs", "Show the last 100 Frappe log lines"), ("show-login", "Print the saved Administrator login"),
                            ("configure-from-docker", "Create settings from explicitly selected retained services")):
        modes.add_argument("--" + flag, action="store_true", help=help_text)
    modes.add_argument("--verify-backup", metavar="FOLDER", help="Verify an existing snapshot manifest without restoring")
    parser.add_argument("--yes", action="store_true", help="Accept the resolved release without an interactive prompt")
    for flag in ("db-container", "redis-container", "network", "entry-network"):
        parser.add_argument("--" + flag)
    parser.add_argument("--site", default="erp.codexsun.localhost")
    parser.add_argument("--port", type=int, default=8088)
    parser.add_argument("--db-name", default="codexsun_frappe")
    parser.add_argument("--cache-db", type=int, default=10)
    parser.add_argument("--queue-db", type=int, default=11)
    return parser.parse_args()


def main():
    args = arguments()
    installer = transcript = None
    try:
        if args.latest:
            print(latest_release())
            return 0
        if args.verify_backup:
            from backup import verify_backup
            verify_backup(args.verify_backup)
            print("Backup checksums, gzip data, and RDB header passed. Restore was not performed.")
            return 0
        installer = Installer(args.env_file)
        if args.show_login:
            validate_settings(installer.settings, existing=installer.record_path.is_file())
            print("URL: http://localhost:" + installer.settings.get("CODEXSUN_FRAPPE_PORT", "8088"))
            print("Username: Administrator\nPassword: " + installer.settings["CODEXSUN_FRAPPE_ADMIN_PASSWORD"])
            return 0
        transcript = Transcript(installer.root, secrets(installer.settings))
        installer.transcript = transcript
        transcript.write("Private operation log: " + str(transcript.path))
        if args.configure_from_docker:
            if not all((args.db_container, args.redis_container, args.network)):
                raise ValueError("Supply --db-container, --redis-container, and --network. Or run setup.py.")
            configure(installer.env_file, args.db_container, args.redis_container, args.network, args.site, args.port,
                      db_schema=args.db_name, cache_db=args.cache_db, queue_db=args.queue_db, entry_network=args.entry_network)
        elif args.check:
            installer.validate()
            transcript.write("Configuration passed. No containers started.")
        elif args.preflight:
            installer.preflight()
            transcript.write("Fresh-install preflight passed. No services changed.")
        elif args.status:
            installer.status()
        elif args.logs:
            installer.run(["docker", "logs", "--tail", "100", "codexsun-frappe"])
        elif args.verify:
            installer.verify()
        else:
            with deployment_lock(installer.root):
                installer.install(args.yes)
    except (Exception, KeyboardInterrupt) as error:
        if isinstance(error, subprocess.CalledProcessError):
            message = f"Command failed (exit {error.returncode})."
            if error.stderr:
                detail = error.stderr.decode(errors="replace") if isinstance(error.stderr, bytes) else error.stderr
                message += " " + detail[-3000:]
        elif isinstance(error, KeyboardInterrupt):
            message = "Interrupted. Docker work may remain active."
        else:
            message = str(error)
        message += " Existing resources were retained. Use --status and the private log before retrying."
        if transcript:
            transcript.write("ERROR: " + message)
        else:
            print(message, file=sys.stderr)
        return 1
    finally:
        if transcript:
            transcript.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
