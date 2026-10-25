import { z } from "zod";

const appId = z.enum([
  "application",
  "billing",
  "accounts",
  "devkit",
  "project-manager",
  "mail",
  "notes",
  "chat",
  "task-manager",
  "blog",
  "auditor",
  "marketing",
  "crm",
  "frappe",
  "zetro",
  "logicx-erp",
  "tconnect",
  "ecommerce",
  "qcafe",
  "hrms",
  "docs",
  "codeit",
  "himsx",
  "codexsun",
  "sites",
  "sportsclub"
]);
const stack = z.enum([
  "platform",
  "billing",
  "accounts",
  "devkit",
  "project-manager",
  "mail",
  "notes",
  "chat",
  "platform-task-manager",
  "blog",
  "auditor",
  "marketing",
  "crm",
  "frappe",
  "zetro",
  "logicx-erp",
  "tconnect",
  "ecommerce",
  "qcafe",
  "hrms",
  "docs",
  "codeit",
  "himsx",
  "codexsun",
  "sites",
  "sportsclub"
]);

export const platformAppSaveSchema = z
  .object({
    alwaysEnabled: z.boolean(),
    appId: appId.exclude(["project-manager"]),
    defaultLanding: z.boolean(),
    description: z.string().trim().min(1).max(2_000),
    label: z.string().trim().min(1).max(160),
    moduleKey: z.string().trim().min(1).max(160),
    stack: stack.exclude(["project-manager"])
  })
  .strict();

export const platformAppSchema = platformAppSaveSchema.extend({
  appId,
  stack,
  id: z.number().int().nonnegative(),
  uuid: z.string().min(1)
});

export const numericIdParamsSchema = z
  .object({
    id: z.coerce.number().int().positive()
  })
  .strict();

export const platformAppListSchema = z.array(platformAppSchema);
