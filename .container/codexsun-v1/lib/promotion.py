"""Validate immutable release inputs before production mutation."""
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

SERVICES = {"codexsun-" + role for role in ["api", "web", "shop", "worker", "chatb"]}
SCOPED_DATABASES = {"techmedia_db", "rainbow_db"}


class PromotionError(ValueError):
    pass


class PromotionPolicy:
    def __init__(self, manifest, expected_revision):
        self.path = Path(manifest).resolve()
        self.record = json.loads(self.path.read_text(encoding="utf-8-sig"))
        self.expected_revision = expected_revision

    def validate(self):
        source = self.record["source"]
        require(re.fullmatch(r"[a-f0-9]{40}", self.expected_revision), "Supply the full reviewed source SHA")
        require(source["revision"] == self.expected_revision, "Release source differs from reviewed SHA")
        require(re.fullmatch(r"\d+\.\d+\.\d+", source["version"]), "Invalid release version")
        self.images = self.record["images"]
        require(set(self.images) == SERVICES, "Promotion requires the exact five reviewed services")
        for image in self.images.values():
            require(isinstance(image, str) and re.fullmatch(
                r"[a-zA-Z0-9][a-zA-Z0-9./:_-]*@sha256:[a-f0-9]{64}", image
            ), "Every image must use an immutable repository digest")
        self.stage = self.evidence("staging")
        self.migrations = self.evidence("migrations")
        self.adoption = self.evidence("adoption")
        self.recovery = self.evidence("recovery")
        self.model = self.evidence("production")
        self.rollback = self.evidence("rollback")
        self.check_acceptance()
        self.check_recovery()
        self.check_model()
        return self

    def check_acceptance(self):
        for receipt in [self.stage, self.migrations, self.adoption]:
            require(receipt.get("source") == self.record["source"], "Evidence source does not match release")
        require(self.stage.get("images") == self.images, "Staging images differ from promotion images")
        fresh(self.stage["completedAt"], 86400)
        checks = self.stage.get("checks", {})
        for name in ["startup", "isolation", "authentication", "tenant-isolation", "browser",
                     "worker-queue-ownership", "chatb-websocket", "restart", "rollback"]:
            require(checks.get(name) is True, "Missing staging acceptance: " + name)
        require(self.migrations.get("compatible") is True, "Migration compatibility is not established")
        require(self.migrations.get("images") == self.images, "Migration image identities differ")
        require(self.migrations.get("completed") is True, "Approved migration procedure is incomplete")
        require(self.adoption.get("approved") is True, "Mount/configuration adoption is incomplete")
        require(self.adoption.get("workerQueueOwnershipVerified") is True and
                self.adoption.get("realtimeRoutingVerified") is True, "Realtime adoption evidence is incomplete")
        require(self.adoption.get("productionSha256") == self.record["production"]["sha256"],
                "Adoption review does not bind the production model")
        require(self.record.get("productionAuthorization", {}).get("source") == self.record["source"],
                "Production authorization must bind the exact source")
        require(self.record["productionAuthorization"].get("images") == self.images,
                "Production authorization must bind the exact image set")

    def check_recovery(self):
        fresh(self.recovery["completedAt"], 3600)
        require(set(self.recovery.get("newTenantDatabases", [])) == SCOPED_DATABASES,
                "New tenant backups must cover only Techmedia and Rainbow")
        targets = self.migrations.get("targets", [])
        require(targets and "master" in targets, "Migration target evidence must include the master")
        require(set(targets) <= set(self.recovery.get("coveredTargets", [])),
                "Recovery does not cover all actual migration targets")
        require(self.recovery.get("registryTargetsVerified") is True,
                "Actual registry migration targets require verification")
        require(self.recovery.get("restoreRehearsalVerified") is True,
                "Recovery rehearsal is not verified")
        artifacts = self.recovery.get("artifacts", {})
        for role in ["scoped-sql", "scoped-storage", "scoped-media", "configuration", "images", "shared-coverage"]:
            self.verify_reference(artifacts.get(role))
        require(self.recovery.get("rollbackSha256") == self.record["rollback"]["sha256"],
                "Recovery does not bind the rollback model")
        from promotion_recovery import verify_recovery_artifacts
        verify_recovery_artifacts(self)

    def check_model(self):
        require(self.model.get("name") == "codexsun", "Unexpected production Compose project")
        require(set(self.model) <= {"name", "services", "networks", "volumes"}, "Unresolved Compose extensions are prohibited")
        services = self.model.get("services", {})
        require(set(services) == SERVICES, "Production model must contain only the five application services")
        for name, service in services.items():
            require(service.get("image") == self.images[name], "Production image differs from tested image")
            require(service.get("container_name") == name, "Unexpected production container identity")
            require("build" not in service and service.get("pull_policy") == "never",
                    "Production must never build or pull during promotion")
            allowed = {"image", "container_name", "pull_policy", "restart", "ports", "volumes",
                       "environment", "networks", "depends_on", "profiles"}
            require(set(service) <= allowed,
                    "Unreviewed runtime overrides are prohibited")
            if name in ["codexsun-worker", "codexsun-chatb"]:
                require(not service.get("volumes"), "Worker/Chatb cannot acquire application or database mounts")
                allowed_env = {"NODE_ENV", "CODEXSUN_CHATB_PORT", "CODEXSUN_CHATB_UPSTREAM_URL"} if name.endswith("chatb") else {
                    "NODE_ENV", "CODEXSUN_REDIS_URL", "CODEXSUN_WORKER_CONTROL_TOKEN",
                    "CODEXSUN_WORKER_QUEUE_PREFIX", "CODEXSUN_WORKER_PORT"}
                require(set(service.get("environment", {})) <= allowed_env, "Worker/Chatb environment exceeds its service boundary")
            if name == "codexsun-api":
                for key in ["CODEXSUN_DB_FRESH_ON_START", "CODEXSUN_ALLOW_PRODUCTION_DB_RESET",
                            "CODEXSUN_ALLOW_LIVE_RESTORE", "ENABLE_DEFAULT_TENANT_SEED"]:
                    require(service.get("environment", {}).get(key) == "0", "Unsafe API lifecycle flag: " + key)
            require(service.get("restart") == "unless-stopped", "Unexpected restart policy")
            environment = service.get("environment", {})
            require(isinstance(environment, dict) and all(isinstance(v, str) for v in environment.values()),
                    "Use resolved string environment values")
            for value in environment.values():
                require("$" not in value.replace("$$", ""), "Unescaped Compose environment interpolation is prohibited")
            for port in service.get("ports", []):
                require(isinstance(port, dict) and port.get("host_ip") == "127.0.0.1",
                        "Published application ports must bind to loopback")
                require(str(port.get("target", "")).isdigit() and str(port.get("published", "")).isdigit() and
                        1 <= int(port["target"]) <= 65535 and 1 <= int(port["published"]) <= 65535,
                        "Use resolved numeric application ports")
            for mount in service.get("volumes", []):
                require(isinstance(mount, dict) and mount.get("type") == "volume",
                        "Only explicitly reviewed named volumes are supported")
        for section in ["networks", "volumes"]:
            require(self.model.get(section), "Production external resources are required")
            require(all(v.get("external") is True for v in self.model[section].values()),
                    "Promotion cannot provision infrastructure")
        previous = self.rollback.get("services", {})
        require(previous and set(previous) <= SERVICES, "Rollback includes unrelated or missing services")
        require(set(self.rollback) <= {"name", "services", "networks", "volumes"},
                "Rollback Compose extensions are prohibited")
        for section in ["networks", "volumes"]:
            require(all(resource.get("external") is True for resource in self.rollback.get(section, {}).values()),
                    "Rollback cannot provision infrastructure")
        for name, service in previous.items():
            require(service.get("container_name", name) == name, "Rollback container identity differs")
            require(not {"build", "env_file", "extends", "include", "provider", "develop"} & set(service),
                    "Rollback must use captured self-contained runtime settings")
            require(re.fullmatch(r"sha256:[a-f0-9]{64}", service.get("image", "")),
                    "Rollback must retain immutable local image IDs")

    def evidence(self, name):
        return json.loads(self.read_reference(self.record.get(name)))

    def read_reference(self, ref):
        path = self.verify_reference(ref)
        require(path.stat().st_size <= 8 * 1024 * 1024, "JSON evidence exceeds the input limit")
        return path.read_bytes()

    def verify_reference(self, ref):
        require(isinstance(ref, dict), "Missing checksummed release evidence")
        require(re.fullmatch(r"[a-f0-9]{64}", ref.get("sha256", "")), "Missing evidence SHA-256")
        path = Path(ref["path"])
        if not path.is_absolute():
            path = self.path.parent / path
        require(path.stat().st_size > 0, "Empty recovery artifact")
        digest = hashlib.sha256()
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
        require(digest.hexdigest() == ref["sha256"], "Evidence checksum mismatch")
        return path

    def reference_path(self, name):
        path = Path(self.record[name]["path"])
        return path if path.is_absolute() else self.path.parent / path


def require(value, message):
    if not value:
        raise PromotionError(message)


def fresh(value, maximum_age):
    stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(stamp.tzinfo is not None, "Evidence timestamp requires a timezone")
    age = (datetime.now(timezone.utc) - stamp).total_seconds()
    require(0 <= age <= maximum_age, "Evidence is stale or future-dated")
