import type { IncomingMessage, ServerResponse } from "node:http";
import { CsrfMismatchError, HostForbiddenError, UnauthorizedError } from "../errors.js";
import type { PairingManager, SessionRecord } from "./pairing.js";

export interface SecurityOptions {
  apiPort: number;
  webPort: number;
  pairingManager: PairingManager;
}

export interface SecurityContext {
  session: SessionRecord | null;
  sessionToken: string | null;
  isPairingAuthenticated: boolean;
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx !== -1) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

export function isLoopbackHost(hostHeader: string | undefined, expectedPort: number): boolean {
  if (!hostHeader) return false;
  const cleanHost = hostHeader.toLowerCase().trim();
  const validHosts = [`127.0.0.1:${expectedPort}`, `localhost:${expectedPort}`];
  return validHosts.includes(cleanHost);
}

export function isAllowedOrigin(
  originHeader: string | undefined,
  webPort: number,
  apiPort: number
): boolean {
  if (!originHeader) return true;
  const cleanOrigin = originHeader.toLowerCase().trim();
  const validOrigins = [
    `http://127.0.0.1:${webPort}`,
    `http://localhost:${webPort}`,
    `http://127.0.0.1:${apiPort}`,
    `http://localhost:${apiPort}`
  ];
  return validOrigins.includes(cleanOrigin);
}

export class SecurityMiddleware {
  private apiPort: number;
  private readonly webPort: number;
  private readonly pairingManager: PairingManager;

  constructor(options: SecurityOptions) {
    this.apiPort = options.apiPort;
    this.webPort = options.webPort;
    this.pairingManager = options.pairingManager;
  }

  setApiPort(port: number): void {
    this.apiPort = port;
  }

  handle(req: IncomingMessage, res: ServerResponse): SecurityContext | null {
    // 1. Host header validation: strictly loopback
    const hostHeader = req.headers.host;
    if (!isLoopbackHost(hostHeader, this.apiPort)) {
      throw new HostForbiddenError("Host rebinding or non-loopback host rejected", {
        host: hostHeader ?? null
      });
    }

    // 2. Origin validation: if origin is supplied, must match approved loopback origin
    const originHeader = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
    if (originHeader) {
      if (!isAllowedOrigin(originHeader, this.webPort, this.apiPort)) {
        throw new HostForbiddenError("Unauthorized origin rejected", {
          origin: originHeader
        });
      }

      // Set CORS headers for approved origins
      res.setHeader("Access-Control-Allow-Origin", originHeader);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-codeit-csrf");
    }

    // Preflight OPTIONS handling
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return null;
    }

    const url = new URL(req.url ?? "/", `http://127.0.0.1:${this.apiPort}`);
    const pathname = url.pathname;

    // Public endpoints exempt from session/pairing authentication
    if (
      pathname === "/api/codeit/pairing" ||
      pathname === "/api/codeit/health" ||
      pathname === "/health" ||
      !pathname.startsWith("/api/")
    ) {
      return {
        session: null,
        sessionToken: null,
        isPairingAuthenticated: false
      };
    }

    // 3. Extract credentials from Authorization header or Session Cookie
    const authHeader = req.headers.authorization;
    let bearerToken: string | null = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      bearerToken = authHeader.slice(7).trim();
    }

    const cookies = parseCookies(req.headers.cookie);
    const sessionCookie = cookies["codexsun_codeit_session"] ?? null;

    const candidateToken = bearerToken || sessionCookie;
    if (!candidateToken) {
      throw new UnauthorizedError("Missing or invalid pairing token / session cookie");
    }

    let session: SessionRecord | null = null;
    let isPairingAuthenticated = false;

    // Check if token is a valid session
    session = this.pairingManager.getSession(candidateToken);
    if (!session) {
      // Check if token matches raw pairing token
      if (this.pairingManager.verifyPairingToken(candidateToken)) {
        isPairingAuthenticated = true;
      } else {
        throw new UnauthorizedError("Missing or invalid pairing token / session cookie");
      }
    }

    // 4. CSRF protection on mutations (POST, PUT, DELETE, PATCH)
    const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(req.method ?? "");
    if (isMutation) {
      const csrfHeader =
        typeof req.headers["x-codeit-csrf"] === "string" ? req.headers["x-codeit-csrf"] : undefined;
      const validCsrf = this.pairingManager.verifyCsrf(session?.session_token, csrfHeader);
      if (!validCsrf) {
        throw new CsrfMismatchError("CSRF token missing or mismatch");
      }
    }

    return {
      session,
      sessionToken: session ? session.session_token : candidateToken,
      isPairingAuthenticated
    };
  }
}
