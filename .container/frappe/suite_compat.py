"""Use the existing HTTP proxy for production Socket.IO clients in the suite image."""

import json
from pathlib import Path


SOCKET_FILES = (
    "hrms/frontend/src/socket.js",
    "crm/frontend/src/socket.js",
    "helpdesk/desk/src/socket.ts",
    "insights/frontend/src/socket.js",
)
OLD_URL = "let url = `${protocol}://${host}${port}/${siteName}`"
PROXY_URL = "let url = import.meta.env.DEV ? `${protocol}://${host}${port}/${siteName}` : `${window.location.origin}/${siteName}`"


def apply(bench):
    bench = Path(bench)
    config = bench / "sites/common_site_config.json"
    settings = json.loads(config.read_text()) if config.exists() else {}
    # This file belongs to the image build. The site's private volume replaces it at runtime.
    settings.setdefault("socketio_port", 9000)
    config.write_text(json.dumps(settings, indent=2) + "\n")
    for name in SOCKET_FILES:
        path = bench / "apps" / name
        source = path.read_text()
        if PROXY_URL in source:
            continue
        if OLD_URL not in source:
            raise ValueError("The upstream Socket.IO client changed. Review before building: " + name)
        path.write_text(source.replace(OLD_URL, PROXY_URL, 1))
        print("Production Socket.IO uses the site proxy: " + name)


if __name__ == "__main__":
    apply("/home/frappe/frappe-bench")
