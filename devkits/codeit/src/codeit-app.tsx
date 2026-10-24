import { useEffect, useState } from "react";
import {
  Code2Icon,
  LayersIcon,
  LayoutDashboardIcon,
  MessageSquareCodeIcon,
  PuzzleIcon,
  Settings2Icon,
  SparklesIcon
} from "lucide-react";
import {
  AppLayout,
  AppHeader,
  SideMenu,
  StatusBar,
  TopMenu,
  WorkspaceCanvas,
  mainLayoutTechnicalNames
} from "@codexsun/ui/layouts/main-layouts";
import { CodeitOverview, CodeitSettings } from "./modules/overview";
import { ConversationWorkspace } from "./modules/conversation";
import { PluginPanel } from "./modules/plugin";
import { OrchestrationWorkspace } from "./modules/orchestration";
import { PersonalizationPanel } from "./modules/personalization";
import { ProviderWorkspace } from "./modules/provider";

export function CodeitApp() {
  const [page, setPage] = useState<
    "chat" | "overview" | "supervisor" | "personalization" | "settings" | "plugins"
  >(pageFromLocation);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const title =
    page === "settings"
      ? "Settings"
      : page === "plugins"
        ? "Plugins"
        : page === "supervisor"
          ? "Supervisor"
          : page === "personalization"
            ? "Personalization"
            : page === "chat"
              ? "Workspace"
              : "Overview";
  const user = { name: "Local developer", email: "Standalone workspace", fallback: "CI" };

  useEffect(() => {
    const onPopState = () => setPage(pageFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function selectPage(
    next: "chat" | "overview" | "supervisor" | "personalization" | "settings" | "plugins"
  ) {
    window.history.pushState(null, "", `/codeit/${next}`);
    setPage(next);
    setSearchOpen(false);
    setSearch("");
    if (window.innerWidth < 768) setSidebarOpen(false);
  }

  const navigation = [
    {
      label: "Codeit",
      icon: Code2Icon,
      items: [
        { label: "Workspace", icon: MessageSquareCodeIcon, onSelect: () => selectPage("chat") },
        { label: "Overview", icon: LayoutDashboardIcon, onSelect: () => selectPage("overview") },
        { label: "Supervisor", icon: LayersIcon, onSelect: () => selectPage("supervisor") },
        {
          label: "Personalization",
          icon: SparklesIcon,
          onSelect: () => selectPage("personalization")
        },
        { label: "Plugins", icon: PuzzleIcon, onSelect: () => selectPage("plugins") },
        { label: "Settings", icon: Settings2Icon, onSelect: () => selectPage("settings") }
      ]
    }
  ];

  return (
    <AppLayout className="h-dvh [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <div data-technical-name={mainLayoutTechnicalNames.topMenu}>
        <TopMenu
          applicationName="Codeit"
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
          onProfile={() => selectPage("settings")}
          search={search}
          searchOpen={searchOpen}
          searchPlaceholder="Search Codeit pages..."
          onSearchChange={setSearch}
          onOpenSearch={() => setSearchOpen(true)}
          onCloseSearch={() => {
            setSearchOpen(false);
            setSearch("");
          }}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          searchItems={navigation[0]!.items.map((item) => ({
            label: item.label,
            icon: item.icon,
            onSelect: item.onSelect
          }))}
        />
      </div>
      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen ? (
          <div
            data-technical-name={mainLayoutTechnicalNames.sideBar}
            className="absolute inset-y-0 left-0 z-20 flex bg-background shadow-lg md:static md:shadow-none"
          >
            <SideMenu
              navigation={navigation}
              onSelect={(label) =>
                selectPage(
                  label === "Settings"
                    ? "settings"
                    : label === "Plugins"
                      ? "plugins"
                      : label === "Supervisor"
                        ? "supervisor"
                        : label === "Personalization"
                          ? "personalization"
                          : label === "Workspace"
                            ? "chat"
                            : "overview"
                )
              }
              search=""
              selected={title}
              workspaceTitle="Overview"
            />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <div data-technical-name={mainLayoutTechnicalNames.appHeader}>
            <AppHeader
              breadcrumbs={[{ label: title }]}
              homeHref="/codeit/overview"
              name={user.name}
            />
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto"
            data-technical-name={mainLayoutTechnicalNames.workspace}
          >
            {page === "chat" ? (
              <ConversationWorkspace />
            ) : page === "plugins" ? (
              <WorkspaceCanvas>
                <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
                  <PluginPanel />
                </div>
              </WorkspaceCanvas>
            ) : page === "supervisor" ? (
              <WorkspaceCanvas>
                <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
                  <OrchestrationWorkspace />
                </div>
              </WorkspaceCanvas>
            ) : page === "personalization" ? (
              <WorkspaceCanvas>
                <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
                  <PersonalizationPanel />
                </div>
              </WorkspaceCanvas>
            ) : (
              <WorkspaceCanvas>
                <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
                  {page === "settings" ? (
                    <div className="space-y-6">
                      <CodeitSettings standaloneUrl={window.location.origin} />
                      <ProviderWorkspace />
                    </div>
                  ) : (
                    <CodeitOverview onOpenSettings={() => selectPage("settings")} />
                  )}
                </div>
              </WorkspaceCanvas>
            )}
          </div>
        </div>
      </div>
      <div data-technical-name={mainLayoutTechnicalNames.statusBar}>
        <StatusBar
          status={page === "chat" ? "Local runtime · Active" : "Local shell"}
          workspace={title}
        />
      </div>
    </AppLayout>
  );
}

function pageFromLocation():
  "chat" | "overview" | "supervisor" | "personalization" | "settings" | "plugins" {
  if (typeof window === "undefined") return "chat";
  if (window.location.pathname === "/codeit/settings") return "settings";
  if (window.location.pathname === "/codeit/plugins") return "plugins";
  if (window.location.pathname === "/codeit/supervisor") return "supervisor";
  if (window.location.pathname === "/codeit/personalization") return "personalization";
  if (window.location.pathname === "/codeit/overview") return "overview";
  return "chat";
}
