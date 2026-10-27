#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");

export function buildUserSql({ appUser, appPassword, masterDb, tenantDb }) {
  const user = quoteString(appUser);
  const password = quoteString(appPassword);
  const databases = [quoteIdentifier(masterDb), quoteIdentifier(tenantDb)];
  const statements = [
    "SET SESSION sql_mode = CONCAT_WS(',', @@SESSION.sql_mode, 'NO_BACKSLASH_ESCAPES');"
  ];
  for (const host of ["localhost", "127.0.0.1"]) {
    const account = `${user}@${quoteString(host)}`;
    statements.push(`CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY ${password};`);
    statements.push(`ALTER USER ${account} IDENTIFIED BY ${password};`);
    statements.push(`GRANT CREATE, SHOW DATABASES ON *.* TO ${account};`);
    for (const database of databases) {
      statements.push(`GRANT ALL PRIVILEGES ON ${database}.* TO ${account};`);
    }
  }
  statements.push("FLUSH PRIVILEGES;");
  return `${statements.join("\n")}\n`;
}

export function runUserSetup({ client, adminUser, adminPassword, host, port, ...settings }, run = execFileSync) {
  if ((client.includes("/") || client.includes("\\")) && !existsSync(client)) {
    throw new Error(`MariaDB client was not found at ${client}. Set MARIADB_CLIENT_PATH to the executable path or command.`);
  }
  run(client, ["-h", host, "-P", port, "-u", adminUser, "--default-character-set=utf8mb4", "--binary-mode"], {
    env: { ...process.env, MYSQL_PWD: adminPassword },
    input: buildUserSql(settings),
    stdio: ["pipe", "inherit", "inherit"]
  });
}

function quoteString(value) {
  if (value.includes("\0")) throw new Error("Database settings cannot contain NUL bytes.");
  return `'${value.replaceAll("'", "''")}'`;
}

function quoteIdentifier(value) {
  if (value.includes("\0")) throw new Error("Database settings cannot contain NUL bytes.");
  return `\`${value.replaceAll("`", "``")}\``;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}. Create .env from .env.example and set ${name} before running this helper.`);
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const envPath = join(root, ".env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  const settings = {
    client: requiredEnv("MARIADB_CLIENT_PATH"),
    adminUser: requiredEnv("MARIADB_ADMIN_USER"),
    adminPassword: requiredEnv("MARIADB_ROOT_PASSWORD"),
    host: requiredEnv("DB_HOST"),
    port: requiredEnv("DB_PORT"),
    appUser: requiredEnv("DB_USER"),
    appPassword: requiredEnv("DB_PASSWORD"),
    masterDb: requiredEnv("DB_MASTER_NAME"),
    tenantDb: requiredEnv("DEFAULT_TENANT_DB_NAME")
  };
  runUserSetup(settings);
  console.log(`MariaDB application user ${settings.appUser} was reconciled from .env.`);
}
