"""OCI archive fixtures require the complete descriptor and layer graph."""
import gzip
import hashlib
import io
import json
import pathlib
import sys
import tarfile
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / ".container/codexsun-v1/lib"))
from promotion_recovery import verify_image_archive

INDEX = "application/vnd.oci.image.index.v1+json"
MANIFEST = "application/vnd.oci.image.manifest.v1+json"
CONFIG = "application/vnd.oci.image.config.v1+json"
LAYER = "application/vnd.oci.image.layer.v1.tar+gzip"


class OciArchiveTests(unittest.TestCase):
    def setUp(self):
        directory = ROOT / "dist/deployment-tests"
        directory.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=directory, prefix="oci-")
        self.addCleanup(self.temp.cleanup)
        self.members = {}

    def blob(self, value, media):
        data = value if isinstance(value, bytes) else json.dumps(value).encode()
        digest = hashlib.sha256(data).hexdigest()
        self.members["blobs/sha256/" + digest] = data
        return {"mediaType": media, "digest": "sha256:" + digest, "size": len(data)}

    def image(self, missing=False, corrupt=False, wrong_size=False, direct=False):
        raw = b"Synthetic uncompressed layer bytes"
        layer = self.blob(gzip.compress(raw), LAYER)
        config = self.blob({"rootfs": {"type": "layers", "diff_ids": ["sha256:" + hashlib.sha256(raw).hexdigest()]}}, CONFIG)
        if wrong_size:
            layer["size"] += 1
        manifest = self.blob({"schemaVersion": 2, "mediaType": MANIFEST,
                              "config": config, "layers": [layer]}, MANIFEST)
        root = manifest if direct else self.blob({"schemaVersion": 2, "mediaType": INDEX, "manifests": [manifest]}, INDEX)
        self.members["index.json"] = json.dumps({"schemaVersion": 2, "mediaType": INDEX, "manifests": [root]}).encode()
        name = "blobs/sha256/" + layer["digest"][7:]
        if missing:
            del self.members[name]
        if corrupt:
            data = self.members[name]
            self.members[name] = bytes([data[0] ^ 1]) + data[1:]
        return root["digest"][7:]

    def archive(self):
        path = pathlib.Path(self.temp.name) / "image.tar"
        with tarfile.open(path, "w") as archive:
            for name, data in self.members.items():
                member = tarfile.TarInfo(name)
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
        return path

    def test_complete_containerd_index_graph(self):
        identity = self.image()
        verify_image_archive(self.archive(), {identity})

    def test_direct_oci_manifest_identity(self):
        identity = self.image(direct=True)
        verify_image_archive(self.archive(), {identity})

    def test_missing_layer_is_rejected(self):
        identity = self.image(missing=True)
        with self.assertRaisesRegex(ValueError, "Missing or truncated OCI"):
            verify_image_archive(self.archive(), {identity})

    def test_corrupt_layer_is_rejected(self):
        identity = self.image(corrupt=True)
        with self.assertRaisesRegex(ValueError, "OCI image content digest mismatch"):
            verify_image_archive(self.archive(), {identity})

    def test_incorrect_descriptor_size_is_rejected(self):
        identity = self.image(wrong_size=True)
        with self.assertRaisesRegex(ValueError, "Missing or truncated OCI"):
            verify_image_archive(self.archive(), {identity})

    def test_config_blob_cannot_be_an_oci_image_root(self):
        config = self.blob({"architecture": "amd64"}, CONFIG)
        self.members["index.json"] = json.dumps({"schemaVersion": 2, "manifests": [config]}).encode()
        with self.assertRaisesRegex(ValueError, "complete image"):
            verify_image_archive(self.archive(), {config["digest"][7:]})

    def test_index_cannot_wrap_a_configuration_blob_as_an_image(self):
        config = self.blob({"architecture": "amd64"}, CONFIG)
        root = self.blob({"schemaVersion": 2, "mediaType": INDEX, "manifests": [config]}, INDEX)
        self.members["index.json"] = json.dumps({"schemaVersion": 2, "manifests": [root]}).encode()
        with self.assertRaisesRegex(ValueError, "reference image manifests or indexes"):
            verify_image_archive(self.archive(), {root["digest"][7:]})


if __name__ == "__main__":
    unittest.main()
