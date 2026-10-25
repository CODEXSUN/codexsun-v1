"""Verify the owned installation before sending Administrator credentials."""

from http.cookiejar import CookieJar
import json
from pathlib import Path
import subprocess
import urllib.parse
import urllib.request

from infrastructure import inspect


class LocalRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, origin):
        self.origin = origin

    def redirect_request(self, request, fp, code, message, headers, new_url):
        if urllib.parse.urlparse(new_url).netloc != urllib.parse.urlparse(self.origin).netloc:
            raise ValueError("Refusing an authentication redirect outside the configured local origin.")
        return super().redirect_request(request, fp, code, message, headers, new_url)


def verify(settings, record=None, run=None):
    def execute(args, capture=False, input=None, timeout=180):
        if run:
            return run(args, capture=capture, input=input, timeout=timeout)
        return subprocess.run(args, check=True, text=True, capture_output=capture, input=input, timeout=timeout)

    info = inspect("codexsun-frappe")
    labels = info["Config"].get("Labels") or {}
    if labels.get("com.docker.compose.project") != "codexsun-frappe":
        raise ValueError("The Frappe container has unexpected ownership.")
    if record and info["Config"]["Image"] != record["image"]:
        raise ValueError("The running image differs from the deployment record.")
    networks = info["NetworkSettings"]["Networks"]
    for network in filter(None, (settings["CODEXSUN_FRAPPE_NETWORK"], settings.get("CODEXSUN_FRAPPE_ENTRY_NETWORK"))):
        if network not in networks:
            raise ValueError("A configured network is missing from the Frappe container.")
    port = settings.get("CODEXSUN_FRAPPE_PORT", "8088")
    published = info["NetworkSettings"].get("Ports", {}).get("8080/tcp") or []
    if not any(binding["HostIp"] == "127.0.0.1" and binding["HostPort"] == port for binding in published):
        raise ValueError("The loopback port is not published. Check the existing entry network before login.")
    if info["State"].get("Health", {}).get("Status") != "healthy":
        raise ValueError("Frappe container is not healthy.")
    execute(["docker", "exec", "codexsun-frappe", "python", "/opt/codexsun/healthcheck.py"])
    execute(["docker", "exec", "codexsun-frappe", "supervisorctl", "-c", "/opt/codexsun/supervisord.conf", "status"])
    apps = execute(["docker", "exec", "codexsun-frappe", "bench", "--site",
                    settings["CODEXSUN_FRAPPE_SITE"], "list-apps", "--format", "json"], capture=True)
    installed = json.loads(apps.stdout).get(settings["CODEXSUN_FRAPPE_SITE"], [])
    if not {"frappe", "erpnext"}.issubset(installed):
        raise ValueError("The selected site does not have both Frappe and ERPNext installed.")
    execute(["docker", "exec", "-i", "codexsun-frappe", "env/bin/python", "-",
             settings["CODEXSUN_FRAPPE_SITE"]], input=Path(__file__).with_name("verify_workers.py").read_text())
    origin = "http://127.0.0.1:" + port
    client = urllib.request.build_opener(LocalRedirect(origin),
                                        urllib.request.HTTPCookieProcessor(CookieJar()))
    with client.open(origin + "/socket.io/?EIO=4&transport=polling", timeout=30) as response:
        packet = response.read().decode()
        if not packet.startswith("0") or "sid" not in json.loads(packet[1:]):
            raise ValueError("Socket.IO handshake failed.")
    credentials = urllib.parse.urlencode({"usr": "Administrator", "pwd": settings["CODEXSUN_FRAPPE_ADMIN_PASSWORD"]}).encode()
    try:
        response = client.open(origin + "/api/method/login", credentials, timeout=60)
    except urllib.error.HTTPError as error:
        raise ValueError("Administrator login failed. If its password changed, update the private file before verification.") from None
    with response:
        if json.load(response).get("message") != "Logged In":
            raise ValueError("Administrator login failed.")
    with client.open(origin + "/api/method/frappe.auth.get_logged_user", timeout=30) as response:
        if json.load(response).get("message") != "Administrator":
            raise ValueError("Authenticated session verification failed.")
    with client.open(origin + "/api/resource/Company?limit_page_length=1", timeout=30) as response:
        if "data" not in json.load(response):
            raise ValueError("ERPNext Company API failed.")
    with client.open(origin + "/desk", timeout=30) as response:
        if response.status != 200:
            raise ValueError("Authenticated Desk failed.")
    for name in (settings["CODEXSUN_FRAPPE_DB_HOST"], settings["CODEXSUN_FRAPPE_REDIS_HOST"]):
        shared = inspect(name)
        if not shared["State"]["Running"] or shared["State"].get("Health", {}).get("Status", "healthy") != "healthy":
            raise ValueError(f"Shared service {name} is unhealthy.")
        if record and shared["Id"] != record["shared_container_ids"].get(name):
            raise ValueError(f"Shared service {name} changed identity. Review it before adoption.")
    print("PASS: six processes, ERPNext installed, both worker queues, Socket.IO, Administrator login, session cookie, Company API, and Desk.")
    print(f"ERPNext URL: {origin}. Use --show-login to read the saved Administrator login.")
    return {"processes": 6, "worker_queues": ["short", "long"], "socket_io": "passed",
            "administrator_api_login": "passed", "erpnext_api": "passed",
            "runtime_container_id": info["Id"]}
