"""Check compatibility detection without importing Frappe on the host."""

from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from logicx_compat import apply


class CompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)

    def write(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        return path

    def test_current_api_patch_is_idempotent_and_keeps_original_business_code(self):
        self.write("apps/frappe/frappe/utils/install.py", "def create_desktop_icons_for_app(app_name=None): pass\n")
        self.write("apps/frappe/frappe/desk/doctype/workspace_sidebar/workspace_sidebar.py", "# archive\n")
        hook = self.write("apps/logicx_app/logicx_app/install.py", "from frappe.utils.install import auto_generate_icons_and_sidebar\n")
        navigation = self.write("apps/logicx_biz/logicx_biz/desk_fixes.py",
                                "def cleanup_shadow_sidebars(app_name: str | None = None):\n\tpass\n"
                                "def extend_bootinfo(bootinfo):\n\tpass\n")
        with patch("logicx_compat.convert_sidebars"):
            apply(self.root)
            first = navigation.read_text()
            apply(self.root)
        self.assertEqual(first, navigation.read_text())
        self.assertIn("create_desktop_icons_for_app as auto_generate_icons_and_sidebar", hook.read_text())
        self.assertEqual(first.count("Module Sidebars supersede"), 2)
        compile(first, "navigation", "exec")

    def test_legacy_api_needs_no_patch(self):
        self.write("apps/frappe/frappe/utils/install.py", "def auto_generate_icons_and_sidebar(app): pass\n")
        self.write("apps/frappe/frappe/desk/doctype/workspace_sidebar/workspace_sidebar.py",
                   "def auto_generate_sidebar_from_module(module): pass\n")
        with patch("logicx_compat.convert_sidebars") as convert:
            apply(self.root)
        convert.assert_not_called()

    def test_unknown_api_fails_before_rewriting_apps(self):
        self.write("apps/frappe/frappe/utils/install.py", "def unrelated(): pass\n")
        with self.assertRaisesRegex(ValueError, "no supported"):
            apply(self.root)


if __name__ == "__main__":
    unittest.main()
