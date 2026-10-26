#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, resolve } from "node:path";

import { prepareMobileOutput } from "./mobile-output.mjs";

const root = resolve(import.meta.dirname, "..");
const appRoot = join(root, "apps", "crm", "mobile");
const mobileEnvironment = prepareMobileOutput(root, "crm");
const [command, ...argumentsList] = process.argv.slice(2);
const options = readOptions(argumentsList);
const flutterArgs = argumentsList.filter(
  (argument) =>
    !argument.startsWith("--client-") &&
    !argument.startsWith("--api-url=") &&
    !argument.startsWith("--application-id=") &&
    !argument.startsWith("--corporate-id=") &&
    !argument.startsWith("--logo-asset=") &&
    !argument.startsWith("--android-brand-asset=")
);

if (!["run", "build-debug", "build-release", "analyze", "test"].includes(command ?? "")) {
  fail(
    "Usage: node tools/crm-mobile.mjs <run|build-debug|build-release|analyze|test> --client-name=<name> --api-url=<url> --application-id=<id> [Flutter options]"
  );
}

if (command === "run") runFlutter(["run", ...defines(), ...flutterArgs]);
if (command === "build-debug") buildApk("debug");
if (command === "build-release") buildApk("release");
if (command === "analyze") runFlutter(["analyze", ...flutterArgs]);
if (command === "test") runFlutter(["test", ...flutterArgs]);

function defines() {
  return [
    `--dart-define=APP_BRAND=${options.clientName}`,
    `--dart-define=APP_VERSION=${process.env.npm_package_version ?? "1.0.87"}`,
    `--dart-define=API_URL=${options.apiUrl}`,
    `--dart-define=CORPORATE_ID=${options.corporateId}`,
    `--dart-define=NATIVE_CHANNEL_PREFIX=${options.applicationId}`,
    `--dart-define=APP_LOGO_ASSET=${options.logoAsset}`
  ];
}

function buildApk(mode) {
  const registrant = join(
    appRoot,
    "android",
    "app",
    "src",
    "main",
    "java",
    "io",
    "flutter",
    "plugins",
    "GeneratedPluginRegistrant.java"
  );
  if (flutterArgs.includes("--no-pub") && !existsSync(registrant))
    fail(
      "Android plugin registration is missing. Run Flutter pub get (offline is supported) before a --no-pub APK build."
    );
  runFlutter(["build", "apk", `--${mode}`, ...defines(), ...flutterArgs]);
  if (!existsSync(registrant))
    fail("Android plugin registration is missing; do not distribute this APK.");
  const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
  const outputDirectory = join(appRoot, "build", "app", "outputs", "flutter-apk");
  const source = join(outputDirectory, `app-${mode}.apk`);
  const artifactName =
    mode === "release"
      ? `${clientSlug(options.clientName)}-v${version}.apk`
      : `${clientSlug(options.clientName)}-debug.apk`;
  const target = join(outputDirectory, artifactName);
  if (!existsSync(source)) fail(`Flutter APK is missing: ${source}`);
  copyFileSync(source, target);
  console.log(`Client APK: ${target}`);
}

function clientSlug(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "") || "client"
  );
}

function runFlutter(args) {
  const executable = process.env.FLUTTER_BIN?.trim() || defaultFlutter();
  const environment = {
    ...process.env,
    ...mobileEnvironment,
    ...(command.startsWith("build-") ? { FLUTTER_WINDOWS: "false", FLUTTER_LINUX: "false" } : {}),
    APP_BRAND_NAME: options.clientName,
    ANDROID_APPLICATION_ID: options.applicationId,
    MOBILE_ANDROID_BRAND_ASSET: options.androidBrandAsset
  };
  const result =
    platform() === "win32"
      ? spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", executable, ...args], {
          cwd: appRoot,
          env: environment,
          stdio: "inherit"
        })
      : spawnSync(executable, args, { cwd: appRoot, env: environment, stdio: "inherit" });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function defaultFlutter() {
  if (platform() === "win32") {
    const localFlutter = join(homedir(), "development", "flutter", "bin", "flutter.bat");
    return existsSync(localFlutter) ? localFlutter : "flutter.bat";
  }
  return "flutter";
}

function readOptions(args) {
  const value = (name, fallback) => {
    const entry = args.find((argument) => argument.startsWith(`--${name}=`));
    return entry ? entry.slice(name.length + 3).trim() : fallback;
  };
  const options = {
    clientName: value("client-name", "CRM"),
    apiUrl: value("api-url", "http://10.0.2.2:7010"),
    applicationId: value("application-id", "in.codexsun.crm_app"),
    corporateId: value("corporate-id", process.env.DEFAULT_TENANT_CORPORATE_ID ?? "CODEXSUN"),
    logoAsset: value("logo-asset", "assets/crm-logo.png"),
    androidBrandAsset: value("android-brand-asset", "crm")
  };
  if (!options.clientName) fail("--client-name must not be empty.");
  if (!/^https?:\/\//u.test(options.apiUrl)) fail("--api-url must be an HTTP or HTTPS URL.");
  if (!/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u.test(options.applicationId))
    fail("--application-id must be a valid Android application ID.");
  if (!/^[a-z][a-z0-9_]*$/u.test(options.androidBrandAsset))
    fail("--android-brand-asset must name a lowercase Android branding folder.");
  if (!existsSync(join(appRoot, options.logoAsset)))
    fail(`Logo asset does not exist: ${options.logoAsset}`);
  if (
    !existsSync(
      join(appRoot, "android", "app", "src", "main", "branding", options.androidBrandAsset)
    )
  )
    fail(`Android brand assets do not exist: ${options.androidBrandAsset}`);
  return options;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
