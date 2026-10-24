import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface SessionRecord {
  session_slot: string;
  session_token: string;
  csrf_token: string;
  created_at: string;
  expires_at: string;
}

export interface PairingOptions {
  tokenPath?: string | undefined;
  staticToken?: string | undefined;
  sessionTtlMs?: number | undefined;
  inMemory?: boolean | undefined;
}

export class PairingManager {
  private readonly pairingToken: string;
  private readonly tokenPath?: string;
  private readonly sessionTtlMs: number;
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly pairingCsrfTokens = new Set<string>();

  constructor(options: PairingOptions = {}) {
    this.sessionTtlMs = options.sessionTtlMs ?? 24 * 60 * 60 * 1000; // 24 hours

    if (options.staticToken) {
      this.pairingToken = options.staticToken;
    } else if (options.inMemory) {
      this.pairingToken = randomBytes(32).toString("hex");
    } else {
      const defaultPath = resolve(process.cwd(), ".codeit", "pairing.token");
      this.tokenPath = options.tokenPath ? resolve(options.tokenPath) : defaultPath;

      if (existsSync(this.tokenPath)) {
        this.pairingToken = readFileSync(this.tokenPath, "utf8").trim();
      } else {
        this.pairingToken = randomBytes(32).toString("hex");
        try {
          mkdirSync(dirname(this.tokenPath), { recursive: true });
          writeFileSync(this.tokenPath, this.pairingToken, { mode: 0o600 });
        } catch {
          // If disk write is unavailable or read-only, pairingToken is kept in memory
        }
      }
    }
  }

  getPairingToken(): string {
    return this.pairingToken;
  }

  verifyPairingToken(tokenCandidate: string): boolean {
    if (!tokenCandidate || typeof tokenCandidate !== "string") {
      return false;
    }
    const tokenBuffer = Buffer.from(tokenCandidate, "utf8");
    const expectedBuffer = Buffer.from(this.pairingToken, "utf8");
    if (tokenBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(tokenBuffer, expectedBuffer);
  }

  createSession(): SessionRecord {
    const session_slot = randomBytes(4).toString("hex"); // 8-hex character slot
    const session_token = randomBytes(32).toString("hex");
    const csrf_token = randomBytes(16).toString("hex");
    const now = Date.now();

    const session: SessionRecord = {
      session_slot,
      session_token,
      csrf_token,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + this.sessionTtlMs).toISOString()
    };

    this.sessions.set(session_token, session);
    return session;
  }

  getSession(sessionToken: string): SessionRecord | null {
    if (!sessionToken) return null;
    const session = this.sessions.get(sessionToken);
    if (!session) return null;

    if (new Date(session.expires_at).getTime() < Date.now()) {
      this.sessions.delete(sessionToken);
      return null;
    }
    return session;
  }

  createPairingCsrfToken(): string {
    const token = randomBytes(16).toString("hex");
    this.pairingCsrfTokens.add(token);
    return token;
  }

  verifyCsrf(sessionToken: string | undefined, csrfTokenCandidate: string | undefined): boolean {
    if (!csrfTokenCandidate) return false;

    // Check session-associated CSRF
    if (sessionToken) {
      const session = this.getSession(sessionToken);
      if (session) {
        const expected = Buffer.from(session.csrf_token, "utf8");
        const candidate = Buffer.from(csrfTokenCandidate, "utf8");
        if (expected.length === candidate.length && timingSafeEqual(expected, candidate)) {
          return true;
        }
      }
    }

    // Check pairing-level CSRF
    for (const token of this.pairingCsrfTokens) {
      const expected = Buffer.from(token, "utf8");
      const candidate = Buffer.from(csrfTokenCandidate, "utf8");
      if (expected.length === candidate.length && timingSafeEqual(expected, candidate)) {
        return true;
      }
    }

    return false;
  }
}
