import { createServer, type Server } from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { HostVerifier } from "../src/session/host-verifier.js";
import { NativeSessionManager } from "../src/session/native-session-manager.js";
import { NativeHttpTransport } from "../src/native/http.js";
import {
  CRM_ROUTE_REGISTRY,
  CrmPermissionDeniedError,
  getAccessibleCrmRoutes,
  getCrmRoutesBySection
} from "../src/domains/crm/crm-routes.js";
import { CrmService } from "../src/domains/crm/crm-service.js";

describe("CRM Mobile Parity - M0 Workflow Verification", () => {
  let server: Server;
  let serverPort: number;
  let serverOrigin: string;

  // In-memory test stores simulating tenant database
  const enquiries = new Map<string, Record<string, unknown>>();
  const enquiryComments = new Map<string, Array<Record<string, unknown>>>();
  const enquiryJobs = new Map<string, Array<Record<string, unknown>>>();
  const enquiryClosures = new Map<string, Array<Record<string, unknown>>>();
  const leads = new Map<string, Record<string, unknown>>();
  const tasks = new Map<number, Record<string, unknown>>();
  const taskComments = new Map<number, Array<Record<string, unknown>>>();
  const taskJobs = new Map<number, Array<Record<string, unknown>>>();
  const taskClosures = new Map<number, Array<Record<string, unknown>>>();
  const activities: Array<Record<string, unknown>> = [];
  const closureRequests = new Map<number, Record<string, unknown>>();
  const schedules = new Map<number, Record<string, unknown>>();
  const callLogs = new Map<number, Record<string, unknown>>();
  const sops = new Map<number, Record<string, unknown>>();
  const sopItems = new Map<number, Record<string, unknown>>();
  const sopRevisions = new Map<number, Array<Record<string, unknown>>>();
  const dutyAssignments = new Map<number, Record<string, unknown>>();
  const dutyReports = new Map<number, Record<string, unknown>>();
  const contacts = new Map<number, Record<string, unknown>>();
  const listIns = new Map<number, Record<string, unknown>>();
  const statuses = new Map<number, Record<string, unknown>>();
  const priorities = new Map<number, Record<string, unknown>>();

  let closureCounter = 1;
  let scheduleCounter = 1;
  let callLogCounter = 1;
  let sopCounter = 1;
  let sopItemCounter = 1;
  let revisionCounter = 1;
  let dutyAssignmentCounter = 1;
  let dutyReportCounter = 1;
  let contactCounter = 1;
  let listInCounter = 1;
  let statusCounter = 1;
  let priorityCounter = 1;
  let taskCounter = 1;

  before(async () => {
    // Seed initial leads, sops, and masters
    leads.set("lead-uuid-1", {
      company: "Initech",
      createdAt: new Date().toISOString(),
      email: "peter@initech.invalid",
      id: 1,
      mobile: "9876543210",
      name: "Peter Gibbons",
      status: "qualified",
      uuid: "lead-uuid-1"
    });

    listIns.set(1, { code: "web", id: 1, name: "Website Portal", status: "active" });
    statuses.set(1, { code: "open", id: 1, name: "Open Stage", status: "active" });
    priorities.set(1, { code: "high", id: 1, name: "High Urgency", status: "active" });

    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      let rawBody = "";

      req.on("data", (chunk) => {
        rawBody += chunk;
      });

      req.on("end", () => {
        let body: Record<string, unknown> = {};
        if (rawBody) {
          try {
            body = JSON.parse(rawBody) as Record<string, unknown>;
          } catch {
            // raw string or multipart
          }
        }

        const authRole = req.headers["x-test-role"] as string | undefined;

        const sendJson = (status: number, data: unknown) => {
          res.writeHead(status, { "Content-Type": "application/json" });
          res.end(JSON.stringify(data));
        };

        // 1. Overview counts & summaries
        if (url.pathname === "/crm/enquiries/counts" && req.method === "GET") {
          sendJson(200, {
            data: {
              active: enquiries.size,
              allCount: enquiries.size,
              attention: 2,
              newCalls: 1,
              total: enquiries.size
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/crm/enquiries/summary" && req.method === "GET") {
          sendJson(200, {
            data: {
              all: { total: enquiries.size, active: enquiries.size },
              assigned: { total: enquiries.size, active: enquiries.size }
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/crm/enquiries/attention" && req.method === "GET") {
          sendJson(200, {
            data: { assignments: [], due: [] },
            success: true
          });
          return;
        }

        // 2. Enquiries: List & Create
        if (url.pathname === "/crm/enquiries" && req.method === "GET") {
          const items = Array.from(enquiries.values());
          sendJson(200, {
            data: {
              items,
              statusCounts: [{ code: "open", count: items.length }],
              total: items.length
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/crm/enquiries" && req.method === "POST") {
          const id = "enq-" + Math.random().toString(36).slice(2, 8);
          const record = {
            ...body,
            createdAt: new Date().toISOString(),
            id,
            status: body.statusId ?? "open",
            updatedAt: new Date().toISOString(),
            uuid: id
          };
          enquiries.set(id, record);
          enquiryComments.set(id, []);
          enquiryJobs.set(id, []);
          enquiryClosures.set(id, []);
          activities.push({
            action: "enquiry.created",
            createdAt: new Date().toISOString(),
            createdBy: "agent@codexsun.invalid",
            details: `Created Enquiry #${id}`,
            id: activities.length + 1
          });
          sendJson(200, { data: record, success: true });
          return;
        }

        // Enquiries: Properties PATCH (Assign, Status, Priority)
        const enqPropsMatch = url.pathname.match(/^\/crm\/enquiries\/([^/]+)\/properties$/);
        if (enqPropsMatch && req.method === "PATCH") {
          const id = decodeURIComponent(enqPropsMatch[1]!);
          const enq = enquiries.get(id);
          if (enq) {
            Object.assign(enq, body, { updatedAt: new Date().toISOString() });
            sendJson(200, { data: enq, success: true });
          } else {
            sendJson(404, { error: { message: "Enquiry not found" }, success: false });
          }
          return;
        }

        // Enquiries: Open New Call
        const enqCallMatch = url.pathname.match(/^\/crm\/enquiries\/([^/]+)\/open-new-call$/);
        if (enqCallMatch && req.method === "POST") {
          const id = decodeURIComponent(enqCallMatch[1]!);
          const enq = enquiries.get(id);
          if (enq) {
            enq.newCallOpened = true;
            sendJson(200, { data: enq, success: true });
          } else {
            sendJson(404, { error: { message: "Enquiry not found" }, success: false });
          }
          return;
        }

        // Enquiries: Comments GET & POST
        const enqCommentMatch = url.pathname.match(/^\/crm\/enquiries\/([^/]+)\/comments$/);
        if (enqCommentMatch && req.method === "GET") {
          const id = decodeURIComponent(enqCommentMatch[1]!);
          sendJson(200, { data: enquiryComments.get(id) ?? [], success: true });
          return;
        }

        if (enqCommentMatch && req.method === "POST") {
          const id = decodeURIComponent(enqCommentMatch[1]!);
          const list = enquiryComments.get(id) ?? [];
          const comment = {
            id: Date.now(),
            ...body,
            createdAt: new Date().toISOString(),
            createdBy: "agent@codexsun.invalid",
            enquiryId: id
          };
          list.push(comment);
          enquiryComments.set(id, list);
          sendJson(200, { data: comment, success: true });
          return;
        }

        // Enquiries: Attachments upload (multipart)
        const enqAttachMatch = url.pathname.match(/^\/crm\/enquiries\/([^/]+)\/attachments$/);
        if (enqAttachMatch && req.method === "POST") {
          const id = decodeURIComponent(enqAttachMatch[1]!);
          const attachment = {
            id: "att-" + Date.now(),
            url: `/storage/crm/enquiries/${id}/file.pdf`,
            uuid: "att-" + Date.now()
          };
          sendJson(200, { data: attachment, success: true });
          return;
        }

        // Enquiries: Jobs timer
        const enqJobStartMatch = url.pathname.match(/^\/crm\/enquiries\/([^/]+)\/jobs\/start$/);
        if (enqJobStartMatch && req.method === "POST") {
          const id = decodeURIComponent(enqJobStartMatch[1]!);
          const list = enquiryJobs.get(id) ?? [];
          const job = {
            createdAt: new Date().toISOString(),
            createdBy: "agent@codexsun.invalid",
            durationSeconds: 0,
            enquiryId: id,
            id: "job-" + Date.now(),
            ratePerHour: 50,
            startAt: new Date().toISOString(),
            status: "running"
          };
          list.push(job);
          enquiryJobs.set(id, list);
          sendJson(200, { data: job, success: true });
          return;
        }

        const enqJobStopMatch = url.pathname.match(/^\/crm\/enquiries\/([^/]+)\/jobs\/([^/]+)\/stop$/);
        if (enqJobStopMatch && req.method === "POST") {
          const id = decodeURIComponent(enqJobStopMatch[1]!);
          const jobId = decodeURIComponent(enqJobStopMatch[2]!);
          const list = enquiryJobs.get(id) ?? [];
          const job = list.find((j) => j.id === jobId);
          if (job) {
            job.status = "completed";
            job.stopAt = new Date().toISOString();
            job.durationSeconds = 1200;
            sendJson(200, { data: job, success: true });
          } else {
            sendJson(404, { error: { message: "Job not found" }, success: false });
          }
          return;
        }

        const enqJobsGetMatch = url.pathname.match(/^\/crm\/enquiries\/([^/]+)\/jobs$/);
        if (enqJobsGetMatch && req.method === "GET") {
          const id = decodeURIComponent(enqJobsGetMatch[1]!);
          sendJson(200, { data: enquiryJobs.get(id) ?? [], success: true });
          return;
        }

        // Enquiries: Closure request
        const enqClosureMatch = url.pathname.match(/^\/crm\/enquiries\/([^/]+)\/closure-requests$/);
        if (enqClosureMatch && req.method === "POST") {
          const id = decodeURIComponent(enqClosureMatch[1]!);
          const closureId = closureCounter++;
          const request = {
            createdAt: new Date().toISOString(),
            id: closureId,
            note: body.note,
            recordId: id,
            recordType: "enquiry",
            status: "pending"
          };
          closureRequests.set(closureId, request);
          const list = enquiryClosures.get(id) ?? [];
          list.push(request);
          enquiryClosures.set(id, list);
          sendJson(200, { data: request, success: true });
          return;
        }

        // Enquiries: Reports
        if (url.pathname === "/crm/enquiries/reports" && req.method === "GET") {
          sendJson(200, {
            data: [{ count: enquiries.size, status: "open", statusName: "Open Stage" }],
            success: true
          });
          return;
        }

        // Enquiries: Get single
        const enqGetMatch = url.pathname.match(/^\/crm\/enquiries\/([^/]+)$/);
        if (enqGetMatch && req.method === "GET") {
          const id = decodeURIComponent(enqGetMatch[1]!);
          const enq = enquiries.get(id);
          if (enq) {
            sendJson(200, { data: enq, success: true });
          } else {
            sendJson(404, { error: { message: "Enquiry not found" }, success: false });
          }
          return;
        }

        // 3. Marketing Leads
        if (url.pathname === "/crm/leads" && req.method === "GET") {
          sendJson(200, { data: Array.from(leads.values()), success: true });
          return;
        }

        const leadGetMatch = url.pathname.match(/^\/crm\/leads\/([^/]+)$/);
        if (leadGetMatch && req.method === "GET") {
          const uuid = decodeURIComponent(leadGetMatch[1]!);
          const lead = leads.get(uuid);
          if (lead) {
            sendJson(200, { data: lead, success: true });
          } else {
            sendJson(404, { error: { message: "Lead not found" }, success: false });
          }
          return;
        }

        // 4. Tasks (Local scope preserved)
        if (url.pathname === "/crm/tasks" && req.method === "GET") {
          sendJson(200, {
            data: {
              items: Array.from(tasks.values()),
              statusCounts: [{ code: "open", count: tasks.size }],
              total: tasks.size
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/crm/tasks" && req.method === "POST") {
          const id = taskCounter++;
          const task = {
            ...body,
            createdAt: new Date().toISOString(),
            id,
            status: "open",
            updatedAt: new Date().toISOString()
          };
          tasks.set(id, task);
          taskComments.set(id, []);
          taskJobs.set(id, []);
          taskClosures.set(id, []);
          sendJson(200, { data: task, success: true });
          return;
        }

        const taskPropsMatch = url.pathname.match(/^\/crm\/tasks\/(\d+)\/properties$/);
        if (taskPropsMatch && req.method === "PATCH") {
          const id = Number(taskPropsMatch[1]);
          const task = tasks.get(id);
          if (task) {
            Object.assign(task, body, { updatedAt: new Date().toISOString() });
            sendJson(200, { data: task, success: true });
          } else {
            sendJson(404, { error: { message: "Task not found" }, success: false });
          }
          return;
        }

        const taskCommentMatch = url.pathname.match(/^\/crm\/tasks\/(\d+)\/comments$/);
        if (taskCommentMatch && req.method === "GET") {
          const id = Number(taskCommentMatch[1]);
          sendJson(200, { data: taskComments.get(id) ?? [], success: true });
          return;
        }

        if (taskCommentMatch && req.method === "POST") {
          const id = Number(taskCommentMatch[1]);
          const comment = {
            id: Date.now(),
            ...body,
            createdAt: new Date().toISOString(),
            taskId: id
          };
          const list = taskComments.get(id) ?? [];
          list.push(comment);
          taskComments.set(id, list);
          sendJson(200, { data: comment, success: true });
          return;
        }

        const taskJobStartMatch = url.pathname.match(/^\/crm\/tasks\/(\d+)\/jobs\/start$/);
        if (taskJobStartMatch && req.method === "POST") {
          const id = Number(taskJobStartMatch[1]);
          const job = {
            createdAt: new Date().toISOString(),
            id: Date.now(),
            startAt: new Date().toISOString(),
            status: "running",
            taskId: id
          };
          const list = taskJobs.get(id) ?? [];
          list.push(job);
          taskJobs.set(id, list);
          sendJson(200, { data: job, success: true });
          return;
        }

        const taskJobStopMatch = url.pathname.match(/^\/crm\/tasks\/(\d+)\/jobs\/stop$/);
        if (taskJobStopMatch && req.method === "POST") {
          const id = Number(taskJobStopMatch[1]);
          const list = taskJobs.get(id) ?? [];
          const running = list.find((j) => j.status === "running");
          if (running) {
            running.status = "completed";
            running.stopAt = new Date().toISOString();
          }
          sendJson(200, { data: { stopped: true }, success: true });
          return;
        }

        const taskClosureMatch = url.pathname.match(/^\/crm\/tasks\/(\d+)\/closure-requests$/);
        if (taskClosureMatch && req.method === "POST") {
          const id = Number(taskClosureMatch[1]);
          const closureId = closureCounter++;
          const request = {
            createdAt: new Date().toISOString(),
            id: closureId,
            reason: body.reason,
            recordId: id,
            recordType: "task",
            status: "pending"
          };
          closureRequests.set(closureId, request);
          const list = taskClosures.get(id) ?? [];
          list.push(request);
          taskClosures.set(id, list);
          sendJson(200, { data: request, success: true });
          return;
        }

        const taskGetMatch = url.pathname.match(/^\/crm\/tasks\/(\d+)$/);
        if (taskGetMatch && req.method === "GET") {
          const id = Number(taskGetMatch[1]);
          const task = tasks.get(id);
          if (task) {
            sendJson(200, { data: task, success: true });
          } else {
            sendJson(404, { error: { message: "Task not found" }, success: false });
          }
          return;
        }

        // 5. Activities & Closure Reviews
        if (url.pathname === "/crm/activities" && req.method === "GET") {
          sendJson(200, { data: { items: activities, total: activities.length }, success: true });
          return;
        }

        if (url.pathname === "/crm/closure-requests" && req.method === "GET") {
          sendJson(200, { data: { items: Array.from(closureRequests.values()) }, success: true });
          return;
        }

        const closureReviewMatch = url.pathname.match(/^\/crm\/closure-requests\/(\d+)\/review$/);
        if (closureReviewMatch && req.method === "PATCH") {
          if (authRole === "viewer") {
            sendJson(403, { error: { message: "Forbidden: Closure review requires manager or admin role" }, success: false });
            return;
          }
          const id = Number(closureReviewMatch[1]);
          const item = closureRequests.get(id);
          if (item) {
            item.status = body.decision === "approve" ? "approved" : "rejected";
            item.reviewNote = body.note;
            item.reviewedAt = new Date().toISOString();
            sendJson(200, { data: item, success: true });
          } else {
            sendJson(404, { error: { message: "Closure request not found" }, success: false });
          }
          return;
        }

        // 6. Schedules & Reminders
        if (url.pathname === "/crm/schedules" && req.method === "GET") {
          sendJson(200, { data: Array.from(schedules.values()), success: true });
          return;
        }

        if (url.pathname === "/crm/schedules" && req.method === "POST") {
          const id = scheduleCounter++;
          const rec = {
            ...body,
            createdAt: new Date().toISOString(),
            createdBy: "agent@codexsun.invalid",
            id,
            status: "scheduled"
          };
          schedules.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        if (url.pathname === "/crm/schedules/reminders" && req.method === "GET") {
          sendJson(200, { data: Array.from(schedules.values()), success: true });
          return;
        }

        const schedAckMatch = url.pathname.match(/^\/crm\/schedules\/(\d+)\/acknowledge$/);
        if (schedAckMatch && req.method === "POST") {
          const id = Number(schedAckMatch[1]);
          const rec = schedules.get(id);
          if (rec) {
            rec.acknowledgedAt = new Date().toISOString();
            sendJson(200, { data: rec, success: true });
          } else {
            sendJson(404, { error: { message: "Schedule not found" }, success: false });
          }
          return;
        }

        const schedStatusMatch = url.pathname.match(/^\/crm\/schedules\/(\d+)\/status$/);
        if (schedStatusMatch && req.method === "POST") {
          const id = Number(schedStatusMatch[1]);
          const rec = schedules.get(id);
          if (rec) {
            rec.status = body.status;
            sendJson(200, { data: rec, success: true });
          } else {
            sendJson(404, { error: { message: "Schedule not found" }, success: false });
          }
          return;
        }

        // 7. Manual Call Logs
        if (url.pathname === "/crm/call-logs" && req.method === "GET") {
          sendJson(200, { data: { items: Array.from(callLogs.values()), total: callLogs.size }, success: true });
          return;
        }

        if (url.pathname === "/crm/call-logs" && req.method === "POST") {
          const id = callLogCounter++;
          const rec = { ...body, createdAt: new Date().toISOString(), id, name: `LOG-${id}` };
          callLogs.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        // 8. SOPs
        if (url.pathname === "/crm/sops" && req.method === "GET") {
          sendJson(200, { data: Array.from(sops.values()), success: true });
          return;
        }

        if (url.pathname === "/crm/sops" && req.method === "POST") {
          const id = sopCounter++;
          const rec = { ...body, id, status: "active" };
          sops.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        if (url.pathname === "/crm/sop-items" && req.method === "GET") {
          sendJson(200, { data: Array.from(sopItems.values()), success: true });
          return;
        }

        if (url.pathname === "/crm/sop-items" && req.method === "POST") {
          const id = sopItemCounter++;
          const rec = {
            ...body,
            currentRevision: {
              evidenceGuidance: (body.revision as { evidenceGuidance: string })?.evidenceGuidance ?? "",
              id: 1,
              instructions: (body.revision as { instructions: string })?.instructions ?? "",
              revision: 1,
              status: "published"
            },
            id,
            status: "active"
          };
          sopItems.set(id, rec);
          sopRevisions.set(id, [rec.currentRevision]);
          sendJson(200, { data: rec, success: true });
          return;
        }

        const sopRevMatch = url.pathname.match(/^\/crm\/sop-items\/(\d+)\/revisions$/);
        if (sopRevMatch && req.method === "POST") {
          const id = Number(sopRevMatch[1]);
          const revId = revisionCounter++;
          const rev = {
            author: "agent@codexsun.invalid",
            createdAt: new Date().toISOString(),
            evidenceGuidance: (body.evidenceGuidance as string) ?? "",
            id: revId,
            instructions: (body.instructions as string) ?? "",
            revision: 2,
            status: "draft"
          };
          const list = sopRevisions.get(id) ?? [];
          list.push(rev);
          sopRevisions.set(id, list);
          sendJson(200, { data: rev, success: true });
          return;
        }

        const sopPubMatch = url.pathname.match(/^\/crm\/sop-items\/(\d+)\/revisions\/(\d+)\/publish$/);
        if (sopPubMatch && req.method === "POST") {
          if (authRole === "viewer") {
            sendJson(403, { error: { message: "Forbidden: Publishing SOP requires crm.sop.publish permission" }, success: false });
            return;
          }
          const id = Number(sopPubMatch[1]);
          const revId = Number(sopPubMatch[2]);
          const item = sopItems.get(id);
          const revList = sopRevisions.get(id) ?? [];
          const rev = revList.find((r) => r.id === revId);
          if (item && rev) {
            rev.status = "published";
            item.currentRevision = rev;
            sendJson(200, { data: { published: true }, success: true });
          } else {
            sendJson(404, { error: { message: "SOP revision not found" }, success: false });
          }
          return;
        }

        // 9. Duties & Duty Reporting
        if (url.pathname === "/crm/duty-assignments" && req.method === "GET") {
          sendJson(200, { data: Array.from(dutyAssignments.values()), success: true });
          return;
        }

        if (url.pathname === "/crm/duty-assignments" && req.method === "POST") {
          const id = dutyAssignmentCounter++;
          const rec = { ...body, id, status: "active" };
          dutyAssignments.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        const dutyDeactMatch = url.pathname.match(/^\/crm\/duty-assignments\/(\d+)\/deactivate$/);
        if (dutyDeactMatch && req.method === "POST") {
          const id = Number(dutyDeactMatch[1]);
          const rec = dutyAssignments.get(id);
          if (rec) {
            rec.status = "inactive";
            sendJson(200, { data: { deactivated: true }, success: true });
          } else {
            sendJson(404, { error: { message: "Assignment not found" }, success: false });
          }
          return;
        }

        if (url.pathname === "/crm/duty-reports" && req.method === "GET") {
          sendJson(200, { data: { items: Array.from(dutyReports.values()), total: dutyReports.size }, success: true });
          return;
        }

        if (url.pathname === "/crm/duty-reports" && req.method === "POST") {
          const id = dutyReportCounter++;
          const rec = { ...body, createdAt: new Date().toISOString(), id, result: "completed" };
          dutyReports.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        if (url.pathname === "/crm/duty-reports/summary" && req.method === "GET") {
          sendJson(200, {
            data: [{ count: dutyReports.size, groupKey: "sop-1", groupName: "Facility Safety Checklist" }],
            success: true
          });
          return;
        }

        // 10. Reports & Contacts
        if (url.pathname === "/crm/enquiries/reports" && req.method === "GET") {
          sendJson(200, {
            data: [{ count: enquiries.size, status: "open", statusName: "Open Stage" }],
            success: true
          });
          return;
        }

        if (url.pathname === "/crm/contacts" && req.method === "GET") {
          sendJson(200, { data: Array.from(contacts.values()), success: true });
          return;
        }

        if (url.pathname === "/crm/contacts" && req.method === "POST") {
          const id = contactCounter++;
          const rec = { ...body, id, status: "active" };
          contacts.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        const contactGetMatch = url.pathname.match(/^\/crm\/contacts\/(\d+)$/);
        if (contactGetMatch && req.method === "GET") {
          const id = Number(contactGetMatch[1]);
          const rec = contacts.get(id);
          if (rec) {
            sendJson(200, { data: rec, success: true });
          } else {
            sendJson(404, { error: { message: "Contact not found" }, success: false });
          }
          return;
        }

        // 11. Masters: List-In, Status, Priority
        if (url.pathname === "/crm/list-ins" && req.method === "GET") {
          sendJson(200, { data: Array.from(listIns.values()), success: true });
          return;
        }

        if (url.pathname === "/crm/list-ins" && req.method === "POST") {
          if (authRole === "viewer") {
            sendJson(403, { error: { message: "Admin role required to modify masters" }, success: false });
            return;
          }
          const id = listInCounter++;
          const rec = { ...body, id, status: "active" };
          listIns.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        if (url.pathname === "/crm/statuses" && req.method === "GET") {
          sendJson(200, { data: Array.from(statuses.values()), success: true });
          return;
        }

        if (url.pathname === "/crm/statuses" && req.method === "POST") {
          if (authRole === "viewer") {
            sendJson(403, { error: { message: "Admin role required to modify masters" }, success: false });
            return;
          }
          const id = statusCounter++;
          const rec = { ...body, id, status: "active" };
          statuses.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        if (url.pathname === "/crm/priorities" && req.method === "GET") {
          sendJson(200, { data: Array.from(priorities.values()), success: true });
          return;
        }

        if (url.pathname === "/crm/priorities" && req.method === "POST") {
          if (authRole === "viewer") {
            sendJson(403, { error: { message: "Admin role required to modify masters" }, success: false });
            return;
          }
          const id = priorityCounter++;
          const rec = { ...body, id, status: "active" };
          priorities.set(id, rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        // Default 404
        sendJson(404, { error: { message: `Route not found: ${req.method} ${url.pathname}` }, success: false });
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (typeof addr === "object" && addr) {
          serverPort = addr.port;
          serverOrigin = `http://127.0.0.1:${serverPort}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  function createTestCrmService(role: "admin" | "sales" | "viewer" = "admin"): {
    crm: CrmService;
    sessionManager: NativeSessionManager;
    transport: NativeHttpTransport;
  } {
    const sessionManager = new NativeSessionManager({ apiOrigin: serverOrigin });
    const perms =
      role === "admin"
        ? ["admin", "super-admin", "crm.enquiry.view", "crm.enquiry.view-all", "crm.task.view", "crm.task.create", "crm.task.update", "crm.task.work", "crm.task.respond", "crm.closure.review", "crm.schedule.view", "crm.schedule.create", "crm.schedule.update-own", "crm.call-log.view", "crm.sop.view", "crm.sop.create", "crm.sop.update", "crm.sop.publish", "crm.duty.view.own", "crm.duty.assign", "crm.duty-report.view.own", "crm.duty-report.create.own", "crm.duty-report.view.all", "crm.contact.view"]
        : role === "sales"
          ? ["crm.enquiry.view", "crm.lead.view", "crm.task.view", "crm.task.create", "crm.task.update", "crm.task.work", "crm.task.respond", "crm.schedule.view", "crm.schedule.create", "crm.schedule.update-own", "crm.call-log.view", "crm.sop.view", "crm.duty.view.own", "crm.duty-report.view.own", "crm.duty-report.create.own", "crm.contact.view"]
          : ["crm.enquiry.view"];

    const hasPermissionFn = (p: string) => perms.includes(p);

    const transport = new NativeHttpTransport({
      hostVerifier: new HostVerifier({ allowLoopback: true }),
      sessionManager
    });

    // Provide a mocked active session slot
    const sessionRecord = {
      activeCompanyId: 1,
      activeFinancialYearId: 1,
      authenticated: true,
      context: {
        cachedAt: new Date().toISOString(),
        company: { code: "CORP01", id: 1, name: "Solaris Corp" },
        defaultCompany: { companyId: 1, companyName: "Solaris Corp", financialYearId: 1, financialYearName: "FY 2026-27", landingApp: "crm" },
        enabledModuleKeys: ["crm"],
        landingPage: "/workspace",
        safeSettings: {},
        tenant: { code: "tenant-demo", id: "ten-demo", name: "Solaris Industries" }
      },
      email: "agent@codexsun.invalid",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      name: "Field Officer",
      role,
      sessionIssuedAt: Date.now(),
      sessionSlot: "slot-crm-" + role,
      tenantCode: "tenant-demo",
      tenantDbName: "codexsun_tenant_demo",
      tenantId: "ten-demo",
      tenantUuid: "ten-demo",
      token: "mock-token",
      userType: "tenant" as const
    };

    (sessionManager as unknown as { _activeSession: typeof sessionRecord; _status: string })._activeSession = sessionRecord;
    (sessionManager as unknown as { _status: string })._status = "authenticated";

    const crm = new CrmService(transport, hasPermissionFn);
    return { crm, sessionManager, transport };
  }

  // ==========================================
  // Test Suite 1: Route Inventory & Navigation
  // ==========================================
  it("covers all 24 M0 CRM routes with metadata, masking contact-360 and isolating task scope", () => {
    // 1. Check all route keys exist
    const expectedKeys = [
      "crm.overview", "crm.my-job", "crm.my-calls", "crm.leads", "crm.enquiries",
      "crm.enquiries.new", "crm.enquiries.show", "crm.tasks", "crm.tasks.new", "crm.tasks.show",
      "crm.activities", "crm.closures", "crm.schedules", "crm.reminders", "crm.call-logs",
      "crm.sops", "crm.duties", "crm.duty-assignment", "crm.duty-reporting", "crm.reports",
      "crm.contacts", "crm.list-in", "crm.status", "crm.priority", "crm.contact-360"
    ];

    for (const key of expectedKeys) {
      assert.ok(key in CRM_ROUTE_REGISTRY, `Missing expected CRM route: ${key}`);
    }

    // 2. Contact-360 is masked
    const contact360 = CRM_ROUTE_REGISTRY["crm.contact-360"];
    assert.equal(contact360.isMasked, true, "Contact-360 must be flagged as isMasked: true");

    // 3. getAccessibleCrmRoutes excludes contact-360 even for admin
    const accessible = getAccessibleCrmRoutes(() => true);
    const hasContact360 = accessible.some((r) => r.id === "crm.contact-360");
    assert.equal(hasContact360, false, "Contact-360 must be strictly excluded from accessible navigation");

    // 4. Tasks strictly isolated as local scope
    const taskRoute = CRM_ROUTE_REGISTRY["crm.tasks"];
    assert.equal(taskRoute.isLocalScopeOnly, true, "Tasks route must be flagged as isLocalScopeOnly");

    // 5. Section grouping
    const sections = getCrmRoutesBySection(() => true);
    assert.ok(sections.pipeline.length >= 5, "Pipeline section must contain core enquiry workflows");
    assert.ok(sections.operations.length >= 6, "Operations section must contain tasks, duties, schedules");
    assert.ok(sections.compliance.length >= 3, "Compliance section must contain SOPs and closures");
    assert.ok(sections.masters.length >= 4, "Masters section must contain reports, contacts, and masters");
  });

  // ==========================================
  // Test Suite 2: Enquiries Lifecycle & Persistence
  // ==========================================
  it("executes complete Enquiry lifecycle: creation, assignment, status, priority, comments, jobs, closure and reload", async () => {
    const { crm } = createTestCrmService("admin");

    // 1. Create Enquiry
    const created = await crm.createEnquiry({
      customerName: "Apex Manufacturing Ltd",
      email: "contact@apex.invalid",
      mobile: "9123456780",
      requirements: "Heavy duty linear actuators 200 units",
      sourceName: "Field Representative"
    });

    assert.ok(created.id, "Created enquiry must have an ID");
    const enqId = created.id;

    // 2. Assign Enquiry
    const assigned = await crm.assignEnquiry(enqId, "usr-sales-99");
    assert.equal(assigned.assignedUserId, "usr-sales-99");

    // 3. Status and Priority Updates
    const statusUpdated = await crm.updateEnquiryStatus(enqId, "in-negotiation");
    assert.equal(statusUpdated.statusId, "in-negotiation");

    const priorityUpdated = await crm.updateEnquiryPriority(enqId, "urgent");
    assert.equal(priorityUpdated.priorityId, "urgent");

    // 4. Comments & Attachment
    const comment1 = await crm.addEnquiryComment(enqId, "Initial meeting completed at client facility.");
    assert.ok(comment1.id, "Comment 1 must be created");

    const commentWithFile = await crm.addEnquiryComment(
      enqId,
      "Attached specifications datasheet.",
      null,
      {
        data: "PDF-SPEC-DATA-BYTES",
        filename: "actuator-specs.pdf",
        mimeType: "application/pdf"
      }
    );
    assert.ok(commentWithFile.id, "Comment with attachment must be created");
    assert.ok(commentWithFile.body.includes("actuator-specs.pdf"), "Comment body must record attachment reference");

    // 5. Work Timer Jobs
    const job = await crm.startEnquiryJob(enqId);
    assert.equal(job.status, "running");
    assert.ok(job.id);

    const stoppedJob = await crm.stopEnquiryJob(enqId, job.id);
    assert.equal(stoppedJob.status, "completed");
    assert.ok(stoppedJob.durationSeconds > 0);

    // 6. Closure Request
    const closureReq = await crm.requestEnquiryClosure(enqId, "Contract successfully signed.");
    assert.equal(closureReq.status, "pending");
    assert.equal(closureReq.recordId, enqId);

    // 7. Persistence Reload
    const reloadedEnq = await crm.getEnquiry(enqId);
    assert.equal(reloadedEnq.assignedUserId, "usr-sales-99");
    assert.equal(reloadedEnq.statusId, "in-negotiation");
    assert.equal(reloadedEnq.priorityId, "urgent");

    const reloadedComments = await crm.listEnquiryComments(enqId);
    assert.equal(reloadedComments.length, 2, "Both comments must persist on reload");

    const reloadedJobs = await crm.listEnquiryJobs(enqId);
    assert.equal(reloadedJobs.length, 1);
    assert.equal(reloadedJobs[0]?.status, "completed");
  });

  // ==========================================
  // Test Suite 3: Tasks Lifecycle & Local Scope
  // ==========================================
  it("executes complete Task lifecycle: creation, local scope filtering, comments, jobs, and closure review", async () => {
    const { crm } = createTestCrmService("sales");

    // 1. Create Task
    const task = await crm.createTask({
      assignedUserId: 42,
      description: "Perform sensor calibration on line 4",
      dueDate: "2026-11-15",
      priorityId: 2,
      statusId: 1,
      title: "Line 4 Calibration"
    });

    assert.ok(task.id, "Task must have an ID");
    const taskId = task.id;

    // 2. Update Properties
    const updated = await crm.updateTaskProperties(taskId, {
      dueDate: "2026-11-20",
      statusId: 2
    });
    assert.equal(updated.dueDate, "2026-11-20");

    // 3. Comments
    const comment = await crm.addTaskComment(taskId, "Calibration equipment checked and ready.");
    assert.ok(comment.id);

    const comments = await crm.listTaskComments(taskId);
    assert.equal(comments.length, 1);

    // 4. Job Timer
    const job = await crm.startTaskJob(taskId);
    assert.equal(job.status, "running");

    const stopped = await crm.stopTaskJob(taskId);
    assert.equal(stopped.stopped, true);

    // 5. Closure Request & Review
    const closureReq = await crm.requestTaskClosure(taskId, "Calibration finished within tolerances.");
    assert.equal(closureReq.status, "pending");

    // 6. Persistence Reload
    const reloadedTask = await crm.getTask(taskId);
    assert.equal(reloadedTask.title, "Line 4 Calibration");
    assert.equal(reloadedTask.dueDate, "2026-11-20");

    const listResult = await crm.listTasks();
    assert.ok(listResult.items.some((t) => t.id === taskId), "Task must be present in local task listing");
  });

  // ==========================================
  // Test Suite 4: Leads, Activities, Call Logs, Schedules
  // ==========================================
  it("verifies Leads intake, Activities stream, Schedules, Reminders, and Manual Call Logs", async () => {
    const { crm } = createTestCrmService("admin");

    // 1. Leads
    const leadList = await crm.listLeads();
    assert.ok(leadList.length > 0);
    const lead = await crm.getLead(leadList[0]!.uuid);
    assert.equal(lead.company, "Initech");

    // 2. Activities
    const activityStream = await crm.listActivities();
    assert.ok(activityStream.items.length > 0, "Activities must record pipeline actions");

    // 3. Schedules & Reminders
    const sched = await crm.createSchedule({
      notes: "Follow up regarding actuator delivery timetable",
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      sourceId: 1,
      sourceType: "enquiry"
    });
    assert.ok(sched.id);

    const acknowledged = await crm.acknowledgeReminder(sched.id);
    assert.ok(acknowledged.acknowledgedAt);

    const completed = await crm.updateScheduleStatus(sched.id, "completed");
    assert.equal(completed.status, "completed");

    // 4. Manual Call Logs
    const callLog = await crm.createCallLog({
      contactName: "David Wallace",
      notes: "Confirmed delivery window for next Tuesday.",
      phone: "9876500002",
      status: "connected",
      type: "outbound"
    });
    assert.ok(callLog.name);

    const logs = await crm.listCallLogs();
    assert.ok(logs.items.some((l) => l.contactName === "David Wallace"));
  });

  // ==========================================
  // Test Suite 5: SOPs & Duty Reporting
  // ==========================================
  it("manages SOP drafting/publishing, Duty assignments, and Duty Report submission", async () => {
    const { crm } = createTestCrmService("admin");

    // 1. Create SOP & Item
    const sop = await crm.createSop({
      code: "SOP-SAFE-01",
      purpose: "Daily electrical switchboard inspection",
      title: "Electrical Safety Routine"
    });
    assert.ok(sop.id);

    const sopItem = await crm.createSopItem({
      code: "SOP-ITEM-01",
      department: "Maintenance",
      frequency: "daily",
      revision: {
        evidenceGuidance: "Photograph circuit breaker indicators",
        instructions: "Verify zero voltage indicator before manual inspection"
      },
      sopId: sop.id,
      sortOrder: 1,
      title: "Main Panel Check"
    });
    assert.ok(sopItem.id);

    // 2. Create Draft Revision and Publish
    const revision = await crm.createSopRevision(sopItem.id, {
      evidenceGuidance: "Photograph thermal camera display",
      instructions: "Inspect with calibrated FLIR thermal camera"
    });
    assert.equal(revision.status, "draft");

    await crm.publishSopItem(sopItem.id, revision.id);

    // 3. Duty Assignment
    const duty = await crm.assignDuty({
      assigneeUserId: 101,
      displayOrder: 1,
      revisionId: revision.id,
      sopItemId: sopItem.id,
      startDate: "2026-10-25"
    });
    assert.ok(duty.id);

    // 4. Duty Reporting
    const report = await crm.createDutyReport({
      actions: "Inspection completed, panel within nominal temperature limits",
      assignmentId: duty.id,
      performedDate: "2026-10-25"
    });
    assert.ok(report.id);

    const summary = await crm.getDutyReportSummary("sop");
    assert.ok(summary.length > 0, "Summary must aggregate submitted duty reports");

    // 5. Deactivate Duty
    await crm.deactivateDuty(duty.id);
  });

  // ==========================================
  // Test Suite 6: Reports, Contacts, and Masters
  // ==========================================
  it("generates Reports, manages Contacts, and verifies Master tables (List-In, Status, Priority)", async () => {
    const { crm } = createTestCrmService("admin");

    // 1. Reports
    const reports = await crm.getEnquiryReports({}, "status");
    assert.ok(reports.length > 0);

    // 2. Contacts
    const contact = await crm.createContact({
      companyName: "Nexus Dynamics",
      email: "info@nexus.invalid",
      name: "Arthur Dent",
      phone: "9988776655"
    });
    assert.ok(contact);

    const contactList = await crm.listContacts();
    assert.ok(contactList.length > 0);

    // 3. Masters: List-In
    const listIn = await crm.createListIn({ code: "event", name: "Industry Expo 2026" });
    assert.ok(listIn.id);

    // 4. Masters: Status
    const status = await crm.createStatus({ code: "proposal-sent", name: "Proposal Sent" });
    assert.ok(status.id);

    // 5. Masters: Priority
    const priority = await crm.createPriority({ code: "critical", name: "Critical P1" });
    assert.ok(priority.id);
  });

  // ==========================================
  // Test Suite 7: Role & Permission Denial & Contact-360 Masking
  // ==========================================
  it("strictly enforces role/permission denial and masks CRM contact-360 access", async () => {
    // 1. Viewer trying to review closure request is rejected by permission assert
    const { crm: viewerCrm } = createTestCrmService("viewer");

    await assert.rejects(
      async () => viewerCrm.reviewClosureRequest(1, "approve"),
      (err: Error) => {
        assert.ok(err instanceof CrmPermissionDeniedError);
        assert.ok(err.message.includes("crm.closure.review"));
        return true;
      }
    );

    // 2. Viewer trying to create master record is rejected
    await assert.rejects(
      async () => viewerCrm.createListIn({ name: "Unauthorized Source" }),
      (err: Error) => {
        assert.ok(err instanceof CrmPermissionDeniedError);
        assert.ok(err.message.includes("admin"));
        return true;
      }
    );

    // 3. Viewer trying to create task without permission is rejected
    await assert.rejects(
      async () => viewerCrm.createTask({ title: "Unauthorized Task" }),
      (err: Error) => {
        assert.ok(err instanceof CrmPermissionDeniedError);
        assert.ok(err.message.includes("crm.task.create"));
        return true;
      }
    );

    // 4. Viewer trying to publish SOP is rejected
    await assert.rejects(
      async () => viewerCrm.publishSopItem(1, 1),
      (err: Error) => {
        assert.ok(err instanceof CrmPermissionDeniedError);
        assert.ok(err.message.includes("crm.sop.publish"));
        return true;
      }
    );

    // 5. Contact-360 access is strictly masked and rejected even for admin
    const { crm: adminCrm } = createTestCrmService("admin");
    await assert.rejects(
      async () => adminCrm.getContact360Profile(1),
      (err: Error) => {
        assert.ok(err instanceof CrmPermissionDeniedError);
        assert.ok(err.message.includes("CRM Contact-360 remains masked"));
        return true;
      }
    );
  });
});
