import React, { useState } from "react";
import {
  FileTextIcon,
  ReceiptIcon,
  BarChart3Icon,
  SettingsIcon
} from "lucide-react";
import {
  BillingDashboardWorkspace,
  BillingSettingsWorkspace,
  CustomerStatementWorkspace,
  CustomerSummaryWorkspace,
  DocumentSettingsWorkspace,
  ExportSalesWorkspace,
  GstStatementWorkspace,
  OpeningBalanceWorkspace,
  PaymentWorkspace,
  PurchaseWorkspace,
  QuotationWorkspace,
  ReceiptWorkspace,
  SalesWorkspace,
  StockStatementWorkspace,
  SupplierStatementWorkspace,
  SupplierSummaryWorkspace
} from "@codexsun/billing-web";

export type BillingMobileRouteKey =
  | "overview"
  | "quotation"
  | "sales"
  | "purchase"
  | "export-sales"
  | "payment"
  | "receipt"
  | "opening-balance"
  | "customer-statement"
  | "customer-summary"
  | "supplier-statement"
  | "supplier-summary"
  | "stock-statement"
  | "gst-statement"
  | "settings"
  | "document-settings";

export type BillingRouteSection = "documents" | "vouchers" | "reports" | "config";

export interface BillingRouteItem {
  description: string;
  key: BillingMobileRouteKey;
  label: string;
  section: BillingRouteSection;
}

export const BILLING_MOBILE_ROUTES: BillingRouteItem[] = [
  { description: "Financial health, receivables & key metrics", key: "overview", label: "Overview", section: "documents" },
  { description: "Customer price estimates & proposals", key: "quotation", label: "Quotations", section: "documents" },
  { description: "GST tax invoices & customer billing", key: "sales", label: "Sales Invoices", section: "documents" },
  { description: "Vendor inward purchase bills", key: "purchase", label: "Purchase Bills", section: "documents" },
  { description: "Foreign currency export billing", key: "export-sales", label: "Export Sales", section: "documents" },

  { description: "Vendor disbursements & bill allocations", key: "payment", label: "Payment Vouchers", section: "vouchers" },
  { description: "Customer receipts & invoice settlements", key: "receipt", label: "Receipt Vouchers", section: "vouchers" },
  { description: "Initial debit/credit ledger positions", key: "opening-balance", label: "Opening Balances", section: "vouchers" },

  { description: "Customer ledger running statement", key: "customer-statement", label: "Customer Statement", section: "reports" },
  { description: "Customer aggregate balances & aging", key: "customer-summary", label: "Customer Summary", section: "reports" },
  { description: "Supplier ledger running statement", key: "supplier-statement", label: "Supplier Statement", section: "reports" },
  { description: "Supplier aggregate balances & aging", key: "supplier-summary", label: "Supplier Summary", section: "reports" },
  { description: "Inventory valuation & movement", key: "stock-statement", label: "Stock Statement", section: "reports" },
  { description: "GSTR summary & tax acknowledgements", key: "gst-statement", label: "GST Statement", section: "reports" },

  { description: "Tax rates, numbering sequences & defaults", key: "settings", label: "Billing Settings", section: "config" },
  { description: "Document prefixes & numbering formats", key: "document-settings", label: "Document Settings", section: "config" }
];

export interface BillingMobileWorkspaceProps {
  initialRoute?: BillingMobileRouteKey;
  onNavigateRoute?: (route: BillingMobileRouteKey) => void;
}

export function BillingMobileWorkspace({
  initialRoute = "quotation",
  onNavigateRoute
}: BillingMobileWorkspaceProps) {
  const [activeRoute, setActiveRoute] = useState<BillingMobileRouteKey>(initialRoute);
  const [activeSection, setActiveSection] = useState<BillingRouteSection>("documents");

  function handleSelectRoute(route: BillingMobileRouteKey) {
    setActiveRoute(route);
    onNavigateRoute?.(route);
  }

  const routesForCurrentSection = BILLING_MOBILE_ROUTES.filter(
    (item) => item.section === activeSection
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-950 text-slate-100" data-testid="billing-mobile-workspace">
      {/* 1. Primary Section Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900 px-2 py-1.5 overflow-x-auto gap-1">
        <button
          type="button"
          onClick={() => {
            setActiveSection("documents");
            setActiveRoute("quotation");
          }}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors shrink-0 ${
            activeSection === "documents"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <FileTextIcon className="size-3.5" />
          <span>Documents</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSection("vouchers");
            setActiveRoute("payment");
          }}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors shrink-0 ${
            activeSection === "vouchers"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <ReceiptIcon className="size-3.5" />
          <span>Vouchers</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSection("reports");
            setActiveRoute("customer-statement");
          }}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors shrink-0 ${
            activeSection === "reports"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <BarChart3Icon className="size-3.5" />
          <span>Reports</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSection("config");
            setActiveRoute("settings");
          }}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors shrink-0 ${
            activeSection === "config"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <SettingsIcon className="size-3.5" />
          <span>Config</span>
        </button>
      </div>

      {/* 2. Sub-Route Navigation Pills */}
      <div className="flex border-b border-slate-800/80 bg-slate-900/60 px-2 py-1.5 overflow-x-auto gap-1">
        {routesForCurrentSection.map((item) => {
          const isCurrent = activeRoute === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSelectRoute(item.key)}
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors shrink-0 ${
                isCurrent
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-700/80"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* 3. Real Authoritative Owner Workspace Mount */}
      <div className="flex-1 overflow-y-auto p-2" data-testid={`billing-view-${activeRoute}`}>
        {activeRoute === "overview" && <BillingDashboardWorkspace />}
        {activeRoute === "quotation" && <QuotationWorkspace />}
        {activeRoute === "sales" && <SalesWorkspace />}
        {activeRoute === "purchase" && <PurchaseWorkspace />}
        {activeRoute === "export-sales" && <ExportSalesWorkspace />}
        {activeRoute === "payment" && <PaymentWorkspace />}
        {activeRoute === "receipt" && <ReceiptWorkspace />}
        {activeRoute === "opening-balance" && <OpeningBalanceWorkspace />}
        {activeRoute === "customer-statement" && <CustomerStatementWorkspace />}
        {activeRoute === "customer-summary" && <CustomerSummaryWorkspace />}
        {activeRoute === "supplier-statement" && <SupplierStatementWorkspace />}
        {activeRoute === "supplier-summary" && <SupplierSummaryWorkspace />}
        {activeRoute === "stock-statement" && <StockStatementWorkspace />}
        {activeRoute === "gst-statement" && <GstStatementWorkspace />}
        {activeRoute === "settings" && <BillingSettingsWorkspace />}
        {activeRoute === "document-settings" && <DocumentSettingsWorkspace />}
      </div>
    </div>
  );
}
