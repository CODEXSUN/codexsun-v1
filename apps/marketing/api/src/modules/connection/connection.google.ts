import { z } from "zod";
import { AppError } from "@codexsun/framework/errors";

export type GoogleConnectionConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type VerifiedGoogleGrant = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
  accounts: { id: string; label: string }[];
};

export type GoogleTokenRefreshResult = {
  accessToken: string;
  expiresAt: number;
  scopes: string[];
};

export class GoogleChannelConnector {
  constructor(private readonly config: GoogleConnectionConfig) {
    const isHttps = config.redirectUri.startsWith("https://");
    const isLocalhost =
      config.redirectUri.startsWith("http://localhost") ||
      config.redirectUri.startsWith("http://127.0.0.1");

    if (!config.clientId || !config.clientSecret || (!isHttps && !isLocalhost)) {
      throw AppError.validation(
        "Configure the Google application and its fixed HTTPS callback first."
      );
    }
  }

  authorizationUrl(
    state: string,
    challenge: string,
    scopes: string[] = ["https://www.googleapis.com/auth/youtube.readonly"]
  ): string {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      access_type: "offline",
      prompt: "consent"
    }).toString();
    return url.toString();
  }

  async exchange(code: string, verifier: string): Promise<VerifiedGoogleGrant> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: "authorization_code",
        code,
        code_verifier: verifier
      })
    });

    if (!response.ok) {
      throw AppError.validation("Google authorization failed. Reconnect to try again.");
    }

    const grant = z
      .object({
        access_token: z.string().min(1),
        refresh_token: z.string().default(""),
        expires_in: z.number().positive(),
        scope: z.string().min(1)
      })
      .parse(await response.json());

    const scopes = grant.scope.split(" ");
    if (!scopes.includes("https://www.googleapis.com/auth/youtube.readonly")) {
      throw AppError.forbidden("YouTube discovery permission was not granted.");
    }

    const channels = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      {
        signal: AbortSignal.timeout(10000),
        headers: { Authorization: "Bearer " + grant.access_token }
      }
    );

    if (!channels.ok) {
      throw AppError.validation("Unable to verify the Google account's YouTube channels.");
    }

    const data = z
      .object({
        items: z
          .array(z.object({ id: z.string().min(1), snippet: z.object({ title: z.string() }) }))
          .max(100)
      })
      .parse(await channels.json());

    if (!data.items.length) {
      throw AppError.validation("This account has no accessible YouTube channel.");
    }

    return {
      accessToken: grant.access_token,
      refreshToken: grant.refresh_token,
      expiresAt: Date.now() + grant.expires_in * 1000,
      scopes,
      accounts: data.items.map((row) => ({ id: row.id, label: row.snippet.title }))
    };
  }

  async refresh(refreshToken: string): Promise<GoogleTokenRefreshResult> {
    if (!refreshToken) {
      throw AppError.validation(
        "A valid refresh token is required to refresh Google authorization."
      );
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      throw AppError.validation(
        "Google token refresh failed. Reconnect the channel to grant fresh access."
      );
    }

    const refreshed = z
      .object({
        access_token: z.string().min(1),
        expires_in: z.number().positive(),
        scope: z.string().optional()
      })
      .parse(await response.json());

    return {
      accessToken: refreshed.access_token,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
      scopes: refreshed.scope ? refreshed.scope.split(" ") : []
    };
  }

  async revoke(token: string): Promise<boolean> {
    if (!token) return true;
    try {
      const response = await fetch(
        "https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(token),
        {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
