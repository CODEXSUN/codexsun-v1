"""Promote already-tested local images. No source fetch, build, pull, or database command."""
import argparse
from contextlib import contextmanager
import json
import os
import subprocess
import sys
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from promotion import PromotionError, PromotionPolicy, SERVICES, require


class ImagePromotion:
    def __init__(self, policy):
        self.policy = policy

    def inspect(self):
        p = self.policy
        for name, digest in p.images.items():
            image = json.loads(self.docker("image", "inspect", digest))[0]
            require(digest in image.get("RepoDigests", []), "Exact tested image is unavailable locally")
            labels = image.get("Config", {}).get("Labels") or {}
            for key in ["version", "revision"]:
                require(labels.get("org.opencontainers.image." + key) == p.record["source"][key],
                        "Local image labels differ from reviewed source")
        names = self.docker("ps", "-a", "--format", "{{.Names}}").splitlines()
        self.current = {}
        for name in sorted(SERVICES & set(names)):
            item = json.loads(self.docker("inspect", name))[0]
            labels = item["Config"].get("Labels") or {}
            require(labels.get("com.docker.compose.project") == "codexsun" and
                    labels.get("com.docker.compose.service") == name, "Application ownership mismatch")
            self.current[name] = item
        require(set(p.rollback["services"]) == set(self.current), "Rollback inventory differs from actual application set")
        for name, item in self.current.items():
            require(item["Image"] == p.rollback["services"][name]["image"], "Rollback image differs from current image")
            recorded = p.adoption.get("containers", {}).get(name, {})
            require(recorded.get("id") == item["Id"], "Container changed after adoption review")
            mounts = sorted((m["Type"], m.get("Name"), m["Destination"], m["RW"]) for m in item["Mounts"])
            planned = sorted((m["type"], p.model["volumes"][m["source"]].get("name", m["source"]),
                              m["target"], not m.get("read_only", False))
                             for m in p.model["services"][name].get("volumes", []))
            require(mounts == planned, "Promotion would change an existing application mount")
            existing_env = dict(v.split("=", 1) for v in item["Config"].get("Env", []) if "=" in v)
            planned_env = p.model["services"][name].get("environment", {})
            for key in ["DB_HOST", "DB_PORT", "DB_MASTER_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET",
                        "AUTH_COOKIE_SECURE", "CODEXSUN_REDIS_URL", "CODEXSUN_TENANCY_MODE"]:
                if key in existing_env:
                    require(existing_env[key] == planned_env.get(key, "").replace("$$", "$"),
                            "Existing identity/data configuration would change")
        return self

    def apply(self):
        with self.lock():
            self.policy.validate()
            self.inspect()
            self.check_quiescence()
            system = self.docker("info", "--format", "{{.OperatingSystem}}").strip()
            require(system and "docker desktop" not in system.lower(), "Production promotion rejects Docker Desktop")
            self.check_private_inputs()
            self.compose("production", "config", "--quiet")
            self.compose("rollback", "config", "--quiet")
            self.save_status("promoting")
            try:
                self.compose("production", "up", "-d", "--no-build", "--pull", "never",
                             "--wait", "--wait-timeout", "180", *sorted(SERVICES))
                self.verify()
                self.save_status("promoted")
            except (OSError, ValueError, subprocess.SubprocessError):
                try:
                    self.recover()
                except (OSError, ValueError, subprocess.SubprocessError):
                    self.save_status("rollback-failed")
                    raise ValueError("Application recovery requires operator intervention")
                self.save_status("application-rolled-back")
                raise ValueError("Promotion failed; previous application configuration restored. Database changes are not reversed.")

    def save_status(self, status):
        path = self.policy.path.parent / "promotion-status.json"
        payload = {"status": status, "source": self.policy.record["source"], "images": self.policy.images,
                   "at": datetime.now(timezone.utc).isoformat(), "databaseRollback": False}
        with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, prefix=".promotion-", delete=False) as stream:
            json.dump(payload, stream, indent=2)
            temporary = stream.name
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)

    @contextmanager
    def lock(self):
        require(sys.platform == "linux", "Promotion requires the audited Linux VPS")
        import fcntl
        with open("/tmp/codexsun-v1-deployment.lock", "a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            yield

    def check_private_inputs(self):
        if os.name != "posix":
            return
        files = [self.policy.path] + [self.policy.reference_path(name) for name in [
            "staging", "migrations", "adoption", "recovery", "production", "rollback"]]
        for path in files:
            mode = path.stat()
            require(mode.st_uid == os.geteuid() and not mode.st_mode & 0o077,
                    "Promotion inputs must belong to the operator with private permissions")

    def check_quiescence(self):
        stopped = self.policy.recovery.get("quiescedContainers", {})
        require(set(stopped) == set(self.current), "Final backup must bind the exact quiesced application set")
        for name, item in self.current.items():
            require(not item["State"]["Running"], "Application writers must be gracefully quiesced before promotion")
            require(stopped[name].get("id") == item["Id"] and
                    stopped[name].get("finishedAt") == item["State"]["FinishedAt"],
                    "Application writer state changed after the final backup")

    def verify(self):
        for name, digest in self.policy.images.items():
            item = json.loads(self.docker("inspect", name))[0]
            image = json.loads(self.docker("image", "inspect", digest))[0]
            require(item["Image"] == image["Id"], "Running image differs from tested image")
            require(item["State"].get("Health", {}).get("Status") == "healthy", "Promoted service is not healthy")
        self.docker("exec", "codexsun-api", "node", "-e",
                    "fetch('http://127.0.0.1:'+process.env.PLATFORM_API_PORT+'/ready').then(r=>process.exit(r.ok?0:1))")
        for name, path in [("codexsun-web", "/api/app/ready"), ("codexsun-shop", "/health")]:
            self.docker("exec", name, "wget", "-qO", "/dev/null", "http://127.0.0.1" + path)

    def recover(self):
        self.policy.read_reference(self.policy.record["rollback"])
        previous = self.policy.rollback["services"]
        existing = set(self.docker("ps", "-a", "--format", "{{.Names}}").splitlines()) & SERVICES
        for name in sorted(existing):
            item = json.loads(self.docker("inspect", name))[0]
            labels = item["Config"].get("Labels") or {}
            require(labels.get("com.docker.compose.project") == "codexsun" and
                    labels.get("com.docker.compose.service") == name, "Rollback ownership changed")
            require(item["Config"].get("StopSignal", "").upper() not in ["SIGKILL", "KILL", "9"],
                    "Unsafe image stop signal; manual recovery required")
            if item["State"]["Running"]:
                self.docker("stop", "--timeout", "-1", name, timeout=90)
            require(not json.loads(self.docker("inspect", name))[0]["State"]["Running"],
                    "Writer did not stop gracefully; manual recovery required")
            if name not in previous:
                self.docker("rm", name)
        self.policy.read_reference(self.policy.record["rollback"])
        self.compose("rollback", "create", "--no-build", "--pull", "never", *sorted(previous))
        running = [name for name, service in previous.items() if service.get("x-codexsun-running") is True]
        if running:
            self.compose("rollback", "up", "-d", "--no-deps", "--no-build", "--pull", "never",
                         "--wait", "--wait-timeout", "180", *sorted(running))

    def compose(self, name, *args):
        self.policy.read_reference(self.policy.record[name])
        return self.docker("compose", "-p", "codexsun", "-f", str(self.policy.reference_path(name)), *args)

    def docker(self, *args, timeout=240):
        result = subprocess.run(["docker", *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                text=True, timeout=timeout, check=False)
        require(result.returncode == 0, "Docker operation failed; inspect restricted operator logs")
        return result.stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--expected-revision", required=True)
    parser.add_argument("--expected-operator-revision")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        if args.apply:
            verify_operator_checkout(args.expected_operator_revision)
        policy = PromotionPolicy(args.manifest, args.expected_revision).validate()
        runtime = ImagePromotion(policy).inspect()
        if args.apply:
            runtime.apply()
        print(json.dumps({"status": "promoted" if args.apply else "inputs-checked", "source": policy.record["source"],
                          "limit": "External browser acceptance and database recovery remain separate."}))
        return 0
    except PromotionError as error:
        print("Promotion blocked: " + str(error), file=sys.stderr)
        return 78
    except (OSError, ValueError, KeyError, TypeError, EOFError, tarfile.TarError, subprocess.SubprocessError):
        print("Promotion blocked or failed. Check release evidence, images, ownership, recovery, and quiescence. No database rollback is implied.", file=sys.stderr)
        return 78


def verify_operator_checkout(expected):
    import re
    require(isinstance(expected, str) and re.fullmatch(r"[a-f0-9]{40}", expected),
            "Apply requires the reviewed published operator commit")
    root = Path(__file__).resolve().parents[2]
    def git(*args):
        return subprocess.check_output(["git", "-C", str(root), *args], text=True, timeout=15).strip()
    require(git("rev-parse", "HEAD") == expected, "Operator source differs from the reviewed commit")
    require(not git("status", "--porcelain", "--untracked-files=normal"), "Operator checkout is dirty")


if __name__ == "__main__":
    sys.exit(main())
