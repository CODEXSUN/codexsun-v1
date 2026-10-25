"""Private operator settings. Values are never evaluated as shell code."""

import json
import os
from pathlib import Path
import re
from urllib.parse import unquote, urlparse


def read_settings(path):
    result = {}
    for number, line in enumerate(Path(path).read_text(encoding="utf-8-sig").splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if not separator or not re.fullmatch(r"CODEXSUN_FRAPPE_[A-Z_]+", key):
            raise ValueError(f"Invalid setting on line {number}. Use KEY=value without shell commands.")
        if key in result:
            raise ValueError(f"Duplicate setting {key} on line {number}.")
        if value.startswith('"'):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise ValueError(f"Invalid quoted value on line {number}. Use JSON string escaping.") from None
        elif value.startswith("'"):
            if len(value) < 2 or not value.endswith("'"):
                raise ValueError(f"Unclosed literal value on line {number}.")
            value = value[1:-1]
        if not isinstance(value, str) or any(char in value for char in ("\n", "\r", "\0")):
            raise ValueError(f"Invalid multiline or non-string value on line {number}.")
        result[key] = value
    return result


def write_settings(path, settings):
    validate_settings(settings)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
        stream.write("# Private settings. Read by Python, never source this file in a shell.\n")
        for key, value in settings.items():
            stream.write(f"{key}={json.dumps(str(value), ensure_ascii=True)}\n")


def validate_settings(settings):
    if any(not isinstance(value, str) or any(char in value for char in ("\n", "\r", "\0")) for value in settings.values()):
        raise ValueError("Settings must be single-line strings without null characters.")
    required = ("SITE", "NETWORK", "DB_HOST", "DB_NAME", "DB_PASSWORD", "REDIS_HOST",
                "REDIS_CACHE", "REDIS_QUEUE", "ADMIN_PASSWORD")
    for suffix in required:
        key = "CODEXSUN_FRAPPE_" + suffix
        if not settings.get(key) or "CHANGE_ME" in settings[key]:
            raise ValueError(f"Configure {key} in the private environment file.")
    site = settings["CODEXSUN_FRAPPE_SITE"]
    if len(site) > 253 or any(not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label)
                            for label in site.split(".")):
        raise ValueError("Use a lowercase site hostname with valid DNS labels and no scheme, path, or port.")
    for key in ("PORT", "DB_PORT"):
        value = settings.get("CODEXSUN_FRAPPE_" + key, "8088" if key == "PORT" else "3306")
        if not value.isdigit() or not 1 <= int(value) <= 65535:
            raise ValueError(f"CODEXSUN_FRAPPE_{key} must be a port between 1 and 65535.")
    if not re.fullmatch(r"codexsun_[a-z0-9_]{1,50}", settings["CODEXSUN_FRAPPE_DB_NAME"]):
        raise ValueError("Use a new codexsun_ database name with lowercase letters, digits, or underscores.")
    if len(settings["CODEXSUN_FRAPPE_ADMIN_PASSWORD"]) < 16:
        raise ValueError("Use an Administrator password of at least 16 characters.")
    if settings.get("CODEXSUN_FRAPPE_ENTRY_NETWORK") == settings["CODEXSUN_FRAPPE_NETWORK"]:
        raise ValueError("Remove the duplicate entry network setting when using one non-internal network.")
    for key in ("DB_HOST", "REDIS_HOST"):
        if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]*", settings["CODEXSUN_FRAPPE_" + key]):
            raise ValueError(f"CODEXSUN_FRAPPE_{key} must name an existing Docker container.")
    urls = [urlparse(settings["CODEXSUN_FRAPPE_" + key]) for key in ("REDIS_CACHE", "REDIS_QUEUE")]
    for url in urls:
        if url.scheme != "redis" or url.hostname != settings["CODEXSUN_FRAPPE_REDIS_HOST"] or url.port != 6379:
            raise ValueError("Both Redis URLs must use the selected shared Redis container on port 6379.")
        index = url.path.lstrip("/")
        if not index.isdigit() or int(index) == 0 or str(int(index)) != index or url.query or url.fragment:
            raise ValueError("Reserve canonical nonzero Redis database indexes such as /10 and /11.")
    if urls[0].path == urls[1].path:
        raise ValueError("Cache and queue must use distinct Redis databases.")
    if (urls[0].username, urls[0].password) != (urls[1].username, urls[1].password):
        raise ValueError("Both URLs must authenticate to the same shared Redis service.")


def secrets(settings):
    values = [value for key, value in settings.items() if key.endswith("PASSWORD")]
    for key in ("CODEXSUN_FRAPPE_REDIS_CACHE", "CODEXSUN_FRAPPE_REDIS_QUEUE"):
        if settings.get(key):
            password = urlparse(settings[key]).password
            if password:
                values += [password, unquote(password)]
    values += [json.dumps(value)[1:-1] for value in values if value]
    return sorted(set(filter(None, values)), key=len, reverse=True)
