#!/usr/bin/env python3
"""Guided manual installation. No AI service, npm packages, or repository tools required."""

import argparse
import getpass
import json
from pathlib import Path
import subprocess
import sys

if sys.version_info < (3, 11):
    sys.exit("Python 3.11 or later is required.")

from infrastructure import command, configure, environment, inspect


def choose(label, choices):
    if not choices:
        raise ValueError(f"No {label} found. Prepare the existing infrastructure before running setup.")
    print(f"\n{label}:")
    for number, value in enumerate(choices, 1):
        print(f"  {number}. {value}")
    answer = input("Choose a number" + (" [1]" if len(choices) == 1 else "") + ": ").strip()
    if not answer and len(choices) == 1:
        return choices[0]
    if not answer.isdigit() or not 1 <= int(answer) <= len(choices):
        raise ValueError("Choose one of the displayed numbers. No settings were written.")
    return choices[int(answer) - 1]


def ask(label, default):
    return input(f"{label} [{default}]: ").strip() or str(default)


def configure_interactively(path):
    command(["docker", "info"])
    command(["docker", "compose", "version"])
    ids = command(["docker", "ps", "-q"]).stdout.decode().split()
    containers = [inspect(identifier) for identifier in ids]
    def candidates(term):
        matched = [info["Name"].lstrip("/") for info in containers
                   if term in (info["Name"] + " " + info["Config"]["Image"]).lower()]
        return matched or [info["Name"].lstrip("/") for info in containers]
    db_name = choose("Running MariaDB containers", candidates("mariadb"))
    redis_name = choose("Running Redis containers", candidates("redis"))
    if db_name == redis_name:
        raise ValueError("MariaDB and Redis must be different existing containers.")
    db, redis = inspect(db_name), inspect(redis_name)
    common = sorted(set(db["NetworkSettings"]["Networks"]) & set(redis["NetworkSettings"]["Networks"]))
    network = choose("Existing networks shared by both services", common)
    selected = json.loads(command(["docker", "network", "inspect", network]).stdout)[0]
    entry = None
    if selected["Internal"]:
        names = command(["docker", "network", "ls", "--filter", "driver=bridge", "--format", "{{.Name}}"]).stdout.decode().splitlines()
        entries = [name for name in names if name != "bridge"
                   and not json.loads(command(["docker", "network", "inspect", name]).stdout)[0]["Internal"]]
        entry = choose("Existing host-accessible entry networks", entries)
    site = ask("Site hostname", "erp.codexsun.localhost")
    port = int(ask("Free loopback web port", "8088"))
    schema = ask("New database name", "codexsun_frappe")
    cache = int(ask("Reserved, unused Redis cache database", "10"))
    queue = int(ask("Reserved, unused Redis queue database", "11"))
    db_password = environment(db).get("MARIADB_ROOT_PASSWORD")
    redis_password = environment(redis).get("REDIS_PASSWORD")
    if not db_password:
        db_password = getpass.getpass("Existing MariaDB root password: ")
    if redis_password is None:
        redis_password = getpass.getpass("Existing Redis password (blank for an unauthenticated server): ")
    admin = getpass.getpass("New Administrator password (blank generates a strong password): ")
    if admin and admin != getpass.getpass("Confirm Administrator password: "):
        raise ValueError("Administrator passwords do not match. No settings were written.")
    configure(path, db_name, redis_name, network, site, port, db_schema=schema,
              cache_db=cache, queue_db=queue, entry_network=entry,
              db_password=db_password, redis_password=redis_password, admin_password=admin)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", default=str(Path(__file__).with_name("frappe.env")))
    parser.add_argument("--configure-only", action="store_true", help="Write private settings without installing")
    args = parser.parse_args()
    path = Path(args.env_file).resolve()
    try:
        if path.exists():
            print("Private configuration already exists. It will not be overwritten.")
            if args.configure_only:
                return 0
            if input("Continue with these settings for a fresh installation? [y/N] ").strip().lower() != "y":
                return 0
        else:
            configure_interactively(path)
        if args.configure_only:
            print("Configuration complete. Run install.py --check, then install.py to deploy.")
            return 0
        result = subprocess.run([sys.executable, str(Path(__file__).with_name("install.py")),
                                 "--env-file", str(path)], check=False)
        return result.returncode
    except (Exception, KeyboardInterrupt) as error:
        print("Setup stopped: " + ("interrupted" if isinstance(error, KeyboardInterrupt) else str(error)), file=sys.stderr)
        print("No existing service was removed. Review settings and use install.py --status before retrying.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
