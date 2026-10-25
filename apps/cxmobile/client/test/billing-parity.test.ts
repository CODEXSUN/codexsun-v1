import { createServer, type Server } from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { HostVerifier } from "../src/session/host-verifier.js";
import { NativeSessionManager } from "../src/session/native-session-manager.js";
import { NativeHttpTransport } from "../src/native/http.js";
import type { SessionRecord } from "../src/session/session-types.js";
import {
  BillingPermissionError,
  assertAdminPermission,
  calculateClosingBalance,
  calculateDocumentTotals,
  calculateExportCurrencyTotals,
  calculateLineItem,
  cancelExportSale,
  cancelPayment,
  cancelPurchase,
  cancelReceipt,
  cancelSale,
  classifyOpeningBalance,
  confirmQuotation,
  convertQuotationToSale,
  convertQuotationsToSale,
  createExportSale,
  createPayment,
  createPurchase,
  createQuotation,
  createReceipt,
  createSale,
  downloadQuotationPdf,
  downloadSalePdf,
  formatDocumentNumber,
  formatMoney,
  formatOpeningBalanceDescriptor,
  generateNextDocumentNumber,
  getBillingDashboard,
  getBillingSettings,
  getCustomerStatement,
  getCustomerSummary,
  getExportSale,
  getGstStatement,
  getOpeningBalances,
  getPayment,
  getPurchase,
  getQuotation,
  getQuotationPdf,
  getReceipt,
  getSale,
  getSalePdf,
  getStockStatement,
  getSupplierStatement,
  getSupplierSummary,
  isAdminSession,
  listExportSales,
  listPaymentAllocations,
  listPayments,
  listPurchases,
  listQuotations,
  listReceiptAllocations,
  listReceipts,
  listSales,
  postExportSale,
  postPayment,
  postPurchase,
  postReceipt,
  postSale,
  roundMoney,
  saveBillingSettings,
  saveGstStatementFiling,
  saveOpeningBalance,
  updateQuotation,
  updateSale
} from "../src/domains/billing/index.js";
import type { BillingSettings, OpeningBalance } from "../src/domains/billing/types.js";

describe("Billing Mobile Parity & Authoritative Engine Suite", () => {
  let server: Server;
  let serverOrigin: string;

  // In-memory test state
  const storedQuotations = new Map<string, Record<string, unknown>>();
  const storedSales = new Map<string, Record<string, unknown>>();
  const storedPurchases = new Map<string, Record<string, unknown>>();
  const storedExportSales = new Map<string, Record<string, unknown>>();
  const storedPayments = new Map<string, Record<string, unknown>>();
  const storedReceipts = new Map<string, Record<string, unknown>>();
  const storedOpeningBalances: OpeningBalance[] = [];

  let testSettings: BillingSettings = {
    features: { exportSales: true, quotation: true, tconnect: true },
    gstApiMode: "einvoice_eway",
    numbering: {
      exportSales: { automatic: true, nextNumber: 1, padding: 4, prefix: "EXP", separator: "-", suffix: "", usePrefix: true, useSeparator: true, useSuffix: false },
      payment: { automatic: true, nextNumber: 1, padding: 4, prefix: "PAY", separator: "-", suffix: "", usePrefix: true, useSeparator: true, useSuffix: false },
      purchase: { automatic: true, nextNumber: 1, padding: 4, prefix: "PUR", separator: "-", suffix: "", usePrefix: true, useSeparator: true, useSuffix: false },
      quotation: { automatic: true, nextNumber: 1, padding: 4, prefix: "QUO", separator: "-", suffix: "", usePrefix: true, useSeparator: true, useSuffix: false },
      receipt: { automatic: true, nextNumber: 1, padding: 4, prefix: "REC", separator: "-", suffix: "", usePrefix: true, useSeparator: true, useSuffix: false },
      sales: { automatic: true, nextNumber: 1, padding: 4, prefix: "SAL", separator: "-", suffix: "", usePrefix: true, useSeparator: true, useSuffix: false }
    }
  };

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

        // Helper to send json response
        const sendJson = (statusCode: number, payload: unknown) => {
          res.writeHead(statusCode, { "Content-Type": "application/json" });
          res.end(JSON.stringify(payload));
        };

        // 1. Dashboard
        if (url.pathname === "/billing/dashboard" && req.method === "GET") {
          sendJson(200, {
            data: {
              companyId: 1,
              companyName: "Solaris Corp",
              currencyCode: "INR",
              metrics: {
                payment: { count: storedPayments.size, total: 5000 },
                purchase: { count: storedPurchases.size, total: 31000 },
                receipt: { count: storedReceipts.size, total: 2500 },
                sales: { count: storedSales.size, total: 31000 }
              },
              monthly: [
                { label: "Oct 2026", month: "2026-10", payment: 5000, purchase: 31000, receipt: 2500, sales: 31000 }
              ],
              outstanding: [
                { contactId: 201, contactName: "Acme Industrial Corp", direction: "receivable", grossAmount: 31000, outstandingAmount: 28500, overLimit: false, settledAmount: 2500 },
                { contactId: 101, contactName: "Apex Raw Materials Co", direction: "payable", grossAmount: 31000, outstandingAmount: 26000, overLimit: false, settledAmount: 5000 }
              ],
              recent: [
                { amount: 31000, contactName: "Acme Industrial Corp", date: "2026-10-25", documentId: "sal-1", documentNumber: "SAL-0001", kind: "sales", status: "confirmed" }
              ]
            },
            success: true
          });
          return;
        }

        // 2. Quotations Routes
        if (url.pathname === "/billing/quotations" && req.method === "GET") {
          sendJson(200, { data: Array.from(storedQuotations.values()), success: true });
          return;
        }

        if (url.pathname === "/billing/quotations" && req.method === "POST") {
          const id = "qt-" + Math.random().toString(36).slice(2, 8);
          const record = { ...body, id, quotationNumber: body.quotationNumber ?? `QUO-${Date.now().toString().slice(-4)}`, status: body.status ?? "draft" };
          storedQuotations.set(id, record);
          sendJson(200, { data: record, success: true });
          return;
        }

        const qtGetMatch = url.pathname.match(/^\/billing\/quotations\/([^/]+)$/);
        if (qtGetMatch && req.method === "GET") {
          const id = decodeURIComponent(qtGetMatch[1]!);
          const q = storedQuotations.get(id);
          if (q) sendJson(200, { data: q, success: true });
          else sendJson(404, { error: { message: "Quotation not found" }, success: false });
          return;
        }

        if (qtGetMatch && req.method === "PUT") {
          const id = decodeURIComponent(qtGetMatch[1]!);
          const q = storedQuotations.get(id);
          if (q) {
            Object.assign(q, body);
            sendJson(200, { data: q, success: true });
          } else {
            sendJson(404, { error: { message: "Quotation not found" }, success: false });
          }
          return;
        }

        if (qtGetMatch && req.method === "DELETE") {
          const id = decodeURIComponent(qtGetMatch[1]!);
          storedQuotations.delete(id);
          sendJson(200, { data: { deleted: true }, success: true });
          return;
        }

        const qtConfirmMatch = url.pathname.match(/^\/billing\/quotations\/([^/]+)\/confirm$/);
        if (qtConfirmMatch && req.method === "POST") {
          const id = decodeURIComponent(qtConfirmMatch[1]!);
          const q = storedQuotations.get(id);
          if (q) {
            q.status = "confirmed";
            sendJson(200, { data: q, success: true });
          } else {
            sendJson(404, { error: { message: "Quotation not found" }, success: false });
          }
          return;
        }

        const qtCancelMatch = url.pathname.match(/^\/billing\/quotations\/([^/]+)\/cancel$/);
        if (qtCancelMatch && req.method === "POST") {
          const id = decodeURIComponent(qtCancelMatch[1]!);
          const q = storedQuotations.get(id);
          if (q) {
            q.status = "cancelled";
            sendJson(200, { data: q, success: true });
          } else {
            sendJson(404, { error: { message: "Quotation not found" }, success: false });
          }
          return;
        }

        const qtRevokeMatch = url.pathname.match(/^\/billing\/quotations\/([^/]+)\/revoke$/);
        if (qtRevokeMatch && req.method === "POST") {
          const id = decodeURIComponent(qtRevokeMatch[1]!);
          const q = storedQuotations.get(id);
          if (q) {
            q.status = "draft";
            sendJson(200, { data: q, success: true });
          } else {
            sendJson(404, { error: { message: "Quotation not found" }, success: false });
          }
          return;
        }

        const qtConvertMatch = url.pathname.match(/^\/billing\/quotations\/([^/]+)\/convert-to-sale$/);
        if (qtConvertMatch && req.method === "POST") {
          const id = decodeURIComponent(qtConvertMatch[1]!);
          const q = storedQuotations.get(id);
          const saleNumber = `SAL-${Date.now().toString().slice(-4)}`;
          sendJson(200, {
            data: { quotation: q, sale: { id: `sal-${id}`, invoiceNumber: saleNumber } },
            success: true
          });
          return;
        }

        if (url.pathname === "/billing/quotations/convert-to-sale" && req.method === "POST") {
          sendJson(200, {
            data: { quotations: [], sale: { invoiceNumber: "SAL-BATCH-01" } },
            success: true
          });
          return;
        }

        const qtPdfMatch = url.pathname.match(/^\/billing\/quotations\/([^/]+)\/pdf$/);
        if (qtPdfMatch && req.method === "GET") {
          const id = decodeURIComponent(qtPdfMatch[1]!);
          // If binary accept or download requested, return binary buffer
          if (!req.headers.accept || req.headers.accept.includes("*/*") || req.headers.accept.includes("application/pdf")) {
            res.writeHead(200, { "Content-Type": "application/pdf" });
            res.end(Buffer.from(`%PDF-1.4 Mock Quotation PDF for ${id}`));
            return;
          }
          sendJson(200, {
            data: { pdfUrl: `/billing/quotations/${id}/preview.pdf`, shareableUrl: `https://share.codexsun.invalid/q/${id}` },
            success: true
          });
          return;
        }

        // 3. Sales Invoices Routes
        if (url.pathname === "/billing/sales" && req.method === "GET") {
          sendJson(200, { data: Array.from(storedSales.values()), success: true });
          return;
        }

        if (url.pathname === "/billing/sales" && req.method === "POST") {
          const id = "sal-" + Math.random().toString(36).slice(2, 8);
          const record = { ...body, id, invoiceNumber: body.invoiceNumber ?? `SAL-${Date.now().toString().slice(-4)}`, status: body.status ?? "draft" };
          storedSales.set(id, record);
          sendJson(200, { data: record, success: true });
          return;
        }

        const saleGetMatch = url.pathname.match(/^\/billing\/sales\/([^/]+)$/);
        if (saleGetMatch && req.method === "GET") {
          const id = decodeURIComponent(saleGetMatch[1]!);
          const s = storedSales.get(id);
          if (s) sendJson(200, { data: s, success: true });
          else sendJson(404, { error: { message: "Sale not found" }, success: false });
          return;
        }

        if (saleGetMatch && req.method === "PUT") {
          const id = decodeURIComponent(saleGetMatch[1]!);
          const s = storedSales.get(id);
          if (s) {
            Object.assign(s, body);
            sendJson(200, { data: s, success: true });
          } else {
            sendJson(404, { error: { message: "Sale not found" }, success: false });
          }
          return;
        }

        if (saleGetMatch && req.method === "DELETE") {
          const id = decodeURIComponent(saleGetMatch[1]!);
          storedSales.delete(id);
          sendJson(200, { data: { deleted: true }, success: true });
          return;
        }

        const saleConfirmMatch = url.pathname.match(/^\/billing\/sales\/([^/]+)\/(confirm|post)$/);
        if (saleConfirmMatch && req.method === "POST") {
          const id = decodeURIComponent(saleConfirmMatch[1]!);
          const s = storedSales.get(id);
          if (s) {
            s.status = "confirmed";
            sendJson(200, { data: s, success: true });
          } else {
            sendJson(404, { error: { message: "Sale not found" }, success: false });
          }
          return;
        }

        const saleCancelMatch = url.pathname.match(/^\/billing\/sales\/([^/]+)\/cancel$/);
        if (saleCancelMatch && req.method === "POST") {
          const id = decodeURIComponent(saleCancelMatch[1]!);
          const s = storedSales.get(id);
          if (s) {
            s.status = "cancelled";
            sendJson(200, { data: s, success: true });
          } else {
            sendJson(404, { error: { message: "Sale not found" }, success: false });
          }
          return;
        }

        const salePdfMatch = url.pathname.match(/^\/billing\/sales\/([^/]+)\/pdf$/);
        if (salePdfMatch && req.method === "GET") {
          const id = decodeURIComponent(salePdfMatch[1]!);
          if (!req.headers.accept || req.headers.accept.includes("*/*") || req.headers.accept.includes("application/pdf")) {
            res.writeHead(200, { "Content-Type": "application/pdf" });
            res.end(Buffer.from(`%PDF-1.4 Mock Sale PDF for ${id}`));
            return;
          }
          sendJson(200, {
            data: { pdfUrl: `/billing/sales/${id}/preview.pdf`, shareableUrl: `https://share.codexsun.invalid/s/${id}` },
            success: true
          });
          return;
        }

        // 4. Purchase Bills Routes
        if (url.pathname === "/billing/purchases" && req.method === "GET") {
          sendJson(200, { data: Array.from(storedPurchases.values()), success: true });
          return;
        }

        if (url.pathname === "/billing/purchases" && req.method === "POST") {
          const id = "pur-" + Math.random().toString(36).slice(2, 8);
          const record = { ...body, id, purchaseNumber: body.purchaseNumber ?? `PUR-${Date.now().toString().slice(-4)}`, status: body.status ?? "draft" };
          storedPurchases.set(id, record);
          sendJson(200, { data: record, success: true });
          return;
        }

        const purGetMatch = url.pathname.match(/^\/billing\/purchases\/([^/]+)$/);
        if (purGetMatch && req.method === "GET") {
          const id = decodeURIComponent(purGetMatch[1]!);
          const p = storedPurchases.get(id);
          if (p) sendJson(200, { data: p, success: true });
          else sendJson(404, { error: { message: "Purchase not found" }, success: false });
          return;
        }

        const purConfirmMatch = url.pathname.match(/^\/billing\/purchases\/([^/]+)\/(confirm|post)$/);
        if (purConfirmMatch && req.method === "POST") {
          const id = decodeURIComponent(purConfirmMatch[1]!);
          const p = storedPurchases.get(id);
          if (p) {
            p.status = "confirmed";
            sendJson(200, { data: p, success: true });
          } else {
            sendJson(404, { error: { message: "Purchase not found" }, success: false });
          }
          return;
        }

        const purCancelMatch = url.pathname.match(/^\/billing\/purchases\/([^/]+)\/cancel$/);
        if (purCancelMatch && req.method === "POST") {
          const id = decodeURIComponent(purCancelMatch[1]!);
          const p = storedPurchases.get(id);
          if (p) {
            p.status = "cancelled";
            sendJson(200, { data: p, success: true });
          } else {
            sendJson(404, { error: { message: "Purchase not found" }, success: false });
          }
          return;
        }

        // 5. Export Sales Routes
        if (url.pathname === "/billing/export-sales" && req.method === "GET") {
          sendJson(200, { data: Array.from(storedExportSales.values()), success: true });
          return;
        }

        if (url.pathname === "/billing/export-sales" && req.method === "POST") {
          const id = "exp-" + Math.random().toString(36).slice(2, 8);
          const record = { ...body, id, invoiceNumber: body.invoiceNumber ?? `EXP-${Date.now().toString().slice(-4)}`, status: body.status ?? "draft" };
          storedExportSales.set(id, record);
          sendJson(200, { data: record, success: true });
          return;
        }

        const expGetMatch = url.pathname.match(/^\/billing\/export-sales\/([^/]+)$/);
        if (expGetMatch && req.method === "GET") {
          const id = decodeURIComponent(expGetMatch[1]!);
          const e = storedExportSales.get(id);
          if (e) sendJson(200, { data: e, success: true });
          else sendJson(404, { error: { message: "Export sale not found" }, success: false });
          return;
        }

        const expConfirmMatch = url.pathname.match(/^\/billing\/export-sales\/([^/]+)\/(confirm|post)$/);
        if (expConfirmMatch && req.method === "POST") {
          const id = decodeURIComponent(expConfirmMatch[1]!);
          const e = storedExportSales.get(id);
          if (e) {
            e.status = "confirmed";
            sendJson(200, { data: e, success: true });
          } else {
            sendJson(404, { error: { message: "Export sale not found" }, success: false });
          }
          return;
        }

        // 6. Payments Routes
        if (url.pathname === "/billing/payments" && req.method === "GET") {
          sendJson(200, { data: Array.from(storedPayments.values()), success: true });
          return;
        }

        if (url.pathname === "/billing/payments" && req.method === "POST") {
          const id = "pay-" + Math.random().toString(36).slice(2, 8);
          const record = {
            ...body,
            allocatedAmount: ((body.allocations as Array<{ allocatedAmount: number }>) ?? []).reduce((acc, a) => acc + (Number(a.allocatedAmount) || 0), 0),
            id,
            paymentNumber: body.paymentNumber ?? `PAY-${Date.now().toString().slice(-4)}`,
            status: "draft",
            unallocatedAmount: Math.max(0, (Number(body.amount) || 0) - (((body.allocations as Array<{ allocatedAmount: number }>) ?? []).reduce((acc, a) => acc + (Number(a.allocatedAmount) || 0), 0)))
          };
          storedPayments.set(id, record);
          sendJson(200, { data: record, success: true });
          return;
        }

        const payPostMatch = url.pathname.match(/^\/billing\/payments\/([^/]+)\/post$/);
        if (payPostMatch && req.method === "POST") {
          const id = decodeURIComponent(payPostMatch[1]!);
          const p = storedPayments.get(id);
          if (p) {
            p.status = "posted";
            sendJson(200, { data: p, success: true });
          } else {
            sendJson(404, { error: { message: "Payment not found" }, success: false });
          }
          return;
        }

        const payCancelMatch = url.pathname.match(/^\/billing\/payments\/([^/]+)\/cancel$/);
        if (payCancelMatch && req.method === "POST") {
          const id = decodeURIComponent(payCancelMatch[1]!);
          const p = storedPayments.get(id);
          if (p) {
            p.status = "cancelled";
            sendJson(200, { data: p, success: true });
          } else {
            sendJson(404, { error: { message: "Payment not found" }, success: false });
          }
          return;
        }

        if (url.pathname === "/billing/payments/allocations" && req.method === "GET") {
          const supplierId = Number(url.searchParams.get("supplierId") ?? 1);
          sendJson(200, {
            data: [
              { currencyId: 1, documentDate: "2026-10-20", documentNo: "PUR-1001", documentTotal: 15000, outstandingAmount: 10000, purchaseId: "pur-1001", supplierId }
            ],
            success: true
          });
          return;
        }

        // 7. Receipts Routes
        if (url.pathname === "/billing/receipts" && req.method === "GET") {
          sendJson(200, { data: Array.from(storedReceipts.values()), success: true });
          return;
        }

        if (url.pathname === "/billing/receipts" && req.method === "POST") {
          const id = "rec-" + Math.random().toString(36).slice(2, 8);
          const record = {
            ...body,
            allocatedAmount: ((body.allocations as Array<{ allocatedAmount: number }>) ?? []).reduce((acc, a) => acc + (Number(a.allocatedAmount) || 0), 0),
            id,
            receiptNumber: body.receiptNumber ?? `REC-${Date.now().toString().slice(-4)}`,
            status: "draft",
            unallocatedAmount: Math.max(0, (Number(body.amount) || 0) - (((body.allocations as Array<{ allocatedAmount: number }>) ?? []).reduce((acc, a) => acc + (Number(a.allocatedAmount) || 0), 0)))
          };
          storedReceipts.set(id, record);
          sendJson(200, { data: record, success: true });
          return;
        }

        const recPostMatch = url.pathname.match(/^\/billing\/receipts\/([^/]+)\/post$/);
        if (recPostMatch && req.method === "POST") {
          const id = decodeURIComponent(recPostMatch[1]!);
          const r = storedReceipts.get(id);
          if (r) {
            r.status = "posted";
            sendJson(200, { data: r, success: true });
          } else {
            sendJson(404, { error: { message: "Receipt not found" }, success: false });
          }
          return;
        }

        const recCancelMatch = url.pathname.match(/^\/billing\/receipts\/([^/]+)\/cancel$/);
        if (recCancelMatch && req.method === "POST") {
          const id = decodeURIComponent(recCancelMatch[1]!);
          const r = storedReceipts.get(id);
          if (r) {
            r.status = "cancelled";
            sendJson(200, { data: r, success: true });
          } else {
            sendJson(404, { error: { message: "Receipt not found" }, success: false });
          }
          return;
        }

        if (url.pathname === "/billing/receipts/allocations" && req.method === "GET") {
          const customerId = Number(url.searchParams.get("customerId") ?? 1);
          sendJson(200, {
            data: [
              { customerId, documentDate: "2026-10-18", documentNo: "SAL-2001", documentTotal: 12500, outstandingAmount: 5000, saleId: "sal-2001" }
            ],
            success: true
          });
          return;
        }

        // 8. Reports Routes (All 6)
        if (url.pathname === "/billing/reports/customer-statement" && req.method === "GET") {
          sendJson(200, {
            data: {
              ageing: { bucket0To30: 10000, bucket31To60: 5000, bucket61To90: 0, bucket90Plus: 0, current: 15000, total: 30000, undatedOpening: 0 },
              closingBalance: 30000,
              contactId: 201,
              contactName: "Acme Industrial Corp",
              items: [
                { balance: 10000, credit: 0, date: "2026-10-01", debit: 10000, description: "Opening Balance", id: "cs-1", voucherNo: "OP-01" },
                { balance: 35000, credit: 0, date: "2026-10-10", debit: 25000, description: "Tax Invoice #SAL-01", id: "cs-2", voucherNo: "SAL-01" },
                { balance: 30000, credit: 5000, date: "2026-10-15", debit: 0, description: "Receipt #REC-01", id: "cs-3", voucherNo: "REC-01" }
              ],
              openingBalance: 10000,
              page: 1,
              pageSize: 50,
              total: 3,
              totalCredit: 5000,
              totalDebit: 25000
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/billing/reports/customer-summary" && req.method === "GET") {
          sendJson(200, {
            data: {
              items: [
                { balance: 30000, code: "CUST-01", contactId: 201, contactName: "Acme Industrial Corp", credit: 5000, current: 30000, debit: 35000, overdue: 0 }
              ],
              totalBalance: 30000,
              totalCredit: 5000,
              totalDebit: 35000
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/billing/reports/supplier-statement" && req.method === "GET") {
          sendJson(200, {
            data: {
              ageing: { bucket0To30: 20000, bucket31To60: 0, bucket61To90: 0, bucket90Plus: 0, current: 20000, total: 20000, undatedOpening: 0 },
              closingBalance: 20000,
              contactId: 101,
              contactName: "Apex Raw Materials Co",
              items: [
                { balance: 5000, credit: 5000, date: "2026-10-01", debit: 0, description: "Opening Balance", id: "ss-1", voucherNo: "OP-02" },
                { balance: 25000, credit: 20000, date: "2026-10-12", debit: 0, description: "Purchase Bill #PUR-01", id: "ss-2", voucherNo: "PUR-01" },
                { balance: 20000, credit: 0, date: "2026-10-18", debit: 5000, description: "Payment #PAY-01", id: "ss-3", voucherNo: "PAY-01" }
              ],
              openingBalance: 5000,
              page: 1,
              pageSize: 50,
              total: 3,
              totalCredit: 20000,
              totalDebit: 5000
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/billing/reports/supplier-summary" && req.method === "GET") {
          sendJson(200, {
            data: {
              items: [
                { balance: 20000, code: "SUPP-01", contactId: 101, contactName: "Apex Raw Materials Co", credit: 25000, current: 20000, debit: 5000, overdue: 0 }
              ],
              totalBalance: 20000,
              totalCredit: 25000,
              totalDebit: 5000
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/billing/reports/stock-statement" && req.method === "GET") {
          sendJson(200, {
            data: {
              items: [
                { closingQuantity: 150, inwardQuantity: 200, openingQuantity: 50, outwardQuantity: 100, productId: 501, productName: "Standard Hex Bolts M10", rate: 12.5, unit: "Nos", valuation: 1875 }
              ],
              page: 1,
              pageSize: 50,
              total: 1,
              totalValuation: 1875
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/billing/reports/gst-statement" && req.method === "GET") {
          sendJson(200, {
            data: {
              cgstAmount: 2790,
              filingStatus: "ready",
              igstAmount: 0,
              month: Number(url.searchParams.get("month") ?? 10),
              purchaseCount: 1,
              purchaseTaxable: 20000,
              salesCount: 1,
              salesTaxable: 31000,
              sgstAmount: 2790,
              totalTax: 5580,
              year: Number(url.searchParams.get("year") ?? 2026)
            },
            success: true
          });
          return;
        }

        if (url.pathname === "/billing/reports/gst-statement/filing" && req.method === "PUT") {
          sendJson(200, {
            data: { filingStatus: body.status ?? "filed", success: true },
            success: true
          });
          return;
        }

        // 9. Settings
        if (url.pathname === "/billing/settings" && req.method === "GET") {
          sendJson(200, { data: testSettings, success: true });
          return;
        }

        if (url.pathname === "/billing/settings" && req.method === "PUT") {
          testSettings = body as unknown as BillingSettings;
          sendJson(200, { data: testSettings, success: true });
          return;
        }

        // 10. Opening Balances
        if (url.pathname === "/billing/opening-balances" && req.method === "GET") {
          sendJson(200, { data: { items: storedOpeningBalances }, success: true });
          return;
        }

        if (url.pathname === "/billing/opening-balances" && req.method === "PUT") {
          const rec: OpeningBalance = {
            amount: Number(body.amount),
            classification: (body.partyRole === "customer" ? "debit" : "credit"),
            contactId: Number(body.contactId),
            currencyId: Number(body.currencyId),
            id: "ob-" + (storedOpeningBalances.length + 1),
            partyRole: body.partyRole as any,
            reason: String(body.reason)
          };
          storedOpeningBalances.push(rec);
          sendJson(200, { data: rec, success: true });
          return;
        }

        // 404 Fallback
        sendJson(404, { error: { message: `Route ${url.pathname} not found.` }, success: false });
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (typeof addr === "object" && addr !== null) {
          serverOrigin = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // Mock sessions
  const adminSession: SessionRecord = {
    activeCompanyId: 1,
    activeFinancialYearId: 1,
    apiOrigin: "http://127.0.0.1",
    authenticated: true,
    desk: "tenant",
    email: "admin@codexsun.invalid",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    loginHost: "127.0.0.1",
    role: "admin",
    sessionGeneration: 1,
    sessionSlot: "slot-admin-1",
    tenantCode: "CORP01",
    userType: "admin"
  };

  const standardSession: SessionRecord = {
    activeCompanyId: 1,
    activeFinancialYearId: 1,
    apiOrigin: "http://127.0.0.1",
    authenticated: true,
    desk: "tenant",
    email: "sales_rep@codexsun.invalid",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    loginHost: "127.0.0.1",
    role: "sales_lead",
    sessionGeneration: 1,
    sessionSlot: "slot-user-1",
    tenantCode: "CORP01",
    userType: "tenant"
  };

  function createTestTransport(session: SessionRecord) {
    const sessionManager = new NativeSessionManager({
      apiOrigin: serverOrigin,
      hostVerifier: new HostVerifier({ allowLoopback: true })
    });
    // Set active session directly for test assertions
    (sessionManager as unknown as { currentSession: SessionRecord }).currentSession = {
      ...session,
      apiOrigin: serverOrigin
    };
    return new NativeHttpTransport({ sessionManager });
  }

  // --- Section 1: Authoritative Calculations & Math ---
  describe("Authoritative Calculations & Tax Split", () => {
    it("calculates intra-state CGST & SGST with exact 50/50 split and roundMoney", () => {
      const line = calculateLineItem(
        { description: "Industrial Sensor", quantity: 3, rate: 1450.5, taxRate: 18 },
        "cgst-sgst",
        1
      );
      // 3 * 1450.5 = 4351.5. Tax @ 18% = 783.27
      assert.equal(line.taxableAmount, 4351.5);
      assert.equal(line.taxAmount, 783.27);
      assert.equal(line.cgstAmount, 391.64);
      assert.equal(line.sgstAmount, 391.63);
      assert.equal(roundMoney(line.cgstAmount + line.sgstAmount), 783.27);
      assert.equal(line.lineTotal, 5134.77);
    });

    it("calculates inter-state IGST without split", () => {
      const line = calculateLineItem(
        { description: "Precision Motor", quantity: 2, rate: 5000, taxRate: 12 },
        "igst",
        1
      );
      // 2 * 5000 = 10000. Tax @ 12% = 1200
      assert.equal(line.taxableAmount, 10000);
      assert.equal(line.taxAmount, 1200);
      assert.equal(line.cgstAmount, 0);
      assert.equal(line.sgstAmount, 0);
      assert.equal(line.igstAmount, 1200);
      assert.equal(line.lineTotal, 11200);
    });

    it("handles item discount and roundoff correctly in document totals", () => {
      const doc = calculateDocumentTotals({
        items: [
          { description: "Item 1", discountPercent: 10, quantity: 10, rate: 100, taxRate: 18 },
          { description: "Item 2", discountAmount: 50, quantity: 5, rate: 200, taxRate: 18 }
        ],
        roundOff: -0.2,
        taxType: "cgst-sgst"
      });

      // Item 1: gross = 1000, discount 10% = 100 -> taxable = 900, tax = 162
      // Item 2: gross = 1000, discount 50 -> taxable = 950, tax = 171
      // Subtotal = 1850, Tax = 333, RoundOff = -0.2 -> Amount = 2182.80
      assert.equal(doc.subtotal, 1850);
      assert.equal(doc.taxAmount, 333);
      assert.equal(doc.cgstTotal, 166.5);
      assert.equal(doc.sgstTotal, 166.5);
      assert.equal(doc.amount, 2182.8);
    });

    it("calculates export currency conversion accurately", () => {
      const conversion = calculateExportCurrencyTotals({
        exchangeRate: 83.5,
        foreignAmount: 1250.75,
        foreignCurrencyCode: "USD"
      });
      assert.equal(conversion.foreignAmount, 1250.75);
      assert.equal(conversion.exchangeRate, 83.5);
      assert.equal(conversion.baseAmountInInr, 104437.63);
      assert.equal(conversion.foreignCurrencyCode, "USD");
    });
  });

  // --- Section 2: Quotations Workflow ---
  describe("Quotations Workflow (M0 Parity)", () => {
    it("creates quotation, reloads totals, verifies calculations, and generates PDF", async () => {
      const transport = createTestTransport(adminSession);

      const created = await createQuotation(transport, {
        customerName: "Acme Industrial Corp",
        date: "2026-10-25",
        items: [
          { description: "Servo Driver Unit", quantity: 4, rate: 3200, taxRate: 18 },
          { description: "Mounting Bracket Assembly", quantity: 8, rate: 450, taxRate: 18 }
        ],
        quotationNumber: "QUO-9001",
        status: "draft",
        taxType: "cgst-sgst"
      });

      assert.ok(created.id);
      assert.equal(created.quotationNumber, "QUO-9001");
      // Subtotal: 4*3200 (12800) + 8*450 (3600) = 16400. Tax: 18% = 2952. Grand: 19352.
      assert.equal(created.subtotal, 16400);
      assert.equal(created.taxAmount, 2952);
      assert.equal(created.amount, 19352);

      // Reload
      const reloaded = await getQuotation(transport, created.id);
      assert.equal(reloaded.amount, 19352);

      // Edit Quotation
      const updated = await updateQuotation(transport, created.id, {
        customerName: "Acme Industrial Corp (Updated)",
        date: "2026-10-25",
        items: [{ description: "Servo Driver Unit", quantity: 5, rate: 3200, taxRate: 18 }]
      });
      // 5 * 3200 = 16000 + 18% = 18880
      assert.equal(updated.amount, 18880);

      // Status Confirm
      const confirmed = await confirmQuotation(transport, created.id);
      assert.equal(confirmed.status, "confirmed");

      // Convert to Sale
      const conversion = await convertQuotationToSale(transport, created.id);
      assert.ok(conversion.sale.invoiceNumber.startsWith("SAL-"));

      // PDF Preview & Binary Download
      const pdf = await getQuotationPdf(transport, created.id);
      assert.ok(pdf.pdfUrl.includes(".pdf"));
      assert.ok(pdf.shareableUrl);

      const binary = await downloadQuotationPdf(transport, created.id);
      assert.ok(binary.byteLength > 0);
    });

    it("lists quotations and supports batch conversion to sales", async () => {
      const transport = createTestTransport(adminSession);
      const list = await listQuotations(transport);
      assert.ok(Array.isArray(list));
      assert.ok(list.length >= 1);

      const batchConversion = await convertQuotationsToSale(transport, [list[0]!.id]);
      assert.equal(batchConversion.sale.invoiceNumber, "SAL-BATCH-01");
    });
  });

  // --- Section 3: Sales Invoices & Role Permissions ---
  describe("Sales Invoices & Role Permission Enforcement", () => {
    it("creates sales invoice draft with intra-state tax split", async () => {
      const transport = createTestTransport(adminSession);

      const sale = await createSale(transport, {
        customerName: "Acme Industrial Corp",
        invoiceNumber: "SAL-1001",
        issuedOn: "2026-10-25",
        items: [
          { description: "PLC Module", quantity: 2, rate: 12000, taxRate: 18 }
        ],
        status: "draft",
        taxType: "cgst-sgst"
      });

      assert.equal(sale.invoiceNumber, "SAL-1001");
      assert.equal(sale.subtotal, 24000);
      assert.equal(sale.taxAmount, 4320);
      assert.equal(sale.amount, 28320);
      assert.equal(sale.status, "draft");
    });

    it("allows admin user to post and cancel sales invoices", async () => {
      const transport = createTestTransport(adminSession);

      const sale = await createSale(transport, {
        customerName: "Acme Industrial Corp",
        invoiceNumber: "SAL-1002",
        issuedOn: "2026-10-25",
        items: [{ description: "PLC Module", quantity: 1, rate: 12000, taxRate: 18 }]
      });

      // Admin post
      const posted = await postSale(transport, sale.id, adminSession);
      assert.equal(posted.status, "confirmed");

      // Admin cancel
      const cancelled = await cancelSale(transport, sale.id, adminSession);
      assert.equal(cancelled.status, "cancelled");
    });

    it("ENFORCES NEGATIVE PERMISSION: rejects posting and cancellation from non-admin user", async () => {
      const transport = createTestTransport(standardSession);

      const sale = await createSale(transport, {
        customerName: "Acme Industrial Corp",
        invoiceNumber: "SAL-1003",
        issuedOn: "2026-10-25",
        items: [{ description: "PLC Module", quantity: 1, rate: 12000, taxRate: 18 }]
      });

      // Non-admin attempting to post
      await assert.rejects(
        async () => {
          await postSale(transport, sale.id, standardSession);
        },
        (err: unknown) => {
          assert.ok(err instanceof BillingPermissionError);
          assert.equal(err.statusCode, 403);
          assert.ok(err.message.includes("administrator privileges"));
          return true;
        }
      );

      // Non-admin attempting to cancel
      await assert.rejects(
        async () => {
          await cancelSale(transport, sale.id, standardSession);
        },
        (err: unknown) => {
          assert.ok(err instanceof BillingPermissionError);
          assert.equal(err.statusCode, 403);
          return true;
        }
      );
    });

    it("downloads PDF for sales invoice", async () => {
      const transport = createTestTransport(adminSession);
      const list = await listSales(transport);
      const saleId = list[0]!.id;

      const pdf = await getSalePdf(transport, saleId);
      assert.ok(pdf.pdfUrl);

      const binary = await downloadSalePdf(transport, saleId);
      assert.ok(binary.byteLength > 0);
    });
  });

  // --- Section 4: Purchase Bills & Export Sales ---
  describe("Purchase Bills & Export Sales", () => {
    it("creates and manages purchase bills with admin posting permissions", async () => {
      const transport = createTestTransport(adminSession);

      const bill = await createPurchase(transport, {
        date: "2026-10-25",
        items: [{ description: "Raw Steel Ingot", quantity: 10, rate: 2500, taxRate: 18 }],
        purchaseNumber: "PUR-2001",
        status: "draft",
        supplierName: "Apex Raw Materials Co",
        taxType: "cgst-sgst"
      });

      assert.equal(bill.purchaseNumber, "PUR-2001");
      // 10 * 2500 = 25000 + 18% = 29500
      assert.equal(bill.subtotal, 25000);
      assert.equal(bill.amount, 29500);

      // Admin post
      const posted = await postPurchase(transport, bill.id, adminSession);
      assert.equal(posted.status, "confirmed");

      // Non-admin reject
      await assert.rejects(
        async () => {
          await cancelPurchase(transport, bill.id, standardSession);
        },
        (err: unknown) => err instanceof BillingPermissionError
      );
    });

    it("creates export sale with foreign currency and exchange rate conversion", async () => {
      const transport = createTestTransport(adminSession);

      const exp = await createExportSale(transport, {
        currencyCode: "USD",
        currencyId: 2,
        customerName: "Global Tech Inc (US)",
        exchangeRate: 83.5,
        invoiceNumber: "EXP-3001",
        issuedOn: "2026-10-25",
        items: [{ description: "Proprietary Sensor Assembly", quantity: 5, rate: 400, taxRate: 0 }],
        status: "draft",
        taxType: "igst"
      });

      assert.equal(exp.invoiceNumber, "EXP-3001");
      assert.equal(exp.currencyCode, "USD");
      assert.equal(exp.amount, 2000); // 5 * 400
      assert.equal(exp.amountInBaseCurrency, 167000); // 2000 * 83.5

      // Post export sale as admin
      const posted = await postExportSale(transport, exp.id, adminSession);
      assert.equal(posted.status, "confirmed");

      // Non-admin post rejection
      await assert.rejects(
        async () => {
          await cancelExportSale(transport, exp.id, standardSession);
        },
        (err: unknown) => err instanceof BillingPermissionError
      );
    });
  });

  // --- Section 5: Payments, Receipts & Allocations ---
  describe("Payments, Receipts & Allocations", () => {
    it("creates supplier payment voucher and allocates against open purchase bills", async () => {
      const transport = createTestTransport(adminSession);

      // Query open allocation candidates
      const openBills = await listPaymentAllocations(transport, 101);
      assert.ok(openBills.length > 0);
      assert.equal(openBills[0]!.documentNo, "PUR-1001");

      const payment = await createPayment(transport, {
        allocations: [{ allocatedAmount: 5000, purchaseId: openBills[0]!.purchaseId }],
        amount: 5000,
        paymentDate: "2026-10-25",
        paymentMode: "bank",
        paymentNumber: "PAY-4001",
        supplierId: 101,
        supplierName: "Apex Raw Materials Co"
      });

      assert.equal(payment.paymentNumber, "PAY-4001");
      assert.equal(payment.amount, 5000);
      assert.equal(payment.allocatedAmount, 5000);
      assert.equal(payment.unallocatedAmount, 0);

      // Post payment as admin
      const posted = await postPayment(transport, payment.id, adminSession);
      assert.equal(posted.status, "posted");

      // Non-admin cancel rejected
      await assert.rejects(
        async () => {
          await cancelPayment(transport, payment.id, standardSession);
        },
        (err: unknown) => err instanceof BillingPermissionError
      );
    });

    it("creates customer receipt voucher and allocates against sales invoices", async () => {
      const transport = createTestTransport(adminSession);

      // Query open invoice allocation candidates
      const openInvoices = await listReceiptAllocations(transport, 201);
      assert.ok(openInvoices.length > 0);
      assert.equal(openInvoices[0]!.documentNo, "SAL-2001");

      const receipt = await createReceipt(transport, {
        allocations: [{ allocatedAmount: 2500, saleId: openInvoices[0]!.saleId }],
        amount: 3000,
        customerId: 201,
        customerName: "Acme Industrial Corp",
        receiptDate: "2026-10-25",
        receiptMode: "upi",
        receiptNumber: "REC-5001"
      });

      assert.equal(receipt.receiptNumber, "REC-5001");
      assert.equal(receipt.amount, 3000);
      assert.equal(receipt.allocatedAmount, 2500);
      assert.equal(receipt.unallocatedAmount, 500);

      // Post receipt as admin
      const posted = await postReceipt(transport, receipt.id, adminSession);
      assert.equal(posted.status, "posted");

      // Non-admin cancel rejected
      await assert.rejects(
        async () => {
          await cancelReceipt(transport, receipt.id, standardSession);
        },
        (err: unknown) => err instanceof BillingPermissionError
      );
    });
  });

  // --- Section 6: All 6 Reports ---
  describe("All 6 Billing Reports (Parity & Statements)", () => {
    it("1. loads Customer Statement with opening balance and running balance", async () => {
      const transport = createTestTransport(adminSession);
      const rep = await getCustomerStatement(transport, { contactId: 201 });

      assert.equal(rep.openingBalance, 10000);
      assert.equal(rep.closingBalance, 30000);
      assert.equal(rep.items.length, 3);
      assert.ok(rep.ageing);
      assert.equal(rep.ageing.total, 30000);

      // Verify running balance math: 10000 (opening) + 25000 (debit) - 5000 (credit) = 30000
      const closing = calculateClosingBalance({
        credit: rep.totalCredit,
        debit: rep.totalDebit,
        openingBalance: rep.openingBalance,
        role: "customer"
      });
      assert.equal(closing, 30000);
    });

    it("2. loads Customer Summary with total receivables", async () => {
      const transport = createTestTransport(adminSession);
      const rep = await getCustomerSummary(transport);

      assert.equal(rep.totalBalance, 30000);
      assert.equal(rep.items.length, 1);
      assert.equal(rep.items[0]!.contactName, "Acme Industrial Corp");
    });

    it("3. loads Supplier Statement with opening balance and running balance", async () => {
      const transport = createTestTransport(adminSession);
      const rep = await getSupplierStatement(transport, { contactId: 101 });

      assert.equal(rep.openingBalance, 5000);
      assert.equal(rep.closingBalance, 20000);
      assert.equal(rep.items.length, 3);
      assert.ok(rep.ageing);

      // Verify supplier running balance math: 5000 (opening credit) + 20000 (bills) - 5000 (paid) = 20000
      const closing = calculateClosingBalance({
        credit: rep.totalCredit,
        debit: rep.totalDebit,
        openingBalance: rep.openingBalance,
        role: "supplier"
      });
      assert.equal(closing, 20000);
    });

    it("4. loads Supplier Summary with total payables", async () => {
      const transport = createTestTransport(adminSession);
      const rep = await getSupplierSummary(transport);

      assert.equal(rep.totalBalance, 20000);
      assert.equal(rep.items.length, 1);
      assert.equal(rep.items[0]!.contactName, "Apex Raw Materials Co");
    });

    it("5. loads Stock Statement with valuation", async () => {
      const transport = createTestTransport(adminSession);
      const rep = await getStockStatement(transport);

      assert.equal(rep.totalValuation, 1875);
      assert.equal(rep.items.length, 1);
      const item = rep.items[0]!;
      assert.equal(item.openingQuantity, 50);
      assert.equal(item.inwardQuantity, 200);
      assert.equal(item.outwardQuantity, 100);
      assert.equal(item.closingQuantity, 150);
    });

    it("6. loads GST Statement and saves filing acknowledgement", async () => {
      const transport = createTestTransport(adminSession);
      const rep = await getGstStatement(transport, { month: 10, year: 2026 });

      assert.equal(rep.cgstAmount, 2790);
      assert.equal(rep.sgstAmount, 2790);
      assert.equal(rep.totalTax, 5580);
      assert.equal(rep.filingStatus, "ready");

      const filingRes = await saveGstStatementFiling(transport, {
        acknowledgementNumber: "ARN-2026-10-0991",
        filedAt: "2026-10-25T10:00:00Z",
        month: 10,
        status: "filed",
        year: 2026
      });
      assert.equal(filingRes.filingStatus, "filed");
      assert.equal(filingRes.success, true);
    });
  });

  // --- Section 7: Settings & Opening Balance Classification ---
  describe("Settings & Opening Balance Classification", () => {
    it("respects double-entry classification for opening balances (Customer=Debit, Supplier=Credit)", async () => {
      const transport = createTestTransport(adminSession);

      // Customer opening balance -> Debit
      assert.equal(classifyOpeningBalance("customer"), "debit");
      const custOb = await saveOpeningBalance(
        transport,
        {
          amount: 12000,
          contactId: 201,
          currencyId: 1,
          partyRole: "customer",
          reason: "Prior year customer receivable"
        },
        adminSession
      );
      assert.equal(custOb.classification, "debit");
      assert.ok(formatOpeningBalanceDescriptor("customer", custOb.amount).includes("DEBIT"));

      // Supplier opening balance -> Credit
      assert.equal(classifyOpeningBalance("supplier"), "credit");
      const suppOb = await saveOpeningBalance(
        transport,
        {
          amount: 8500,
          contactId: 101,
          currencyId: 1,
          partyRole: "supplier",
          reason: "Prior year supplier payable"
        },
        adminSession
      );
      assert.equal(suppOb.classification, "credit");
      assert.ok(formatOpeningBalanceDescriptor("supplier", suppOb.amount).includes("CREDIT"));

      // Non-admin rejected from saving opening balances
      await assert.rejects(
        async () => {
          await saveOpeningBalance(
            transport,
            { amount: 5000, contactId: 201, currencyId: 1, partyRole: "customer", reason: "Test" },
            standardSession
          );
        },
        (err: unknown) => err instanceof BillingPermissionError
      );
    });

    it("configures and formats document numbers for all document types", async () => {
      const transport = createTestTransport(adminSession);
      const s = await getBillingSettings(transport);

      assert.equal(generateNextDocumentNumber(s, "quotation"), "QUO-0001");
      assert.equal(generateNextDocumentNumber(s, "sales"), "SAL-0001");
      assert.equal(generateNextDocumentNumber(s, "purchase"), "PUR-0001");
      assert.equal(generateNextDocumentNumber(s, "exportSales"), "EXP-0001");
      assert.equal(generateNextDocumentNumber(s, "payment"), "PAY-0001");
      assert.equal(generateNextDocumentNumber(s, "receipt"), "REC-0001");

      // Custom formatting test
      const customFormatted = formatDocumentNumber({
        automatic: true,
        nextNumber: 42,
        padding: 5,
        prefix: "INV",
        separator: "/",
        suffix: "-FY26",
        usePrefix: true,
        useSeparator: true,
        useSuffix: true
      });
      assert.equal(customFormatted, "INV/00042-FY26");
    });
  });

  // --- Section 8: Dashboard ---
  describe("Dashboard Metrics", () => {
    it("loads real-time metrics, outstanding amounts, and monthly trends", async () => {
      const transport = createTestTransport(adminSession);
      const dash = await getBillingDashboard(transport);

      assert.equal(dash.companyName, "Solaris Corp");
      assert.ok(dash.metrics.sales.total > 0);
      assert.ok(dash.metrics.purchase.total > 0);
      assert.equal(dash.outstanding.length, 2);
      assert.ok(dash.outstanding.some((o) => o.direction === "receivable"));
      assert.ok(dash.outstanding.some((o) => o.direction === "payable"));
    });
  });
});
