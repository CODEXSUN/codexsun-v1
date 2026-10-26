"""Inspect scoped backup and retained-image artifacts without restoring data."""
import gzip
import hashlib
import json
import re
import tarfile
from pathlib import PurePosixPath
from promotion import SCOPED_DATABASES, fresh, require


def verify_recovery_artifacts(policy):
    artifacts = policy.recovery["artifacts"]
    sql_index = json.loads(policy.read_reference(artifacts["scoped-sql"]))
    require({row["database"] for row in sql_index} == SCOPED_DATABASES and len(sql_index) == 2,
            "SQL recovery index must identify exactly the two permitted databases")
    for row in sql_index:
        path = policy.verify_reference(row)
        opener = gzip.open if path.suffix == ".gz" else open
        databases, tail = set(), b""
        with opener(path, "rb") as stream:
            for line in stream:
                match = re.fullmatch(rb"USE `([A-Za-z0-9_]+)`;\s*", line)
                if match:
                    databases.add(match.group(1).decode())
                tail = (tail + line)[-8192:]
        require(databases == {row["database"]} and b"-- Dump completed" in tail,
                "Scoped SQL is incomplete or includes an unexpected database")
    for role in ["scoped-storage", "scoped-media"]:
        index = json.loads(policy.read_reference(artifacts[role]))
        require(index.get("tenantOwnershipVerified") is True and
                set(index.get("tenantUuids", [])) == {"de870404", "14c8040c"},
                "Storage recovery requires both verified tenant ownership mappings")
        prefixes = index.get("allowedPrefixes", [])
        require(prefixes and all(safe_name(p) for p in prefixes), "Missing safe scoped archive paths")
        archive = policy.verify_reference(index["archive"])
        count = 0
        with tarfile.open(archive, "r|*") as stream:
            for member in stream:
                name = member.name.removeprefix("./").rstrip("/")
                require(safe_name(name) and any(name == p or name.startswith(p.rstrip("/") + "/") for p in prefixes),
                        "Archive member exceeds the reviewed tenant paths")
                require(member.isfile() or member.isdir(), "Scoped archives cannot contain links or special files")
                count += 1
        require(count, "Scoped archive is empty")
    images = policy.verify_reference(artifacts["images"])
    required = {service["image"].removeprefix("sha256:") for service in policy.rollback["services"].values()}
    verify_image_archive(images, required)
    shared = json.loads(policy.read_reference(artifacts["shared-coverage"]))
    fresh(shared["capturedAt"], 3600)
    require(set(policy.migrations["targets"]) <= set(shared.get("coveredTargets", [])),
            "Existing shared recovery coverage is insufficient")
    require(shared.get("restoreVerified") is True and shared.get("artifacts"),
            "Existing shared recovery needs verified restore evidence and artifacts")
    for ref in shared["artifacts"]:
        policy.verify_reference(ref)


def verify_image_archive(path, required):
    # A config blob alone identifies an image but cannot restore its layers.
    with tarfile.open(path, "r:*") as archive:
        members = {}
        for member in archive.getmembers():
            require(member.isfile() or member.isdir(), "Image archives cannot contain links or special files")
            if member.isfile():
                name = member.name.removeprefix("./")
                require(safe_name(name) and name not in members, "Unsafe or duplicate image archive member")
                members[name] = member
        found = verify_oci_images(archive, members, required)
        if found == required:
            return
        manifest = json.loads(image_metadata(archive, members, "manifest.json"))
        require(isinstance(manifest, list) and manifest, "Missing Docker save image manifest")
        verified_layers = {}
        for record in manifest:
            config_data = image_metadata(archive, members, record["Config"])
            identity = hashlib.sha256(config_data).hexdigest()
            if identity not in required:
                continue
            config = json.loads(config_data)
            rootfs = config.get("rootfs", {})
            diff_ids, layers = rootfs.get("diff_ids"), record.get("Layers")
            require(rootfs.get("type") == "layers" and isinstance(diff_ids, list) and
                    isinstance(layers, list) and len(diff_ids) == len(layers),
                    "Image archive layer manifest differs from retained image configuration")
            for name, expected in zip(layers, diff_ids):
                require(isinstance(expected, str) and re.fullmatch(r"sha256:[a-f0-9]{64}", expected),
                        "Invalid retained image layer identity")
                require(name in members, "Image archive is missing a required rollback layer")
                if name not in verified_layers:
                    verified_layers[name] = image_layer_digest(archive, members[name])
                require(verified_layers[name] == expected, "Rollback image layer content digest mismatch")
            found.add(identity)
        require(found == required, "Image archive does not retain every rollback image identity")


def verify_oci_images(archive, members, required):
    if "index.json" not in members:
        return set()
    index = json.loads(image_metadata(archive, members, "index.json"))
    indexes = {"application/vnd.oci.image.index.v1+json", "application/vnd.docker.distribution.manifest.list.v2+json"}
    manifests = {"application/vnd.oci.image.manifest.v1+json", "application/vnd.docker.distribution.manifest.v2+json"}
    verified, visiting = set(), set()

    def verify(descriptor, depth=0):
        digest = descriptor.get("digest", "")
        require(isinstance(digest, str) and re.fullmatch(r"sha256:[a-f0-9]{64}", digest), "Invalid OCI content digest")
        require(depth <= 32 and digest not in visiting, "OCI descriptor cycle or excessive depth")
        name = "blobs/sha256/" + digest[7:]
        member = members.get(name)
        require(member is not None and member.size == descriptor.get("size"), "Missing or truncated OCI image content")
        if digest in verified:
            return
        calculated = hashlib.sha256()
        with archive.extractfile(member) as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                calculated.update(block)
        require("sha256:" + calculated.hexdigest() == digest, "OCI image content digest mismatch")
        media = descriptor.get("mediaType")
        if media in indexes | manifests:
            visiting.add(digest)
            document = json.loads(image_metadata(archive, members, name))
            if media in indexes:
                children = document.get("manifests")
                require(isinstance(children, list) and children, "OCI image index has no manifests")
                require(all(isinstance(child, dict) and child.get("mediaType") in indexes | manifests
                            for child in children), "OCI image index must reference image manifests or indexes")
            else:
                require(isinstance(document.get("config"), dict) and isinstance(document.get("layers"), list),
                        "OCI manifest is missing configuration or layers")
                children = [document["config"], *document["layers"]]
            for child in children:
                require(isinstance(child, dict), "Invalid OCI child descriptor")
                verify(child, depth + 1)
            visiting.remove(digest)
        verified.add(digest)

    found = set()
    for descriptor in index.get("manifests", []):
        identity = descriptor.get("digest", "").removeprefix("sha256:")
        if identity in required:
            require(descriptor.get("mediaType") in indexes | manifests, "OCI root must describe a complete image")
            verify(descriptor)
            found.add(identity)
    return found


def image_metadata(archive, members, name):
    member = members.get(name)
    require(member is not None and 0 < member.size <= 8 * 1024 * 1024,
            "Missing or oversized Docker save image metadata")
    return archive.extractfile(member).read()


def image_layer_digest(archive, member):
    with archive.extractfile(member) as payload:
        compressed = payload.read(2) == b"\x1f\x8b"
        payload.seek(0)
        stream = gzip.GzipFile(fileobj=payload) if compressed else payload
        digest = hashlib.sha256()
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
        if compressed:
            stream.close()
        return "sha256:" + digest.hexdigest()


def safe_name(name):
    return isinstance(name, str) and name and not name.startswith("/") and ".." not in PurePosixPath(name).parts
