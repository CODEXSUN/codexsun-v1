import { createServer, type Server } from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { HostVerifier } from "../src/session/host-verifier.js";
import { NativeSessionManager } from "../src/session/native-session-manager.js";
import { NativeHttpTransport } from "../src/native/http.js";
import { initRuntimeConfig } from "../src/app/runtime-config.js";
import { runCompleteM2Slice } from "../src/slices/m2-slice-runner.js";
import { executeStep1LoginAndRestore, executeStep6SignOutCleanup } from "../src/slices/session-slice.js";
import { executeStep2CrmEnquiry } from "../src/slices/crm-slice.js";
import { executeStep3BillingQuotation } from "../src/slices/billing-slice.js";
import { executeStep4ChatMessage } from "../src/slices/chat-slice.js";
import { executeStep5EcommerceDraft } from "../src/slices/ecommerce-slice.js";

describe("Production M2 Integrated Six-Step Slice", () => {
  let server: Server;
  let serverPort: number;
  let serverOrigin: string;

  // In-memory test store
  const storedEnquiries = new Map<string, Record<string, unknown>>();
  const storedEnquiryComments = new Map<string, Array<Record<string, unknown>>>();
  const storedQuotations = new Map<string, Record<string, unknown>>();
  const storedChatChannels = new Map<string, Record<string, unknown>>();
  const storedChatMessages = new Map<string, Array<Record<string, unknown>>>();
  const storedEcommerceDrafts = new Map<number, Record<string, unknown>>();
  const activeSessionSlots = new Set<string>();

  before(async () => {
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
            // raw string
          }
        }

        const slot = req.headers["x-codexsun-session-slot"] as string | undefined;

        // 1. Auth Login
        if (url.pathname === "/auth/login" && req.method === "POST") {
          const corporateId = (body.corporateId ?? body.tenantCode) as string;
          const newSlot = "slot-test-" + Math.random().toString(36).slice(2, 10);
          activeSessionSlots.add(newSlot);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              data: {
                authenticated: true,
                context: {
                  cachedAt: new Date().toISOString(),
                  company: { code: "CORP01", id: 1, name: "Solaris Corp" },
                  defaultCompany: {
                    companyId: 1,
                    companyName: "Solaris Corp",
                    financialYearId: 1,
                    financialYearName: "FY 2026-27",
                    landingApp: "crm"
                  },
                  enabledModuleKeys: ["crm", "billing", "chat", "ecommerce"],
                  landingPage: "/workspace",
                  safeSettings: {},
                  tenant: { code: corporateId, id: `ten-${corporateId}`, name: "Solaris Industries" }
                },
                email: (body.email as string) ?? "agent@codexsun.invalid",
                expiresAt: new Date(Date.now() + 86400000).toISOString(),
                name: "Field Supervisor",
                role: "sales_lead",
                sessionIssuedAt: Date.now(),
                sessionSlot: newSlot,
                tenantCode: corporateId,
                tenantDbName: `codexsun_tenant_${corporateId}`,
                tenantId: `ten-${corporateId}`,
                tenantUuid: `ten-${corporateId}`,
                token: "mock-jwt-token-12345",
                userType: "tenant"
              },
              success: true
            })
          );
          return;
        }

        // 2. Auth Session Restore
        if (url.pathname === "/auth/session" && req.method === "GET") {
          if (!slot || !activeSessionSlots.has(slot)) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: { message: "Invalid slot" }, success: false }));
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              data: {
                authenticated: true,
                context: {
                  cachedAt: new Date().toISOString(),
                  company: { code: "CORP01", id: 1, name: "Solaris Corp" },
                  defaultCompany: {
                    companyId: 1,
                    companyName: "Solaris Corp",
                    financialYearId: 1,
                    financialYearName: "FY 2026-27",
                    landingApp: "crm"
                  },
                  enabledModuleKeys: ["crm", "billing", "chat", "ecommerce"],
                  landingPage: "/workspace",
                  safeSettings: {},
                  tenant: { code: "tenant-demo", id: "ten-tenant-demo", name: "Solaris Industries" }
                },
                email: "agent@codexsun.invalid",
                expiresAt: new Date(Date.now() + 86400000).toISOString(),
                name: "Field Supervisor",
                role: "sales_lead",
                sessionSlot: slot,
                tenantCode: "tenant-demo",
                tenantDbName: "codexsun_tenant_tenant-demo",
                tenantId: "ten-tenant-demo",
                tenantUuid: "ten-tenant-demo",
                token: "mock-jwt-token-12345",
                userType: "tenant"
              },
              success: true
            })
          );
          return;
        }

        // 3. Auth Logout
        if (url.pathname === "/auth/logout" && req.method === "POST") {
          if (slot) activeSessionSlots.delete(slot);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: { loggedOut: true }, success: true }));
          return;
        }

        // 4. CRM: Create Enquiry
        if (url.pathname === "/crm/enquiries" && req.method === "POST") {
          const id = "enq-" + Math.random().toString(36).slice(2, 8);
          const record = { ...body, id, uuid: id, status: "open" };
          storedEnquiries.set(id, record);
          storedEnquiryComments.set(id, []);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: record, success: true }));
          return;
        }

        // 5. CRM: Assign Enquiry (PATCH properties)
        const crmPropsMatch = url.pathname.match(/^\/crm\/enquiries\/([^/]+)\/properties$/);
        if (crmPropsMatch && req.method === "PATCH") {
          const id = decodeURIComponent(crmPropsMatch[1]!);
          const enq = storedEnquiries.get(id);
          if (enq) {
            Object.assign(enq, body);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ data: enq, success: true }));
          } else {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: { message: "Enquiry not found" }, success: false }));
          }
          return;
        }

        // 6. CRM: Add Comment
        const crmCommentMatch = url.pathname.match(/^\/crm\/enquiries\/([^/]+)\/comments$/);
        if (crmCommentMatch && req.method === "POST") {
          const id = decodeURIComponent(crmCommentMatch[1]!);
          const comment = { id: Date.now(), ...body, createdAt: new Date().toISOString() };
          const list = storedEnquiryComments.get(id) ?? [];
          list.push(comment);
          storedEnquiryComments.set(id, list);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: comment, success: true }));
          return;
        }

        // 7. CRM: Get Comments
        if (crmCommentMatch && req.method === "GET") {
          const id = decodeURIComponent(crmCommentMatch[1]!);
          const list = storedEnquiryComments.get(id) ?? [];
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: list, success: true }));
          return;
        }

        // 8. CRM: Get Enquiry
        const crmGetMatch = url.pathname.match(/^\/crm\/enquiries\/([^/]+)$/);
        if (crmGetMatch && req.method === "GET") {
          const id = decodeURIComponent(crmGetMatch[1]!);
          const enq = storedEnquiries.get(id);
          if (enq) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ data: enq, success: true }));
          } else {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: { message: "Enquiry not found" }, success: false }));
          }
          return;
        }

        // 9. Billing: Create Quotation
        if (url.pathname === "/billing/quotations" && req.method === "POST") {
          const id = "qt-" + Math.random().toString(36).slice(2, 8);
          const record = { ...body, id, uuid: id };
          storedQuotations.set(id, record);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: record, success: true }));
          return;
        }

        // 10. Billing: Get Quotation
        const billGetMatch = url.pathname.match(/^\/billing\/quotations\/([^/]+)$/);
        if (billGetMatch && req.method === "GET") {
          const id = decodeURIComponent(billGetMatch[1]!);
          const record = storedQuotations.get(id);
          if (record) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ data: record, success: true }));
          } else {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: { message: "Quotation not found" }, success: false }));
          }
          return;
        }

        // 11. Billing: Quotation PDF Preview
        const billPdfMatch = url.pathname.match(/^\/billing\/quotations\/([^/]+)\/pdf$/);
        if (billPdfMatch && req.method === "GET") {
          const id = decodeURIComponent(billPdfMatch[1]!);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              data: {
                pdfUrl: `/billing/quotations/${id}/preview.pdf`,
                shareableUrl: `https://share.codexsun.invalid/q/${id}`
              },
              success: true
            })
          );
          return;
        }

        // 12. Chat: Channels List & Create
        if (url.pathname === "/chat/channels") {
          if (req.method === "POST") {
            const uuid = "chan-" + Math.random().toString(36).slice(2, 8);
            const channel = {
              id: Date.now(),
              kind: body.kind ?? "channel",
              name: body.name ?? "general",
              unreadCount: 0,
              uuid
            };
            storedChatChannels.set(uuid, channel);
            storedChatMessages.set(uuid, []);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ data: channel, success: true }));
            return;
          }
          const list = Array.from(storedChatChannels.values());
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: list, success: true }));
          return;
        }

        // 13. Chat: Send Message
        if (url.pathname === "/chat/messages" && req.method === "POST") {
          const channelUuid = String(body.channelUuid);
          const msgUuid = "msg-" + Math.random().toString(36).slice(2, 8);
          const msg = {
            attachments: body.attachments ?? [],
            body: body.body,
            channelUuid,
            createdAt: new Date().toISOString(),
            id: Date.now(),
            uuid: msgUuid
          };
          const list = storedChatMessages.get(channelUuid) ?? [];
          list.push(msg);
          storedChatMessages.set(channelUuid, list);

          // Update unread count
          const channel = storedChatChannels.get(channelUuid);
          if (channel) channel.unreadCount = ((channel.unreadCount as number) ?? 0) + 1;

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: msg, success: true }));
          return;
        }

        // 14. Chat: Mark Read
        const chatReadMatch = url.pathname.match(/^\/chat\/channels\/([^/]+)\/read$/);
        if (chatReadMatch && req.method === "POST") {
          const uuid = decodeURIComponent(chatReadMatch[1]!);
          const channel = storedChatChannels.get(uuid);
          if (channel) channel.unreadCount = 0;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: { read: true, uuid }, success: true }));
          return;
        }

        // 15. Chat: Get Channel Detail
        const chatChanMatch = url.pathname.match(/^\/chat\/channels\/([^/]+)$/);
        if (chatChanMatch && req.method === "GET") {
          const uuid = decodeURIComponent(chatChanMatch[1]!);
          const channel = storedChatChannels.get(uuid);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              data: {
                channel: channel ?? { unreadCount: 0, uuid },
                unreadCount: channel?.unreadCount ?? 0
              },
              success: true
            })
          );
          return;
        }

        // 16. Ecommerce: Upload Image
        if (url.pathname === "/api/platform/ecommerce/catalog/images/upload" && req.method === "POST") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              data: {
                imageUrl: `/media/ecommerce/products/${Date.now()}-${body.fileName ?? "img.png"}`,
                sizeBytes: 1024
              },
              success: true
            })
          );
          return;
        }

        // 17. Ecommerce: Create Product Draft
        if (
          url.pathname === "/api/platform/ecommerce/catalog/product-information" &&
          req.method === "POST"
        ) {
          const id = storedEcommerceDrafts.size + 1;
          const draft = { id, ...body, publicationStatus: "draft", uuid: `draft-${id}` };
          storedEcommerceDrafts.set(id, draft);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: draft, success: true }));
          return;
        }

        // 18. Ecommerce: Get Product Draft
        const ecomGetMatch = url.pathname.match(
          /^\/api\/platform\/ecommerce\/catalog\/product-information\/(\d+)$/
        );
        if (ecomGetMatch && req.method === "GET") {
          const id = Number(ecomGetMatch[1]);
          const draft = storedEcommerceDrafts.get(id);
          if (draft) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ data: draft, success: true }));
          } else {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: { message: "Draft not found" }, success: false }));
          }
          return;
        }

        // Unhandled
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: `Route ${url.pathname} not found.` }, success: false }));
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (typeof address === "object" && address !== null) {
          serverPort = address.port;
          serverOrigin = `http://127.0.0.1:${serverPort}`;
        }
        resolve();
      });
    });

    initRuntimeConfig({ VITE_PLATFORM_API_URL: serverOrigin });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("completes all 6 steps of the persisted M2 slice in sequence", async () => {
    const sessionManager = new NativeSessionManager({
      apiOrigin: serverOrigin,
      hostVerifier: new HostVerifier({ allowLoopback: true })
    });
    const transport = new NativeHttpTransport({ sessionManager });

    const report = await runCompleteM2Slice({
      credentials: {
        corporateId: "tenant-demo",
        desk: "tenant",
        password: "SecretPassword123"
      },
      sessionManager,
      targetOrigin: serverOrigin,
      transport
    });

    assert.equal(report.success, true);

    // Step 1: Login & restore tenant/company/year context
    const s1 = report.results.step1_loginAndRestore;
    assert.equal(s1.success, true);
    assert.equal(s1.data.session.authenticated, true);
    assert.equal(s1.data.session.tenantCode, "tenant-demo");
    assert.equal(s1.data.restoredSession.sessionSlot, s1.data.session.sessionSlot);
    assert.equal(s1.data.session.activeCompanyId, 1);
    assert.equal(s1.data.session.activeFinancialYearId, 1);

    // Step 2: CRM: create enquiry, assign, comment, reload
    const s2 = report.results.step2_crmEnquiry;
    assert.equal(s2.success, true);
    assert.ok(s2.data.enquiryId.startsWith("enq-"));
    assert.equal(s2.data.assignedUserId, "usr-sales-01");
    assert.ok(s2.data.reloadedCommentsCount >= 1);

    // Step 3: Billing: create quotation, reload totals, PDF preview/share
    const s3 = report.results.step3_billingQuotation;
    assert.equal(s3.success, true);
    assert.ok(s3.data.quotationId.startsWith("qt-"));
    assert.ok(s3.data.grandTotal > 0);
    assert.ok(s3.data.pdfUrl.includes("pdf"));

    // Step 4: Chat: send message, attachment, verify read status
    const s4 = report.results.step4_chatMessage;
    assert.equal(s4.success, true);
    assert.ok(s4.data.messageUuid.startsWith("msg-"));
    assert.equal(s4.data.readStatusVerified, true);

    // Step 5: Ecommerce: save item draft, image, reload unpublished state
    const s5 = report.results.step5_ecommerceDraft;
    assert.equal(s5.success, true);
    assert.ok(s5.data.draftId > 0);
    assert.equal(s5.data.publicationStatus, "draft");
    assert.ok(s5.data.imageUrl.includes("products/"));

    // Step 6: Sign out / account switch cleanup
    const s6 = report.results.step6_signOutCleanup;
    assert.equal(s6.success, true);
    assert.equal(sessionManager.activeSession, null);
    assert.equal(sessionManager.status, "unauthenticated");
  });

  it("verifies individual step 1 restore failure when session slot is revoked", async () => {
    const sessionManager = new NativeSessionManager({
      apiOrigin: serverOrigin,
      hostVerifier: new HostVerifier({ allowLoopback: true })
    });

    const session = await sessionManager.login({
      corporateId: "tenant-demo",
      desk: "tenant",
      password: "pass"
    });

    // Revoke slot on server
    activeSessionSlots.delete(session.sessionSlot);

    // Attempt restore
    const restored = await sessionManager.restoreSession();
    assert.equal(restored, null);
    assert.equal(sessionManager.status, "expired");
  });

  it("verifies individual step 3 billing calculation and tax totals", async () => {
    const sessionManager = new NativeSessionManager({
      apiOrigin: serverOrigin,
      hostVerifier: new HostVerifier({ allowLoopback: true })
    });
    const transport = new NativeHttpTransport({ sessionManager });

    await sessionManager.login({
      corporateId: "tenant-demo",
      desk: "tenant",
      password: "pass"
    });

    const res = await executeStep3BillingQuotation(transport, {
      customerName: "Precision Dynamics",
      items: [
        { description: "M8 Flange Nut", quantity: 50, rate: 10, taxRate: 18 },
        { description: "Heavy Duty Shaft", quantity: 2, rate: 2500, taxRate: 18 }
      ]
    });

    // Subtotal: 50*10 = 500, 2*2500 = 5000 -> 5500. Tax: 18% of 5500 = 990. Grand: 6490.
    assert.equal(res.data.subtotal, 5500);
    assert.equal(res.data.taxTotal, 990);
    assert.equal(res.data.grandTotal, 6490);
    assert.ok(res.data.quotationId);
  });
});
