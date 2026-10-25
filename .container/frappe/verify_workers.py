"""Execute harmless jobs through both installed worker queues."""

import os
import sys
import time
import uuid

import frappe


def main():
    os.chdir("sites")
    frappe.init(site=sys.argv[1])
    frappe.connect()
    try:
        for queue in ("short", "long"):
            job = frappe.enqueue("frappe.utils.now", queue=queue, at_front=True,
                                 job_id="codexsun-frappe-verify-" + uuid.uuid4().hex)
            for attempt in range(60):
                status = job.get_status(refresh=True)
                if status == "finished":
                    print(f"PASS: {queue} worker executed verification job")
                    job.delete()
                    break
                if status in ("failed", "stopped", "canceled"):
                    raise RuntimeError(f"{queue} worker verification job failed")
                time.sleep(1)
            else:
                raise RuntimeError(f"{queue} worker did not execute its verification job")
    finally:
        frappe.destroy()


if __name__ == "__main__":
    main()
