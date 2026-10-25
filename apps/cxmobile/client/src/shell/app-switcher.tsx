import React from "react";
import {
  FileTextIcon,
  LockIcon,
  MessageSquareIcon,
  ShoppingBagIcon,
  UserCheckIcon,
  XIcon
} from "lucide-react";
import {
  type SupportedApp,
  useNativeSession
} from "../app/native-session-provider.js";

interface AppItemConfig {
  color: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  key: SupportedApp;
  title: string;
}

const APPS: AppItemConfig[] = [
  {
    color: "text-sky-500",
    description: "Leads, pipeline, tasks & customer communication",
    icon: UserCheckIcon,
    key: "crm",
    title: "CRM"
  },
  {
    color: "text-emerald-500",
    description: "Quotations, GST invoices, payments & vouchers",
    icon: FileTextIcon,
    key: "billing",
    title: "Billing"
  },
  {
    color: "text-violet-500",
    description: "Channels, direct messages & document sharing",
    icon: MessageSquareIcon,
    key: "chat",
    title: "Chat"
  },
  {
    color: "text-amber-500",
    description: "Catalogue management, item drafts & media",
    icon: ShoppingBagIcon,
    key: "ecommerce",
    title: "Ecommerce"
  }
];

export interface AppSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppSwitcher({ isOpen, onClose }: AppSwitcherProps) {
  const { activeApp, isAppEnabled, session, setActiveApp } = useNativeSession();

  if (!isOpen) return null;

  const tenantCode = session?.tenantCode ?? session?.tenantId ?? "Unassigned";
  const companyLabel =
    session?.context?.company?.name ??
    session?.context?.defaultCompany?.companyName ??
    (session?.activeCompanyId !== undefined ? `Company #${session.activeCompanyId}` : "Company Default");
  const yearLabel =
    session?.context?.defaultCompany?.financialYearName ??
    (session?.activeFinancialYearId !== undefined ? `FY #${session.activeFinancialYearId}` : "FY 2026-27");

  function handleSelect(app: SupportedApp) {
    if (!isAppEnabled(app)) return;
    setActiveApp(app);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="App Switcher"
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-2xl text-card-foreground">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Switch Application</h2>
            <p className="text-[11px] text-muted-foreground">CODEXSUN Mobile Suite</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Close Switcher"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* Active Tenant / Company / Year Indicator */}
        <div className="my-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-muted/50 p-2 text-[11px]">
          <span className="font-semibold text-muted-foreground">Context:</span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary font-mono border border-primary/20">
            {tenantCode}
          </span>
          <span className="rounded bg-background px-1.5 py-0.5 text-foreground border border-border">
            {companyLabel}
          </span>
          <span className="rounded bg-background px-1.5 py-0.5 text-muted-foreground border border-border">
            {yearLabel}
          </span>
        </div>

        {/* 4 Apps Grid with Permission Gating */}
        <div className="grid grid-cols-2 gap-2.5">
          {APPS.map((item) => {
            const isPermitted = isAppEnabled(item.key);
            const isActive = activeApp === item.key;
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                type="button"
                disabled={!isPermitted}
                onClick={() => handleSelect(item.key)}
                className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                  isActive
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : isPermitted
                    ? "border-border bg-card hover:bg-accent hover:border-border"
                    : "border-border/40 bg-muted/20 opacity-50 cursor-not-allowed"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <Icon className={`size-5 ${item.color}`} />
                  {!isPermitted ? (
                    <span className="flex items-center gap-0.5 text-[10px] text-destructive font-medium">
                      <LockIcon className="size-3" /> Gated
                    </span>
                  ) : isActive ? (
                    <span className="rounded-full bg-primary size-1.5" />
                  ) : null}
                </div>
                <div className="mt-2 text-xs font-semibold text-foreground">{item.title}</div>
                <div className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                  {item.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
