import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";
import { z } from "zod";
import type { StorageManagerService } from "./storage-manager.service.js";
import type { CompanyBrandingVariant } from "./storage-manager.types.js";

const sourceSchema = z.array(
  z
    .object({
      sourceId: z.number().int().positive(),
      database: z.string().min(1),
      tenantKey: z.string().regex(/^[a-zA-Z0-9_-]+$/),
      root: z.string().refine(isAbsolute, "Source media root must be absolute.")
    })
    .strict()
);
const variants = [
  ["logo_path", "logoPath", "logo"],
  ["logo_dark_path", "logoDarkPath", "logo-dark"],
  ["favicon_path", "faviconPath", "favicon"]
] as const;

export async function readSourceCompanyLogo(root: string, tenantKey: string, path: string) {
  const prefix = `storage/${tenantKey}/public/`;
  if (!path.startsWith(prefix) || path.includes("\\") || path.includes("\0"))
    throw new Error("Source logo path does not belong to the configured source tenant.");
  const relative = path.slice(`storage/${tenantKey}/`.length);
  if (relative.split("/").some((part) => !part || part === "." || part === ".."))
    throw new Error("Source logo path contains invalid segments.");
  const base = await realpath(root);
  const file = await realpath(resolve(base, relative));
  if (!file.startsWith(base + sep)) throw new Error("Source logo escapes its configured root.");
  const info = await stat(file);
  if (!info.isFile() || info.size > 5 * 1024 * 1024)
    throw new Error("Source logo is not a supported image file.");
  return readFile(file);
}

export class CompanyBrandingTransfer {
  constructor(
    private readonly media: Pick<StorageManagerService, "readCompanyLogo" | "uploadCompanyLogo">
  ) {}

  async copy(input: {
    configuration: string;
    sourceId: number;
    sourceDatabase: string;
    paths: Record<string, string>;
    targetTenantId: string;
    targetCompanyId: number;
    current: { logoPath: string | null; logoDarkPath: string | null; faviconPath: string | null };
  }) {
    const result = {
      copied: 0,
      existing: 0,
      warnings: [] as string[],
      paths: {} as { logoPath?: string; logoDarkPath?: string; faviconPath?: string }
    };
    if (!Object.keys(input.paths).length) return result;
    const mappings = sourceSchema.parse(JSON.parse(input.configuration));
    const source = mappings.find(
      (item) => item.sourceId === input.sourceId && item.database === input.sourceDatabase
    );
    if (!source) {
      result.warnings.push("No read-only media location is configured for this source connection.");
      return result;
    }
    for (const [field, property, variant] of variants) {
      if (!input.paths[field]) continue;
      try {
        const buffer = await readSourceCompanyLogo(
          source.root,
          source.tenantKey,
          input.paths[field]!
        );
        const existing = await this.media.readCompanyLogo(
          input.targetTenantId,
          input.targetCompanyId,
          variant
        );
        if (existing && !existing.buffer.equals(buffer)) {
          result.warnings.push(`${variant}: a different target image exists and was preserved.`);
          continue;
        }
        if (existing && input.current[property]) {
          result.existing++;
          continue;
        }
        const uploaded = await this.media.uploadCompanyLogo(input.targetTenantId, {
          companyId: input.targetCompanyId,
          variant: variant as CompanyBrandingVariant,
          contentBase64: buffer.toString("base64")
        });
        result.paths[property] = uploaded.path;
        result.copied++;
      } catch {
        result.warnings.push(
          `${variant}: source image is unavailable, unsafe, or could not be copied.`
        );
      }
    }
    return result;
  }
}
