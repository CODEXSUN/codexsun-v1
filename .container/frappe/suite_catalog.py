"""Reviewed upstream releases for the optional Frappe application suite."""

APPS = {
    "hrms": {"ref": "v16.52.0", "route": "/hrms", "doctype": "Employee"},
    "crm": {"ref": "v1.89.1", "route": "/crm", "doctype": "CRM Lead"},
}


def repository(name):
    if name not in APPS:
        raise ValueError("Unsupported suite app: " + name)
    return "https://github.com/frappe/" + name + ".git"
