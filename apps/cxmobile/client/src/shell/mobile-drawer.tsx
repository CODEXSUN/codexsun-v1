import React from "react";
import {
  BuildingIcon,
  ChevronRightIcon,
  FileTextIcon,
  LogOutIcon,
  MessageSquareIcon,
  ShoppingBagIcon,
  UserCheckIcon,
  UserIcon,
  XIcon
} from "lucide-react";
import {
  type SupportedApp,
  useNativeSession
} from "../app/native-session-provider.js";

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAppSwitcher: () => void;
}

export function MobileDrawer({ isOpen, onClose, onOpenAppSwitcher }: MobileDrawerProps) {
  const {
    activeApp,
    isAppEnabled,
    logout,
    session,
    setActiveApp,
    switchCompany
  } = useNativeSession();

  const userEmail = session?.email ?? "field.agent@codexsun.invalid";
  const userName = session?.name ?? session?.userType ?? "Mobile User";
  const tenantCode = session?.tenantCode ?? session?.tenantId ?? "tenant";

  function handleSelectApp(app: SupportedApp) {
    if (isAppEnabled(app)) {
      setActiveApp(app);
      onClose();
    }
  }

  async function handleLogout() {
    onClose();
    await logout();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`cxmobile-drawer-backdrop ${isOpen ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        className={`cxmobile-drawer ${isOpen ? "open" : ""}`}
        data-region="main.sideBar"
        aria-label="Mobile Navigation Drawer"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-border p-4 bg-card">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-primary">
              CODEXSUN Mobile
            </div>
            <div className="text-sm font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
              <span>{tenantCode}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
                {session?.desk ?? "tenant"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Close Navigation Drawer"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4 bg-background">
          {/* Quick App Switcher Section */}
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Applications</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAppSwitcher();
                }}
                className="text-primary hover:underline lowercase"
              >
                all apps
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => handleSelectApp("crm")}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                  activeApp === "crm"
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                <span className="flex items-center gap-2">
                  <UserCheckIcon className="size-4 text-sky-500" />
                  CRM Workspace
                </span>
                <ChevronRightIcon className="size-3.5 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => handleSelectApp("billing")}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                  activeApp === "billing"
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileTextIcon className="size-4 text-emerald-500" />
                  Billing Workspace
                </span>
                <ChevronRightIcon className="size-3.5 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => handleSelectApp("chat")}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                  activeApp === "chat"
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                <span className="flex items-center gap-2">
                  <MessageSquareIcon className="size-4 text-violet-500" />
                  Team Chat
                </span>
                <ChevronRightIcon className="size-3.5 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => handleSelectApp("ecommerce")}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                  activeApp === "ecommerce"
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                <span className="flex items-center gap-2">
                  <ShoppingBagIcon className="size-4 text-amber-500" />
                  Ecommerce Catalogue
                </span>
                <ChevronRightIcon className="size-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Company / Year Context Selector */}
          <div className="rounded-lg border border-border bg-card p-2.5 text-card-foreground">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1.5">
              <BuildingIcon className="size-3 text-muted-foreground" />
              Company Selection
            </div>
            <div className="text-xs text-foreground font-medium">
              Company ID: {session?.activeCompanyId ?? session?.context?.defaultCompany?.companyId ?? 1}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Financial Year: {session?.activeFinancialYearId ?? session?.context?.defaultCompany?.financialYearId ?? 1}
            </div>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => switchCompany(1, 1)}
                className="rounded border border-border bg-muted px-2 py-1 text-[10px] text-foreground hover:bg-accent transition-colors"
              >
                Co #1
              </button>
              <button
                type="button"
                onClick={() => switchCompany(2, 1)}
                className="rounded border border-border bg-muted px-2 py-1 text-[10px] text-foreground hover:bg-accent transition-colors"
              >
                Co #2
              </button>
            </div>
          </div>
        </div>

        {/* Drawer Footer with User & Sign Out */}
        <div className="border-t border-border p-3 bg-muted/40">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UserIcon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-foreground">{userName}</div>
              <div className="truncate text-[10px] text-muted-foreground">{userEmail}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
          >
            <LogOutIcon className="size-3.5" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
