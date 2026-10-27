#!/usr/bin/env python3
"""Initialize one new site using retained MariaDB and isolated Redis databases."""

import json
import os
from pathlib import Path
import re
import subprocess
import sys


def bench(*args):
    subprocess.run(["bench", *args], check=True)


def initialize():
    settings = json.loads(sys.stdin.read())
    site = settings["CODEXSUN_FRAPPE_SITE"]
    if len(site) > 253 or not re.fullmatch(r"[a-z0-9]+(?:[.-][a-z0-9]+)*", site):
        raise ValueError("Invalid site hostname")
    if Path("sites", site).exists():
        raise ValueError("Site already exists. Refusing recreation.")
    Path("sites/apps.txt").write_text("\n".join(sorted(p.name for p in Path("apps").iterdir()
                                                        if p.is_dir())) + "\n")
    config = {"db_host": settings["CODEXSUN_FRAPPE_DB_HOST"],
              "db_port": int(settings.get("CODEXSUN_FRAPPE_DB_PORT", "3306")),
              "redis_cache": settings["CODEXSUN_FRAPPE_REDIS_CACHE"],
              "redis_queue": settings["CODEXSUN_FRAPPE_REDIS_QUEUE"],
              "redis_socketio": settings["CODEXSUN_FRAPPE_REDIS_QUEUE"],
              "socketio_port": 9000,
              "webserver_host": "127.0.0.1",
              "webserver_port": 8000,
              "chromium_path": "/usr/lib/chromium/chromium-headless-shell"}
    Path("sites/common_site_config.json").write_text(json.dumps(config, indent=2) + "\n")
    os.chmod("sites/common_site_config.json", 0o600)
    bench("new-site", site, "--db-host", config["db_host"], "--db-port", str(config["db_port"]),
          "--db-name", settings["CODEXSUN_FRAPPE_DB_NAME"],
          "--db-root-username", "root", "--db-root-password", settings["CODEXSUN_FRAPPE_DB_PASSWORD"],
          "--admin-password", settings["CODEXSUN_FRAPPE_ADMIN_PASSWORD"],
          "--mariadb-user-host-login-scope", "%", "--install-app", "erpnext", "--set-default")
    bench("--site", site, "enable-scheduler")
    bench("--site", site, "list-apps")


if __name__ == "__main__":
    try:
        initialize()
    except subprocess.CalledProcessError:
        print("Bench initialization failed. Existing data was preserved.", file=sys.stderr)
        sys.exit(1)
    except (ValueError, KeyError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
