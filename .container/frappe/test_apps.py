"""Exercise app installation ordering and failures without Docker or a database."""

import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch


spec = importlib.util.spec_from_file_location("setup_apps", Path(__file__).with_name("setup-app.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AppSetupTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.setup = module.AppSetup.__new__(module.AppSetup)
        self.setup.site = "erp.example.localhost"
        self.setup.record = {"image": "old", "app_setup": {}}
        self.setup.installer = Mock(root=Path(self.folder.name), compose=["docker", "compose"], environment={})
        self.setup.exec = Mock()
        self.setup.bench = Mock()

    def test_backup_failure_never_stops_or_replaces_container(self):
        self.setup.bench.side_effect = [None, subprocess.CalledProcessError(1, ["backup"])]
        with self.assertRaises(subprocess.CalledProcessError):
            self.setup.install("new-image")
        self.setup.installer.run.assert_not_called()
        self.assertEqual(self.setup.bench.call_args_list[0].args, ("set-maintenance-mode", "on"))
        self.assertNotIn(("set-maintenance-mode", "off"), [call.args for call in self.setup.bench.call_args_list])
        self.assertEqual(self.setup.installer.save.call_args.args[1], "apps-needs-review")

    def test_migration_failure_preserves_maintenance_and_backup_pointer(self):
        def execute(args):
            if "run" in args:
                raise subprocess.CalledProcessError(1, args)
        self.setup.installer.run.side_effect = execute
        with self.assertRaises(subprocess.CalledProcessError):
            self.setup.install("new-image")
        self.assertTrue(Path(self.setup.record["app_setup"]["backup"]).is_dir())
        self.assertEqual(self.setup.record["image"], "new-image")
        self.assertNotIn(("set-maintenance-mode", "off"), [call.args for call in self.setup.bench.call_args_list])
        self.assertFalse(any("up" in call.args[0] for call in self.setup.installer.run.call_args_list))

    def test_success_backs_up_before_replacement_and_compiles_bootstrap(self):
        self.setup.install("new-image")
        commands = [call.args[0] for call in self.setup.installer.run.call_args_list]
        self.assertLess(next(i for i, command in enumerate(commands) if "cp" in command),
                        next(i for i, command in enumerate(commands) if "stop" in command))
        bootstrap = next(command for command in commands if "run" in command)
        code = bootstrap[bootstrap.index("-c") + 1]
        compile(code, "app-bootstrap", "exec")
        self.assertEqual(set(module.APPS), {"logicx_biz"})
        self.assertIn("['logicx_biz']", code)
        self.assertEqual(self.setup.bench.call_args.args, ("set-maintenance-mode", "off"))
        self.assertTrue(all("--no-deps" in command for command in commands if "run" in command or "up" in command))

    def test_repeated_run_only_verifies_existing_apps(self):
        info = {"Config": {"Image": "old", "Labels": {"com.docker.compose.project": "codexsun-frappe"}},
                "State": {"Health": {"Status": "healthy"}}}
        self.setup.site_state = Mock(return_value={"apps": ["frappe", "erpnext", "logicx_biz"],
                                                  "employee": True})
        self.setup.verify = Mock()
        self.setup.build = Mock()
        with patch.object(module, "inspect", return_value=info):
            self.setup.run()
        self.setup.verify.assert_called_once()
        self.setup.build.assert_not_called()
        self.setup.bench.assert_not_called()


if __name__ == "__main__":
    unittest.main()
