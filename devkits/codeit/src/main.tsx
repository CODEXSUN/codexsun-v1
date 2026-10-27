import { createRoot } from "react-dom/client";
import { DESIGN_SYSTEM_NAME } from "@codexsun/ui/design-system";
import "@codexsun/ui/styles.css";
import { CodeitApp } from "./codeit-app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@codexsun/ui/components/sonner";

document.documentElement.setAttribute("data-design-system", DESIGN_SYSTEM_NAME);
document.documentElement.setAttribute("data-design-variant", "default");
const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <CodeitApp />
    <Toaster />
  </QueryClientProvider>
);
