import React, { useEffect, useState } from "react";
import {
  LoginPagePresentation,
  getTenantLoginContext,
  type TenantLoginContext
} from "@codexsun/platform-web/client";
import { useNativeSession } from "../app/native-session-provider.js";
import type { Desk } from "../session/session-types.js";

export function MobileLogin() {
  const { login } = useNativeSession();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tenantContext, setTenantContext] = useState<TenantLoginContext | null>(null);

  useEffect(() => {
    let active = true;
    void getTenantLoginContext()
      .then((ctx) => {
        if (active) {
          setTenantContext(ctx);
        }
      })
      .catch(() => {
        if (active) {
          // If tenant context cannot be retrieved yet, default to corporateIdRequired on shared/unknown host
          setTenantContext({
            brandName: null,
            corporateIdRequired: true,
            mode: "shared_domain",
            tenantName: null
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleLoginSubmit(credentials: {
    corporateId?: string | undefined;
    desk: Desk;
    identifier: string;
    password: string;
  }) {
    setLoading(true);
    setErrorMessage(null);

    try {
      await login({
        desk: credentials.desk,
        email: credentials.identifier,
        identifier: credentials.identifier,
        password: credentials.password,
        ...(credentials.corporateId ? { corporateId: credentials.corporateId, tenantCode: credentials.corporateId } : {})
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full w-full items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-md">
        <LoginPagePresentation
          desk="tenant"
          errorMessage={errorMessage}
          loading={loading}
          onLogin={handleLoginSubmit}
          tenantContext={tenantContext}
          title="Sign in"
        />
      </div>
    </div>
  );
}
