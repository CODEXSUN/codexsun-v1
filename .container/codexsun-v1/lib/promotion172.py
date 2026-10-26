"""One human-approved operation for the pinned 1.1.72 application, never a generic bypass."""
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from promotion import PromotionPolicy, fresh, require
from promotion_recovery import verify_image_archive

PINS = json.loads(Path(__file__).with_name("release172-pins.json").read_text())
FALSE_PROOFS = ["restoreRehearsalVerified", "completeRecovery", "crossDatabaseAtomicityVerified", "filesCoverageVerified"]
USED = Path("/home/codexsun-operators/release172-e6e7b79c-exception.used")


class Release172PromotionPolicy(PromotionPolicy):
    def __init__(self, manifest, expected_revision, local_verification_sha256):
        require(isinstance(local_verification_sha256, str) and len(local_verification_sha256) == 64
                and all(c in "0123456789abcdef" for c in local_verification_sha256),
                "Supply the trusted SHA-256 printed by the local encrypted-backup verifier")
        super().__init__(manifest, expected_revision)
        self.local_sha = local_verification_sha256

    def check_recovery(self):
        require(self.record["source"] == PINS["source"] and self.images == PINS["images"],
                "Release exception is restricted to the exact tested 1.1.72 images")
        require(datetime.now(timezone.utc) < stamp(PINS["expiresAt"]), "Release exception expired")
        for role in ["production", "rollback"]:
            require(self.record[role]["sha256"] == PINS[role + "Sha256"], "Release exception model differs")
        previous = self.rollback.get("services", {})
        require(set(previous) == {"codexsun-api", "codexsun-web", "codexsun-shop"} and
                all(type(row.get("x-codexsun-running")) is bool for row in previous.values()),
                "Rollback must capture every original application running state")
        ref = self.record.get("release172Exception")
        require(isinstance(ref, dict) and ref.get("sha256") == PINS["humanExceptionSha256"],
                "Release exception requires the exact recorded human authorization")
        approval = json.loads(self.read_reference(ref))
        require(approval.get("release") == PINS["source"] and approval.get("proofValuesModified") is False,
                "Human exception source or truthfulness differs")
        require({"codexsun-" + key: value for key, value in approval["images"].items()} == self.images,
                "Human exception images differ")
        recovery = self.recovery
        fresh(recovery["completedAt"], 3600)
        require(recovery.get("registryTargetsVerified") is True, "Actual registry targets require verification")
        targets = self.migrations["targets"]
        require(len(targets) == 14 and len(set(targets)) == 14 and digest(sorted(targets)) == PINS["targetsSha256"],
                "Release exception migration targets differ from the approved registry scope")
        require(set(recovery.get("coveredTargets", [])) == set(targets), "Recovery target coverage differs")
        require(recovery.get("rollbackSha256") == self.record["rollback"]["sha256"], "Rollback binding differs")
        local_ref = recovery.get("localVerification")
        require(isinstance(local_ref, dict) and local_ref.get("sha256") == self.local_sha,
                "Local verification differs from the out-of-band trusted hash")
        local = json.loads(self.read_reference(local_ref))
        proof_ref = recovery.get("backupProof")
        proof = json.loads(self.read_reference(proof_ref))
        require(local.get("proofSha256") == proof_ref["sha256"], "Local verification does not bind the backup proof")
        self.check_local(local, proof)
        require(recovery["completedAt"] == proof["completedAt"], "Do not refresh an old backup timestamp")
        require(recovery.get("quiescedContainers") == local["quiescedContainers"], "Backup writer identities differ")
        require(stamp(self.migrations["completedAt"]) >= stamp(proof["completedAt"]),
                "Approved production migrations must follow the fresh backup")
        for field in FALSE_PROOFS:
            require(proof.get(field) is False and recovery.get(field) is False,
                    "Preserve actual false recovery proof: " + field)
        images = self.verify_reference(recovery["artifacts"]["images"])
        verify_image_archive(images, {row["image"].removeprefix("sha256:") for row in self.rollback["services"].values()})
        self.local = local

    def check_local(self, local, proof):
        require(local.get("format") == "codexsun-release172-local-verification-v1", "Unknown local verification format")
        require(proof.get("format") == "codexsun-local-backup-proof-v1", "Unknown encrypted backup proof format")
        require(local.get("source") == PINS["source"] and local.get("humanExceptionSha256") == PINS["humanExceptionSha256"],
                "Local verification release binding differs")
        require(local.get("scopeSha256") == PINS["scopeSha256"] and local.get("targetsSha256") == PINS["targetsSha256"],
                "Local verification registry binding differs")
        require(local.get("backupScopeSha256") == PINS["backupScopeSha256"], "Local SQL scope differs")
        require(proof.get("quiesced") is True and proof.get("cxappDatabasesExcluded") is True
                and proof.get("mariaDbContainerLifecycleChanges") is False, "Protected resource proof differs")
        require(local.get("integrityVerified") is True and local.get("restorePerformed") is False,
                "Real local integrity verification is required without a restore")
        fresh(local["verifiedAt"], 3600)
        fresh(local["scopeCapturedAt"], 3600)
        fresh(proof["captureStartedAt"], 3600)
        fresh(proof["completedAt"], 3600)
        require(local.get("captureStartedAt") == proof.get("captureStartedAt"), "Capture timing differs")
        require(proof.get("quiescedContainers") == local.get("quiescedContainers"), "Backup proof writer identities differ")
        for state in local["quiescedContainers"].values():
            require(stamp(proof["captureStartedAt"]) >= stamp(state["finishedAt"]), "Capture preceded writer shutdown")
        rows = proof["backups"]
        require(len(rows) == 14 and sum(row.get("master") is True for row in rows) == 1, "Expected master plus 13 tenants")
        scope = [{"database": r["database"], "uuid": r.get("uuid"), "code": r["code"], "master": r.get("master") is True}
                 for r in sorted(rows, key=lambda row: row["database"])]
        require(digest(scope) == PINS["backupScopeSha256"], "Encrypted SQL identities differ")
        entries = rows + [proof["configuration"]] + proof.get("tenantStorage", [])
        require(local.get("artifacts") == [[r["sha256"], r["bytes"], r["identity"]] for r in entries],
                "Encrypted artifact attestations differ from the proof")
        for row in entries:
            fresh(row["completedAt"], 3600)
            require(stamp(proof["captureStartedAt"]) <= stamp(row["completedAt"]) <= stamp(proof["completedAt"]),
                    "Artifact capture timing differs")
            require(row.get("encryption") == "AES-256-GCM", "Unexpected backup encryption")

    def extra_private_paths(self):
        refs = [self.record["release172Exception"], self.recovery["localVerification"], self.recovery["backupProof"]]
        return [self.verify_reference(ref) for ref in refs]

    def consume_exception(self):
        require(not USED.exists(), "This release exception was already consumed")
        flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0)
        with os.fdopen(os.open(USED, flags, 0o600), "w") as stream:
            json.dump({"source": PINS["source"], "images": self.images, "manifestSha256": hashlib.sha256(self.path.read_bytes()).hexdigest(),
                       "localVerificationSha256": self.local_sha, "at": datetime.now(timezone.utc).isoformat()}, stream)
            stream.flush()
            os.fsync(stream.fileno())

    def exception_status(self):
        return {"release": PINS["source"], "humanAuthorizationSha256": PINS["humanExceptionSha256"],
                "localVerificationSha256": self.local_sha, "acceptedGaps": ["restore", "legacy-artifact-contract", "consistency/shared-media"],
                "proofValues": {field: False for field in FALSE_PROOFS}}


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def stamp(value):
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(result.tzinfo is not None, "Capture timestamps require a timezone")
    return result
