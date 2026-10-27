import { useEffect, useState, type CSSProperties } from "react";
import {
  Code2Icon,
  LayoutDashboardIcon,
  PanelLeftIcon,
  Settings2Icon,
  MessagesSquare
} from "lucide-react";
import { AppSidebar } from "@codexsun/ui/blocks/menu/sidemenu/app-sidebar";
import {
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar
} from "@codexsun/ui/components/sidebar";
import {
  AppLayout,
  AppHeader,
  StatusBar,
  TopMenu,
  WorkspaceCanvas
} from "@codexsun/ui/layouts/main-layouts";
import { Card, CardContent, CardHeader, CardTitle } from "@codexsun/ui/components/card";
import { Button } from "@codexsun/ui/components/button";
import { PromptManagerWorkspace, PromptManagerNotifications } from "./modules/prompt-manager";
import packageInfo from "../package.json";

type Page = "overview" | "workspace" | "settings" | "prompt-manager";
const user = { name: "Local developer", email: "Standalone workspace", fallback: "CI" };

export function CodeitApp() {
  return (
    <SidebarProvider
      className="h-dvh min-h-0"
      style={{ "--sidebar-width": "19rem", "--sidebar-width-icon": "2.5rem" } as CSSProperties}
    >
      <CodeitShell />
    </SidebarProvider>
  );
}

function CodeitShell() {
  const [page, setPage] = useState<Page>(pageFromLocation);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  const { toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const title =
    page === "overview"
      ? "Overview"
      : page === "workspace"
        ? "Workspace"
        : page === "prompt-manager"
          ? "Prompt Manager"
          : "Settings";

  useEffect(() => {
    const sync = () => setPage(pageFromLocation());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  function selectPage(next: Page) {
    window.history.pushState(null, "", `/codeit/${next}`);
    setPage(next);
    setSearchOpen(false);
    setSearch("");
    if (isMobile) setOpenMobile(false);
  }

  const items = [
    {
      title: "Overview",
      icon: LayoutDashboardIcon,
      isActive: page === "overview",
      onSelect: () => selectPage("overview")
    },
    {
      title: "Workspace",
      icon: PanelLeftIcon,
      isActive: page === "workspace",
      onSelect: () => selectPage("workspace")
    },
    {
      title: "Prompt Manager",
      icon: MessagesSquare,
      isActive: page === "prompt-manager",
      onSelect: () => selectPage("prompt-manager")
    }
  ];
  const searchItems = [
    ...items.map((item) => ({ label: item.title, icon: item.icon, onSelect: item.onSelect })),
    { label: "Settings", icon: Settings2Icon, onSelect: () => selectPage("settings") },
    { label: "Toggle sidebar", onSelect: toggleSidebar }
  ];

  return (
    <AppLayout className="relative h-dvh w-full">
      <PromptManagerNotifications
        onOpen={(id) => {
          window.history.pushState(null, "", `/codeit/prompt-manager/${id}`);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }}
      />
      <div className="tenant-main-menu shrink-0 [&>header]:h-10 [&>header>div:last-child]:gap-3">
        <TopMenu
          applicationName="Codeit"
          companyBrand={{ name: "codexsun" }}
          appItems={[
            {
              title: "Codeit",
              description: "Standalone development workspace",
              icon: Code2Icon,
              active: true,
              onSelect: () => selectPage("overview")
            }
          ]}
          notifications={[]}
          user={user}
          search={search}
          searchOpen={searchOpen}
          searchPlaceholder="Search applications and commands"
          onSearchChange={setSearch}
          onOpenSearch={() => setSearchOpen(true)}
          onCloseSearch={() => {
            setSearchOpen(false);
            setSearch("");
          }}
          onToggleSidebar={toggleSidebar}
          searchItems={searchItems}
        />
      </div>
      <div className="relative flex min-h-0 flex-1 pt-0.5">
        <AppSidebar
          className="md:p-1 md:pt-0.5 md:pb-0.5"
          items={items}
          positioning="container"
          user={user}
          variant="inset"
          footerContent={
            <>
              <div className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                v {packageInfo.version}
              </div>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={page === "settings"} tooltip="Settings">
                    <button type="button" onClick={() => selectPage("settings")}>
                      <Settings2Icon />
                      <span className="group-data-[collapsible=icon]:hidden">Settings</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </>
          }
        />
        <SidebarInset className="min-h-0 min-w-0 overflow-hidden md:peer-data-[variant=inset]:m-1 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:mt-0 md:peer-data-[variant=inset]:mb-0.5">
          <AppHeader
            breadcrumbs={[{ label: title }]}
            homeHref="/codeit/overview"
            actionsAlignment="workspace"
            actions={
              page === "prompt-manager" ? (
                <div ref={setHeaderTarget} className="flex items-center gap-2" />
              ) : null
            }
          />
          <div className="workspace-scroll min-h-0 flex-1 overflow-y-auto">
            <WorkspaceCanvas>
              {page === "prompt-manager" ? (
                <PromptManagerWorkspace headerTarget={headerTarget} />
              ) : (
                <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Developer kits</p>
                    <h1 className="text-2xl font-semibold">{title}</h1>
                    <p className="text-sm text-muted-foreground">
                      {page === "overview"
                        ? "Your standalone development workspace."
                        : page === "workspace"
                          ? "A place for your development work."
                          : "Codeit settings."}
                    </p>
                  </div>
                  {page === "overview" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Prompt Manager</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 text-sm text-muted-foreground">
                          <p>
                            Save repeating instructions, send them to a Codex chat, and keep each
                            response.
                          </p>
                          <Button className="w-fit" onClick={() => selectPage("prompt-manager")}>
                            Open Prompt Manager
                          </Button>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Standalone app</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          Codeit runs separately from CRM and uses the shared CODEXSUN interface.
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{title}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        {page === "workspace"
                          ? "Open Prompt Manager to save and run your development instructions."
                          : "Codex uses the account and permissions configured in your local Codex CLI."}
                      </CardContent>
                    </Card>
                  )}
                </main>
              )}
            </WorkspaceCanvas>
          </div>
        </SidebarInset>
      </div>
      <StatusBar status="Standalone" workspace={title} />
    </AppLayout>
  );
}

function pageFromLocation(): Page {
  if (window.location.pathname.startsWith("/codeit/prompt-manager")) return "prompt-manager";
  if (window.location.pathname === "/codeit/workspace") return "workspace";
  if (window.location.pathname === "/codeit/settings") return "settings";
  return "overview";
}
