import type { RouteDefinition } from "../project/project.routes.js";
import type { PersonalizationService } from "./personalization.service.js";
import {
  ConfirmFactInputSchema,
  type ContextPreviewInput,
  type CreateFactInput,
  type FactFilter,
  type FactScope,
  type ConfirmationState
} from "./personalization.types.js";

export function createPersonalizationRoutes(
  personalizationService: PersonalizationService
): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/api/codeit/personalization",
      handler: (_req, _res, ctx) => {
        const scope = ctx.query.get("scope") as FactScope | null;
        const owner_id = ctx.query.get("owner_id");
        const confirmation_state = ctx.query.get("confirmation_state") as ConfirmationState | null;
        const fact_key = ctx.query.get("fact_key");

        const filter: FactFilter = {};
        if (scope) filter.scope = scope;
        if (owner_id) filter.owner_id = owner_id;
        if (confirmation_state) filter.confirmation_state = confirmation_state;
        if (fact_key) filter.fact_key = fact_key;

        const facts = personalizationService.listFacts(filter);
        return { facts };
      }
    },
    {
      method: "POST",
      path: "/api/codeit/personalization",
      handler: (_req, _res, ctx) => {
        const input = (ctx.body ?? {}) as CreateFactInput;
        return personalizationService.storeFact(input);
      }
    },
    {
      method: "POST",
      path: "/api/codeit/personalization/:uuid/confirm",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        const rawBody = ctx.body ?? {};
        const parsed = ConfirmFactInputSchema.safeParse(rawBody);
        const decision = parsed.success ? parsed.data.decision : "confirmed";
        return personalizationService.confirmFact(uuid, decision);
      }
    },
    {
      method: "DELETE",
      path: "/api/codeit/personalization/:uuid",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        return personalizationService.forgetFact(uuid);
      }
    },
    {
      method: "POST",
      path: "/api/codeit/personalization/preview",
      handler: (_req, _res, ctx) => {
        const input = (ctx.body ?? {}) as ContextPreviewInput;
        return personalizationService.assembleContextPreview(input);
      }
    }
  ];
}
