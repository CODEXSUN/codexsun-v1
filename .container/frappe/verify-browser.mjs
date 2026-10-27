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
const browserProblems = [];
const socketRequests = new Map();
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
  page.socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") {
      const detail = message.params.exceptionDetails;
      const text = String(detail.exception?.description || detail.text).replaceAll(settings.CODEXSUN_FRAPPE_ADMIN_PASSWORD, "[redacted]");
      browserProblems.push({ type: "javascript", message: text.slice(0, 500) });
    }
    if (message.method === "Network.responseReceived") {
      const response = message.params.response;
      if (response.status >= 400 && response.url.startsWith(origin + "/api/")) {
        browserProblems.push({ type: "api", status: response.status, path: new URL(response.url).pathname });
      }
    }
    if (message.method === "Network.requestWillBeSent" && message.params.request.url.includes("/socket.io")) {
      socketRequests.set(message.params.requestId, message.params.request.url);
    }
    if (message.method === "Network.loadingFailed" && socketRequests.has(message.params.requestId) && !message.params.canceled) {
      browserProblems.push({ type: "socket", url: socketRequests.get(message.params.requestId).split("?")[0], message: message.params.errorText });
    }
    if (message.method === "Network.loadingFinished") socketRequests.delete(message.params.requestId);
  });
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Network.enable");
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
  let realtime;
  if (process.argv.includes("--suite")) {
    realtime = await page.evaluate(`new Promise(resolve => {
      const site = ${JSON.stringify(settings.CODEXSUN_FRAPPE_SITE)};
      const socket = new WebSocket(location.origin.replace(/^http/, 'ws') + '/socket.io/?EIO=4&transport=websocket');
      const finish = result => { clearTimeout(timer); socket.close(); resolve(result); };
      const timer = setTimeout(() => finish('timeout'), 10000);
      socket.onerror = () => finish('connection failed');
      socket.onmessage = event => {
        const packet = String(event.data);
        if (packet.startsWith('0')) socket.send('40/' + site + ',');
        else if (packet.startsWith('40/' + site + ',')) finish('passed');
        else if (packet.startsWith('44')) finish('authentication denied');
        else if (packet === '2') socket.send('3');
      };
    })`);
    assert.equal(realtime, "passed", "Authenticated Socket.IO namespace handshake failed");
  }
  const suite = {};
  if (process.argv.includes("--suite")) {
    for (const app of ["hrms", "raven", "crm", "helpdesk", "insights"]) {
      const problemOffset = browserProblems.length;
      await page.send("Page.navigate", { url: origin + "/" + app });
      await page.waitFor(`location.pathname.startsWith('/${app}') && document.readyState === 'complete' && (document.querySelector('#app')?.children.length > 0 || document.querySelector('#root')?.children.length > 0) && document.body.innerText.trim().length > 30`, "rendered " + app);
      await page.evaluate("new Promise(resolve => setTimeout(resolve, 1500))");
      assert.equal(await page.evaluate("fetch('/api/method/frappe.auth.get_logged_user').then(r => r.json()).then(r => r.message)"), "Administrator");
      const appScreenshot = resolve(report, `suite-${app}.png`);
      await page.screenshot(appScreenshot);
      const problems = browserProblems.slice(problemOffset);
      assert.equal(problems.length, 0, `${app} startup errors: ${JSON.stringify(problems)}`);
      suite[app] = { rendered: "passed", url: await page.evaluate("location.href"), screenshot: appScreenshot };
      console.info("PASS: browser rendered " + app);
    }
  }
  console.info(JSON.stringify({ login: "passed", authenticatedUser: user, url: await page.evaluate("location.href"),
    title: await page.evaluate("document.title"), screenshot, suite, realtime }, null, 2));
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
