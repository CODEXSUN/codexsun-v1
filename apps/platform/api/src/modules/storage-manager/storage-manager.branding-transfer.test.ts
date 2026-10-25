import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CompanyBrandingTransfer,
  readSourceCompanyLogo
} from "./storage-manager.branding-transfer.js";
import type { StorageManagerService } from "./storage-manager.service.js";

test("configured branding copies once, preserves conflicts and rejects source traversal", async () => {
  const root = await mkdtemp(join(tmpdir(), "bridge-branding-"));
  try {
    await mkdir(join(root, "public"));
    const data = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    await writeFile(join(root, "public/logo.svg"), data);
    let saved: Buffer | null = null;
    let writes = 0;
    const media = {
      readCompanyLogo: async () => (saved ? { buffer: saved } : null),
      uploadCompanyLogo: async (
        tenant: string,
        value: { companyId: number; contentBase64: string }
      ) => {
        assert.equal(tenant, "target-uuid");
        assert.equal(value.companyId, 19);
        saved = Buffer.from(value.contentBase64, "base64");
        writes++;
        return { path: "storage/target/public/companies/19/logo/logo" };
      }
    } as unknown as StorageManagerService;
    const service = new CompanyBrandingTransfer(media);
    const input = {
      configuration: JSON.stringify([
        { sourceId: 8, database: "source_db", tenantKey: "client", root }
      ]),
      sourceId: 8,
      sourceDatabase: "source_db",
      paths: { logo_path: "storage/client/public/logo.svg" },
      targetTenantId: "target-uuid",
      targetCompanyId: 19,
      current: { logoPath: null as string | null, logoDarkPath: null, faviconPath: null }
    };
    const first = await service.copy(input);
    assert.equal(first.copied, 1);
    assert.deepEqual(first.warnings, []);
    input.current.logoPath = first.paths.logoPath!;
    assert.equal((await service.copy(input)).existing, 1);
    assert.equal(writes, 1);
    saved = Buffer.from("different target");
    assert.equal((await service.copy(input)).warnings.length, 1);
    assert.equal(writes, 1);
    assert.equal((await service.copy({ ...input, sourceDatabase: "other_db" })).warnings.length, 1);
    await assert.rejects(readSourceCompanyLogo(root, "client", "storage/other/public/logo.svg"));
    await assert.rejects(
      readSourceCompanyLogo(root, "client", "storage/client/public/../logo.svg")
    );
    await assert.rejects(
      readSourceCompanyLogo(root, "client", "storage/client/public/missing.svg")
    );
    const outside = `${root}-outside`;
    await mkdir(outside);
    await writeFile(join(outside, "logo.svg"), data);
    try {
      await symlink(outside, join(root, "public/escape"), "junction");
      await assert.rejects(
        readSourceCompanyLogo(root, "client", "storage/client/public/escape/logo.svg")
      );
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
