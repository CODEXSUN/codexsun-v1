import { lazy, Suspense, useEffect } from "react";
import { GlobalLoader } from "@codexsun/ui/components/global-loader";
import { AuthGate } from "../../shared/auth/AuthGate";
import { workspaceLoadingMessage } from "../../shared/loading/workspace-loading";

let deskRequest: ReturnType<typeof importDesk> | undefined;
function importDesk() {
  return import("./AppDesk").then((module) => ({ default: module.AppDesk }));
}
function loadDesk() {
  return (deskRequest ??= importDesk());
}
const TenantAppDesk = lazy(loadDesk);

export function TenantAppDeskRoute() {
  useEffect(() => {
    // Download code alongside session verification. AuthGate still controls rendering.
    void loadDesk().catch(() => undefined);
  }, []);
  return (
    <AuthGate desk="tenant" loadingMessage={workspaceLoadingMessage} steady>
      <Suspense fallback={<GlobalLoader message={workspaceLoadingMessage} steady />}>
        <TenantAppDesk />
      </Suspense>
    </AuthGate>
  );
}
