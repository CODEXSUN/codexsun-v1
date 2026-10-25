import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import { NativeSessionProvider } from "./native-session-provider.js";
import { queryClient } from "./query-client.js";
import { mobileRouter } from "./router.js";

export function AppRoot() {
  return (
    <QueryClientProvider client={queryClient}>
      <NativeSessionProvider>
        <RouterProvider router={mobileRouter} />
      </NativeSessionProvider>
    </QueryClientProvider>
  );
}
