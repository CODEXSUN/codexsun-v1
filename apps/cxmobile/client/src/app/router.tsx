import {
  createHashHistory,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet
} from "@tanstack/react-router";
import React from "react";
import { MobileShell } from "../shell/mobile-shell.js";

const rootRoute = createRootRoute({
  component: () => <Outlet />
});

const indexRoute = createRoute({
  component: MobileShell,
  getParentRoute: () => rootRoute,
  path: "/"
});

const crmRoute = createRoute({
  component: MobileShell,
  getParentRoute: () => rootRoute,
  path: "/crm"
});

const billingRoute = createRoute({
  component: MobileShell,
  getParentRoute: () => rootRoute,
  path: "/billing"
});

const chatRoute = createRoute({
  component: MobileShell,
  getParentRoute: () => rootRoute,
  path: "/chat"
});

const ecommerceRoute = createRoute({
  component: MobileShell,
  getParentRoute: () => rootRoute,
  path: "/ecommerce"
});

const loginRoute = createRoute({
  component: MobileShell,
  getParentRoute: () => rootRoute,
  path: "/login"
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  crmRoute,
  billingRoute,
  chatRoute,
  ecommerceRoute,
  loginRoute
]);

export function createMobileRouter(customHistory?: ReturnType<typeof createMemoryHistory>) {
  const history =
    customHistory ??
    (typeof window !== "undefined" && window.history
      ? createHashHistory()
      : createMemoryHistory({ initialEntries: ["/"] }));

  return createRouter({
    history,
    routeTree
  });
}

export const mobileRouter = createMobileRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof mobileRouter;
  }
}
