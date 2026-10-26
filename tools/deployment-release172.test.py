"""Synthetic operator-only tests. No Docker, database, backup capture or restore."""
import importlib.util
import json
import io
import tarfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from contextlib import nullcontext

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("base_promotion_tests", ROOT / "tools/deployment-promotion.test.py")
BASE = importlib.util.module_from_spec(spec)
spec.loader.exec_module(BASE)
import promotion172 as RELEASE


class Release172Tests(unittest.TestCase):
    def setUp(self):
        self.base = BASE.PromotionTests("test_complete_synthetic_policy")
        self.base.setUp()
        self.addCleanup(self.base.doCleanups)
        b = self.base
        self.pins = dict(RELEASE.PINS)
        self.pins["expiresAt"] = self.time(3600)
        self.patch = patch.object(RELEASE, "PINS", self.pins)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.marker = b.root / "exception-used"
        marker_patch = patch.object(RELEASE, "USED", self.marker)
        marker_patch.start()
        self.addCleanup(marker_patch.stop)
        b.source.update(self.pins["source"])
        b.images.clear()
        b.images.update(self.pins["images"])
        for name, image in b.images.items():
            b.model["services"][name]["image"] = image
        self.targets = ["master"] + ["tenant_" + str(i) for i in range(13)]
        b.data["migrations"]["targets"] = self.targets
        b.data["migrations"]["completedAt"] = self.time()
        self.pins["targetsSha256"] = RELEASE.digest(sorted(self.targets))
        self.proof = {"format": "codexsun-local-backup-proof-v1", "completedAt": self.time(-1),
                      "captureStartedAt": self.time(-3), "quiesced": True, "cxappDatabasesExcluded": True,
                      "mariaDbContainerLifecycleChanges": False, "tenantStorage": [],
                      **{key: False for key in RELEASE.FALSE_PROOFS}}
        self.proof["backups"] = [self.artifact("master_db" if i == 0 else self.targets[i], i) for i in range(14)]
        self.proof["configuration"] = self.artifact(None, 14)
        scope = [{"database": r["database"], "uuid": r.get("uuid"), "code": r["code"], "master": r.get("master") is True}
                 for r in sorted(self.proof["backups"], key=lambda row: row["database"])]
        self.pins["backupScopeSha256"] = RELEASE.digest(scope)
        self.local = {"format": "codexsun-release172-local-verification-v1", "source": b.source,
                      "scopeSha256": self.pins["scopeSha256"], "targetsSha256": self.pins["targetsSha256"],
                      "backupScopeSha256": self.pins["backupScopeSha256"], "verifiedAt": self.time(), "scopeCapturedAt": self.time(-1),
                      "captureStartedAt": self.proof["captureStartedAt"], "integrityVerified": True,
                      "restorePerformed": False, "quiescedContainers": {
                          name: {"id": "id-" + name, "finishedAt": self.time(-5)} for name in b.old}}
        self.proof["quiescedContainers"] = self.local["quiescedContainers"]

    def time(self, seconds=0):
        return (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()

    def artifact(self, database, i):
        return {"database": database, "uuid": None if i in [0, 14] else "uuid-" + str(i),
                "code": "tenant-" + str(i), "master": i == 0, "bytes": 50, "sha256": str(i % 10) * 64,
                "encryption": "AES-256-GCM", "completedAt": self.time(-2),
                "identity": {"runId": "fixture", "database": database, "role": "scoped-sql"}}

    def docker(self, *args, **kwargs):
        result = self.base.docker(*args, **kwargs)
        if args[0] == "inspect":
            rows = json.loads(result)
            rows[0]["State"]["FinishedAt"] = self.local["quiescedContainers"][args[1]]["finishedAt"]
            return json.dumps(rows)
        return result

    def policy(self):
        b = self.base
        approval = {"release": self.pins["source"], "images": {k.removeprefix("codexsun-"): v for k, v in self.pins["images"].items()},
                    "proofValuesModified": False, "humanInstruction": "Synthetic approval"}
        b.record["release172Exception"] = b.file("approval", json.dumps(approval).encode())
        self.pins["humanExceptionSha256"] = b.record["release172Exception"]["sha256"]
        self.local["humanExceptionSha256"] = self.pins["humanExceptionSha256"]
        proof_ref = b.file("backup-proof", json.dumps(self.proof).encode())
        self.local["proofSha256"] = proof_ref["sha256"]
        self.local["artifacts"] = [[r["sha256"], r["bytes"], r["identity"]]
                                   for r in self.proof["backups"] + [self.proof["configuration"]] + self.proof["tenantStorage"]]
        local_ref = b.file("local-verification", json.dumps(self.local).encode())
        b.data["recovery"].update({"completedAt": self.proof["completedAt"], "coveredTargets": self.targets,
                                   "localVerification": local_ref, "backupProof": proof_ref,
                                   "quiescedContainers": self.local["quiescedContainers"],
                                   **{key: False for key in RELEASE.FALSE_PROOFS}})
        b.policy()
        for role in ["production", "rollback"]:
            self.pins[role + "Sha256"] = b.record[role]["sha256"]
        for file in b.root.iterdir():
            if file.is_file():
                file.chmod(0o600)
        return RELEASE.Release172PromotionPolicy(b.root / "release.json", b.source["revision"], local_ref["sha256"])

    def test_exact_release_accepts_only_disclosed_false_proofs(self):
        policy = self.policy().validate()
        self.assertTrue(all(value is False for value in policy.exception_status()["proofValues"].values()))
        self.assertFalse(self.marker.exists())

    def test_default_policy_still_rejects_missing_restore_evidence(self):
        self.policy()
        with self.assertRaises(ValueError):
            BASE.PromotionPolicy(self.base.root / "release.json", self.base.source["revision"]).validate()

    def test_future_release_and_changed_images_cannot_use_exception(self):
        self.base.source["version"] = "1.1.73"
        with self.assertRaisesRegex(ValueError, "exact tested"):
            self.policy().validate()

    def test_changed_digest_cannot_use_exception(self):
        self.base.images["codexsun-api"] = "fixture/api@sha256:" + "f" * 64
        self.base.model["services"]["codexsun-api"]["image"] = self.base.images["codexsun-api"]
        with self.assertRaisesRegex(ValueError, "exact tested"):
            self.policy().validate()

    def test_expired_authorization_is_rejected(self):
        self.pins["expiresAt"] = self.time(-1)
        with self.assertRaisesRegex(ValueError, "expired"):
            self.policy().validate()

    def test_stale_capture_cannot_be_relabelled(self):
        self.proof["backups"][0]["completedAt"] = self.time(-7200)
        with self.assertRaisesRegex(ValueError, "stale"):
            self.policy().validate()

    def test_timing_scope_and_real_verification_are_not_waived(self):
        for change, message in [
            (lambda: self.proof.update(quiesced=False), "Protected resource"),
            (lambda: self.proof["backups"].pop(), "master plus 13"),
            (lambda: self.local.update(integrityVerified=False), "integrity verification"),
            (lambda: self.proof.update(captureStartedAt=self.time(-60)), "Capture timing")]:
            with self.subTest(message=message):
                original_proof, original_local = json.loads(json.dumps(self.proof)), json.loads(json.dumps(self.local))
                change()
                with self.assertRaisesRegex(ValueError, message):
                    self.policy().validate()
                self.proof, self.local = original_proof, original_local

    def test_false_proof_cannot_be_claimed_true(self):
        self.proof["restoreRehearsalVerified"] = True
        with self.assertRaisesRegex(ValueError, "actual false"):
            self.policy().validate()

    def test_missing_out_of_band_hash_and_corrupt_proof_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "trusted SHA"):
            RELEASE.Release172PromotionPolicy("unused", "unused", None)

    def test_wrong_out_of_band_hash_is_rejected(self):
        policy = self.policy()
        policy.local_sha = "a" * 64
        with self.assertRaisesRegex(ValueError, "out-of-band"):
            policy.validate()

    def test_changed_identity_and_corrupt_proof_are_rejected(self):
        self.proof["backups"][1]["uuid"] = "foreign-tenant"
        with self.assertRaisesRegex(ValueError, "SQL identities differ"):
            self.policy().validate()
        self.proof["backups"][1]["uuid"] = "uuid-1"
        policy = self.policy()
        (self.base.root / "backup-proof").write_text("tampered")
        with self.assertRaisesRegex(ValueError, "checksum"):
            policy.validate()

    def test_approval_and_models_are_pinned(self):
        policy = self.policy()
        policy.record["release172Exception"]["sha256"] = "a" * 64
        with self.assertRaisesRegex(ValueError, "exact recorded human"):
            policy.validate()
        policy = self.policy()
        self.pins["productionSha256"] = "a" * 64
        with self.assertRaisesRegex(ValueError, "model differs"):
            policy.validate()

    def test_writer_restart_blocks_before_single_use_is_consumed(self):
        runtime = BASE.PROMOTE.ImagePromotion(self.policy().validate())
        def restarted(*args, **kwargs):
            result = self.docker(*args, **kwargs)
            if args[0] == "inspect":
                rows = json.loads(result)
                rows[0]["State"]["Running"] = True
                return json.dumps(rows)
            return result
        with patch.object(runtime, "lock", return_value=nullcontext()), patch.object(runtime, "docker", side_effect=restarted):
            with self.assertRaisesRegex(ValueError, "quiesced"):
                runtime.apply()
        self.assertFalse(self.marker.exists())
        self.assertFalse(any("up" in call for call in self.base.calls))

    def test_unwaived_staging_and_migration_guards_remain(self):
        self.base.data["staging"]["checks"]["authentication"] = False
        with self.assertRaisesRegex(ValueError, "authentication"):
            self.policy().validate()
        self.base.data["staging"]["checks"]["authentication"] = True
        self.base.data["migrations"]["completedAt"] = self.time(-60)
        with self.assertRaisesRegex(ValueError, "must follow"):
            self.policy().validate()

    def test_model_guards_remain_even_with_bound_hash(self):
        self.base.model["services"]["codexsun-worker"]["environment"] = {"DB_PASSWORD": "forbidden"}
        with self.assertRaisesRegex(ValueError, "service boundary"):
            self.policy().validate()

    def test_single_use_under_apply_and_status_preserves_false_values(self):
        runtime = BASE.PROMOTE.ImagePromotion(self.policy().validate())
        with patch.object(runtime, "lock", return_value=nullcontext()), patch.object(runtime, "docker", side_effect=self.docker), patch.object(runtime, "verify"):
            runtime.apply()
            up_count = sum("up" in call for call in self.base.calls)
            with self.assertRaisesRegex(ValueError, "already consumed"):
                runtime.apply()
            self.assertEqual(sum("up" in call for call in self.base.calls), up_count)
        status = json.loads((self.base.root / "promotion-status.json").read_text())
        self.assertTrue(all(value is False for value in status["releaseException"]["proofValues"].values()))

    def test_missing_original_running_state_is_rejected(self):
        del self.base.old["codexsun-shop"]["x-codexsun-running"]
        with self.assertRaisesRegex(ValueError, "original application running state"):
            self.policy().validate()

    def test_failed_verification_restarts_actual_prior_three_without_dependencies(self):
        runtime = BASE.PROMOTE.ImagePromotion(self.policy().validate())
        with patch.object(runtime, "lock", return_value=nullcontext()), patch.object(runtime, "docker", side_effect=self.docker), patch.object(runtime, "verify", side_effect=ValueError("not ready")):
            with self.assertRaisesRegex(ValueError, "configuration restored"):
                runtime.apply()
        rollback_up = next(call for call in self.base.calls if str(self.base.root / "rollback") in call and "up" in call)
        self.assertIn("--no-deps", rollback_up)
        self.assertTrue(all(name in rollback_up for name in self.base.old))
        self.assertNotIn("codexsun-worker", rollback_up)
        self.assertNotIn("codexsun-chatb", rollback_up)


class LocalTarTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location("local_tar_verification", ROOT / ".container/codexsun-v1/lib/verify-local-tar.py")
        self.verifier = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.verifier)

    def archive(self, name="tenant/file", link=False):
        output = io.BytesIO()
        with tarfile.open(fileobj=output, mode="w") as stream:
            member = tarfile.TarInfo(name)
            member.size = 3
            if link:
                member.type = tarfile.SYMTYPE
                member.linkname = "outside"
                stream.addfile(member)
            else:
                stream.addfile(member, io.BytesIO(b"abc"))
        output.seek(0)
        return output

    def test_archive_is_read_without_filesystem_extraction(self):
        result = self.verifier.verify(self.archive(), ["tenant"])
        self.assertEqual(result["files"], 1)
        self.assertFalse(result["extracted"])

    def test_foreign_paths_traversal_and_links_are_rejected(self):
        for path in ["cxapp/file", "../tenant/file", "/tenant/file", "tenant/../../secret", "tenant/C:secret"]:
            with self.subTest(path=path), self.assertRaises(ValueError):
                self.verifier.verify(self.archive(path), ["tenant"])
        with self.assertRaises(ValueError):
            self.verifier.verify(self.archive(link=True), ["tenant"])


if __name__ == "__main__":
    unittest.main()
