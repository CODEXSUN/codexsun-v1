import { useEffect, useState, type ReactNode } from "react";
import { WorkspaceNavigationProvider } from "@codexsun/ui/workspace/navigation";

export const promptManagerPath = "/codeit/prompt-manager";
export function PromptManagerNavigation({
  children,
  headerTarget
}: {
  headerTarget: HTMLElement | null;
  children: (path: string, navigate: (path: string) => void) => ReactNode;
}) {
  const [location, setLocation] = useState(() => readLocation());
  useEffect(() => {
    const sync = () => setLocation(readLocation());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  function navigate(path: string) {
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  return (
    <WorkspaceNavigationProvider
      headerTarget={headerTarget}
      search={location.search}
      onSearchChange={(search) => {
        const params = new URLSearchParams(
          Object.entries(search).map(([key, value]) => [key, String(value)])
        );
        window.history.replaceState(null, "", `${location.path}${params.size ? `?${params}` : ""}`);
        setLocation({ path: location.path, search: Object.fromEntries(params) });
      }}
    >
      {children(location.path, navigate)}
    </WorkspaceNavigationProvider>
  );
}

function readLocation() {
  return {
    path: window.location.pathname,
    search: Object.fromEntries(new URLSearchParams(window.location.search))
  };
}
