#!/usr/bin/env python3
"""Install pinned LogicX apps into this installer's existing Frappe Docker site."""

import argparse
from datetime import datetime, timezone
import hashlib
from http.cookiejar import CookieJar
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request

from execution import Transcript
from infrastructure import deployment_lock, inspect
from install import Installer
from configuration import secrets
from verify import LocalRedirect


APPS = {"logicx_app": "https://github.com/CODEXSUN/logicx-app.git",
        "logicx_biz": "https://github.com/CODEXSUN/logicx-biz.git"}
BENCH = "/home/frappe/frappe-bench"


class AppSetup:
    def __init__(self, args):
        self.args = args
        self.installer = Installer(args.env_file)
        self.installer.validate()
        self.record = self.installer.load_record()
        self.site = self.installer.settings["CODEXSUN_FRAPPE_SITE"]

    def run(self):
        installer = self.installer
        info = inspect("codexsun-frappe")
        if info["Config"]["Image"] != self.record["image"]:
            raise ValueError("Running image differs from deployment.private.json. Review before installing.")
        if info["State"].get("Health", {}).get("Status") != "healthy":
            raise ValueError("The existing Frappe container must be healthy.")
        if (info["Config"].get("Labels") or {}).get("com.docker.compose.project") != "codexsun-frappe":
            raise ValueError("Unexpected container ownership.")
        state = self.site_state()
        if not {"frappe", "erpnext"}.issubset(state["apps"]) or not state["employee"]:
            raise ValueError("ERPNext and its Employee DocType are required before installing LogicX Biz.")
        if set(APPS).issubset(state["apps"]):
            self.verify()
            self.record["app_setup"]["verified_at"] = datetime.now(timezone.utc).isoformat()
            installer.save(self.record, "apps-verified")
            print("Both LogicX apps are already installed. No upgrade was attempted.")
            return
        if set(APPS).intersection(state["apps"]):
            raise ValueError("A partial LogicX installation exists. Review its backup and logs before recovery.")
        if state["maintenance"]:
            raise ValueError("The site is already in maintenance mode. Review it before installation.")
        installer.verify()
        shared = {name: inspect(name) for name in self.record["shared_container_ids"]}
        with tempfile.TemporaryDirectory(prefix="codexsun-logicx-") as folder:
            image, revisions = self.build(Path(folder), info["Image"])
        self.record.update(app_setup={"revisions": revisions, "previous_image": self.record["image"],
                                      "image": image, "started_at": datetime.now(timezone.utc).isoformat()})
        installer.save(self.record, "apps-image-built")
        self.install(image)
        try:
            self.verify()
        except BaseException:
            self.bench("set-maintenance-mode", "on")
            installer.save(self.record, "apps-needs-review")
            raise
        for name, before in shared.items():
            after = inspect(name)
            if before["Id"] != after["Id"] or before["Mounts"] != after["Mounts"]:
                raise ValueError("Shared infrastructure changed during installation: " + name)
        self.record["app_setup"]["verified_at"] = datetime.now(timezone.utc).isoformat()
        installer.save(self.record, "apps-verified")
        print("LogicX installation passed. Site: http://localhost:" + installer.settings.get("CODEXSUN_FRAPPE_PORT", "8088"))

    def build(self, folder, base_id):
        revisions = {}
        for name, url in APPS.items():
            ref = getattr(self.args, name + "_ref")
            if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]*", ref) or ".." in ref:
                raise ValueError("Invalid repository ref: " + ref)
            destination = folder / name
            self.installer.run(["git", "clone", "--no-checkout", "--filter=blob:none", url, str(destination)])
            self.installer.run(["git", "-C", str(destination), "fetch", "origin", ref])
            self.installer.run(["git", "-C", str(destination), "checkout", "--detach", "FETCH_HEAD"])
            revisions[name] = self.installer.run(["git", "-C", str(destination), "rev-parse", "HEAD"], True).stdout.strip()
            print(name + " revision: " + revisions[name])
        recipe = Path(__file__).with_name("Dockerfile.apps").read_bytes() + Path(__file__).with_name("logicx_compat.py").read_bytes()
        digest = hashlib.sha256((base_id + json.dumps(revisions, sort_keys=True)).encode() + recipe).hexdigest()[:12]
        image = "codexsun/frappe:" + self.record["release"] + "-logicx-" + digest
        shutil.copyfile(Path(__file__).with_name("Dockerfile.apps"), folder / "Dockerfile")
        shutil.copyfile(Path(__file__).with_name("logicx_compat.py"), folder / "logicx_compat.py")
        # Use an immutable local alias. Docker build resolves the source without registry credentials.
        base = "codexsun/frappe:logicx-base-" + base_id.split(":")[-1][:12]
        self.installer.run(["docker", "tag", base_id, base])
        self.installer.run(["docker", "build", "--build-arg", "CODEXSUN_FRAPPE_APP_BASE=" + base,
                            "--tag", image, str(folder)])
        return image, revisions

    def install(self, image):
        installer = self.installer
        self.bench("set-maintenance-mode", "on")
        # Maintenance protects the site during backup and schema changes.
        try:
            self.exec("supervisorctl", "-c", "/opt/codexsun/supervisord.conf", "stop",
                      "scheduler", "queue-short", "queue-long")
            self.bench("backup", "--with-files")
            backup = installer.root / "backups" / ("logicx-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
            backup.mkdir(parents=True, exist_ok=False)
            installer.run(["docker", "cp", "codexsun-frappe:" + BENCH + "/sites/" + self.site + "/private/backups/.", str(backup)])
            self.record["app_setup"]["backup"] = str(backup)
            installer.save(self.record, "apps-backed-up")
            installer.run(installer.compose + ["stop", "--timeout", "150", "frappe"])
            installer.environment["CODEXSUN_FRAPPE_IMAGE"] = image
            self.record["image"] = image
            installer.save(self.record, "apps-installing")
            code = r"""import pathlib,subprocess,sys
subprocess.run(['cp','-a','/home/frappe/logicx-assets/.','sites/assets/'],check=True)
p=pathlib.Path('sites/apps.txt')
p.write_text('\n'.join(dict.fromkeys(p.read_text().split()+['logicx_app','logicx_biz']))+'\n')
for app in ('logicx_app','logicx_biz'):
 subprocess.run(['bench','--site',sys.argv[1],'install-app',app],check=True)
subprocess.run(['bench','--site',sys.argv[1],'migrate'],check=True)
subprocess.run(['bench','--site',sys.argv[1],'clear-cache'],check=True)
subprocess.run(['bench','--site',sys.argv[1],'set-maintenance-mode','off'],check=True)
"""
            installer.run(installer.compose + ["run", "--rm", "--no-deps", "-T", "frappe",
                                               "python", "-c", code, self.site])
            installer.run(installer.compose + ["up", "-d", "--no-deps", "--no-build", "--wait",
                                               "--wait-timeout", "360", "frappe"])
            self.bench("set-maintenance-mode", "off")
        except BaseException:
            installer.save(self.record, "apps-needs-review")
            print("Installation stopped. Preserve the backup, image, and volumes. Review maintenance mode before reopening.", file=sys.stderr)
            raise

    def site_state(self):
        code = """import os,frappe,json,sys
os.chdir('sites')
frappe.init(site=sys.argv[1]);frappe.connect()
try:
 sidebar_type='Sidebar' if frappe.db.exists('DocType','Sidebar') else 'Workspace Sidebar'
 print(json.dumps({'apps':frappe.get_installed_apps(),'employee':bool(frappe.db.exists('DocType','Employee')),
                   'maintenance':bool(frappe.conf.maintenance_mode),
                   'sidebars':frappe.get_all(sidebar_type,filters={'app':'logicx_biz','standard':1},pluck='name')}))
finally: frappe.destroy()
"""
        return json.loads(self.exec("env/bin/python", "-c", code, self.site, capture=True).stdout)

    def verify(self):
        state = self.site_state()
        if not set(APPS).issubset(state["apps"]):
            raise ValueError("Both LogicX apps must be installed on the selected site.")
        if not {"LogicX HR", "LogicX ERP", "LogicX Banking"}.issubset(state["sidebars"]):
            raise ValueError("The three curated LogicX Biz sidebars were not installed.")
        self.installer.verify()
        self.record = self.installer.load_record()
        origin = "http://127.0.0.1:" + self.installer.settings.get("CODEXSUN_FRAPPE_PORT", "8088")
        client = urllib.request.build_opener(LocalRedirect(origin), urllib.request.HTTPCookieProcessor(CookieJar()))
        credentials = urllib.parse.urlencode({"usr": "Administrator", "pwd": self.installer.settings["CODEXSUN_FRAPPE_ADMIN_PASSWORD"]}).encode()
        with client.open(origin + "/api/method/login", credentials, timeout=60) as response:
            if json.load(response).get("message") != "Logged In":
                raise ValueError("LogicX verification login failed.")
        with client.open(origin + "/logicx-app", timeout=60) as response:
            html = response.read().decode()
        assets = re.findall(r'(?:src|href)="(/assets/logicx_app/[^"?]+)', html)
        if not assets:
            raise ValueError("The LogicX page has no compiled frontend assets.")
        for path in assets:
            with client.open(origin + path, timeout=30) as response:
                if response.status != 200:
                    raise ValueError("A LogicX frontend asset failed: " + path)
        for doctype in ("LogicX Product", "Workspace Sidebar"):
            with client.open(origin + "/api/resource/" + urllib.parse.quote(doctype) + "?limit_page_length=1", timeout=30) as response:
                if "data" not in json.load(response):
                    raise ValueError("LogicX API verification failed: " + doctype)
        print("PASS: both apps installed, authenticated LogicX page, compiled frontend assets, and DocType APIs.")
        self.record.setdefault("app_setup", {})["verification"] = {
            "installed_apps": state["apps"], "sidebars": state["sidebars"],
            "logicx_page": "passed", "frontend_assets": "passed", "doctype_apis": "passed"}

    def bench(self, *args):
        return self.exec("bench", "--site", self.site, *args)

    def exec(self, *args, capture=False):
        return self.installer.run(["docker", "exec", "-w", BENCH, "codexsun-frappe", *args], capture=capture)


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", default=str(Path(__file__).with_name("frappe.env")))
    parser.add_argument("--logicx-app-ref", default="main", help="Branch, tag, or commit to install")
    parser.add_argument("--logicx-biz-ref", default="main", help="Branch, tag, or commit to install")
    parser.add_argument("--with-suite", action="store_true", help="Also install HRMS, Raven, CRM, Helpdesk, Insights and Telephony")
    parser.add_argument("--suite-source", help="Optional clean local source checkouts at the selected refs")
    from suite_catalog import APPS as SUITE_APPS
    for name in SUITE_APPS:
        parser.add_argument("--" + name + "-ref", help="Override the reviewed suite ref")
    args = parser.parse_args()
    setup = AppSetup(args)
    transcript = Transcript(setup.installer.root, secrets(setup.installer.settings))
    setup.installer.transcript = transcript
    try:
        with deployment_lock(setup.installer.root):
            setup.run()
            if args.with_suite:
                from frappe_suite import SuiteSetup
                SuiteSetup(setup, args).run()
    finally:
        transcript.close()


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        sys.exit("LogicX setup failed: " + str(error))
