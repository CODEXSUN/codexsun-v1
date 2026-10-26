"""Read-only staging input checks. Never starts Docker or changes a checkout."""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from config import environment


class CandidatePreparation:
    def __init__(self, root, manifest, env_file=None):
        self.root = Path(root).resolve()
        self.path = Path(manifest).resolve()
        self.manifest = json.loads(self.path.read_text(encoding="utf-8-sig"))
        self.env_file = env_file
        self.errors = []

    def check(self, phase):
        self.check_source()
        if phase == "staging":
            self.check_images()
            self.check_isolation()
            self.check_evidence()
        return self.errors

    def check_source(self):
        source = self.manifest["source"]
        revision = source.get("revision", "")
        version = source.get("version", "")
        if not re.fullmatch(r"[a-f0-9]{40}", revision):
            self.errors.append("source.revision requires the full reviewed commit SHA")
            return
        if not re.fullmatch(r"\d+\.\d+\.\d+", version):
            self.errors.append("source.version requires an exact numeric version")
        if self.git("rev-parse", "HEAD") != revision:
            self.errors.append("HEAD differs from source.revision; supervisor must prepare the exact checkout")
        if self.git("status", "--porcelain", "--untracked-files=normal"):
            self.errors.append("Source is dirty; proposed fixes require supervisor review and a distinct commit")
        package = json.loads(self.git("show", revision + ":package.json"))
        if package["version"] != version:
            self.errors.append("Committed package version differs from source.version")
        if json.loads((self.root / "package.json").read_text())["version"] != version:
            self.errors.append("Working package version differs from source.version")

    def check_images(self):
        services = self.manifest.get("services", {})
        base = {"api", "web", "shop"}
        if set(services) not in [{"api", "web"}, base, base | {"worker", "chatb"}]:
            self.errors.append("Select API/Web, API/Web/Shop, or all five services")
        if set(services) == {"api", "web"} and set(self.manifest.get("excludedServices", {})) != {"shop", "worker", "chatb"}:
            self.errors.append("API/Web preparation must record Shop/Worker/Chatb exclusion compatibility")
        if set(services) & set(self.manifest.get("excludedServices", {})):
            self.errors.append("Included services cannot also appear in excludedServices")
        for name, service in services.items():
            digest = service.get("image") or ""
            if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9./:_-]*@sha256:[a-f0-9]{64}", digest):
                self.errors.append(f"{name}: record an immutable repository digest after an authorized build")
                continue
            evidence = self.read_evidence(service.get("inspection"), f"{name} image inspection")
            if evidence is None:
                continue
            images = json.loads(evidence)
            if not isinstance(images, list) or len(images) != 1:
                self.errors.append(f"{name}: inspection must contain exactly one image")
                continue
            labels = images[0].get("Config", {}).get("Labels") or {}
            for key in ["version", "revision"]:
                if labels.get("org.opencontainers.image." + key) != self.manifest["source"][key]:
                    self.errors.append(f"{name}: OCI {key} does not match reviewed source")
            if digest not in images[0].get("RepoDigests", []):
                self.errors.append(f"{name}: requested digest is absent from recorded image inspection")

    def check_isolation(self):
        if not self.env_file:
            self.errors.append("Supply --env with a reviewed staging-only environment")
            return
        values = environment(self.env_file)
        expected = {
            "CODEXSUN_DEPLOY_TARGET": "staging",
            "NODE_ENV": "production",
            "DB_DRIVER": "mariadb",
            "DB_PORT": "3306",
            "CODEXSUN_REALTIME_ENABLED": "1" if self.realtime_selected() else "0",
            "CODEXSUN_DB_FRESH_ON_START": "0",
            "CODEXSUN_ALLOW_PRODUCTION_DB_RESET": "0",
            "CODEXSUN_ALLOW_LIVE_RESTORE": "0",
            "ENABLE_DEFAULT_TENANT_SEED": "0",
            "CODEXSUN_QUEUE_WORKER_ENABLED": "0",
            "MAIL_ENABLED": "0",
        }
        for key, value in expected.items():
            if values.get(key) != value:
                self.errors.append(f"{key}: staging preparation requires {value}")
        resources = ["CODEXSUN_MARIADB_CONTAINER", "CODEXSUN_REDIS_CONTAINER", "CODEXSUN_DATA_VOLUME",
                     "CODEXSUN_MEDIA_DATA_VOLUME", "CODEXSUN_DOCKER_NETWORK", "DB_MASTER_NAME",
                     "CODEXSUN_WORKER_QUEUE_PREFIX"]
        for key in resources:
            if not re.fullmatch(r"codexsun[-_]staging[-_][a-zA-Z0-9_-]+", values.get(key, "")):
                self.errors.append(f"{key}: use a separate codexsun-staging resource")
        if values.get("DB_HOST") != values.get("CODEXSUN_MARIADB_CONTAINER"):
            self.errors.append("DB_HOST must identify the isolated staging database")
        redis_host = values.get("CODEXSUN_REDIS_CONTAINER", "")
        if values.get("CODEXSUN_REDIS_URL") != f"redis://{redis_host}:6379/0":
            self.errors.append("Redis URL must identify the isolated staging Redis")
        if values.get("PLATFORM_WEB_ORIGIN") != "http://127.0.0.1:28020":
            self.errors.append("PLATFORM_WEB_ORIGIN must remain the staging loopback origin")
        for key, port in [("PLATFORM_API_PORT", "28010"), ("PLATFORM_WEB_PORT", "28020"),
                          ("CODEXSUN_SHOP_PORT", "28030")]:
            if values.get(key) != port:
                self.errors.append(f"{key}: use the reserved staging port {port}")
        approval = values.get("CODEXSUN_MIGRATION_COMPATIBLE_VERSION")
        if approval != self.manifest["source"]["version"]:
            self.errors.append("Exact staging migration compatibility review remains required")
        for key in ["DB_PASSWORD", "JWT_SECRET"]:
            if not values.get(key) or values[key].startswith("change_this"):
                self.errors.append(f"{key}: provision an isolated private staging secret")
        if self.realtime_selected():
            self.check_realtime(values)

    def realtime_selected(self):
        return {"worker", "chatb"} <= set(self.manifest.get("services", {}))

    def check_realtime(self, values):
        for key, value in {
            "CODEXSUN_WORKER_PORT": "28040",
            "CODEXSUN_CHATB_PORT": "28031",
            "CODEXSUN_CHATB_UPSTREAM_URL": "ws://codexsun-staging-api:28010",
        }.items():
            if values.get(key) != value:
                self.errors.append(f"{key}: use the isolated staging realtime configuration")
        token = values.get("CODEXSUN_WORKER_CONTROL_TOKEN", "")
        if len(token) < 32 or token.startswith("change_this"):
            self.errors.append("Worker requires a private staging control token of at least 32 characters")

    def check_evidence(self):
        for name in ["isolation", "migration-review", "recovery-rehearsal", "mount-adoption"]:
            self.read_evidence(self.manifest.get("evidence", {}).get(name), name)
        if self.realtime_selected():
            self.read_evidence(self.manifest.get("evidence", {}).get("realtime-queue-routing"),
                               "realtime queue and WebSocket routing review")

    def read_evidence(self, record, name):
        if not isinstance(record, dict) or not record.get("path"):
            self.errors.append(f"{name}: missing local evidence path and SHA-256")
            return None
        expected = record.get("sha256", "")
        if not re.fullmatch(r"[a-f0-9]{64}", expected):
            self.errors.append(f"{name}: missing evidence SHA-256")
            return None
        path = Path(record["path"])
        if not path.is_absolute():
            path = self.path.parent / path
        try:
            data = path.read_bytes()
        except OSError:
            self.errors.append(f"{name}: evidence file is unavailable")
            return None
        if not data or hashlib.sha256(data).hexdigest() != expected:
            self.errors.append(f"{name}: empty evidence or checksum mismatch")
            return None
        return data

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.root), *args], text=True, timeout=15).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--env")
    parser.add_argument("--phase", choices=["source", "staging"], default="source")
    args = parser.parse_args()
    try:
        errors = CandidatePreparation(args.root, args.manifest, args.env).check(args.phase)
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        errors = ["Preparation input or Git evidence is invalid; inspect the local manifest and checkout"]
    print(json.dumps({"phase": args.phase, "ready": not errors, "blockers": errors,
                      "limit": "Local input checks only. No deployment, approval, restore, or live isolation proof."}, indent=2))
    return 78 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
