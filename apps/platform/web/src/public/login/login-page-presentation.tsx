import React, { type ChangeEvent, type FormEvent, useState } from "react";
import { AuthLayout } from "@codexsun/ui/layouts/auth-layout";
import { Button } from "@codexsun/ui/components/button";
import { Field } from "@codexsun/ui/components/Field";
import { LogIn } from "lucide-react";
import type { Desk } from "../../shared/api/platform-api.js";

export type TenantLoginContext = {
  brandName: string | null;
  corporateIdRequired: boolean;
  mode: "custom_domain" | "shared_domain" | "unknown";
  tenantName: string | null;
};

export type LoginPagePresentationProps = {
  corporateId?: string | undefined;
  desk?: Desk | undefined;
  errorMessage?: string | null | undefined;
  identifier?: string | undefined;
  loading?: boolean | undefined;
  onCorporateIdChange?: ((value: string) => void) | undefined;
  onForgotPassword?: (() => void) | undefined;
  onIdentifierChange?: ((value: string) => void) | undefined;
  onLogin: (credentials: {
    corporateId?: string | undefined;
    desk: Desk;
    identifier: string;
    password: string;
  }) => Promise<void> | void;
  onPasswordChange?: ((value: string) => void) | undefined;
  password?: string | undefined;
  sessionExpired?: boolean | undefined;
  sessionRefreshed?: boolean | undefined;
  tenantContext?: TenantLoginContext | null | undefined;
  title?: string | undefined;
};

export function LoginPagePresentation({
  corporateId: controlledCorporateId,
  desk = "tenant",
  errorMessage,
  identifier: controlledIdentifier,
  loading = false,
  onCorporateIdChange,
  onForgotPassword,
  onIdentifierChange,
  onLogin,
  onPasswordChange,
  password: controlledPassword,
  sessionExpired = false,
  sessionRefreshed = false,
  tenantContext,
  title = "Sign in"
}: LoginPagePresentationProps) {
  const [internalCorporateId, setInternalCorporateId] = useState("");
  const [internalEmail, setInternalEmail] = useState("");
  const [internalPassword, setInternalPassword] = useState("");

  const corporateId = controlledCorporateId ?? internalCorporateId;
  const email = controlledIdentifier ?? internalEmail;
  const password = controlledPassword ?? internalPassword;

  function handleCorporateIdChange(e: ChangeEvent<HTMLInputElement>) {
    if (onCorporateIdChange) {
      onCorporateIdChange(e.target.value);
    } else {
      setInternalCorporateId(e.target.value);
    }
  }

  function handleEmailChange(e: ChangeEvent<HTMLInputElement>) {
    if (onIdentifierChange) {
      onIdentifierChange(e.target.value);
    } else {
      setInternalEmail(e.target.value);
    }
  }

  function handlePasswordChange(e: ChangeEvent<HTMLInputElement>) {
    if (onPasswordChange) {
      onPasswordChange(e.target.value);
    } else {
      setInternalPassword(e.target.value);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onLogin({
      ...(desk === "tenant" && tenantContext?.corporateIdRequired
        ? { corporateId: corporateId.trim() }
        : corporateId.trim()
          ? { corporateId: corporateId.trim() }
          : {}),
      desk,
      identifier: email.trim(),
      password
    });
  }

  return (
    <AuthLayout
      afterCard={
        sessionExpired || sessionRefreshed ? (
          <p className="auth-session-badge" role="status">
            {sessionRefreshed
              ? "Session data was cleared. Sign in again."
              : "Session expired. Please sign in again."}
          </p>
        ) : null
      }
      surface={desk}
      title={title}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {desk === "tenant" && tenantContext?.brandName ? (
          <p className="auth-workspace">{tenantContext.brandName}</p>
        ) : null}
        {desk === "tenant" && tenantContext?.corporateIdRequired ? (
          <Field
            autoComplete="organization"
            className="auth-field"
            disabled={loading}
            label="Corporate ID"
            name="corporateId"
            onChange={handleCorporateIdChange}
            required
            value={corporateId}
          />
        ) : null}
        <Field
          autoComplete={desk === "tenant" ? "username" : "email"}
          className="auth-field"
          disabled={loading}
          label={desk === "tenant" ? "Username or email" : "Email"}
          name="email"
          onChange={handleEmailChange}
          required
          type={desk === "tenant" ? "text" : "email"}
          value={email}
        />
        <Field
          autoComplete="current-password"
          className="auth-field"
          disabled={loading}
          label="Password"
          name="password"
          onChange={handlePasswordChange}
          required
          type="password"
          value={password}
        />
        {desk === "tenant" && !tenantContext && !errorMessage ? (
          <p className="auth-context-status" role="status" aria-live="polite">
            Checking this workspace…
          </p>
        ) : null}
        <Button
          disabled={loading}
          onClick={
            onForgotPassword ?? (() => window.location.assign(`/forgot-password?desk=${desk}`))
          }
          type="button"
          variant="ghost"
        >
          Forgot password?
        </Button>
        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
        <Button
          disabled={
            loading || (desk === "tenant" && (!tenantContext || tenantContext.mode === "unknown"))
          }
          icon={<LogIn size={16} />}
          type="submit"
        >
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
