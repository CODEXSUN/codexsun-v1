"""Adapt the LogicX legacy Desk hooks and fixtures to Frappe's module Sidebar API.

Only the custom apps change. Framework code and permission checks stay intact.
"""

import ast
import json
from pathlib import Path


def apply(bench):
    bench = Path(bench)
    framework = bench / "apps/frappe/frappe"
    functions = {node.name for node in ast.parse((framework / "utils/install.py").read_text()).body
                 if isinstance(node, ast.FunctionDef)}
    if "auto_generate_icons_and_sidebar" not in functions:
        if "create_desktop_icons_for_app" not in functions:
            raise ValueError("This Frappe build has no supported desktop-icon installation helper.")
        path = bench / "apps/logicx_app/logicx_app/install.py"
        text = path.read_text()
        old = "from frappe.utils.install import auto_generate_icons_and_sidebar"
        new = "from frappe.utils.install import create_desktop_icons_for_app as auto_generate_icons_and_sidebar"
        if old not in text and new not in text:
            raise ValueError("LogicX install hook changed. Review its compatibility before installation.")
        path.write_text(text.replace(old, new))
        print("LogicX: use the current Frappe desktop-icon helper.")
    legacy = framework / "desk/doctype/workspace_sidebar/workspace_sidebar.py"
    if "def auto_generate_sidebar_from_module(" not in legacy.read_text():
        convert_sidebars(bench)
        path = bench / "apps/logicx_biz/logicx_biz/desk_fixes.py"
        text = path.read_text()
        for signature in ("def cleanup_shadow_sidebars(app_name: str | None = None):", "def extend_bootinfo(bootinfo):"):
            marker = signature + "\n\t# Module Sidebars supersede the legacy sidebar cache repair.\n\treturn\n"
            if marker in text:
                continue
            if signature not in text:
                raise ValueError("LogicX Biz navigation hook changed. Review before installation.")
            text = text.replace(signature + "\n", marker, 1)
        path.write_text(text)
        print("LogicX Biz: converted curated navigation and retired obsolete cache repairs.")


def convert_sidebars(bench):
    import frappe
    from frappe.desk.doctype.sidebar.sidebar import SIDEBAR_ITEM_FIELDS, options_as_filters

    root = bench / "apps/logicx_biz/logicx_biz"
    for source in sorted((root / "workspace_sidebar").glob("*.json")):
        old = json.loads(source.read_text())
        module = old["module"].lower().replace(" ", "_")
        name = old["name"].lower().replace(" ", "_")
        folder = root / module / "sidebar" / name
        destination = folder / (name + ".json")
        if destination.exists():
            continue
        items = []
        for index, item in enumerate(old["items"], 1):
            item = frappe._dict(item)
            options_as_filters(item)
            items.append({"doctype": "Sidebar Item", "parentfield": "items", "parenttype": "Sidebar", "idx": index,
                          **{key: value for key, value in item.items() if key in SIDEBAR_ITEM_FIELDS}})
        document = {key: old[key] for key in ("name", "title", "module", "header_icon", "app", "standard")}
        document.update(doctype="Sidebar", items=items)
        folder.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(document, indent=1) + "\n")
        print("Converted sidebar: " + old["name"])


if __name__ == "__main__":
    apply("/home/frappe/frappe-bench")
