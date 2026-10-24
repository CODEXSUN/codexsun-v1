import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { GlobalLoader } from "@codexsun/ui/components/global-loader";
import { workspaceLoadingMessage } from "./shared/loading/workspace-loading";

const root = createRoot(document.getElementById("root") as HTMLElement);

export function showConnecting() {
  root.render(<GlobalLoader message={workspaceLoadingMessage} steady />);
}

export function showApplication(Application: ComponentType) {
  root.render(<Application />);
}

export function showConnectionError(retry: () => void) {
  root.render(
    <main className="simple-page" role="alert">
      <h1>Unable to connect to the application</h1>
      <p>Check that the Platform API is running, then try again.</p>
      <button type="button" onClick={retry}>
        Retry connection
      </button>
    </main>
  );
}
