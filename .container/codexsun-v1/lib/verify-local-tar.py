"""Read a decrypted tar stream without extracting files or executing commands."""
import hashlib
import json
import sys
import tarfile
from pathlib import PurePosixPath


def verify(stream, prefixes):
    if not prefixes or any(not safe(prefix) for prefix in prefixes):
        raise ValueError("Invalid reviewed archive prefixes")
    files, size, entries = 0, 0, 0
    digest = hashlib.sha256()
    with tarfile.open(fileobj=stream, mode="r|*") as archive:
        for member in archive:
            name = member.name.removeprefix("./").rstrip("/")
            if not safe(name) or not any(name == p or name.startswith(p + "/") for p in prefixes):
                raise ValueError("Archive exceeds tenant scope")
            if not (member.isfile() or member.isdir()):
                raise ValueError("Archive contains a link or special file")
            entries += 1
            if entries > 100000 or member.size < 0:
                raise ValueError("Archive exceeds verification limits")
            if member.isfile():
                files += 1
                data = archive.extractfile(member)
                while chunk := data.read(1024 * 1024):
                    size += len(chunk)
                    if size > 512 * 1024 * 1024:
                        raise ValueError("Archive exceeds verification limits")
                    digest.update(chunk)
    if not entries:
        raise ValueError("Empty tenant archive")
    return {"files": files, "fileBytes": size, "contentSha256": digest.hexdigest(), "extracted": False}


def safe(name):
    return bool(name and not name.startswith("/") and "\\" not in name and ":" not in name
                and "\x00" not in name and ".." not in PurePosixPath(name).parts)


if __name__ == "__main__":
    try:
        print(json.dumps(verify(sys.stdin.buffer, json.loads(sys.argv[1]))))
    except (ValueError, EOFError, tarfile.TarError, OSError):
        print("Tenant archive verification failed", file=sys.stderr)
        sys.exit(1)
