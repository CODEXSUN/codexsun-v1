import React, { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import {
  LoginPagePresentation,
  getTenantLoginContext,
  type TenantLoginContext
} from "@codexsun/platform-web/client";
import { Button } from "@codexsun/ui/components/button";
import { Field } from "@codexsun/ui/components/Field";
import { useNativeSession } from "../app/native-session-provider.js";
import type { Desk } from "../session/session-types.js";

export function MobileLogin() {
  const { login, transport } = useNativeSession();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tenantContext, setTenantContext] = useState<TenantLoginContext | null>(null);
  const [showRecovery, setShowRecovery] = useState(() => {
    if (typeof window !== "undefined" && window.location) {
      return window.location.pathname === "/forgot-password";
    }
    return false;
  });

  const [recoveryCorporateId, setRecoveryCorporateId] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

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

  async function handleRecoverySubmit(e: FormEvent) {
    e.preventDefault();
    setRecoveryLoading(true);
    setRecoveryError(null);
    setRecoveryMessage(null);

    try {
      const res = await transport.post<{ accepted?: boolean; message?: string }>("/auth/password/forgot", {
        body: {
          ...(tenantContext?.corporateIdRequired && recoveryCorporateId ? { corporateId: recoveryCorporateId.trim() } : {}),
          desk: "tenant",
          email: recoveryEmail.trim()
        }
      });
      setRecoveryMessage(res?.message ?? "Password recovery instructions sent if an account matches.");
    } catch (err: unknown) {
      setRecoveryError(err instanceof Error ? err.message : "Failed to request password recovery.");
    } finally {
      setRecoveryLoading(false);
    }
  }

  return (
    <div className="flex min-h-full w-full items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-md">
        {showRecovery ? (
          <div className="rounded-lg border bg-card p-6 shadow-sm text-card-foreground">
            <h2 className="text-base font-semibold mb-2">Forgot Password</h2>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Enter your corporate email and workspace ID to receive secure reset instructions.
            </p>
            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              {tenantContext?.corporateIdRequired ? (
                <Field
                  autoComplete="organization"
                  disabled={recoveryLoading}
                  label="Corporate ID"
                  name="corporateId"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setRecoveryCorporateId(e.target.value)}
                  value={recoveryCorporateId}
                />
              ) : null}
              <Field
                autoComplete="email"
                disabled={recoveryLoading}
                label="Email"
                name="email"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setRecoveryEmail(e.target.value)}
                type="email"
                value={recoveryEmail}
              />
              {recoveryError ? <p className="text-xs text-destructive">{recoveryError}</p> : null}
              {recoveryMessage ? <p className="text-xs text-emerald-600 dark:text-emerald-400">{recoveryMessage}</p> : null}
              <Button disabled={recoveryLoading} className="w-full" type="submit">
                {recoveryLoading ? "Sending..." : "Send Reset Link"}
              </Button>
              <Button
                className="w-full"
                disabled={recoveryLoading}
                onClick={() => {
                  setShowRecovery(false);
                  if (typeof window !== "undefined" && window.location.pathname === "/forgot-password") {
                    window.history.pushState(null, "", "/");
                  }
                }}
                type="button"
                variant="outline"
              >
                Back to Sign in
              </Button>
            </form>
          </div>
        ) : (
          <LoginPagePresentation
            desk="tenant"
            errorMessage={errorMessage}
            loading={loading}
            onForgotPassword={() => setShowRecovery(true)}
            onLogin={handleLoginSubmit}
            tenantContext={tenantContext}
            title="Sign in"
          />
        )}
      </div>
    </div>
  );
}
