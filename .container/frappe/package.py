#!/usr/bin/env python3
"""Create or verify a source-only portable installer. Never package local secrets or data."""

import argparse
import hashlib
import json
from pathlib import Path
import sys
import zipfile


FILES = (
    "README.md", "AUDIT.md", "setup.sh", "setup.ps1", "setup.py", "install.sh", "install.py",
    "configuration.py", "execution.py", "infrastructure.py", "backup.py", "verify.py",
    "verify_workers.py", "verify-browser.mjs", "browser-client.mjs", "package.py",
    "init_frappe.py", "healthcheck.py", "Dockerfile", "supervisord.conf", "compose.env",
    "docker-compose.yml", "docker-compose.entry.yml", "docker-compose.init.yml",
    "frappe.env.sample", ".gitignore", ".dockerignore", "test_install.py", "test_safety.py", "test_workflow.py",
    "setup-app.py", "setup-app.sh", "Dockerfile.apps", "logicx_compat.py", "test_apps.py", "test_compat.py",
    "frappe_suite.py", "suite_catalog.py", "Dockerfile.suite", "test_suite.py", "SUITE-AUDIT.md", "verify_suite_records.py",
    "suite_compat.py",
)


def verify_package(folder):
    folder = Path(folder).resolve()
    manifest = json.loads((folder / "MANIFEST.sha256.json").read_text())
    if set(manifest) != set(FILES):
        raise ValueError("The package manifest does not match the source allowlist.")
    for name, digest in manifest.items():
        path = folder / name
        if path.is_symlink() or not path.is_file():
            raise ValueError("Package file is missing or is a symbolic link: " + name)
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError("Package checksum mismatch: " + name)
    return len(manifest)


def create_package(output):
    root = Path(__file__).resolve().parent
    contents = {}
    for name in FILES:
        path = root / name
        if path.is_symlink():
            raise ValueError("Refusing to package a symbolic link: " + name)
        contents[name] = path.read_bytes()
    manifest = {name: hashlib.sha256(data).hexdigest() for name, data in contents.items()}
    output = Path(output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in contents.items():
            archive.writestr("frappe-installer/" + name, data)
        archive.writestr("frappe-installer/MANIFEST.sha256.json", json.dumps(manifest, indent=2) + "\n")
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix(output.suffix + ".sha256").write_text(digest + "  " + output.name + "\n")
    print(f"Portable installer: {output}\nFiles: {len(contents)}\nSHA-256: {digest}")


def main():
    root = Path(__file__).resolve().parent
    default = root.parent.parent / "dist/frappe-installer.zip" if root.parent.name == ".container" else root / "reports/frappe-installer.zip"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default=str(default))
    parser.add_argument("--verify", metavar="EXTRACTED_FOLDER")
    args = parser.parse_args()
    if args.verify:
        print(f"Verified {verify_package(args.verify)} package file checksums.")
    else:
        create_package(args.output)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        sys.exit(str(error))
