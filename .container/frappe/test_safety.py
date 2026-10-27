"""Regression coverage for operator credentials, backups, locking, and log privacy."""

import contextlib
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from backup import Backup, verify_backup
from configuration import read_settings, secrets, validate_settings, write_settings
from execution import Runner, Transcript
from infrastructure import Infrastructure, configure, deployment_lock
from test_install import settings
import init_frappe


class ConfigurationTests(unittest.TestCase):
    def test_existing_site_credentials_do_not_change_fresh_install_password_policy(self):
        values = settings()
        values["CODEXSUN_FRAPPE_ADMIN_PASSWORD"] = "admin@123"
        with self.assertRaisesRegex(ValueError, "at least 16"):
            validate_settings(values)
        validate_settings(values, existing=True)

    def test_special_characters_round_trip_without_shell_interpolation(self):
        values = settings()
        password = "quotes'\" dollars$literal backslash\\ end"
        values["CODEXSUN_FRAPPE_DB_PASSWORD"] = password
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, "frappe.env")
            write_settings(path, values)
            self.assertEqual(read_settings(path)["CODEXSUN_FRAPPE_DB_PASSWORD"], password)
            with self.assertRaises(FileExistsError):
                write_settings(path, values)

    def test_duplicate_and_shell_keys_are_rejected(self):
        for content in ("CODEXSUN_FRAPPE_SITE=a\nCODEXSUN_FRAPPE_SITE=b\n", "export CODEXSUN_FRAPPE_SITE=a\n"):
            with self.subTest(content=content), tempfile.TemporaryDirectory() as directory:
                path = Path(directory, "frappe.env")
                path.write_text(content)
                with self.assertRaises(ValueError):
                    read_settings(path)

    def test_redis_aliases_cannot_select_the_same_database(self):
        values = settings()
        values["CODEXSUN_FRAPPE_REDIS_CACHE"] = "redis://:secret@shared-redis:6379/01"
        values["CODEXSUN_FRAPPE_REDIS_QUEUE"] = "redis://:secret@shared-redis:6379/1"
        with self.assertRaisesRegex(ValueError, "canonical"):
            validate_settings(values)

    def test_ports_and_dns_labels_are_validated(self):
        for key, value in (("PORT", "0"), ("DB_PORT", "65536"), ("SITE", "a" * 64 + ".localhost")):
            with self.subTest(key=key):
                values = settings()
                values["CODEXSUN_FRAPPE_" + key] = value
                with self.assertRaises(ValueError):
                    validate_settings(values)

    def test_docker_discovery_accepts_privately_supplied_credentials(self):
        info = {"Config": {"Env": []}, "NetworkSettings": {"Networks": {"shared-test-network": {}}}}
        with tempfile.TemporaryDirectory() as directory, patch("infrastructure.inspect", return_value=info), \
                patch("infrastructure.command", return_value=subprocess.CompletedProcess([], 0, b'[{"Internal":false}]')):
            path = Path(directory, "frappe.env")
            with contextlib.redirect_stdout(io.StringIO()):
                configure(path, "shared-mariadb", "shared-redis", "shared-test-network", "erp.localhost", 8088,
                          db_password="root'quote$literal", redis_password="cache'quote$literal")
            self.assertEqual(read_settings(path)["CODEXSUN_FRAPPE_DB_PASSWORD"], "root'quote$literal")


class CredentialTransportTests(unittest.TestCase):
    def test_site_initialization_keeps_root_and_admin_secrets_out_of_common_config(self):
        values = settings()
        values["CODEXSUN_FRAPPE_DB_PASSWORD"] = "root'quote$literal"
        original = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            try:
                os.chdir(directory)
                Path("apps/frappe").mkdir(parents=True)
                Path("apps/erpnext").mkdir()
                Path("sites").mkdir()
                with patch("sys.stdin", io.StringIO(json.dumps(values))), patch.object(init_frappe, "bench") as bench:
                    init_frappe.initialize()
                config = Path("sites/common_site_config.json").read_text()
                self.assertFalse(values["CODEXSUN_FRAPPE_DB_PASSWORD"] in config)
                self.assertFalse(values["CODEXSUN_FRAPPE_ADMIN_PASSWORD"] in config)
                self.assertIn(values["CODEXSUN_FRAPPE_DB_PASSWORD"], bench.call_args_list[0].args)
            finally:
                os.chdir(original)

    def test_sql_uses_private_password_on_stdin(self):
        values = settings()
        values["CODEXSUN_FRAPPE_DB_PASSWORD"] = "private'password$literal"
        with patch("infrastructure.command", return_value=subprocess.CompletedProcess([], 0, b"1")) as run:
            self.assertEqual(Infrastructure(values).sql("SELECT 1;"), "1")
        self.assertTrue(run.call_args.kwargs["input"].startswith(b"private'password$literal\n"))
        self.assertFalse(values["CODEXSUN_FRAPPE_DB_PASSWORD"] in " ".join(run.call_args.args[0]))
        self.assertIn("--no-defaults", " ".join(run.call_args.args[0]))

    def test_redis_decodes_password_and_keeps_it_out_of_arguments(self):
        values = settings()
        values["CODEXSUN_FRAPPE_REDIS_QUEUE"] = "redis://:special%24password%3Ahere@shared-redis:6379/11"
        with patch("infrastructure.command", return_value=subprocess.CompletedProcess([], 0, b"PONG")) as run:
            self.assertEqual(Infrastructure(values).redis_command("PING"), "PONG")
        self.assertEqual(run.call_args.kwargs["input"], b"special$password:here\n")
        self.assertFalse("special$password:here" in " ".join(run.call_args.args[0]))


class BackupTests(unittest.TestCase):
    def fixture(self, root):
        with gzip.open(root / "mariadb.sql.gz", "wb") as stream:
            stream.write(b"-- valid fixture SQL\n" * 100)
        (root / "redis.rdb").write_bytes(b"REDIS0011" + b"fixture-data")
        manifest = {name: hashlib.sha256((root / name).read_bytes()).hexdigest()
                    for name in ("mariadb.sql.gz", "redis.rdb")}
        (root / "manifest.json").write_text(json.dumps(manifest))

    def test_checksum_tampering_and_incomplete_snapshots_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaises(FileNotFoundError):
                verify_backup(root)
            self.fixture(root)
            verify_backup(root)
            (root / "redis.rdb").write_bytes(b"tampered")
            with self.assertRaisesRegex(ValueError, "checksum"):
                verify_backup(root)

    def test_dump_failure_does_not_create_a_verified_manifest(self):
        infra = Infrastructure(settings())
        with tempfile.TemporaryDirectory() as directory, patch.object(infra, "sql", return_value="1000"), \
                patch("backup.shutil.disk_usage") as disk, \
                patch("backup.subprocess.run", side_effect=subprocess.CalledProcessError(1, ["dump"])), \
                patch.object(infra, "redis_command") as redis:
            disk.return_value.free = 10**12
            with self.assertRaisesRegex(RuntimeError, "backup failed"):
                Backup(infra).create(Path(directory))
            self.assertFalse(list(Path(directory).rglob("manifest.json")))
            redis.assert_not_called()

    def test_invalid_rdb_never_publishes_a_success_manifest(self):
        infra = Infrastructure(settings())
        def run(args, **kwargs):
            if "stdout" in kwargs:
                kwargs["stdout"].write(b"-- fixture SQL\n" * 100)
            elif args[:2] == ["docker", "cp"]:
                Path(args[-1]).write_bytes(b"invalid-rdb-data")
            return subprocess.CompletedProcess(args, 0)
        with tempfile.TemporaryDirectory() as directory, patch.object(infra, "sql", return_value="1000"), \
                patch("backup.shutil.disk_usage") as disk, patch("backup.subprocess.run", side_effect=run), \
                patch.object(infra, "redis_command"):
            disk.return_value.free = 10**12
            with self.assertRaisesRegex(ValueError, "RDB header"):
                Backup(infra).create(Path(directory))
            self.assertFalse(list(Path(directory).rglob("manifest.json")))


class ExecutionTests(unittest.TestCase):
    def test_console_and_log_redact_streamed_secrets(self):
        secret = "fixture-secret'$literal"
        with tempfile.TemporaryDirectory() as directory:
            transcript = Transcript(directory, [secret])
            try:
                output = io.StringIO()
                with contextlib.redirect_stdout(output):
                    Runner(directory, None, transcript).run([sys.executable, "-c", f"print({secret!r})"])
                self.assertFalse(secret in output.getvalue())
                self.assertFalse(secret in transcript.path.read_text())
                self.assertIn("[redacted]", transcript.path.read_text())
            finally:
                transcript.close()

    def test_redis_raw_and_encoded_passwords_are_redacted(self):
        values = settings()
        values["CODEXSUN_FRAPPE_REDIS_QUEUE"] = "redis://:raw%24secret@shared-redis:6379/11"
        self.assertTrue({"raw$secret", "raw%24secret"}.issubset(secrets(values)))

    def test_existing_local_operation_lock_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory, ".container/frappe")
            root.mkdir(parents=True)
            Path(directory, ".container/codexsun-v1/local").mkdir(parents=True)
            lock = Path(directory, ".container/backups/local/operation.lock")
            lock.mkdir(parents=True)
            with self.assertRaisesRegex(ValueError, "local CODEXSUN"):
                with deployment_lock(root):
                    self.fail("Conflicting local operation was accepted")
            self.assertTrue(lock.is_dir())


if __name__ == "__main__":
    unittest.main()
