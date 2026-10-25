import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const delay = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));
export class BrowserPage {
  constructor(socket) {
    this.socket = socket;
    this.sequence = 0;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      message.error
        ? pending.reject(new Error(message.error.message))
        : pending.resolve(message.result);
    });
  }
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((done, reject) => {
      socket.addEventListener("open", done, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new BrowserPage(socket);
  }
  send(method, params = {}) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Browser command timed out: ${method}`));
      }, 12000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (response.exceptionDetails)
      throw new Error(response.exceptionDetails.exception?.description ?? "Browser script failed.");
    return response.result.value;
  }
  async waitFor(expression, label, attempts = 120) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (await this.evaluate(expression)) return;
      await delay(200);
    }
    await this.screenshot(resolve("dist/codexsun-tconnect-browser-failure.png")).catch(() => {});
    console.info(
      "Browser page at failure:",
      await this.evaluate("document.body.innerText.slice(0,2600)")
    );
    throw new Error(`Browser did not show ${label}.`);
  }
  async clickText(text) {
    await this.evaluate(
      `(()=>{const element=[...document.querySelectorAll('button,a')].find(item=>item.textContent.trim()===${JSON.stringify(text)});if(!element)throw new Error('Control is unavailable');element.click();})()`
    );
  }
  async fill(values) {
    await this.evaluate(
      `(()=>{for(const [name,value] of Object.entries(${JSON.stringify(values)})){const element=document.querySelector('[name="'+name+'"]');if(!element)continue;const prototype=element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,String(value));element.dispatchEvent(new Event('input',{bubbles:true}));}})()`
    );
  }
  async submitField(name) {
    await this.evaluate(`document.querySelector('[name="${name}"]').form.requestSubmit()`);
  }
  async screenshot(path) {
    const result = await this.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true
    });
    await writeFile(path, Buffer.from(result.data, "base64"));
  }
}
export async function runNegotiationBrowserChecks(input) {
  const directory = resolve(`dist/.cache/codexsun-tconnect-negotiation-${Date.now()}`);
  await mkdir(directory, { recursive: true });
  const browser = spawn(
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    [
      "--headless",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${directory}`,
      "--remote-debugging-port=0",
      "about:blank"
    ],
    { windowsHide: true, stdio: "ignore" }
  );
  let control;
  try {
    let port;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        port = Number((await readFile(`${directory}/DevToolsActivePort`, "utf8")).split("\n")[0]);
        if (port) break;
      } catch {}
      await delay(100);
    }
    if (!port) throw new Error("The browser did not start.");
    const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    control = await BrowserPage.connect(version.webSocketDebuggerUrl);
    async function login(email, password, buyer) {
      const url = `${input.platformOrigin}/login?app=tconnect${buyer ? "&account=buyer" : ""}&corporateId=${encodeURIComponent(input.corporateId)}`;
      const { targetId } = await control.send("Target.createTarget", { url });
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = await BrowserPage.connect(
        targets.find((target) => target.id === targetId).webSocketDebuggerUrl
      );
      await page.send("Page.enable");
      await page.send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: 1100,
        deviceScaleFactor: 1,
        mobile: false
      });
      await page.waitFor(
        `document.querySelector('input[type="password"]')!==null&&!document.body.innerText.includes('Checking this workspace')`,
        "login form"
      );
      await page.fill({ corporateId: input.corporateId, email, password });
      await page.evaluate(`document.querySelector('button[type="submit"]').click()`);
      await page.waitFor(
        `location.pathname===${JSON.stringify(buyer ? "/app/tconnect/buyer" : "/app/tconnect/member")}&&document.body.innerText.includes(${JSON.stringify(buyer ? "Discover products. Start a conversation." : "Your company & branding")})`,
        "authenticated workspace"
      );
      return page;
    }
    const seller = await login(input.sellerEmail, input.sellerPassword, false);
    await seller.clickText("Buyer requirements");
    await seller.waitFor(
      `document.body.innerText.includes(${JSON.stringify(input.requirementTitle)})`,
      "open sourcing requirement"
    );
    await seller.evaluate(
      `(()=>{const row=[...document.querySelectorAll('tbody tr')].find(item=>item.innerText.includes(${JSON.stringify(input.requirementTitle)}));if(!row)throw new Error('Requirement row not found');[...row.querySelectorAll('button')].find(button=>button.textContent.trim()==='Reply / Quote').click();})()`
    );
    await seller.waitFor(
      `document.body.textContent.includes('Private conversation')&&document.body.innerText.includes('New quotation')`,
      "seller conversation"
    );
    await seller.clickText("New quotation");
    await seller.waitFor(`document.querySelector('[name="unitPrice"]')!==null`, "quotation form");
    await seller.fill({
      quantity: 500,
      unit: "piece",
      unitPrice: 119,
      taxPercent: 5,
      shipping: 800,
      deliveryDays: 12,
      paymentTerms: "30% advance, balance before dispatch",
      notes: "Browser form quotation for the sourcing comparison check."
    });
    await seller.submitField("unitPrice");
    await seller.waitFor(
      `document.body.innerText.includes('Quotation sent.')`,
      "quotation success"
    );
    await seller.fill({
      message: "Browser seller reply: We can arrange a fabric sample before production."
    });
    await seller.submitField("message");
    await seller.waitFor(
      `document.body.innerText.includes('Browser seller reply:')`,
      "seller message history"
    );
    const buyer = await login(input.buyerEmail, input.buyerPassword, true);
    await buyer.clickText("My requirements");
    await buyer.waitFor(
      `document.body.innerText.includes(${JSON.stringify(input.requirementTitle)})`,
      "buyer requirement"
    );
    await buyer.evaluate(
      `(()=>{const row=[...document.querySelectorAll('tbody tr')].find(item=>item.innerText.includes(${JSON.stringify(input.requirementTitle)}));[...row.querySelectorAll('button')].find(button=>button.textContent.trim()==='View replies & quotes').click();})()`
    );
    for (const uuid of input.quoteUuids) {
      await buyer.waitFor(
        `!!document.querySelector('[aria-label*="Compare quotation ${uuid}"]')`,
        "comparison selector"
      );
      await buyer.evaluate(
        `document.querySelector('[aria-label*="Compare quotation ${uuid}"]').click()`
      );
    }
    await buyer.clickText("Compare selected (2)");
    await buyer.waitFor(
      `document.body.innerText.includes('Compare quotations')&&document.body.innerText.includes('64,131.25')&&document.body.innerText.includes('65,625.00')`,
      "side-by-side quotation amounts"
    );
    await buyer.screenshot(resolve("dist/codexsun-tconnect-quotation-comparison.png"));
    await buyer.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: true
    });
    await delay(150);
    assert.equal(
      await buyer.evaluate("document.documentElement.scrollWidth<=innerWidth"),
      true,
      "Comparison must stay within the mobile viewport"
    );
    await buyer.screenshot(resolve("dist/codexsun-tconnect-quotation-comparison-mobile.png"));
    await buyer.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false
    });
    await buyer.clickText(`Discuss with ${input.sellerName}`);
    await buyer.waitFor(
      `document.body.innerText.includes('Browser seller reply:')`,
      "seller reply in buyer conversation"
    );
    await buyer.fill({
      message: "Browser buyer reply: Please send the sample specifications and confirm delivery."
    });
    await buyer.submitField("message");
    await buyer.waitFor(
      `document.body.innerText.includes('Browser buyer reply:')`,
      "buyer reply history"
    );
    await seller.clickText("Refresh messages");
    await seller.waitFor(
      `document.body.innerText.includes('Browser buyer reply:')`,
      "buyer reply in seller workspace"
    );
    await buyer.screenshot(resolve("dist/codexsun-tconnect-conversation.png"));
    console.info(
      "BROWSER PASS: seller quotation and reply forms, buyer comparison, mobile layout, and buyer-to-seller conversation."
    );
  } finally {
    if (control) {
      await control.send("Browser.close").catch(() => {});
      control.socket.close();
    } else browser.kill();
  }
}
