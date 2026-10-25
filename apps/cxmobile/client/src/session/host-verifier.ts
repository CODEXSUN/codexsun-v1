import { HostVerificationError } from "./session-types.js";

export interface HostVerifierOptions {
  allowedCustomDomains?: Map<string, string> | Record<string, string>;
  allowedOrigins?: string[];
  allowLoopback?: boolean;
}

export class HostVerifier {
  private readonly allowedOrigins: Set<string>;
  private readonly allowedCustomDomains: Map<string, string>;
  private readonly allowLoopback: boolean;

  constructor(options: HostVerifierOptions = {}) {
    this.allowedOrigins = new Set(
      (options.allowedOrigins ?? []).map((origin) => this.normalizeOrigin(origin))
    );
    this.allowLoopback = options.allowLoopback ?? false;
    this.allowedCustomDomains = new Map();

    if (options.allowedCustomDomains) {
      const entries =
        options.allowedCustomDomains instanceof Map
          ? options.allowedCustomDomains.entries()
          : Object.entries(options.allowedCustomDomains);
      for (const [domain, tenantId] of entries) {
        this.allowedCustomDomains.set(domain.toLowerCase().trim(), tenantId);
      }
    }
  }

  registerCustomDomain(domain: string, tenantId: string): void {
    this.allowedCustomDomains.set(domain.toLowerCase().trim(), tenantId);
  }

  removeCustomDomain(domain: string): void {
    this.allowedCustomDomains.delete(domain.toLowerCase().trim());
  }

  isCustomDomainVerified(domain: string, expectedTenantId?: string): boolean {
    const registeredTenantId = this.allowedCustomDomains.get(domain.toLowerCase().trim());
    if (!registeredTenantId) return false;
    if (expectedTenantId && registeredTenantId !== expectedTenantId) return false;
    return true;
  }

  normalizeOrigin(urlOrHost: string): string {
    const raw = urlOrHost.trim();
    const hasScheme = /^[a-z]+:\/\//i.test(raw);
    const parsed = new URL(hasScheme ? raw : `https://${raw}`);
    return parsed.origin;
  }

  extractHost(urlOrHost: string): string {
    const raw = urlOrHost.trim();
    const hasScheme = /^[a-z]+:\/\//i.test(raw);
    const parsed = new URL(hasScheme ? raw : `https://${raw}`);
    return parsed.host;
  }

  isLoopbackHost(hostname: string): boolean {
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    );
  }

  isHostAllowed(urlOrHost: string): boolean {
    try {
      this.assertHostAllowed(urlOrHost);
      return true;
    } catch {
      return false;
    }
  }

  assertHostAllowed(urlOrHost: string): {
    basePath: string;
    baseUrl: string;
    host: string;
    origin: string;
  } {
    const raw = urlOrHost.trim();
    if (!raw) {
      throw new HostVerificationError("Host or URL cannot be empty.");
    }

    let parsed: URL;
    try {
      const hasScheme = /^[a-z]+:\/\//i.test(raw);
      parsed = new URL(hasScheme ? raw : `https://${raw}`);
    } catch {
      throw new HostVerificationError(`Invalid URL or host: "${raw}".`);
    }

    const hostname = parsed.hostname.toLowerCase();
    const isLoopback = this.isLoopbackHost(hostname);

    if (parsed.protocol === "http:") {
      if (!isLoopback || !this.allowLoopback) {
        throw new HostVerificationError(
          `Insecure HTTP is forbidden for "${parsed.host}". Only approved HTTPS origins are allowed.`
        );
      }
    } else if (parsed.protocol !== "https:") {
      throw new HostVerificationError(`Unsupported protocol "${parsed.protocol}". Only HTTPS is allowed.`);
    }

    const origin = parsed.origin;
    const host = parsed.host;
    const basePath = parsed.pathname.replace(/\/+$/u, "");
    const baseUrl = `${origin}${basePath}`;

    if (isLoopback && this.allowLoopback) {
      return { basePath, baseUrl, host, origin };
    }

    if (this.allowedOrigins.has(origin)) {
      return { basePath, baseUrl, host, origin };
    }

    if (this.allowedCustomDomains.has(hostname) || this.allowedCustomDomains.has(host)) {
      return { basePath, baseUrl, host, origin };
    }

    throw new HostVerificationError(
      `Host "${host}" is not in the approved origins or verified tenant domains list.`
    );
  }
}
