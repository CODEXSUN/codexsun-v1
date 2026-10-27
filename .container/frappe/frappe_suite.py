"""Build and install the optional Frappe suite without replacing shared infrastructure."""

from datetime import datetime, timezone
import hashlib
from http.cookiejar import CookieJar
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import urllib.parse
import urllib.request

from infrastructure import inspect
from suite_catalog import APPS, repository
from verify import LocalRedirect


class SuiteSetup:
    def __init__(self, owner, args):
        self.owner, self.args = owner, args
        self.installer = owner.installer
        self.record = self.installer.load_record()
        self.site = owner.site

    def run(self):
        state = self.owner.site_state()
        installed = set(state["apps"])
        if set(APPS).issubset(installed):
            self.verify()
            print("The complete Frappe suite is already installed. No upgrade was attempted.")
            return
        if installed.intersection(APPS):
            raise ValueError("A partial suite installation exists. Review its backup and logs before recovery.")
        if state["maintenance"]:
            raise ValueError("Review the existing maintenance operation before installing the suite.")
        current = inspect("codexsun-frappe")
        if current["Config"]["Image"] != self.record["image"]:
            raise ValueError("The running image differs from the deployment record.")
        shared = {name: inspect(name) for name in self.record["shared_container_ids"]}
        with tempfile.TemporaryDirectory(prefix="codexsun-frappe-suite-") as folder:
            image, revisions = self.build(Path(folder), current["Image"])
        self.check_unchanged(current, state, shared)
        image_info = json.loads(self.installer.run(["docker", "image", "inspect", image], True).stdout)[0]
        self.record["suite_setup"] = {"revisions": revisions, "previous_image": self.record["image"],
                                      "image": image, "image_id": image_info["Id"], "previous_apps": state["apps"],
                                      "started_at": datetime.now(timezone.utc).isoformat()}
        self.installer.save(self.record, "suite-image-built")
        self.install(image)
        try:
            self.verify()
        except BaseException:
            self.owner.bench("set-maintenance-mode", "on")
            self.installer.save(self.record, "suite-needs-review")
            raise
        for name, before in shared.items():
            after = inspect(name)
            if before["Id"] != after["Id"] or before["Mounts"] != after["Mounts"]:
                self.installer.save(self.record, "suite-needs-review")
                raise ValueError("Shared infrastructure changed: " + name)
        print("PASS: all five requested apps and the Telephony dependency are installed.")

    def check_unchanged(self, original, state, shared):
        current = inspect("codexsun-frappe")
        if current["Id"] != original["Id"] or current["Image"] != original["Image"] or current["Mounts"] != original["Mounts"]:
            raise ValueError("Frappe changed during image preparation. Review before installing.")
        if current["State"].get("Health", {}).get("Status") != "healthy":
            raise ValueError("Frappe became unhealthy during image preparation.")
        latest = self.owner.site_state()
        if set(latest["apps"]) != set(state["apps"]) or latest["maintenance"]:
            raise ValueError("The installed apps or maintenance state changed during image preparation.")
        for name, original in shared.items():
            current = inspect(name)
            if current["Id"] != original["Id"] or current["Mounts"] != original["Mounts"]:
                raise ValueError("Shared infrastructure changed during image preparation: " + name)

    def build(self, folder, base_id):
        revisions = {}
        for name, definition in APPS.items():
            ref = getattr(self.args, name + "_ref", None) or definition["ref"]
            if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]*", ref) or ".." in ref:
                raise ValueError("Invalid suite repository ref: " + ref)
            destination = folder / name
            if self.args.suite_source:
                source = Path(self.args.suite_source).resolve() / name
                head = self.installer.run(["git", "-C", str(source), "rev-parse", "HEAD"], True).stdout.strip()
                selected = self.installer.run(["git", "-C", str(source), "rev-parse", ref + "^{commit}"], True).stdout.strip()
                if head != selected or self.installer.run(["git", "-C", str(source), "status", "--porcelain"], True).stdout.strip():
                    raise ValueError("Suite source is dirty or differs from the selected ref: " + name)
                shutil.copytree(source, destination, ignore=shutil.ignore_patterns(".git", "node_modules", "__pycache__"))
                revisions[name] = head
            else:
                self.installer.run(["git", "clone", "--no-checkout", "--filter=blob:none", repository(name), str(destination)])
                self.installer.run(["git", "-C", str(destination), "fetch", "--depth", "1", "origin", ref])
                self.installer.run(["git", "-C", str(destination), "checkout", "--detach", "FETCH_HEAD"])
                self.installer.run(["git", "-C", str(destination), "submodule", "update", "--init", "--recursive", "--depth", "1"])
                revisions[name] = self.installer.run(["git", "-C", str(destination), "rev-parse", "HEAD"], True).stdout.strip()
            print(name + " revision: " + revisions[name], flush=True)
        recipe = Path(__file__).with_name("Dockerfile.suite").read_bytes()
        compatibility = Path(__file__).with_name("suite_compat.py").read_bytes()
        digest = hashlib.sha256((base_id + json.dumps(revisions, sort_keys=True)).encode() + recipe + compatibility).hexdigest()[:12]
        image = "codexsun/frappe:" + self.record["release"] + "-suite-" + digest
        (folder / "Dockerfile").write_bytes(recipe)
        (folder / "suite_compat.py").write_bytes(compatibility)
        (folder / ".dockerignore").write_text("**/.git\n**/node_modules\n**/__pycache__\n")
        base = "codexsun/frappe:suite-base-" + base_id.split(":")[-1][:12]
        self.installer.run(["docker", "tag", base_id, base])
        self.installer.run(["docker", "build", "--build-arg", "CODEXSUN_FRAPPE_SUITE_BASE=" + base,
                            "--tag", image, str(folder)])
        return image, revisions

    def install(self, image):
        self.owner.bench("set-maintenance-mode", "on")
        try:
            self.owner.exec("supervisorctl", "-c", "/opt/codexsun/supervisord.conf", "stop", "scheduler", "queue-short", "queue-long")
            self.owner.bench("backup", "--with-files")
            backup = self.installer.root / "backups" / ("suite-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
            backup.mkdir(parents=True, exist_ok=False)
            self.installer.run(["docker", "cp", "codexsun-frappe:/home/frappe/frappe-bench/sites/" + self.site + "/private/backups/.", str(backup)])
            self.verify_backup(backup)
            self.record["suite_setup"]["backup"] = str(backup)
            self.installer.save(self.record, "suite-backed-up")
            self.installer.run(self.installer.compose + ["stop", "--timeout", "150", "frappe"])
            self.record["image"] = image
            self.installer.environment["CODEXSUN_FRAPPE_IMAGE"] = image
            self.installer.save(self.record, "suite-installing")
            self.installer.run(self.installer.compose + ["run", "--rm", "--no-deps", "-T", "frappe",
                                                        "python", "-c", bootstrap(), self.site, json.dumps(list(APPS))])
            self.installer.run(self.installer.compose + ["up", "-d", "--no-deps", "--no-build", "--wait", "--wait-timeout", "360", "frappe"])
        except BaseException:
            self.installer.save(self.record, "suite-needs-review")
            print("Suite installation stopped. Preserve the backup, image, and volumes for review.", flush=True)
            raise

    def verify(self):
        expected_image = self.record.get("suite_setup", {}).get("image_id")
        if expected_image and inspect("codexsun-frappe")["Image"] != expected_image:
            raise ValueError("The running suite image identity differs from the deployment record.")
        self.installer.verify()
        self.record = self.installer.load_record()
        installed = set(self.owner.site_state()["apps"])
        if not set(APPS).issubset(installed):
            raise ValueError("The site is missing a suite app.")
        if not set(self.record["suite_setup"]["previous_apps"]).issubset(installed):
            raise ValueError("An existing app disappeared from the site.")
        origin = "http://127.0.0.1:" + self.installer.settings.get("CODEXSUN_FRAPPE_PORT", "8088")
        client = urllib.request.build_opener(LocalRedirect(origin), urllib.request.HTTPCookieProcessor(CookieJar()))
        credentials = urllib.parse.urlencode({"usr": "Administrator", "pwd": self.installer.settings["CODEXSUN_FRAPPE_ADMIN_PASSWORD"]}).encode()
        with client.open(origin + "/api/method/login", credentials, timeout=60) as response:
            if json.load(response).get("message") != "Logged In":
                raise ValueError("Suite verification login failed.")
        checked = {}
        for name, definition in APPS.items():
            if definition.get("route"):
                with client.open(origin + definition["route"], timeout=60) as response:
                    html = response.read().decode()
                assets = re.findall(r'(?:src|href)=[\"\'](/assets/[^\"\'?]+)', html)
                own_assets = [path for path in assets if path.startswith("/assets/" + name + "/")]
                if not own_assets:
                    raise ValueError("No compiled frontend assets on the app route: " + name)
                for path in own_assets:
                    with client.open(origin + path, timeout=30) as response:
                        if response.status != 200:
                            raise ValueError("Suite asset failed: " + path)
            # Metadata also covers Single DocTypes without exposing business records.
            url = origin + "/api/resource/DocType/" + urllib.parse.quote(definition["doctype"])
            with client.open(url, timeout=30) as response:
                if json.load(response).get("data", {}).get("name") != definition["doctype"]:
                    raise ValueError("Suite DocType is missing: " + name)
            checked[name] = "passed"
            print("PASS: " + name + " installed, route/assets and DocType verified.", flush=True)
        self.record["suite_setup"].update(verification=checked, verified_at=datetime.now(timezone.utc).isoformat())
        self.installer.save(self.record, "suite-verified")

    @staticmethod
    def verify_backup(folder):
        import gzip
        import tarfile

        files = list(folder.iterdir())
        if not any(path.name.endswith("-database.sql.gz") for path in files) or len(list(folder.glob("*.tar"))) < 2:
            raise ValueError("The suite backup is incomplete.")
        manifest = {}
        for path in files:
            if path.name.endswith(".sql.gz"):
                with gzip.open(path, "rb") as stream:
                    while stream.read(1024 * 1024):
                        pass
            elif path.suffix == ".tar":
                with tarfile.open(path) as archive:
                    archive.getmembers()
            elif path.suffix == ".json":
                json.loads(path.read_text())
            manifest[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
        (folder / "suite-checksums.json").write_text(json.dumps(manifest, indent=2) + "\n")


def bootstrap():
    return r'''import pathlib,subprocess,sys,json
apps=json.loads(sys.argv[2])
subprocess.run(['cp','-a','/home/frappe/suite-assets/.','sites/assets/'],check=True)
p=pathlib.Path('sites/apps.txt')
p.write_text('\n'.join(dict.fromkeys(p.read_text().split()+apps))+'\n')
for app in apps:
 subprocess.run(['bench','--site',sys.argv[1],'install-app',app],check=True)
subprocess.run(['bench','--site',sys.argv[1],'migrate'],check=True)
subprocess.run(['bench','--site',sys.argv[1],'clear-cache'],check=True)
subprocess.run(['bench','--site',sys.argv[1],'set-maintenance-mode','off'],check=True)
'''
