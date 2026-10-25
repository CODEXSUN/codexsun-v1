"""Fresh-install failure simulation and portable-package execution checks."""

import contextlib
import io
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from configuration import write_settings
from install import Installer
from package import FILES, create_package, verify_package
from test_install import settings


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.env = self.root / "frappe.env"
        write_settings(self.env, settings())
        self.installer = Installer(self.env)
        self.installer.root = self.root
        self.installer.record_path = self.root / "deployment.private.json"
        self.calls = []
        self.events = []
        self.failure = None
        self.engine = "linux"
        self.compose_version = "v2.40.0"
        self.model = {"services": {"frappe": {}}, "networks": {"shared": {"external": True}}}
        self.infrastructure = patch("install.Infrastructure").start()
        self.infrastructure.return_value.db = "shared-mariadb"
        self.infrastructure.return_value.redis = "shared-redis"
        self.addCleanup(patch.stopall)
        self.infrastructure.return_value.backup.side_effect = self.backup
        self.infrastructure.return_value.preflight.side_effect = lambda: self.events.append("preflight")
        patch("install.latest_release", return_value="v16.99.8").start()
        patch("install.inspect", return_value={"Id": "retained-id", "Mounts": [{"Name": "retained-data"}]}).start()
        self.verifier = patch("verify.verify", return_value={"processes": 6}).start()
        patch.object(self.installer, "run", side_effect=self.simulate_run).start()
        self.socket = patch("install.socket.socket").start()

    def backup(self, root):
        self.events.append("backup")
        if self.failure == "backup":
            raise RuntimeError("simulated backup failure")
        return str(root / "backups/verified-fixture")

    def simulate_run(self, args, capture=False, input=None, timeout=7200):
        self.calls.append(args)
        if "config" in args:
            output = json.dumps(self.model)
        elif "inspect" in args and "image" in args:
            output = json.dumps([{"RepoDigests": ["frappe/erpnext@sha256:" + "a" * 64]}])
        elif "{{.OSType}}" in args:
            output = self.engine
        elif "--short" in args:
            output = self.compose_version
        else:
            output = ""
        for stage in ("pull", "build", "run", "up"):
            if stage in args:
                self.events.append(stage)
                if self.failure == stage:
                    raise subprocess.CalledProcessError(1, args)
        if "run" in args:
            self.assertEqual(json.loads(input)["CODEXSUN_FRAPPE_SITE"], "erp.codexsun.localhost")
        return subprocess.CompletedProcess(args, 0, output, "")

    def test_fresh_install_orders_backup_init_health_and_verification(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.installer.install(assume_yes=True)
        self.assertLess(self.events.index("backup"), self.events.index("pull"))
        self.assertLess(self.events.index("run"), self.events.index("up"))
        self.assertEqual(self.events.count("preflight"), 3)
        self.assertEqual(json.loads(self.installer.record_path.read_text())["phase"], "verified")
        self.verifier.assert_called_once()
        self.assertFalse((self.root / ".install.lock").exists())
        self.assertTrue(any("docker-compose.init.yml" in " ".join(call) for call in self.calls))

    def test_backup_build_init_and_start_failures_preserve_data(self):
        for stage in ("backup", "build", "run", "up"):
            with self.subTest(stage=stage):
                self.failure = stage
                self.calls.clear()
                self.events.clear()
                self.installer.record_path.unlink(missing_ok=True)
                with contextlib.redirect_stdout(io.StringIO()):
                    with self.assertRaises((RuntimeError, subprocess.CalledProcessError)):
                        self.installer.install(assume_yes=True)
                self.assertFalse(any("down" in call or "prune" in call for call in self.calls))
                self.assertFalse((self.root / ".install.lock").exists())
                if stage in ("backup", "build", "run"):
                    self.assertFalse(any("up" in call for call in self.calls))
                if stage != "backup":
                    self.assertEqual(json.loads(self.installer.record_path.read_text())["phase"], "needs-review")

    def test_verification_failure_is_not_recorded_as_success(self):
        self.verifier.side_effect = ValueError("simulated login failure")
        with contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(ValueError, "login failure"):
                self.installer.install(assume_yes=True)
        self.assertEqual(json.loads(self.installer.record_path.read_text())["phase"], "needs-review")

    def test_late_database_reservation_aborts_before_initialization(self):
        def reservation():
            self.events.append("preflight")
            if self.events.count("preflight") == 3:
                raise ValueError("database was reserved by another operation")
        self.infrastructure.return_value.preflight.side_effect = reservation
        with contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(ValueError, "reserved"):
                self.installer.install(assume_yes=True)
        self.assertFalse(any("run" in call for call in self.calls))

    def test_windows_engine_and_old_compose_abort_before_backup(self):
        for engine, version in (("windows", "v2.40.0"), ("linux", "v2.19.0")):
            with self.subTest(engine=engine, version=version):
                self.engine, self.compose_version = engine, version
                with self.assertRaises(ValueError):
                    self.installer.preflight()
                self.assertNotIn("backup", self.events)

    def test_busy_port_aborts_before_backup(self):
        self.socket.return_value.__enter__.return_value.bind.side_effect = OSError("busy")
        with self.assertRaisesRegex(ValueError, "port is unavailable"):
            self.installer.preflight()
        self.assertNotIn("backup", self.events)

    def test_operator_cancellation_does_not_create_resources(self):
        with patch("builtins.input", return_value="n"), contextlib.redirect_stdout(io.StringIO()):
            self.installer.install()
        self.assertNotIn("backup", self.events)
        self.assertFalse(self.installer.record_path.exists())


class PortableTests(unittest.TestCase):
    def test_source_only_package_runs_outside_the_repository(self):
        with tempfile.TemporaryDirectory(prefix="codexsun-frappe-portable-") as directory:
            root = Path(directory)
            archive = root / "installer.zip"
            with contextlib.redirect_stdout(io.StringIO()):
                create_package(archive)
            with zipfile.ZipFile(archive) as package:
                names = package.namelist()
                self.assertEqual(len(names), len(FILES) + 1)
                self.assertFalse(any(name.endswith("/frappe.env") or "private.json" in name
                                     or "/logs/" in name or "/backups/" in name for name in names))
                package.extractall(root / "extracted")
            copied = root / "extracted/frappe-installer"
            self.assertEqual(verify_package(copied), len(FILES))
            environment = {key: value for key, value in os.environ.items() if key != "PYTHONPATH"}
            for script in ("setup.py", "install.py", "package.py"):
                result = subprocess.run([sys.executable, "-B", str(copied / script), "--help"],
                                        cwd=root, env=environment, capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, 0, result.stderr)
            node = shutil.which("node")
            if node:
                result = subprocess.run([node, "--input-type=module", "-e",
                                         "import('./browser-client.mjs').then(m=>{if(!m.BrowserPage)process.exit(1)})"],
                                        cwd=copied, capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
