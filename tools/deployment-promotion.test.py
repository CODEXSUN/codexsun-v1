"""Immutable promotion tests use synthetic receipts and a fake Docker boundary."""
import importlib.util
import json
import hashlib
import gzip
import tempfile
import io
import tarfile
import subprocess
import unittest
from contextlib import nullcontext
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
OWNER = ROOT / ".container/codexsun-v1"
SPEC = importlib.util.spec_from_file_location("promote", OWNER / "promote.py")
PROMOTE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROMOTE)
from promotion import PromotionPolicy, SERVICES


class PromotionTests(unittest.TestCase):
    def setUp(self):
        output = ROOT / "dist/deployment-tests"
        output.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=output, prefix="promotion-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = {"version": "1.1.69", "revision": "a" * 40}
        self.images = {name: "fixture/" + name + "@sha256:" + "b" * 64 for name in SERVICES}
        self.saved_layer = b"Synthetic image layer bytes"
        self.saved_image = json.dumps({"architecture": "amd64", "rootfs": {"type": "layers",
            "diff_ids": ["sha256:" + hashlib.sha256(self.saved_layer).hexdigest()]}}).encode()
        self.saved_image_digest = hashlib.sha256(self.saved_image).hexdigest()
        self.old = {name: {"image": "sha256:" + self.saved_image_digest, "x-codexsun-running": True}
                    for name in SERVICES if name not in ["codexsun-worker", "codexsun-chatb"]}
        self.model = {"name": "codexsun", "services": {name: {
            "container_name": name, "image": digest, "pull_policy": "never", "restart": "unless-stopped"
        } for name, digest in self.images.items()}, "networks": {"runtime": {"external": True}},
            "volumes": {"data": {"external": True}}}
        self.model["services"]["codexsun-api"]["environment"] = {key: "0" for key in [
            "CODEXSUN_DB_FRESH_ON_START", "CODEXSUN_ALLOW_PRODUCTION_DB_RESET", "CODEXSUN_ALLOW_LIVE_RESTORE", "ENABLE_DEFAULT_TENANT_SEED"]}
        self.record = {"source": self.source, "images": self.images,
                       "productionAuthorization": {"source": self.source, "images": self.images}}
        self.data = {
            "production": self.model,
            "rollback": {"services": self.old},
            "staging": {"source": self.source, "images": self.images, "completedAt": self.now(),
                        "checks": {name: True for name in ["startup", "isolation", "authentication",
                            "tenant-isolation", "browser", "worker-queue-ownership", "chatb-websocket", "restart", "rollback"]}},
            "migrations": {"source": self.source, "images": self.images, "compatible": True,
                           "completed": True, "targets": ["master", "techmedia_db", "rainbow_db", "other-db"]},
            "adoption": {"source": self.source, "approved": True, "workerQueueOwnershipVerified": True,
                         "realtimeRoutingVerified": True, "containers": {
                name: {"id": "id-" + name} for name in self.old}},
            "recovery": {"completedAt": self.now(), "newTenantDatabases": ["techmedia_db", "rainbow_db"],
                         "coveredTargets": ["master", "techmedia_db", "rainbow_db", "other-db"],
                         "registryTargetsVerified": True, "restoreRehearsalVerified": True,
                         "quiescedContainers": {name: {"id": "id-" + name, "finishedAt": "stopped"} for name in self.old},
                         "artifacts": {role: self.file(role, b"Synthetic recovery bytes") for role in
                             ["scoped-sql", "scoped-storage", "scoped-media", "configuration", "images", "shared-coverage"]}}
        }
        self.recovery_inputs()
        self.calls = []

    def now(self):
        return datetime.now(timezone.utc).isoformat()

    def file(self, name, data):
        (self.root / name).write_bytes(data)
        return {"path": name, "sha256": hashlib.sha256(data).hexdigest()}

    def archive(self, name, members):
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode="w:gz") as stream:
            for path, data in members.items():
                member = tarfile.TarInfo(path)
                member.size = len(data)
                stream.addfile(member, io.BytesIO(data))
        return self.file(name, buffer.getvalue())

    def recovery_inputs(self):
        artifacts = self.data["recovery"]["artifacts"]
        rows = []
        for database in ["techmedia_db", "rainbow_db"]:
            row = self.file(database + ".sql", ("USE `" + database + "`;\n-- Dump completed on fixture\n").encode())
            row["database"] = database
            rows.append(row)
        artifacts["scoped-sql"] = self.file("sql-index", json.dumps(rows).encode())
        for role in ["scoped-storage", "scoped-media"]:
            archive = self.archive(role + ".tar.gz", {"techmedia/file": b"one", "rainbow/file": b"two"})
            index = {"tenantOwnershipVerified": True, "tenantUuids": ["de870404", "14c8040c"],
                     "allowedPrefixes": ["techmedia", "rainbow"], "archive": archive}
            artifacts[role] = self.file(role + "-index", json.dumps(index).encode())
        artifacts["images"] = self.archive("images.tar.gz", self.image_members())
        shared = {"capturedAt": self.now(), "coveredTargets": self.data["migrations"]["targets"],
                  "restoreVerified": True, "artifacts": [self.file("existing-shared", b"Synthetic existing backup")]}
        artifacts["shared-coverage"] = self.file("shared-index", json.dumps(shared).encode())

    def image_members(self):
        config = "blobs/sha256/" + self.saved_image_digest
        return {config: self.saved_image, "layer.tar": self.saved_layer,
                "manifest.json": json.dumps([{"Config": config, "Layers": ["layer.tar"]}]).encode()}

    def policy(self):
        for name in ["production", "rollback", "staging", "migrations"]:
            self.record[name] = self.file(name, json.dumps(self.data[name]).encode())
        self.data["adoption"]["productionSha256"] = self.record["production"]["sha256"]
        self.data["recovery"]["rollbackSha256"] = self.record["rollback"]["sha256"]
        for name in ["adoption", "recovery"]:
            self.record[name] = self.file(name, json.dumps(self.data[name]).encode())
        path = self.root / "release.json"
        path.write_text(json.dumps(self.record))
        return PromotionPolicy(path, self.source["revision"])

    def test_complete_synthetic_policy(self):
        self.policy().validate()

    def test_two_backups_cannot_cover_wider_migrations(self):
        self.data["recovery"]["coveredTargets"] = ["techmedia_db", "rainbow_db"]
        with self.assertRaisesRegex(ValueError, "all actual migration targets"):
            self.policy().validate()

    def test_no_backup_scope_expansion(self):
        self.data["recovery"]["newTenantDatabases"].append("other-db")
        with self.assertRaisesRegex(ValueError, "only Techmedia and Rainbow"):
            self.policy().validate()

    def test_image_config_without_load_manifest_cannot_establish_recovery(self):
        self.data["recovery"]["artifacts"]["images"] = self.archive("config-only.tar.gz", {
            "blobs/sha256/" + self.saved_image_digest: self.saved_image})
        with self.assertRaisesRegex(ValueError, "Docker save image metadata"):
            self.policy().validate()

    def test_missing_or_corrupt_image_layers_block_recovery(self):
        for payload in [None, b"corrupt layer"]:
            with self.subTest(payload=payload):
                members = self.image_members()
                if payload is None:
                    del members["layer.tar"]
                else:
                    members["layer.tar"] = payload
                self.data["recovery"]["artifacts"]["images"] = self.archive("incomplete-images.tar.gz", members)
                with self.assertRaisesRegex(ValueError, "rollback layer|layer content digest"):
                    self.policy().validate()

    def test_compressed_saved_layers_match_uncompressed_image_identity(self):
        members = self.image_members()
        members["layer.tar"] = gzip.compress(self.saved_layer)
        self.data["recovery"]["artifacts"]["images"] = self.archive("compressed-images.tar.gz", members)
        self.policy().validate()

    def test_wrong_source_mutable_image_and_staging_identity(self):
        policy = self.policy()
        policy.expected_revision = "d" * 40
        with self.assertRaisesRegex(ValueError, "reviewed SHA"):
            policy.validate()
        self.images["codexsun-api"] = "fixture/api:latest"
        with self.assertRaisesRegex(ValueError, "immutable repository digest"):
            self.policy().validate()

    def test_failed_acceptance_or_missing_migration_blocks(self):
        self.data["staging"]["checks"]["chatb-websocket"] = False
        with self.assertRaisesRegex(ValueError, "chatb-websocket"):
            self.policy().validate()
        self.data["staging"]["checks"]["chatb-websocket"] = True
        self.data["migrations"]["completed"] = False
        with self.assertRaisesRegex(ValueError, "incomplete"):
            self.policy().validate()

    def test_stale_and_corrupt_recovery_blocks(self):
        self.data["recovery"]["completedAt"] = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        with self.assertRaisesRegex(ValueError, "stale"):
            self.policy().validate()
        self.data["recovery"]["completedAt"] = self.now()
        (self.root / "sql-index").write_text("tampered")
        with self.assertRaisesRegex(ValueError, "checksum"):
            self.policy().validate()

    def test_scoped_sql_directives_and_archive_boundaries_are_checked(self):
        rows = json.loads((self.root / "sql-index").read_text())
        rows[0].update(self.file("techmedia_db.sql", b"USE `other_db`;\n-- Dump completed\n"))
        self.data["recovery"]["artifacts"]["scoped-sql"] = self.file("sql-index", json.dumps(rows).encode())
        with self.assertRaisesRegex(ValueError, "unexpected database"):
            self.policy().validate()
        self.recovery_inputs()
        index = json.loads((self.root / "scoped-media-index").read_text())
        index["archive"] = self.archive("unsafe.tar.gz", {"unrelated-tenant/file": b"forbidden"})
        self.data["recovery"]["artifacts"]["scoped-media"] = self.file("scoped-media-index", json.dumps(index).encode())
        with self.assertRaisesRegex(ValueError, "exceeds"):
            self.policy().validate()

    def test_model_cannot_build_start_infrastructure_or_bind_publicly(self):
        self.model["services"]["codexsun-api"]["build"] = "."
        with self.assertRaisesRegex(ValueError, "never build"):
            self.policy().validate()
        del self.model["services"]["codexsun-api"]["build"]
        self.model["services"]["codexsun-api"]["ports"] = [{"host_ip": "0.0.0.0"}]
        with self.assertRaisesRegex(ValueError, "loopback"):
            self.policy().validate()

    def test_rollback_cannot_provision_infrastructure_or_load_external_settings(self):
        self.data["rollback"]["volumes"] = {"unowned": {}}
        with self.assertRaisesRegex(ValueError, "Rollback cannot provision"):
            self.policy().validate()
        self.data["rollback"]["volumes"] = {"retained": {"external": True}}
        self.old["codexsun-api"]["env_file"] = "other.env"
        with self.assertRaisesRegex(ValueError, "self-contained"):
            self.policy().validate()

    def test_compose_extensions_and_new_worker_mounts_are_rejected(self):
        self.model["services"]["codexsun-worker"]["extends"] = {"file": "other.yml"}
        with self.assertRaisesRegex(ValueError, "runtime overrides"):
            self.policy().validate()
        del self.model["services"]["codexsun-worker"]["extends"]
        self.model["services"]["codexsun-worker"]["volumes"] = [{"type": "volume", "source": "data"}]
        with self.assertRaisesRegex(ValueError, "cannot acquire"):
            self.policy().validate()

    def test_reset_and_worker_database_credentials_are_rejected(self):
        self.model["services"]["codexsun-api"]["environment"]["CODEXSUN_DB_FRESH_ON_START"] = "1"
        with self.assertRaisesRegex(ValueError, "Unsafe API lifecycle"):
            self.policy().validate()
        self.model["services"]["codexsun-api"]["environment"]["CODEXSUN_DB_FRESH_ON_START"] = "0"
        self.model["services"]["codexsun-worker"]["environment"] = {"DB_PASSWORD": "forbidden"}
        with self.assertRaisesRegex(ValueError, "service boundary"):
            self.policy().validate()

    def test_unresolved_environment_and_ports_are_rejected(self):
        self.model["services"]["codexsun-api"]["environment"]["JWT_SECRET"] = "${HOST_SECRET}"
        with self.assertRaisesRegex(ValueError, "interpolation"):
            self.policy().validate()
        self.model["services"]["codexsun-api"]["environment"]["JWT_SECRET"] = "literal$$secret"
        self.policy().validate()
        self.model["services"]["codexsun-web"]["ports"] = [{"host_ip": "127.0.0.1", "target": 80, "published": "${PORT}"}]
        with self.assertRaisesRegex(ValueError, "numeric"):
            self.policy().validate()

    def docker(self, *args, **kwargs):
        self.calls.append(args)
        if args[0] == "info":
            return "Ubuntu fixture"
        if args[:2] == ("image", "inspect"):
            return json.dumps([{"Id": "sha256:" + "e" * 64, "RepoDigests": [args[2]], "Config": {"Labels": {
                "org.opencontainers.image.version": self.source["version"],
                "org.opencontainers.image.revision": self.source["revision"]}}}])
        if args[:2] == ("ps", "-a"):
            return "\n".join(self.old)
        if args[0] == "inspect":
            name = args[1]
            return json.dumps([{"Id": "id-" + name, "Image": self.old[name]["image"], "Mounts": [],
                "Config": {"Labels": {"com.docker.compose.project": "codexsun", "com.docker.compose.service": name}},
                "State": {"Running": False, "FinishedAt": "stopped"}}])
        return ""

    def test_inspection_and_quiescence_are_read_only(self):
        runtime = PROMOTE.ImagePromotion(self.policy().validate())
        with patch.object(runtime, "docker", side_effect=self.docker):
            runtime.inspect().check_quiescence()
        self.assertTrue(all(call[0] in ["image", "ps", "inspect"] for call in self.calls))

    def test_successful_apply_never_fetches_builds_pulls_or_runs_migrations(self):
        runtime = PROMOTE.ImagePromotion(self.policy().validate())
        with patch.object(runtime, "lock", return_value=nullcontext()), patch.object(
            runtime, "docker", side_effect=self.docker
        ), patch.object(runtime, "verify"):
            runtime.apply()
        command = next(call for call in self.calls if "up" in call)
        self.assertIn("--no-build", command)
        self.assertEqual(command[command.index("--pull") + 1], "never")
        self.assertFalse(any(call[0] in ["build", "pull", "run", "exec"] for call in self.calls))

    def test_failed_replacement_invokes_rollback(self):
        runtime = PROMOTE.ImagePromotion(self.policy().validate())
        with patch.object(runtime, "lock", return_value=nullcontext()), patch.object(
            runtime, "docker", side_effect=self.docker
        ), patch.object(runtime, "verify", side_effect=ValueError("not healthy")), patch.object(runtime, "recover") as recover:
            with self.assertRaisesRegex(ValueError, "configuration restored"):
                runtime.apply()
            recover.assert_called_once()

    def test_operator_checkout_requires_exact_clean_reviewed_commit(self):
        with self.assertRaisesRegex(ValueError, "reviewed published"):
            PROMOTE.verify_operator_checkout(None)
        with patch.object(PROMOTE.subprocess, "check_output", side_effect=["b" * 40]):
            with self.assertRaisesRegex(ValueError, "differs"):
                PROMOTE.verify_operator_checkout("a" * 40)

    def test_writer_restart_and_desktop_block_before_replacement(self):
        runtime = PROMOTE.ImagePromotion(self.policy().validate())
        def running(*args, **kwargs):
            value = self.docker(*args, **kwargs)
            if args[0] == "inspect":
                row = json.loads(value)
                row[0]["State"]["Running"] = True
                return json.dumps(row)
            return value
        with patch.object(runtime, "lock", return_value=nullcontext()), patch.object(runtime, "docker", side_effect=running):
            with self.assertRaisesRegex(ValueError, "quiesced"):
                runtime.apply()
        self.assertFalse(any(call[0] == "compose" for call in self.calls))
        self.calls.clear()
        def desktop(*args, **kwargs):
            return "Docker Desktop" if args[0] == "info" else self.docker(*args, **kwargs)
        with patch.object(runtime, "lock", return_value=nullcontext()), patch.object(runtime, "docker", side_effect=desktop):
            with self.assertRaisesRegex(ValueError, "Docker Desktop"):
                runtime.apply()
        self.assertFalse(any(call[0] == "compose" for call in self.calls))

    def test_graceful_rollback_timeout_never_removes_or_force_kills(self):
        runtime = PROMOTE.ImagePromotion(self.policy().validate())
        def timeout(*args, **kwargs):
            if args[0] == "stop":
                self.calls.append(args)
                raise subprocess.TimeoutExpired(args, 90)
            value = self.docker(*args, **kwargs)
            if args[0] == "inspect":
                row = json.loads(value)
                row[0]["State"]["Running"] = True
                return json.dumps(row)
            return value
        with patch.object(runtime, "docker", side_effect=timeout):
            with self.assertRaises(subprocess.TimeoutExpired):
                runtime.recover()
        self.assertFalse(any(call[0] in ["rm", "kill", "compose"] for call in self.calls))
        with patch.object(PROMOTE.subprocess, "check_output", side_effect=["a" * 40, " M promote.py"]):
            with self.assertRaisesRegex(ValueError, "dirty"):
                PROMOTE.verify_operator_checkout("a" * 40)

    def test_real_recovery_path_removes_only_added_services_and_preserves_stopped_state(self):
        self.old["codexsun-shop"]["x-codexsun-running"] = False
        runtime = PROMOTE.ImagePromotion(self.policy().validate())
        states = {name: {"Config": {"Labels": {"com.docker.compose.project": "codexsun",
                   "com.docker.compose.service": name}}, "State": {"Running": True}} for name in SERVICES}
        def docker(*args, **kwargs):
            self.calls.append(args)
            if args[:2] == ("ps", "-a"):
                return "\n".join(states)
            if args[0] == "inspect":
                return json.dumps([states[args[1]]])
            if args[0] == "stop":
                self.assertEqual(args[1:3], ("--timeout", "-1"))
                self.assertEqual(kwargs["timeout"], 90)
                states[args[-1]]["State"]["Running"] = False
            if args[0] == "rm":
                del states[args[1]]
            return ""
        with patch.object(runtime, "docker", side_effect=docker):
            runtime.recover()
        self.assertEqual(set(states), set(self.old))
        create = next(call for call in self.calls if "create" in call)
        self.assertNotIn("--no-deps", create)
        start = next(call for call in self.calls if "up" in call)
        self.assertNotIn("codexsun-shop", start)
        self.assertIn("codexsun-api", start)
        self.assertIn("--no-deps", start)
        self.assertFalse(any("--force" in call or "--stop" in call for call in self.calls))


if __name__ == "__main__":
    unittest.main()
