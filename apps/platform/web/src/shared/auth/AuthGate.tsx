import { Button } from "@codexsun/ui/components/button";
import { Card } from "@codexsun/ui/components/card";
import { GlobalLoader } from "@codexsun/ui/components/global-loader";
import { StatusBadge } from "@codexsun/ui/components/StatusBadge";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { PlatformApiError, restoreSession, type Desk } from "../api/platform-api";
import { redirectForExpiredSession } from "./session-expiry";

const expectedUserType: Record<Desk, string> = {
  admin: "staff",
  sa: "super_admin",
  tenant: "tenant"
};

const deskLabels: Record<Desk, string> = {
  admin: "admin",
  sa: "super admin",
  tenant: "app"
};

export function AuthGate({
  children,
  desk,
  loadingMessage = "Checking your session...",
  steady = false
}: {
  children: ReactElement;
  desk: Desk;
  loadingMessage?: string;
  steady?: boolean;
}) {
  const [serverValid, setServerValid] = useState<boolean | null>(null);
  const [failure, setFailure] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setServerValid(null);
    setFailure("");
    async function checkSession() {
      try {
        const data = await restoreSession(desk);
        if (!cancelled) {
          const valid = data.authenticated && data.userType === expectedUserType[desk];
          if (!valid) redirectForExpiredSession(desk);
          setServerValid(valid);
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof PlatformApiError && error.statusCode === 401) {
            redirectForExpiredSession(desk);
          } else {
            setFailure("Unable to verify your session. Check that the API is available, then retry.");
          }
          setServerValid(false);
        }
      }
    }
    checkSession();
    return () => {
      cancelled = true;
    };
  }, [desk, attempt]);

  const valid = serverValid === true;

  if (valid) {
    return children;
  }

  if (serverValid === null || !failure) {
    return <GlobalLoader message={loadingMessage} steady={steady} />;
  }

  return (
    <main className="simple-page">
      <Card title={failure ? "Session check unavailable" : "Login required"}>
        <StatusBadge tone="red">Blocked</StatusBadge>
        <p style={{ marginTop: "1rem", marginBottom: "1.5rem" }}>
          {failure || `You need an active ${deskLabels[desk]} session to view this page.`}
        </p>
        <Button style={{ width: "100%" }} onClick={() => failure ? setAttempt((value) => value + 1) : redirectForExpiredSession(desk)}>
          {failure ? "Retry" : "Go to Login"}
        </Button>
      </Card>
    </main>
  );
}
