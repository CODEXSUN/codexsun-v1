import { z } from "zod";
export const appRegistrySchema = z.object({
  alwaysEnabled: z.boolean(),
  appId: z.string().min(1),
  defaultLanding: z.boolean(),
  description: z.string(),
  label: z.string().min(1),
  moduleKey: z.string().min(1),
  stack: z.enum([
    "platform",
    "billing",
    "accounts",
    "devkit",
    "mail",
    "platform-task-manager",
    "blog",
    "auditor",
    "marketing",
    "crm",
    "frappe",
    "logicx-erp",
    "ecommerce",
    "qcafe",
    "hrms",
    "docs",
    "codeit",
    "himsx",
    "codexsun",
    "sites",
    "sportsclub"
  ])
});
