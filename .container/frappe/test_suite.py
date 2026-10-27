"""Exercise suite ordering and recovery boundaries without touching Docker."""

import gzip
import io
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import Mock, patch

from frappe_suite import SuiteSetup, bootstrap
from suite_catalog import APPS, repository
from suite_compat import apply, SOCKET_FILES, OLD_URL, PROXY_URL


class SuiteTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.setup = SuiteSetup.__new__(SuiteSetup)
        self.setup.owner = Mock()
        self.setup.installer = Mock(root=Path(self.folder.name), compose=["docker", "compose"], environment={})
        self.setup.site = "erp.example.localhost"
        self.setup.record = {"image": "old", "suite_setup": {}}

    def test_dependencies_install_before_their_consumers(self):
        order = list(APPS)
        self.assertLess(order.index("telephony"), order.index("helpdesk"))
        self.assertEqual(len(order), 6)
        self.assertTrue(all(repository(name).startswith("https://github.com/frappe/") for name in order))
        compile(bootstrap(), "suite-bootstrap", "exec")
        with self.assertRaises(ValueError):
            repository("../unexpected")

    def test_backup_failure_never_stops_or_replaces_container(self):
        self.setup.owner.bench.side_effect = [None, subprocess.CalledProcessError(1, ["backup"])]
        with self.assertRaises(subprocess.CalledProcessError):
            self.setup.install("new-image")
        self.setup.installer.run.assert_not_called()
        self.assertEqual(self.setup.installer.save.call_args.args[1], "suite-needs-review")

    def test_partial_installation_is_rejected_before_build(self):
        self.setup.owner.site_state.return_value = {"apps": ["frappe", "erpnext", "hrms"]}
        self.setup.build = Mock()
        with self.assertRaisesRegex(ValueError, "partial"):
            self.setup.run()
        self.setup.build.assert_not_called()
        self.setup.owner.bench.assert_not_called()

    def test_complete_installation_is_verified_without_build(self):
        self.setup.owner.site_state.return_value = {"apps": ["frappe", "erpnext", *APPS]}
        self.setup.build, self.setup.verify = Mock(), Mock()
        self.setup.run()
        self.setup.verify.assert_called_once()
        self.setup.build.assert_not_called()

    def test_concurrent_container_replacement_is_rejected_before_site_mutations(self):
        before = {"Id": "original", "Image": "original-image", "Mounts": []}
        after = {"Id": "replacement", "Image": "original-image", "Mounts": []}
        with patch("frappe_suite.inspect", return_value=after), self.assertRaisesRegex(ValueError, "changed"):
            self.setup.check_unchanged(before, {"apps": ["frappe", "erpnext"]}, {})
        self.setup.owner.bench.assert_not_called()

    def test_changed_image_identity_fails_before_login_or_worker_checks(self):
        self.setup.record["suite_setup"]["image_id"] = "expected-image"
        with patch("frappe_suite.inspect", return_value={"Image": "different-image"}), self.assertRaisesRegex(ValueError, "identity"):
            self.setup.verify()
        self.setup.installer.verify.assert_not_called()

    def test_backup_must_include_database_and_both_file_archives(self):
        root = Path(self.folder.name)
        with self.assertRaisesRegex(ValueError, "incomplete"):
            SuiteSetup.verify_backup(root)
        (root / "site-database.sql.gz").write_bytes(gzip.compress(b"test database backup"))
        for name in ("files.tar", "private-files.tar"):
            with tarfile.open(root / name, "w") as archive:
                content = b"test"
                entry = tarfile.TarInfo("test-file")
                entry.size = len(content)
                archive.addfile(entry, io.BytesIO(content))
        SuiteSetup.verify_backup(root)
        self.assertTrue((root / "suite-checksums.json").is_file())
        (root / "site-database.sql.gz").write_bytes(b"broken gzip")
        with self.assertRaises(gzip.BadGzipFile):
            SuiteSetup.verify_backup(root)

    def test_production_sockets_use_proxy_without_changing_development_or_private_settings(self):
        root = Path(self.folder.name)
        (root / "sites").mkdir()
        config = root / "sites/common_site_config.json"
        config.write_text('{"redis_cache":"retained-cache"}')
        for name in SOCKET_FILES:
            path = root / "apps" / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(OLD_URL + ";\n")
        apply(root)
        apply(root)
        self.assertIn('"redis_cache": "retained-cache"', config.read_text())
        self.assertIn('"socketio_port": 9000', config.read_text())
        for name in SOCKET_FILES:
            self.assertEqual((root / "apps" / name).read_text(), PROXY_URL + ";\n")


if __name__ == "__main__":
    unittest.main()
