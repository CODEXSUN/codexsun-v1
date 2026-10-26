"""Synthetic local evidence only. No Docker, network, Git writes, or database access."""
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
OWNER = ROOT / ".container/codexsun-v1"
SPEC = importlib.util.spec_from_file_location("preparation", OWNER / "prepare.py")
PREPARATION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PREPARATION)


class PreparationTests(unittest.TestCase):
    def setUp(self):
        output = ROOT / "dist/deployment-tests"
        output.mkdir(parents=True, exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(dir=output, prefix="preparation-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.manifest = json.loads((OWNER / "candidate.sample.json").read_text())
        self.revision = self.manifest["source"]["revision"]
        (self.root / "package.json").write_text('{"version":"1.1.69"}')
        self.env = (OWNER / "staging.env.sample").read_text().replace(
            "change_this_isolated_staging_password", "synthetic-password"
        ).replace("change_this_isolated_staging_secret", "synthetic-secret").replace(
            "CODEXSUN_MIGRATION_COMPATIBLE_VERSION=", "CODEXSUN_MIGRATION_COMPATIBLE_VERSION=1.1.69"
        )

    def checker(self):
        manifest = self.root / "candidate.json"
        manifest.write_text(json.dumps(self.manifest))
        env = self.root / "staging.env"
        env.write_text(self.env)
        return PREPARATION.CandidatePreparation(self.root, manifest, env)

    def git(self, *args):
        return {"rev-parse": self.revision, "status": "", "show": '{"version":"1.1.69"}'}[args[0]]

    def evidence(self, name, data):
        path = self.root / name
        path.write_bytes(data)
        return {"path": name, "sha256": hashlib.sha256(data).hexdigest()}

    def complete_inputs(self):
        for name in self.manifest["evidence"]:
            self.manifest["evidence"][name] = self.evidence(name + ".txt", b"Synthetic review fixture")
        for name, image in self.manifest["services"].items():
            digest = "fixture/" + name + "@sha256:" + "a" * 64
            inspection = [{"RepoDigests": [digest], "Config": {"Labels": {
                "org.opencontainers.image.version": "1.1.69",
                "org.opencontainers.image.revision": self.revision
            }}}]
            image.update(image=digest, inspection=self.evidence(name + ".json", json.dumps(inspection).encode()))

    def test_exact_clean_source(self):
        checker = self.checker()
        with patch.object(checker, "git", side_effect=self.git):
            self.assertEqual(checker.check("source"), [])

    def enable_realtime(self):
        self.manifest["services"].update(worker={"image": None}, chatb={"image": None})
        self.manifest["excludedServices"] = {}
        self.manifest["evidence"]["realtime-queue-routing"] = None
        self.env = self.env.replace("CODEXSUN_REALTIME_ENABLED=0", "CODEXSUN_REALTIME_ENABLED=1").replace(
            "CODEXSUN_WORKER_CONTROL_TOKEN=", "CODEXSUN_WORKER_CONTROL_TOKEN=" + "synthetic-" * 5
        )

    def test_five_service_candidate_requires_all_image_and_routing_evidence(self):
        self.enable_realtime()
        checker = self.checker()
        checker.check_images()
        checker.check_evidence()
        self.assertEqual(sum("immutable repository digest" in error for error in checker.errors), 5)
        self.assertTrue(any("WebSocket routing review" in error for error in checker.errors))

    def test_complete_five_service_synthetic_inputs(self):
        self.enable_realtime()
        self.complete_inputs()
        checker = self.checker()
        with patch.object(checker, "git", side_effect=self.git):
            self.assertEqual(checker.check("staging"), [])

    def test_partial_or_contradictory_realtime_selection_is_rejected(self):
        self.manifest["services"]["worker"] = {"image": None}
        checker = self.checker()
        checker.check_images()
        self.assertTrue(any("both Worker and Chatb" in error for error in checker.errors))
        self.enable_realtime()
        self.manifest["excludedServices"] = {"chatb": "stale exclusion"}
        checker = self.checker()
        checker.check_images()
        self.assertTrue(any("also appear" in error for error in checker.errors))

    def test_realtime_live_upstream_short_token_and_wrong_ports_are_rejected(self):
        self.enable_realtime()
        self.env = self.env.replace("ws://codexsun-staging-api:28010", "ws://codexsun-api:18010").replace(
            "synthetic-" * 5, "short"
        ).replace("CODEXSUN_WORKER_PORT=28040", "CODEXSUN_WORKER_PORT=17040")
        checker = self.checker()
        checker.check_isolation()
        self.assertGreaterEqual(len(checker.errors), 3)
        self.assertFalse(any("short" in error for error in checker.errors))

    def test_dirty_or_different_head_is_not_published_source(self):
        checker = self.checker()
        with patch.object(checker, "git", side_effect=["b" * 40, " M update.sh", '{"version":"1.1.69"}']):
            errors = checker.check("source")
        self.assertTrue(any("HEAD differs" in error for error in errors))
        self.assertTrue(any("Source is dirty" in error for error in errors))

    def test_unbuilt_images_and_missing_reviews_block_staging(self):
        checker = self.checker()
        with patch.object(checker, "git", side_effect=self.git):
            errors = checker.check("staging")
        self.assertEqual(sum("immutable repository digest" in error for error in errors), 3)
        self.assertEqual(sum("missing local evidence" in error for error in errors), 4)

    def test_complete_synthetic_inputs(self):
        self.complete_inputs()
        checker = self.checker()
        with patch.object(checker, "git", side_effect=self.git):
            self.assertEqual(checker.check("staging"), [])

    def test_wrong_image_revision_and_digest_are_rejected(self):
        self.complete_inputs()
        image = self.manifest["services"]["api"]
        data = json.loads((self.root / "api.json").read_text())
        data[0]["Config"]["Labels"]["org.opencontainers.image.revision"] = "b" * 40
        data[0]["RepoDigests"] = []
        image["inspection"] = self.evidence("api.json", json.dumps(data).encode())
        checker = self.checker()
        checker.check_images()
        self.assertTrue(any("OCI revision" in error for error in checker.errors))
        self.assertTrue(any("digest is absent" in error for error in checker.errors))

    def test_corrupt_review_and_absent_image_inspection_are_rejected(self):
        self.complete_inputs()
        (self.root / "isolation.txt").write_text("tampered")
        (self.root / "api.json").unlink()
        checker = self.checker()
        checker.check_evidence()
        checker.check_images()
        self.assertTrue(any("checksum mismatch" in error for error in checker.errors))
        self.assertTrue(any("unavailable" in error for error in checker.errors))

    def test_live_resources_workers_and_unapproved_migrations_are_rejected(self):
        self.env = self.env.replace("codexsun-staging-mariadb", "cxapp-mariadb").replace(
            "codexsun-staging-media", "cxapp-media-data"
        ).replace("MAIL_ENABLED=0", "MAIL_ENABLED=1").replace(
            "CODEXSUN_MIGRATION_COMPATIBLE_VERSION=1.1.69", "CODEXSUN_MIGRATION_COMPATIBLE_VERSION=1.1.9"
        )
        checker = self.checker()
        checker.check_isolation()
        self.assertGreaterEqual(len(checker.errors), 4)
        self.assertFalse(any("synthetic-password" in error for error in checker.errors))


if __name__ == "__main__":
    unittest.main()
