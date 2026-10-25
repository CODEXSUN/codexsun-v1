"""Focused tests for latest-v16 selection and retained-infrastructure guards."""

import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import init_frappe
from install import Installer, latest_release
from infrastructure import Infrastructure, deployment_lock


def settings():
    return {"CODEXSUN_FRAPPE_SITE": "erp.codexsun.localhost",
            "CODEXSUN_FRAPPE_NETWORK": "shared-test-network",
            "CODEXSUN_FRAPPE_DB_HOST": "shared-mariadb",
            "CODEXSUN_FRAPPE_DB_NAME": "codexsun_frappe",
            "CODEXSUN_FRAPPE_DB_PASSWORD": "shared-db-password",
            "CODEXSUN_FRAPPE_REDIS_HOST": "shared-redis",
            "CODEXSUN_FRAPPE_REDIS_CACHE": "redis://:secret@shared-redis:6379/10",
            "CODEXSUN_FRAPPE_REDIS_QUEUE": "redis://:secret@shared-redis:6379/11",
            "CODEXSUN_FRAPPE_ADMIN_PASSWORD": "private-test-admin-password"}


class ReleaseTests(unittest.TestCase):
    def test_highest_stable_v16_ignores_v15_and_prereleases(self):
        releases = [{"tag_name": tag, "draft": False, "prerelease": prerelease} for tag, prerelease in
                    (("v15.999.0", False), ("v16.9.0", False), ("v16.10.0", False),
                     ("v16.11.0", True), ("v17.0.0", False), ("v13-baseline", False))]
        response = contextlib.closing(io.BytesIO(json.dumps(releases).encode()))
        with patch("urllib.request.urlopen", return_value=response):
            self.assertEqual(latest_release(), "v16.10.0")

    def test_missing_stable_v16_fails_closed(self):
        response = contextlib.closing(io.BytesIO(b"[]"))
        with patch("urllib.request.urlopen", return_value=response):
            with self.assertRaisesRegex(ValueError, "No stable"):
                latest_release()

    def test_resolver_scans_older_pages_when_newer_majors_fill_first_page(self):
        older = [{"tag_name": "v17.1.0", "draft": False, "prerelease": False}] * 100
        desired = [{"tag_name": "v16.20.1", "draft": False, "prerelease": False}]
        responses = [contextlib.closing(io.BytesIO(json.dumps(page).encode())) for page in (older, desired)]
        with patch("urllib.request.urlopen", side_effect=responses) as request:
            self.assertEqual(latest_release(), "v16.20.1")
        self.assertEqual(request.call_count, 2)


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name, "frappe.env")
        self.path.write_text("".join(f"{key}='{value}'\n" for key, value in settings().items()))
        self.installer = Installer(self.path)

    def test_check_declares_only_frappe(self):
        model = {"services": {"frappe": {}}, "networks": {"shared": {"external": True}}}
        result = subprocess.CompletedProcess([], 0, json.dumps(model), "")
        with patch.object(self.installer, "run", return_value=result) as run:
            self.installer.validate()
        self.assertEqual(run.call_count, 1)
        self.assertEqual(run.call_args.args[0][-3:], ["config", "--format", "json"])

    def test_new_database_or_redis_service_is_rejected(self):
        result = subprocess.CompletedProcess([], 0, json.dumps({"services": {"frappe": {}, "db": {}}}), "")
        with patch.object(self.installer, "run", return_value=result):
            with self.assertRaisesRegex(ValueError, "Only the Frappe"):
                self.installer.validate()

    def test_ambient_compose_and_frappe_values_are_removed(self):
        with patch.dict(os.environ, {"COMPOSE_PROFILES": "other", "CODEXSUN_FRAPPE_SITE": "ambient"}):
            installer = Installer(self.path)
        self.assertFalse("COMPOSE_PROFILES" in installer.environment)
        self.assertEqual(installer.environment.get("CODEXSUN_FRAPPE_SITE"), "erp.codexsun.localhost")

    def test_existing_containers_and_orphaned_volumes_are_rejected(self):
        for existing in ("codexsun-frappe", "codexsun-frappe_sites"):
            with self.subTest(existing=existing):
                result = subprocess.CompletedProcess([], 0, existing, "")
                with patch.object(self.installer, "run", return_value=result):
                    with self.assertRaisesRegex(ValueError, "Refusing"):
                        self.installer.guard_fresh()

    def test_invalid_hostname_rejected_before_docker(self):
        self.path.write_text(self.path.read_text().replace("erp.codexsun.localhost", "../../other"))
        self.installer = Installer(self.path)
        with patch.object(self.installer, "run") as run:
            with self.assertRaisesRegex(ValueError, "hostname"):
                self.installer.validate()
        run.assert_not_called()

    def test_missing_private_environment(self):
        self.path.unlink()
        with self.assertRaises(ValueError):
            self.installer.validate()


class InfrastructureTests(unittest.TestCase):
    def setUp(self):
        self.info = {"State": {"Running": True, "Health": {"Status": "healthy"}},
                     "NetworkSettings": {"Networks": {"shared-test-network": {}}},
                     "Mounts": [{"Type": "volume", "Destination": "/var/lib/mysql"},
                                {"Type": "volume", "Destination": "/data"}]}
        network = patch("infrastructure.command", return_value=subprocess.CompletedProcess(
            [], 0, json.dumps([{"Internal": False}]).encode(), b""))
        self.network = network.start()
        self.addCleanup(network.stop)

    def test_internal_network_requires_existing_entry_network(self):
        self.network.return_value.stdout = json.dumps([{"Internal": True}]).encode()
        with self.assertRaisesRegex(ValueError, "ENTRY_NETWORK"):
            Infrastructure(settings()).preflight()

    def test_existing_database_aborts_before_redis(self):
        infra = Infrastructure(settings())
        with patch("infrastructure.inspect", return_value=self.info), \
                patch.object(infra, "sql", side_effect=lambda sql: "11.8.8-MariaDB" if "VERSION" in sql else "codexsun_frappe"), \
                patch.object(infra, "redis_command") as redis:
            with self.assertRaisesRegex(ValueError, "database already exists"):
                infra.preflight()
        redis.assert_not_called()

    def test_nonempty_redis_is_never_reused(self):
        infra = Infrastructure(settings())
        with patch("infrastructure.inspect", return_value=self.info), \
                patch.object(infra, "sql", side_effect=lambda sql: "11.8.8-MariaDB" if "VERSION" in sql else ""), \
                patch.object(infra, "redis_command", side_effect=lambda *args: "PONG" if args == ("PING",)
                             else "redis_version:7.4.0" if args == ("INFO", "server")
                             else "databases\n16" if "databases" in args else "1"):
            with self.assertRaisesRegex(ValueError, "already contains"):
                infra.preflight()

    def test_unsupported_mariadb_is_not_upgraded(self):
        infra = Infrastructure(settings())
        with patch("infrastructure.inspect", return_value=self.info), \
                patch.object(infra, "sql", return_value="10.6.20-MariaDB"), \
                patch.object(infra, "redis_command") as redis:
            with self.assertRaisesRegex(ValueError, "11.8"):
                infra.preflight()
        redis.assert_not_called()

    def test_existing_site_is_not_recreated(self):
        with patch("sys.stdin", io.StringIO(json.dumps(settings()))), \
                patch.object(Path, "exists", return_value=True), patch.object(init_frappe, "bench") as bench:
            with self.assertRaisesRegex(ValueError, "Refusing"):
                init_frappe.initialize()
        bench.assert_not_called()

    def test_host_lock_rejects_concurrent_installation(self):
        with tempfile.TemporaryDirectory() as directory, patch("tempfile.gettempdir", return_value=directory):
            with deployment_lock():
                with self.assertRaisesRegex(ValueError, "host lock"):
                    with deployment_lock():
                        self.fail("Second deployment acquired the same host lock")


if __name__ == "__main__":
    unittest.main()
