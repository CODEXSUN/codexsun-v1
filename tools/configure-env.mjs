#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";

const root = resolve(import.meta.dirname, "..");
const deployment = process.argv.includes("--deployment");
const envPath = deployment ? resolve(root, ".container", "deploy.env") : resolve(root, ".env");
const examplePath = deployment
  ? resolve(root, ".container", "deploy.env.sample")
  : resolve(root, ".env.example");
const checkOnly = process.argv.includes("--check");
const nonInteractive = process.argv.includes("--non-interactive");
const assignments = process.argv
  .filter((argument) => argument.startsWith("--set="))
  .map((argument) => argument.slice("--set=".length));
const templateText = readFileSync(examplePath, "utf8");
const template = parseEnv(templateText);
const deploymentTemplate = deployment
  ? template
  : parseEnv(readFileSync(resolve(root, ".container", "deploy.env.sample"), "utf8"));
const currentText = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const current = parseEnv(currentText);
if (Array.from(current.keys()).some((key) => /^CX[A]PP_/u.test(key))) {
  fail(
    "This environment belongs to the previous application. Create a separate CODEXSUN environment file."
  );
}

const optionalEmpty = new Set([
  "CODEXSUN_VERIFIED_BACKUP_ID",
  "CODEXSUN_WORKER_CONTROL_TOKEN",
  "CODEXSUN_DB_RESET_CONFIRM",
  "CODEXSUN_RESTORE_TEST_DB_NAME",
  "CODEXSUN_LIVE_RESTORE_CONFIRM",
  "MAIL_SMTP_HOST",
  "MAIL_USERNAME",
  "MAIL_PASSWORD",
  "MAIL_FROM_EMAIL",
  "MAIL_REPLY_TO",
  "GSP_EMAIL",
  "GSP_USERNAME",
  "GSP_PASSWORD",
  "GSP_CLIENT_ID",
  "GSP_CLIENT_SECRET",
  "GSP_GSTIN",
  "CODEXSUN_DEVKIT_SYNC_INSTANCE_ID",
  "CODEXSUN_DEVKIT_SYNC_TOKEN_PEPPER",
  "CODEXSUN_DEVKIT_SYNC_ENCRYPTION_KEY",
  "CODEXSUN_DEVKIT_SYNC_TEST_CLOUD_URL",
  "CODEXSUN_DEVKIT_WORKSPACE_ROOT",
  "CODEXSUN_BACKUP_VERIFY_ID",
  "CODEXSUN_SINGLE_TENANT_CORPORATE_ID"
]);
const retiredKeys = new Set([
  "PLATFORM_API_HOST",
  "PLATFORM_API_URL",
  "PLATFORM_WEB_HOST",
  "PLATFORM_WEB_ALLOWED_HOSTS",
  "PLATFORM_WEB_ORIGINS"
]);
const interactiveKeys = [
  ["DB_USER", "MariaDB application user", false],
  ["DB_PASSWORD", "MariaDB application password", true],
  ["MARIADB_ADMIN_USER", "MariaDB administrative user", false],
  ["MARIADB_ROOT_PASSWORD", "MariaDB administrative password", true],
  ["REDIS_PASSWORD", "Redis password", true],
  ["MEDIA_ADMIN_USER", "File Browser administrator user", false],
  ["MEDIA_ADMIN_PASSWORD", "File Browser administrator password", true],
  ["SUPER_ADMIN_NAME", "Super administrator name", false],
  ["SUPER_ADMIN_EMAIL", "Super administrator email", false],
  ["SUPER_ADMIN_PASSWORD", "Super administrator password", true],
  ["SOFTWARE_ADMIN_NAME", "Software administrator name", false],
  ["SOFTWARE_ADMIN_EMAIL", "Software administrator email", false],
  ["SOFTWARE_ADMIN_PASSWORD", "Software administrator password", true],
  ["TENANT_ADMIN_NAME", "Tenant administrator name", false],
  ["TENANT_ADMIN_EMAIL", "Tenant administrator email", false],
  ["TENANT_ADMIN_PASSWORD", "Tenant administrator password", true],
  ["DEFAULT_TENANT_ADMIN_NAME", "Default tenant administrator name", false],
  ["DEFAULT_TENANT_ADMIN_EMAIL", "Default tenant administrator email", false],
  ["DEFAULT_TENANT_ADMIN_PASSWORD", "Default tenant administrator password", true]
];
const generatedInfrastructureSecrets = new Set([
  "DB_PASSWORD",
  "MARIADB_ROOT_PASSWORD",
  "REDIS_PASSWORD",
  "MEDIA_ADMIN_PASSWORD",
  "JWT_SECRET"
]);
if (!checkOnly) {
  for (const key of retiredKeys) {
    current.delete(key);
  }
  if (!deployment) {
    for (const key of deploymentTemplate.keys()) {
      if (!template.has(key)) current.delete(key);
    }
  }
  for (const [key, value] of template) {
    if (!current.has(key)) {
      current.set(key, value);
    }
  }
  for (const assignment of assignments) {
    const separator = assignment.indexOf("=");
    const key = separator > 0 ? assignment.slice(0, separator) : "";
    const value = separator > 0 ? assignment.slice(separator + 1) : "";
    if (!template.has(key)) {
      fail(`Unknown .env key in --set assignment: ${key || assignment}`);
    }
    current.set(key, value);
  }

  if (deployment) {
    current.set("NODE_ENV", "production");
    current.set("DB_HOST", current.get("CODEXSUN_MARIADB_CONTAINER") || "codexsun-mariadb");
    current.set("DB_PORT", "3306");
    current.set("CODEXSUN_QUEUE_BACKEND", "bullmq-redis");
  }

  if (nonInteractive) {
    for (const key of generatedInfrastructureSecrets) {
      if (template.has(key) && isMissing(current.get(key))) {
        current.set(key, randomBytes(32).toString("hex"));
      }
    }
  } else {
    if (isMissing(current.get("JWT_SECRET"))) {
      current.set("JWT_SECRET", randomBytes(32).toString("hex"));
    }
    if (!stdin.isTTY || !stdout.isTTY) {
      fail(
        "Interactive configuration requires a terminal. Use --non-interactive only when application administrator credentials already exist."
      );
    }
    stdout.write(
      `\n${deployment ? "Deployment" : "Development"} configuration\n` +
        `File: ${envPath}\n` +
        "Press Enter to keep the displayed value. Secret values are never printed.\n\n"
    );
    for (const [key, label, secret] of interactiveKeys) {
      if (!template.has(key)) continue;
      const existing = current.get(key);
      const suffix = isMissing(existing) ? "" : secret ? " [configured]" : ` [${existing}]`;
      const answer = secret
        ? await hiddenQuestion(`${label}${suffix}: `)
        : await visibleQuestion(`${label}${suffix}: `);
      if (answer.trim()) {
        current.set(key, answer.trim());
      }
    }
  }

  const redisPassword = current.get("REDIS_PASSWORD");
  if (!isMissing(redisPassword)) {
    const redis = new URL(current.get("CODEXSUN_REDIS_URL") || "redis://127.0.0.1:6379/0");
    redis.password = redisPassword;
    redis.hostname = deployment
      ? current.get("CODEXSUN_REDIS_CONTAINER") || "codexsun-redis"
      : "127.0.0.1";
    current.set("CODEXSUN_REDIS_URL", redis.toString());
  }

  validate(current, deployment);
  const temporaryPath = `${envPath}.tmp`;
  writeFileSync(temporaryPath, renderEnv(templateText, current), { mode: 0o600 });
  renameSync(temporaryPath, envPath);
  stdout.write(`${deployment ? "Deployment" : "Development"} environment saved to ${envPath}.\n`);
} else {
  validate(current, deployment);
  stdout.write(
    `${deployment ? "Deployment" : "Development"} environment is complete and valid: ${envPath}\n`
  );
}

function validate(values, validateDeployment) {
  const problems = [];
  if (!new Set(["single", "multi"]).has(values.get("CODEXSUN_TENANCY_MODE"))) {
    problems.push("CODEXSUN_TENANCY_MODE must be single or multi");
  }
  if (values.get("CODEXSUN_TENANCY_MODE") === "single") {
    const configuredId = values.get("CODEXSUN_SINGLE_TENANT_CORPORATE_ID")?.trim().toUpperCase();
    if (!configuredId)
      problems.push("CODEXSUN_SINGLE_TENANT_CORPORATE_ID is required in single mode");
    if (
      values.get("ENABLE_DEFAULT_TENANT_SEED") === "1" &&
      configuredId !== values.get("DEFAULT_TENANT_CORPORATE_ID")?.trim().toUpperCase()
    ) {
      problems.push("The default tenant and configured single tenant must match");
    }
  }
  for (const key of retiredKeys) {
    if (values.has(key)) {
      problems.push(`${key} is retired and must be removed`);
    }
  }
  for (const [key] of template) {
    if (!values.has(key)) {
      problems.push(`${key} is missing`);
    } else if (!isOptionalKey(key, validateDeployment) && isMissing(values.get(key))) {
      problems.push(`${key} must have a real value`);
    }
  }
  for (const [key, value] of values) {
    if (!isOptionalKey(key, validateDeployment) && /^change_this/u.test(value.trim())) {
      problems.push(`${key} still contains a placeholder`);
    }
  }
  if (validateDeployment && values.get("CODEXSUN_DB_FRESH_ON_START") !== "0") {
    problems.push("CODEXSUN_DB_FRESH_ON_START must be 0 for deployment");
  }
  if (validateDeployment && values.get("NODE_ENV") !== "production") {
    problems.push("NODE_ENV must be production for deployment");
  }
  if (
    validateDeployment &&
    (values.get("DB_HOST") !== values.get("CODEXSUN_MARIADB_CONTAINER") ||
      values.get("DB_PORT") !== "3306")
  ) {
    problems.push("deployment requires DB_HOST=CODEXSUN_MARIADB_CONTAINER and DB_PORT=3306");
  }
  if (validateDeployment && values.get("CODEXSUN_QUEUE_BACKEND") !== "bullmq-redis") {
    problems.push("container deployment requires CODEXSUN_QUEUE_BACKEND=bullmq-redis");
  }
  if (validateDeployment && values.get("CODEXSUN_ALLOW_PRODUCTION_DB_RESET") !== "0") {
    problems.push("CODEXSUN_ALLOW_PRODUCTION_DB_RESET must be 0 for deployment");
  }
  if (values.get("DB_MASTER_NAME") === values.get("DEFAULT_TENANT_DB_NAME")) {
    problems.push("DB_MASTER_NAME and DEFAULT_TENANT_DB_NAME must differ");
  }
  if (values.get("MAIL_ENABLED") === "1") {
    for (const key of ["MAIL_SMTP_HOST", "MAIL_FROM_EMAIL"]) {
      if (isMissing(values.get(key))) problems.push(`${key} is required when MAIL_ENABLED=1`);
    }
    if (values.get("MAIL_SMTP_PORT") === "465" && values.get("MAIL_SMTP_SECURE") !== "1") {
      problems.push("MAIL_SMTP_SECURE must be 1 when MAIL_SMTP_PORT is 465");
    }
  }
  if (problems.length) {
    fail(`Deployment environment validation failed:\n- ${problems.join("\n- ")}`);
  }
}

function isOptionalKey(key, validateDeployment) {
  return optionalEmpty.has(key) || (!validateDeployment && key === "CODEXSUN_VERIFIED_BACKUP_ID");
}

function parseEnv(source) {
  const values = new Map();
  for (const line of source.split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/u);
    if (!match) continue;
    let value = match[2];
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      if (value.startsWith('"')) {
        try {
          value = JSON.parse(value);
        } catch {
          value = value.slice(1, -1);
        }
      } else {
        value = value.slice(1, -1).replaceAll("\\'", "'");
      }
    }
    values.set(match[1], value);
  }
  return values;
}

function renderEnv(templateSource, values) {
  const lines = [];
  const emitted = new Set();
  for (const line of templateSource.split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=.*$/u);
    if (match) {
      const key = match[1];
      lines.push(`${key}=${quoteEnv(values.get(key) ?? "")}`);
      emitted.add(key);
    } else {
      lines.push(line.trimEnd());
    }
  }
  while (lines.at(-1) === "") lines.pop();

  const additional = [];
  for (const [key, value] of values) {
    if (!emitted.has(key)) additional.push(`${key}=${quoteEnv(value)}`);
  }
  if (additional.length) {
    lines.push("", "# === Additional environment values ===", ...additional);
  }
  return `${lines.join("\n")}\n`;
}

function quoteEnv(value) {
  if (/[\r\n]/u.test(value)) fail("Environment values must fit on one line.");
  // Compose interpolates dollar signs inside double quotes. Keep credentials literal.
  return /^[A-Za-z0-9_./:@+-]*$/u.test(value) ? value : `'${value.replaceAll("'", "\\'")}'`;
}

function isMissing(value) {
  return !value?.trim() || /^change_this/u.test(value.trim());
}

async function hiddenQuestion(prompt) {
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  let value = "";
  try {
    for await (const character of stdin) {
      if (character === "\r" || character === "\n") break;
      if (character === "\u0003") throw new Error("Configuration cancelled.");
      if (character === "\u007f" || character === "\b") {
        value = value.slice(0, -1);
      } else {
        value += character;
      }
    }
  } finally {
    stdin.setRawMode(false);
    stdin.pause();
    stdout.write("\n");
  }
  return value;
}

async function visibleQuestion(prompt) {
  const reader = createInterface({ input: stdin, output: stdout });
  try {
    return await reader.question(prompt);
  } finally {
    reader.close();
  }
}

function fail(message) {
  console.error(message);
  process.exit(78);
}
