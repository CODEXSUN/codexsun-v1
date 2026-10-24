import type { RouteDefinition } from "../project/project.routes.js";
import type { ArtifactService } from "./artifact.service.js";
import type { StoreArtifactInput } from "./artifact.types.js";

export function createArtifactRoutes(artifactService: ArtifactService): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/api/codeit/artifacts/:uuid",
      handler: (_req, res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        const { record, content } = artifactService.getArtifact(uuid);

        res.statusCode = 200;
        res.setHeader("Content-Type", record.media_type);
        res.setHeader("Content-Length", record.byte_size);
        res.setHeader("X-Content-Hash", record.content_hash);
        res.setHeader("Content-Disposition", `inline; filename="${record.uuid}.bin"`);
        res.end(content);
        return;
      }
    },
    {
      method: "POST",
      path: "/api/codeit/artifacts",
      handler: (_req, _res, ctx) => {
        const input = (ctx.body ?? {}) as StoreArtifactInput;
        return artifactService.storeArtifact(input);
      }
    }
  ];
}
