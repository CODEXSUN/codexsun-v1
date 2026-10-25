import { loadEnv, resolvePlatformRuntime } from "@codexsun/framework/env";
import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "staging", "production"]),
    AUTH_MODE: z.enum(["cookie", "jwt", "hybrid"]),
    AUTH_COOKIE_SECURE: z.enum(["0", "1"]).default("1"),
    AUTH_SESSION_RENEWAL_HOURS: z.coerce.number().int().positive(),
    AUTH_SESSION_TTL_HOURS: z.coerce.number().int().positive().max(720),
    PLATFORM_API_PORT: z.coerce.number().int().positive(),
    PLATFORM_WEB_PORT: z.coerce.number().int().positive(),
    PLATFORM_WEB_ORIGIN: z.string().url("PLATFORM_WEB_ORIGIN must be a valid URL"),
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive(),
    DB_USER: z.string().min(1, "DB_USER is required"),
    DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required"),
    DB_DRIVER: z.enum(["mariadb", "mysql2"]),
    DB_MASTER_NAME: z.string().min(1, "DB_MASTER_NAME is required"),
    CODEXSUN_TENANCY_MODE: z.enum(["single", "multi"]),
    CODEXSUN_SINGLE_TENANT_CORPORATE_ID: z.string(),
    CODEXSUN_DB_FRESH_ON_START: z.enum(["0", "1"]),
    CODEXSUN_DB_RESET_CONFIRM: z.string(),
    CODEXSUN_ALLOW_PRODUCTION_DB_RESET: z.enum(["0", "1"]),
    CODEXSUN_BACKUP_DIR: z.string().min(1),
    CODEXSUN_QUEUE_BACKEND: z.preprocess(
      (value) => (value === "memory" ? "database" : value),
      z.enum(["database", "bullmq-redis"])
    ),
    CODEXSUN_QUEUE_COMPLETED_RETENTION_DAYS: z.coerce.number().int().positive(),
    CODEXSUN_QUEUE_FAILED_RETENTION_DAYS: z.coerce.number().int().positive(),
    CODEXSUN_QUEUE_WORKER_ENABLED: z.enum(["0", "1"]),
    CODEXSUN_QUEUE_WORKER_INTERVAL_MS: z.coerce.number().int().positive(),
    CODEXSUN_REDIS_URL: z.string().min(1, "CODEXSUN_REDIS_URL is required"),
    CODEXSUN_FRAPPE_ENABLED: z.enum(["0", "1"]).default("0"),
    CODEXSUN_FRAPPE_BASE_URL: z.string().default(""),
    CODEXSUN_FRAPPE_APP_KEY: z.string().default(""),
    CODEXSUN_FRAPPE_APP_SECRET: z.string().default(""),
    CODEXSUN_ZETRO_API_KEY: z.string().default(""),
    CODEXSUN_ZETRO_BASE_URL: z.string().default("https://api.openai.com/v1"),
    CODEXSUN_ZETRO_MODEL: z.string().default(""),
    CODEXSUN_ZUNO_SOURCE_ROOT: z.string().default(""),
    CODEXSUN_DATA_BRIDGE_MEDIA_SOURCES: z.string().default("[]"),
    CODEXSUN_ZUNO_PLATFORM_LOG_PATH: z.string().default(""),
    CODEXSUN_ZUNO_PROVIDER_BASE_URL: z.string().default(""),
    CODEXSUN_ZUNO_PROVIDER_MODEL: z.string().default(""),
    CODEXSUN_ZUNO_PROVIDER_API_KEY: z.string().default(""),
    MAIL_ENABLED: z.enum(["0", "1"]),
    MAIL_SMTP_HOST: z.string(),
    MAIL_SMTP_PORT: z.coerce.number().int().positive(),
    MAIL_SMTP_SECURE: z.enum(["0", "1"]),
    MAIL_USERNAME: z.string(),
    MAIL_PASSWORD: z.string(),
    MAIL_FROM_EMAIL: z.string(),
    MAIL_FROM_NAME: z.string(),
    MAIL_REPLY_TO: z.string(),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().max(1440),
    CODEXSUN_ALLOW_LIVE_RESTORE: z.enum(["0", "1"]),
    CODEXSUN_LIVE_RESTORE_CONFIRM: z.string(),
    CODEXSUN_RESTORE_TEST_DB_NAME: z.string(),
    CODEXSUN_VERIFIED_BACKUP_ID: z.string(),
    ENABLE_DEFAULT_TENANT_SEED: z.enum(["0", "1"]),
    DEV_AUTO_TENANT_LOGIN: z.enum(["0", "1"]),
    TENANT_DOMAIN_BASE: z.string().min(1),
    DEFAULT_TENANT_ADMIN_EMAIL: z.string(),
    DEFAULT_TENANT_ADMIN_NAME: z.string(),
    DEFAULT_TENANT_ADMIN_PASSWORD: z.string(),
    DEFAULT_TENANT_CORPORATE_ID: z.string(),
    DEFAULT_TENANT_DB_NAME: z.string(),
    DEFAULT_TENANT_DOMAIN: z.string().min(1),
    DEFAULT_TENANT_NAME: z.string().min(1),
    DEFAULT_TENANT_SLUG: z.string(),
    JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
    SOFTWARE_ADMIN_EMAIL: z.string(),
    SOFTWARE_ADMIN_NAME: z.string(),
    SOFTWARE_ADMIN_PASSWORD: z.string(),
    SUPER_ADMIN_EMAIL: z.string(),
    SUPER_ADMIN_NAME: z.string(),
    SUPER_ADMIN_PASSWORD: z.string(),
    TENANT_ADMIN_EMAIL: z.string(),
    TENANT_ADMIN_NAME: z.string(),
    TENANT_ADMIN_PASSWORD: z.string(),
    STORAGE_PUBLIC_ROOT: z.string().min(1),
    STORAGE_ROOT: z.string().min(1),
    TASK_MANAGER_JSON_DIR: z.string().min(1)
  })
  .superRefine((value, context) => {
    if (value.CODEXSUN_TENANCY_MODE === "single") {
      const corporateId = value.CODEXSUN_SINGLE_TENANT_CORPORATE_ID.trim();
      if (!corporateId) {
        context.addIssue({
          code: "custom",
          message: "CODEXSUN_SINGLE_TENANT_CORPORATE_ID is required in single mode",
          path: ["CODEXSUN_SINGLE_TENANT_CORPORATE_ID"]
        });
      }
      if (
        value.ENABLE_DEFAULT_TENANT_SEED === "1" &&
        corporateId.toUpperCase() !== value.DEFAULT_TENANT_CORPORATE_ID.trim().toUpperCase()
      ) {
        context.addIssue({
          code: "custom",
          message: "The default tenant and configured single tenant must match",
          path: ["DEFAULT_TENANT_CORPORATE_ID"]
        });
      }
    }
    if (value.MAIL_ENABLED === "1") {
      for (const key of ["MAIL_SMTP_HOST", "MAIL_FROM_EMAIL"] as const) {
        if (!value[key].trim()) {
          context.addIssue({
            code: "custom",
            message: `${key} is required when MAIL_ENABLED=1`,
            path: [key]
          });
        }
      }
      if (value.MAIL_SMTP_PORT === 465 && value.MAIL_SMTP_SECURE !== "1") {
        context.addIssue({
          code: "custom",
          message: "MAIL_SMTP_SECURE must be 1 when MAIL_SMTP_PORT is 465",
          path: ["MAIL_SMTP_SECURE"]
        });
      }
    }
    if (value.ENABLE_DEFAULT_TENANT_SEED === "1") {
      for (const key of [
        "DEFAULT_TENANT_ADMIN_EMAIL",
        "DEFAULT_TENANT_ADMIN_NAME",
        "DEFAULT_TENANT_ADMIN_PASSWORD",
        "DEFAULT_TENANT_CORPORATE_ID",
        "DEFAULT_TENANT_DB_NAME",
        "DEFAULT_TENANT_DOMAIN",
        "DEFAULT_TENANT_NAME",
        "DEFAULT_TENANT_SLUG"
      ] as const) {
        if (!value[key].trim()) {
          context.addIssue({
            code: "custom",
            message: `${key} is required when ENABLE_DEFAULT_TENANT_SEED=1`,
            path: [key]
          });
        }
      }
    }
  });

export const env = loadEnv(envSchema);
export const platformRuntime = resolvePlatformRuntime(env);
