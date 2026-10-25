import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  developmentTenantLogin,
  type Desk,
  getTenantLoginContext,
  login
} from "../../shared/api/platform-api.js";
import { requiredClientEnv } from "../../shared/env/client-env.js";
import {
  hasSessionExpiredReason,
  hasSessionRefreshedReason
} from "../../shared/auth/session-expiry.js";
import { setPlatformDocumentTitle } from "../../shared/document/PageTitle.js";
import {
  LoginPagePresentation,
  type TenantLoginContext
} from "./login-page-presentation.js";

type LoginPageProps = {
  desk: Desk;
  title: string;
};

export function LoginPage({ desk, title }: LoginPageProps) {
  const navigate = useNavigate();
  const tconnectBuyer = new URLSearchParams(window.location.search).get("account") === "buyer";
  const tconnectLogin =
    desk === "tenant" && new URLSearchParams(window.location.search).get("app") === "tconnect";
  const sportsclubLogin =
    desk === "tenant" && new URLSearchParams(window.location.search).get("app") === "sportsclub";
  const [corporateId, setCorporateId] = useState(
    sportsclubLogin
      ? (new URLSearchParams(window.location.search).get("corporateId") ?? "TENKASISPORTS")
      : tconnectLogin
        ? (new URLSearchParams(window.location.search).get("corporateId") ?? "")
        : ""
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [tenantContext, setTenantContext] = useState<TenantLoginContext | null>(null);
  const autoLoginStarted = useRef(false);
  const sessionExpired = hasSessionExpiredReason(window.location.search);
  const sessionRefreshed = hasSessionRefreshedReason(window.location.search);

  const targetPath = useMemo(() => {
    if (desk === "sa") {
      return "/sa/$";
    }

    if (desk === "admin") {
      return "/admin";
    }

    return "/app/$";
  }, [desk]);

  useEffect(() => {
    if (desk !== "tenant") return;
    void getTenantLoginContext()
      .then(setTenantContext)
      .catch(() => setMessage("Unable to verify this application domain."));
  }, [desk]);

  useEffect(() => {
    if (desk === "tenant" && tenantContext?.brandName) {
      setPlatformDocumentTitle("Sign in", tenantContext.brandName);
    }
  }, [desk, tenantContext?.brandName]);

  useEffect(() => {
    if (
      desk !== "tenant" ||
      tconnectLogin ||
      sportsclubLogin ||
      sessionExpired ||
      requiredClientEnv("VITE_DEV_AUTO_TENANT_LOGIN") !== "1" ||
      autoLoginStarted.current
    ) {
      return;
    }

    autoLoginStarted.current = true;
    setLoading(true);
    setMessage("");
    void developmentTenantLogin()
      .then((result) => {
        if (!result.success) {
          setMessage(result.error.message);
          return;
        }
        window.location.assign(
          sportsclubLogin
            ? "/app/sportsclub/student"
            : tconnectLogin
              ? tconnectBuyer
                ? "/app/tconnect/buyer"
                : "/app/tconnect/member"
              : "/app/"
        );
      })
      .catch(() => setMessage("Development auto-login failed."))
      .finally(() => setLoading(false));
  }, [desk, navigate, targetPath, tconnectLogin, sportsclubLogin, tconnectBuyer, sessionExpired]);

  async function handleLoginSubmit(credentials: {
    corporateId?: string | undefined;
    desk: Desk;
    identifier: string;
    password: string;
  }) {
    if (desk === "tenant") {
      if (!tenantContext) {
        setMessage("Unable to verify this application domain.");
        return;
      }
      if (tenantContext.mode === "unknown") {
        setMessage("This domain is not mapped to an active tenant.");
        return;
      }
      if (tenantContext.corporateIdRequired && !credentials.corporateId) {
        setMessage("Corporate ID is required to select your workspace.");
        return;
      }
    }
    setLoading(true);
    setMessage("");

    try {
      const result = await login({
        ...(credentials.corporateId ? { corporateId: credentials.corporateId } : {}),
        desk: credentials.desk,
        ...(desk === "tenant" ? { identifier: credentials.identifier } : { email: credentials.identifier }),
        password: credentials.password
      });

      if (!result.success) {
        setMessage(result.error?.message ?? "Login failed");
        return;
      }

      if (desk === "tenant") {
        window.location.assign(
          sportsclubLogin
            ? "/app/sportsclub/student"
            : tconnectLogin
              ? tconnectBuyer
                ? "/app/tconnect/buyer"
                : "/app/tconnect/member"
              : "/app/"
        );
        return;
      }

      await navigate({ to: targetPath });
    } catch {
      setMessage("Network error, please try again");
    } finally {
      setLoading(false);
    }
  }

  const resolvedTitle = sportsclubLogin
    ? "Tenkasi Sports Student Login"
    : tconnectLogin
      ? tconnectBuyer
        ? "TConnect Buyer Login"
        : "TConnect Seller / Member Login"
      : title;

  return (
    <LoginPagePresentation
      corporateId={corporateId}
      desk={desk}
      errorMessage={message}
      identifier={email}
      loading={loading}
      onCorporateIdChange={setCorporateId}
      onForgotPassword={() => window.location.assign(`/forgot-password?desk=${desk}`)}
      onIdentifierChange={setEmail}
      onLogin={handleLoginSubmit}
      onPasswordChange={setPassword}
      password={password}
      sessionExpired={sessionExpired}
      sessionRefreshed={sessionRefreshed}
      tenantContext={tenantContext}
      title={resolvedTitle}
    />
  );
}
