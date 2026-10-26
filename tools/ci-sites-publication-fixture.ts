import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { initialSitePage } from "@codexsun/sites-api/page-defaults";
import { publicationChecksum, verifyPublication } from "@codexsun/sites-api/delivery-integrity";

export function ciSitesPublication() {
  const content = initialSitePage({
    id: 1,
    uuid: "e303865e",
    slug: "tirupurconnect",
    status: "active"
  });
  content.profile.brand = "CI verification fixture - not for deployment";
  const payload = {
    schemaVersion: 1 as const,
    siteKey: createHash("sha256").update("ci-only:e303865e").digest("hex"),
    siteUuid: "e303865e",
    siteSlug: "tirupurconnect",
    content,
    blogs: []
  };
  return verifyPublication({
    ...payload,
    sequence: 1,
    publishedAt: "2026-10-26T00:00:00.000Z",
    checksum: publicationChecksum(payload)
  });
}

export function writeCiSitesPublication(environment: NodeJS.ProcessEnv) {
  if (environment.GITHUB_ACTIONS !== "true" || !environment.GITHUB_ENV)
    throw new Error("Synthetic publication generation is restricted to explicit CI verification.");
  const path = resolve(".codex-runtime/ci/tirupurconnect-publication.json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(ciSitesPublication()));
  appendFileSync(environment.GITHUB_ENV, `CODEXSUN_SITES_TIRUPURCONNECT_SNAPSHOT=${path}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  writeCiSitesPublication(process.env);
