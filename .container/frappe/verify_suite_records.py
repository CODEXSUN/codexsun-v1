"""Run reversible installation checks inside the selected Frappe bench.

Temporary records use explicit names so the checks do not consume business number series.
No email, chat message, or provider transaction is created by these checks.
"""

import json
import os
import sys
import uuid

import frappe


def main():
    os.chdir("sites")
    frappe.init(site=sys.argv[1])
    frappe.connect()
    frappe.set_user("Administrator")
    try:
        required = {"hrms", "raven", "crm", "helpdesk", "insights", "telephony"}
        if not required.issubset(frappe.get_installed_apps()):
            raise RuntimeError("Install the full suite before running record checks.")
        token = "codexsun-install-smoke-" + uuid.uuid4().hex[:12]
        checks = [
            ("Shift Type", {"start_time": "09:00:00", "end_time": "18:00:00", "enable_auto_attendance": 0}, "start_time"),
            ("CRM Lead", {"first_name": token, "status": "New"}, "first_name"),
            ("Insights Workbook", {"title": token}, "title"),
        ]
        results = {}
        for doctype, fields, read_field in checks:
            check_record(doctype, token, fields, read_field)
            results[doctype] = "create/read/delete passed; fixture removed"
        if not frappe.db.exists("Raven User", {"user": "Administrator"}):
            raise RuntimeError("Raven did not create its Administrator user.")
        results["Raven"] = "Administrator user exists; no messages sent"
        if not frappe.db.exists("HD Service Level Agreement", {"default_sla": 1}):
            raise RuntimeError("Helpdesk did not create its default service level agreement.")
        if not frappe.db.exists("HD Ticket Priority", "Medium"):
            raise RuntimeError("Helpdesk did not create its default ticket priorities.")
        results["Helpdesk"] = "default service level agreement and ticket priorities exist"
        if not frappe.db.exists("Insights Team", "Admin"):
            raise RuntimeError("Insights did not create its Admin team.")
        results["Insights"] = "Admin team exists"
        print(json.dumps({"record_checks": results, "temporary_records_remaining": 0}, indent=2))
    finally:
        frappe.db.rollback()
        frappe.destroy()


def check_record(doctype, token, fields, read_field):
    if frappe.db.exists(doctype, token):
        raise RuntimeError("The installation test name already exists. No record was changed.")
    try:
        doc = frappe.get_doc({"doctype": doctype, **fields})
        doc.insert(set_name=token)
        frappe.db.commit()
        stored = frappe.get_doc(doctype, token)
        if read_field == "start_time":
            if str(stored.start_time) not in ("9:00:00", "09:00:00"):
                raise RuntimeError("The persisted shift time differs from its input.")
        elif stored.get(read_field) != fields[read_field]:
            raise RuntimeError("A persisted suite record differs from its input: " + doctype)
        stored.delete()
        frappe.db.commit()
        if frappe.db.exists(doctype, token):
            raise RuntimeError("The suite test record was not deleted: " + doctype)
    finally:
        frappe.db.rollback()
        if frappe.db.exists(doctype, token):
            frappe.delete_doc(doctype, token)
            frappe.db.commit()


if __name__ == "__main__":
    main()
