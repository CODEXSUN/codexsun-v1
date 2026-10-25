"""Require every managed process and the Frappe HTTP ping to work."""

import json
import subprocess
import urllib.request


def main():
    status = subprocess.check_output([
        "supervisorctl", "-c", "/opt/codexsun/supervisord.conf", "status"], text=True)
    lines = status.strip().splitlines()
    if len(lines) != 6 or any("RUNNING" not in line for line in lines):
        raise RuntimeError("A required Frappe process is not running")
    with urllib.request.urlopen("http://127.0.0.1:8080/api/method/ping", timeout=5) as response:
        if json.load(response).get("message") != "pong":
            raise RuntimeError("Frappe ping failed")


if __name__ == "__main__":
    main()
