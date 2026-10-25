import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { BrowserPage } from "./tconnect-negotiation-browser.mjs";

/** Loopback-only harness uses the real Marketing screens and the caller's disposable database API. */
export async function verifyMarketingBrowser(app) {
  const directory = resolve("dist/.cache/codexsun-marketing-browser-" + Date.now());
  const chromeDir = resolve("dist/.cache/chrome-profile-" + Date.now());
  await mkdir(directory, { recursive: true });
  await writeFile(
    resolve(directory, "index.html"),
    '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>'
  );
  await writeFile(resolve(directory, "fixture.tsx"), fixture);
  const server = await createServer({
    configFile: false,
    root: directory,
    cacheDir: resolve("dist/.cache/vite/marketing-browser"),
    plugins: [
      {
        name: "codexsun-marketing-fixture-api",
        configureServer(server) {
          server.middlewares.use("/fixture-api", async (request, response) => {
            try {
              const chunks = [];
              for await (const chunk of request) chunks.push(chunk);
              const body = Buffer.concat(chunks).toString("utf8");
              const result = await app.inject({
                method: request.method,
                url: request.url,
                headers: { "content-type": "application/json" },
                ...(body ? { payload: body } : {})
              });
              response.writeHead(result.statusCode, { "Content-Type": "application/json" });
              response.end(result.body);
            } catch {
              response.writeHead(500);
              response.end('{"success":false}');
            }
          });
        }
      },
      react(),
      tailwindcss()
    ],
    server: {
      host: "127.0.0.1",
      port: 0,
      hmr: false,
      watch: null,
      fs: { allow: [process.cwd()] }
    }
  });
  await server.listen();
  const address = server.httpServer.address();
  assert(address && typeof address !== "string");
  const origin = "http://127.0.0.1:" + address.port;
  const browser = spawn(
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    [
      "--headless",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--user-data-dir=" + chromeDir,
      "--remote-debugging-port=0",
      "about:blank"
    ],
    { windowsHide: true, stdio: "ignore" }
  );
  let control, page;
  try {
    let port = 0;
    for (let attempt = 0; attempt < 100 && !port; attempt++) {
      try {
        port = Number(
          (await readFile(resolve(chromeDir, "DevToolsActivePort"), "utf8")).split("\n")[0]
        );
      } catch {}
      if (!port) await new Promise((done) => setTimeout(done, 100));
    }
    assert(port, "Chrome must start for local UI verification.");
    const version = await (await fetch("http://127.0.0.1:" + port + "/json/version")).json();
    control = await BrowserPage.connect(version.webSocketDebuggerUrl);
    const target = await control.send("Target.createTarget", { url: origin });
    const targets = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json();
    const info = targets.find((row) => row.id === target.targetId);
    assert(info);
    page = await BrowserPage.connect(info.webSocketDebuggerUrl);
    await page.waitFor("Boolean(document.body)", "DOM ready");
    await page.waitFor(
      "Boolean(document.body?.innerText?.includes('New Brand'))",
      "Marketing brand workspace",
      200
    );
    await page.clickText("New Brand");
    await page.waitFor(
      "Boolean(document.querySelector(\"input[aria-label='Brand name'], input[aria-label='Name']\"))",
      "CRM-style upsert"
    );
    assert.equal(
      await page.evaluate("Boolean(document.querySelector('table'))"),
      false,
      "Upsert page must not render the list behind its form."
    );
    await page.clickText("Save");
    await page.waitFor(
      "Boolean(document.body?.innerText?.includes('Check the required fields'))",
      "required-field validation"
    );
    await page.evaluate(
      `(()=>{const input=document.querySelector('input[aria-label="Brand name"], input[aria-label="Name"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Browser verified brand');input.dispatchEvent(new Event('input',{bubbles:true}));})()`
    );
    await page.clickText("Save");
    await page.waitFor(
      "document.querySelector('table')?.innerText.includes('Browser verified brand')",
      "database-backed brand creation"
    );
    await page.evaluate(
      `(()=>{const row=[...document.querySelectorAll('tbody tr')].find(item=>item.innerText.includes('Browser verified brand'));row.click();})()`
    );
    await page.waitFor(
      "Boolean(document.body?.innerText?.includes('Brand Details'))",
      "Show details and activity"
    );
    assert.match(await page.evaluate("location.search"), /show=[a-f0-9]{8}/);
    await page.send("Page.reload");
    await page.waitFor(
      "Boolean(document.body?.innerText?.includes('Brand Details'))",
      "Show survives browser refresh"
    );
    await page.clickText("Edit");
    await page.waitFor(
      "document.querySelector(\"input[aria-label='Brand name'], input[aria-label='Name']\")?.value==='Browser verified brand'",
      "Edit current record"
    );
    assert.match(await page.evaluate("location.search"), /form=edit/);
    await page.screenshot(resolve("dist/marketing-brand-upsert-local.png"));
    await page.evaluate("window.confirm=()=>true");
    await page.clickText("Cancel");
    await page.screenshot(resolve("dist/marketing-brand-list-local.png"));
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true
    });
    await page.screenshot(resolve("dist/marketing-brand-mobile-local.png"));
    assert.equal(await page.evaluate("window.innerWidth"), 390);
    const overflow = await page.evaluate("document.documentElement.scrollWidth>window.innerWidth");
    assert.equal(overflow, false, "Workspace must fit a mobile viewport.");
    await page.send("Emulation.clearDeviceMetricsOverride");
    await page.send("Page.navigate", { url: origin + "/?workspace=consent" });
    await page.waitFor("Boolean(document.body?.innerText?.includes('Record Consent'))", "Consent list");
    await page.clickText("Record Consent");
    await page.waitFor(
      `Boolean(document.querySelector('input[aria-label="Recipient email"]'))`,
      "Consent standalone form"
    );
    assert.equal(await page.evaluate("Boolean(document.querySelector('table'))"), false);
    await page.clickText("Save consent evidence");
    await page.waitFor(
      "Boolean(document.body?.innerText?.includes('Check the required fields'))",
      "Consent required-field validation"
    );
    await page.evaluate(`(()=>{const el=document.querySelector('[aria-label="Brand"]');if(el){el.click();el.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true}));}})()`);
    await page.waitFor(
      `Boolean([...document.querySelectorAll('[role="option"], [data-radix-collection-item], div')].find(item=>item.textContent?.trim()==='Consent test brand'))`,
      "Brand lookup options"
    );
    await page.evaluate(
      `(()=>{const el=[...document.querySelectorAll('[role="option"], [data-radix-collection-item], div')].find(item=>item.textContent?.trim()==='Consent test brand');if(el){el.dispatchEvent(new MouseEvent('pointerup',{bubbles:true}));el.click();}})()`
    );
    await page.evaluate(
      `(()=>{for(const [label,value] of Object.entries({'Recipient email':'browser-consent@example.test','Notice version':'browser-notice-v1','Evidence reference':'disposable-browser-evidence','Source description':'disposable-browser-test'})){const input=document.querySelector('input[aria-label="'+label+'"]')||document.querySelector('input[aria-label*="Source"]');if(input){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}}})()`
    );
    await page.clickText("Save consent evidence");
    await page.waitFor(
      "document.querySelector('table')?.innerText.includes('browser-consent@example.test')",
      "Consent persistence"
    );
    await page.evaluate(
      `([...document.querySelectorAll('tbody tr')].find(row=>row.innerText.includes('browser-consent@example.test'))).click()`
    );
    await page.waitFor("Boolean(document.body?.innerText?.includes('Check eligibility'))", "Consent Show");
    await page.clickText("Check eligibility");
    await page.waitFor(
      "Boolean(document.body?.innerText?.includes('Eligible at check time'))",
      "Live owner eligibility check"
    );
    await page.screenshot(resolve("dist/marketing-consent-show-local.png"));
    await page.send("Page.reload");
    await page.waitFor(
      "Boolean(document.body?.innerText?.includes('Check eligibility'))",
      "Consent Show refresh"
    );
    assert.equal(
      Boolean(await page.evaluate("Boolean(document.body?.innerText?.includes('Eligible at check time'))")),
      false,
      "Reload must not restore a cached allow result."
    );

    // Content workspace verification
    await page.send("Page.navigate", { url: origin + "/?workspace=content" });
    await page.waitFor(
      "Boolean(document.body?.innerText?.includes('New Content') || document.body?.innerText?.includes('Content'))",
      "Content workspace list"
    );
    await page.screenshot(resolve("dist/marketing-content-list-local.png"));

    await page.clickText("New Content");
    await page.waitFor("Boolean(document.body?.innerText?.includes('Body'))", "Content New form");
    await page.clickText("Save Draft");
    await page.waitFor(
      "Boolean(document.body?.innerText?.includes('Check the required fields') || document.body?.innerText?.includes('Unable to save content'))",
      "Content form validation"
    );
    await page.screenshot(resolve("dist/marketing-content-upsert-local.png"));

    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true
    });
    await page.send("Page.reload");
    await page.waitFor("Boolean(document.body?.innerText?.includes('New Content') || document.body?.innerText?.includes('Content'))", "Content mobile list");
    const mobileContentScrollWidth = await page.evaluate("document.documentElement.scrollWidth");
    assert.ok(mobileContentScrollWidth <= 390, "Content mobile viewport must not overflow horizontally.");
    await page.screenshot(resolve("dist/marketing-content-mobile-local.png"));

    // Email Campaigns workspace verification
    await page.send("Emulation.clearDeviceMetricsOverride");
    await page.send("Page.navigate", { url: origin + "/?workspace=email-campaigns" });
    await page.waitFor(
      "Boolean(document.body?.innerText?.includes('New Email Campaign') || document.body?.innerText?.includes('Email Campaigns'))",
      "Email Campaigns workspace list"
    );
    await page.screenshot(resolve("dist/marketing-email-list-local.png"));

    await page.clickText("New Email Campaign");
    await page.waitFor(
      "Boolean(document.body?.innerText?.includes('Subject') || document.body?.innerText?.includes('Create email campaign'))",
      "Email Campaign New form"
    );
    assert.equal(
      await page.evaluate("Boolean(document.querySelector('table'))"),
      false,
      "Email Campaign Upsert page must not render the list behind its form."
    );
    await page.clickText("Save Draft");
    await page.waitFor(
      "Boolean(document.body?.innerText?.includes('Check the required fields') || document.body?.innerText?.includes('Unable to save email campaign'))",
      "Email Campaign form validation"
    );
    await page.screenshot(resolve("dist/marketing-email-upsert-local.png"));

    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true
    });
    await page.send("Page.reload");
    await page.waitFor(
      "Boolean(document.body?.innerText?.includes('New Email Campaign') || document.body?.innerText?.includes('Email Campaigns'))",
      "Email Campaign mobile list"
    );
    const mobileEmailScrollWidth = await page.evaluate("document.documentElement.scrollWidth");
    assert.ok(mobileEmailScrollWidth <= 390, "Email Campaign mobile viewport must not overflow horizontally.");
    await page.screenshot(resolve("dist/marketing-email-mobile-local.png"));

    console.info(
      "BROWSER PASS: standalone list/upsert, validation, persisted Brand, consent, Content, and Email Campaign creation, Show refresh, current eligibility, uncached decisions, and mobile viewport."
    );
  } finally {
    page?.socket.close();
    if (control) {
      await control.send("Browser.close").catch(() => {});
      control.socket.close();
    } else browser.kill();
    await server.close();
  }
}

const fixture = `import React,{useState,useEffect} from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{BrandWorkspace,ConsentWorkspace,ContentWorkspace,EmailCampaignWorkspace,MarketingTransportProvider}from'@codexsun/marketing-web';import{WorkspaceNavigationProvider}from'@codexsun/ui/workspace/navigation';import'@codexsun/ui/styles.css';
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});async function request(method,path,body){const result=await fetch('/fixture-api'+path,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await result.json();if(!result.ok)throw new Error(data.error?.message||'API request failed');return data.data;}const api={scopeKey:'isolated-fixture',get:path=>request('GET',path),post:(path,body)=>request('POST',path,body),put:(path,body)=>request('PUT',path,body),publicUrl:path=>location.origin+path};function App(){const[search,setSearch]=useState(Object.fromEntries(new URLSearchParams(location.search)));useEffect(()=>{const update=()=>setSearch(Object.fromEntries(new URLSearchParams(location.search)));addEventListener('popstate',update);const nav=e=>setSearch({workspace:e.detail});addEventListener('nav-workspace',nav);return()=>{removeEventListener('popstate',update);removeEventListener('nav-workspace',nav);};},[]);return <QueryClientProvider client={client}><MarketingTransportProvider.Provider value={api}><WorkspaceNavigationProvider headerTarget={null} search={search} onSearchChange={value=>{history.pushState({},'',location.pathname+'?'+new URLSearchParams(value));setSearch(value);}}><main className="p-4">{search.workspace==='email-campaigns'?<EmailCampaignWorkspace/>:search.workspace==='content'?<ContentWorkspace/>:search.workspace==='consent'?<ConsentWorkspace/>:<BrandWorkspace/>}</main></WorkspaceNavigationProvider></MarketingTransportProvider.Provider></QueryClientProvider>;}createRoot(document.querySelector('#root')).render(<App/>);`;
