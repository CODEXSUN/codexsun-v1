import frappe


def update_customer_name(doc, method=None, *args):
    if method == "on_update" and not doc.has_value_changed("customer_name"):
        return
    customer_name = frappe.db.get_value("Customer", doc.name, "customer_name")
    frappe.db.set_value(
        "Mobile Contact Customer",
        {"customer": doc.name},
        "customer_name",
        customer_name,
        update_modified=False,
    )
