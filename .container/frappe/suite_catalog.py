"""Reviewed upstream releases for the optional Frappe application suite."""

APPS = {
    "hrms": {"ref": "v16.52.0", "route": "/hrms", "doctype": "Employee"},
    "telephony": {"ref": "9447577500a25d242088398157b72c654fa34b20", "doctype": "TP Twilio Settings"},
    "raven": {"ref": "v3.0.0", "route": "/raven", "doctype": "Raven Channel"},
    "crm": {"ref": "v1.89.1", "route": "/crm", "doctype": "CRM Lead"},
    "helpdesk": {"ref": "v1.31.0", "route": "/helpdesk", "doctype": "HD Ticket"},
    "insights": {"ref": "v3.15.1", "route": "/insights", "doctype": "Insights Workbook"},
}


def repository(name):
    if name not in APPS:
        raise ValueError("Unsupported suite app: " + name)
    return "https://github.com/frappe/" + name + ".git"
