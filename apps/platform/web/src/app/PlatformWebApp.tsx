import "@codexsun/ui/styles.css";
import "../styles.css";
import React, { type ErrorInfo, type ReactNode } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { Button } from "@codexsun/ui/components/button";
import { GlobalLoader } from "@codexsun/ui/components/global-loader";
import { Toaster } from "@codexsun/ui/components/sonner";
import { workspaceLoadingMessage } from "../shared/loading/workspace-loading";
import { AppProviders } from "./providers";
import { router } from "./router";
import { applyDesignSystemPreference } from "./design-system";
import { PageTitle } from "../shared/document/PageTitle";
import { clearBrowserSession } from "../shared/api/platform-api";
import { installSessionExpiryInterceptor } from "../shared/auth/session-expiry";

applyDesignSystemPreference();
installSessionExpiryInterceptor(clearBrowserSession);

export function PlatformWebApp() {
  return (
    <React.StrictMode>
      <AppProviders>
        <WorkspaceErrorBoundary>
          <React.Suspense fallback={<GlobalLoader message={workspaceLoadingMessage} steady />}>
            <PageTitle />
            <RouterProvider router={router} />
            <Toaster />
          </React.Suspense>
        </WorkspaceErrorBoundary>
      </AppProviders>
    </React.StrictMode>
  );
}

class WorkspaceErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Workspace failed to render", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
          <section className="w-full max-w-md rounded-md border border-border bg-card p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold">This workspace did not finish loading</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Reload the page to try opening it again.
            </p>
            <Button className="mt-5" onClick={() => window.location.reload()}>
              Reload workspace
            </Button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
