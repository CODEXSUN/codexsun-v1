import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserPage } from "./browser-client.mjs";

const directory = fileURLToPath(new URL(".", import.meta.url));
const source = await readFile(resolve(directory, "frappe.env"), "utf8");
const settings = Object.fromEntries(source.split(/\r?\n/).filter((line) => line.startsWith("CODEXSUN_")).map((line) => {
  const index = line.indexOf("=");
  const raw = line.slice(index + 1).trim();
  return [line.slice(0, index), raw.startsWith('"') ? JSON.parse(raw) : raw.replace(/^'|'$/g, "")];
}));
const origin = `http://127.0.0.1:${settings.CODEXSUN_FRAPPE_PORT || "8088"}`;
const report = resolve(directory, "reports");
const profile = resolve(report, `browser-profile-${Date.now()}`);
await mkdir(profile, { recursive: true, mode: 0o700 });
const candidates = [process.env.CODEXSUN_FRAPPE_BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);
let executable;
for (const candidate of candidates) {
  try { await access(candidate); executable = candidate; break; } catch {}
}
assert(executable, "Set CODEXSUN_FRAPPE_BROWSER to an installed Chrome or Chromium executable");
const browser = spawn(executable, ["--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { windowsHide: true, stdio: "ignore" });
let control;
let page;
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      port = Number((await readFile(resolve(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]);
      if (port) break;
    } catch {}
    await new Promise((done) => setTimeout(done, 100));
  }
  assert(port, "Chrome did not start");
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  control = await BrowserPage.connect(version.webSocketDebuggerUrl);
  const { targetId } = await control.send("Target.createTarget", { url: origin + "/login" });
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  page = await BrowserPage.connect(targets.find((target) => target.id === targetId).webSocketDebuggerUrl);
  await page.send("Page.enable");
  await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await page.waitFor("document.querySelector('#login_email') && document.querySelector('#login_password')", "Frappe login form");
  await page.waitFor("document.readyState === 'complete' && window.jQuery && jQuery._data(document.querySelector('.form-login'), 'events')?.submit?.length > 0", "ready login submit handler");
  await page.evaluate(`(() => {
    document.querySelector('#login_email').value = 'Administrator';
    document.querySelector('#login_password').value = ${JSON.stringify(settings.CODEXSUN_FRAPPE_ADMIN_PASSWORD)};
    document.querySelector('.form-login button[type="submit"]').click();
  })()`);
  await page.waitFor("/^\\/(app|desk|setup-wizard)/.test(location.pathname)", "authenticated ERPNext Desk");
  const user = await page.evaluate("fetch('/api/method/frappe.auth.get_logged_user').then(r => r.json()).then(r => r.message)");
  assert.equal(user, "Administrator");
  await page.waitFor("!document.querySelector('#login_password') && (document.body.innerText.includes('Get Started') || (document.querySelector('#page-desktop') && document.querySelector('#search-widget-button')) || document.querySelector('.desk-container'))", "rendered ERPNext workspace");
  await page.evaluate("new Promise(resolve => setTimeout(resolve, 1200))");
  const screenshot = resolve(report, "browser-login.png");
  await page.screenshot(screenshot);
  console.info(JSON.stringify({ login: "passed", authenticatedUser: user, url: await page.evaluate("location.href"),
    title: await page.evaluate("document.title"), screenshot }, null, 2));
} catch (error) {
  if (page) {
    await page.screenshot(resolve(report, "browser-failure.png")).catch(() => {});
    console.info("Browser state:", await page.evaluate("({path:location.pathname, textLength:document.body.innerText.trim().length, ids:[...document.querySelectorAll('[id]')].map(el=>el.id).slice(0,30)})").catch(() => ({})));
  }
  throw error;
} finally {
  page?.socket.close();
  if (control) {
    await control.send("Browser.close").catch(() => {});
    control.socket.close();
  } else {
    browser.kill();
  }
}
