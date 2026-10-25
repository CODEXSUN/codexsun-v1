import "./styles/mobile.css";
import { initRuntimeConfig } from "./app/runtime-config.js";

// Initialize runtime configuration synchronously before importing owner services
initRuntimeConfig();

async function bootstrap() {
  const [{ default: React }, { createRoot }, { AppRoot }] = await Promise.all([
    import("react"),
    import("react-dom/client"),
    import("./app/app-root.js")
  ]);

  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Target container #root not found in document.");
  }

  const root = createRoot(container);
  root.render(React.createElement(AppRoot));
}

void bootstrap();
