import assert from "node:assert/strict";
import { mkdir, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { createApp } from "../../apps/platform/api/src/app.js";

type TenantSession = { cookie: string; headers: Record<string, string>; sessionSlot: string };
type BrowserContext = { app: Awaited<ReturnType<typeof createApp>>; runId: number; platformWebPort: string | number; adminEmail: string; adminPassword: string; tenantACode: string };

export async function verifyFixtureBrowser(
  context: BrowserContext,
  tenantDomain: string,
  productSlug: string,
  productName: string,
  imageName: string,
  session: TenantSession
) {
  const { app, runId, platformWebPort, adminEmail, adminPassword, tenantACode } = context;
  const { createServer } = await import("vite");
  const react = (await import("@vitejs/plugin-react")).default;
  const tailwindcss = (await import("@tailwindcss/vite")).default;
  const { BrowserPage } = await import("./tconnect-negotiation-browser.mjs");
  const { spawn } = await import("node:child_process");
  const { readFile: readBrowserFile } = await import("node:fs/promises");
  const browserRoot = `dist/ecommerce-scratch/ecommerce-browser-${runId}`;
  await mkdir(browserRoot, { recursive: true });
  const profile = resolve(browserRoot, "chrome");

  const server = await createServer({
    configFile: false,
    root: resolve("apps/ecommerce/web"),
    cacheDir: resolve("dist/.cache/vite/ecommerce-fixture-browser"),
    define: {
      __CODEXSUN_PLATFORM_WEB_PORT__: JSON.stringify(Number(platformWebPort))
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "ecommerce-fixture-api",
        configureServer(vite) {
          vite.middlewares.use("/api/platform", async (request, response) => {
            try {
              const chunks: Buffer[] = [];
              for await (const chunk of request) chunks.push(Buffer.from(chunk));
              const body = Buffer.concat(chunks).toString("utf8");
              const result = await app!.inject({
                method: request.method as "GET",
                url: String(request.url ?? "/"),
                headers: {
                  host: tenantDomain,
                  origin: `http://${tenantDomain}`,
                  ...(body ? { "content-type": "application/json" } : {})
                },
                ...(body ? { payload: body } : {})
              });
              response.statusCode = result.statusCode;
              response.setHeader(
                "content-type",
                String(result.headers["content-type"] ?? "application/octet-stream")
              );
              response.end(result.rawPayload);
            } catch {
              response.statusCode = 500;
              response.end("fixture-browser-api-failed");
            }
          });
        }
      }
    ],
    server: {
      host: "127.0.0.1",
      port: 0,
      hmr: false,
      fs: { allow: [process.cwd()] }
    }
  });
  await server.listen();
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = spawn(
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    [
      "--headless",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      "--remote-debugging-port=0",
      "about:blank"
    ],
    { stdio: "ignore", windowsHide: true }
  );
  let control: Awaited<ReturnType<typeof BrowserPage.connect>> | undefined;
  let page: Awaited<ReturnType<typeof BrowserPage.connect>> | undefined;
  let platformServer: Awaited<ReturnType<typeof createServer>> | undefined;
  try {
    let port = 0;
    for (let attempt = 0; attempt < 150 && !port; attempt++) {
      try {
        port = Number(
          (await readBrowserFile(resolve(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]
        );
      } catch {
        /* The port file appears once Chrome is ready. */
      }
      if (!port) await new Promise((done) => setTimeout(done, 100));
    }
    assert.ok(port, "Chrome did not start for fixture browser acceptance.");
    const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    control = await BrowserPage.connect(version.webSocketDebuggerUrl);
    const { targetId } = await control.send("Target.createTarget", { url: "about:blank" });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    page = await BrowserPage.connect(
      targets.find((target: { id: string }) => target.id === targetId).webSocketDebuggerUrl
    );
    await page.send("Page.enable");
    await page.send("Runtime.enable");

    for (const width of [1440, 390, 320]) {
      await page.send("Emulation.setDeviceMetricsOverride", {
        deviceScaleFactor: 1,
        height: width === 1440 ? 900 : 844,
        mobile: width !== 1440,
        width
      });
      await page.send("Page.navigate", { url: `${origin}/shop` });
      await page.waitFor(
        `document.readyState==='complete'&&Boolean(document.querySelector('.cx-product-card'))`,
        `fixture catalog at ${width}px`
      );
      await page.evaluate(
        "document.querySelector('.cx-product-card img')?.scrollIntoView({block:'center'})"
      );
      await page.waitFor(
        `[...document.images].every((image)=>!image.currentSrc||image.complete)&&Boolean(document.querySelector('.cx-product-card img')?.currentSrc)`,
        `fixture catalog images at ${width}px`
      );
      const catalog = JSON.parse(
        (await page.evaluate(`JSON.stringify((() => ({
        broken: [...document.images].filter((image)=>image.currentSrc&&image.naturalWidth===0).length,
        brokenUrls: [...document.images].filter((image)=>image.currentSrc&&image.naturalWidth===0).map((image)=>image.currentSrc),
        hasProduct: document.body.innerText.includes(${JSON.stringify(productName)}),
        overflow: document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
        productImage: Boolean(document.querySelector('.cx-product-card img')?.naturalWidth)
      }))())`)) as string
      ) as {
        broken: number;
        brokenUrls: string[];
        hasProduct: boolean;
        overflow: boolean;
        productImage: boolean;
      };
      if (catalog.broken) {
        console.log("[e2e] broken fixture images:", catalog.brokenUrls);
        console.log(
          "[e2e] image probe:",
          await page.evaluate(
            `fetch(document.querySelector('.cx-product-card img').currentSrc).then(async (response)=>JSON.stringify({status:response.status,type:response.headers.get('content-type'),bytes:(await response.arrayBuffer()).byteLength}))`
          )
        );
      }
      if (!catalog.hasProduct) {
        console.log(
          "[e2e] fixture browser page:",
          await page.evaluate("document.body.innerText.slice(0,1200)")
        );
      }
      assert.equal(catalog.hasProduct, true, `Fixture product missing at ${width}px.`);
      assert.equal(catalog.broken, 0, `Broken fixture images at ${width}px.`);
      assert.equal(catalog.overflow, false, `Fixture catalog overflowed at ${width}px.`);
      assert.equal(
        catalog.productImage,
        true,
        `Fixture product image did not render at ${width}px.`
      );
    }

    await page.send("Page.navigate", { url: `${origin}/cart` });
    await page.waitFor(
      `Boolean(document.querySelector('main.cx-cart'))&&document.querySelector('.cx-cart h1')?.textContent.trim()==='Shopping cart'`,
      "fixture cart route"
    );

    await page.send("Page.navigate", { url: `${origin}/shop/product/${productSlug}` });
    await page.waitFor(
      `Boolean(document.querySelector('main.cx-detail'))&&document.querySelector('.cx-detail h1')?.textContent.trim()===${JSON.stringify(productName)}`,
      "fixture product identity"
    );
    await page.waitFor(
      `(()=>{const image=document.querySelector('.cx-detail__image img');return Boolean(image&&image.complete&&image.naturalWidth>0);})()`,
      "fixture product image"
    );
    const detail = JSON.parse(
      (await page.evaluate(`JSON.stringify((() => ({
      heading: document.querySelector('.cx-detail h1')?.textContent.trim()??'',
      imageUrl: document.querySelector('.cx-detail__image img')?.currentSrc??'',
      overflow: document.documentElement.scrollWidth>document.documentElement.clientWidth+1
    }))())`)) as string
    ) as { heading: string; imageUrl: string; overflow: boolean };
    assert.equal(detail.heading, productName);
    assert.match(detail.imageUrl, new RegExp(imageName, "u"));
    assert.equal(detail.overflow, false, "Fixture product page overflowed.");
    await page.screenshot(resolve(browserRoot, "fixture-product-1440.png"));

    platformServer = await createServer({
      configFile: resolve("apps/platform/web/vite.config.ts"),
      root: resolve("apps/platform/web"),
      plugins: [
        {
          name: "ecommerce-staff-fixture-api",
          configureServer(vite) {
            vite.middlewares.use(async (request, response, next) => {
              const path = String(request.url ?? "/");
              if (!path.startsWith("/api/")) return next();
              try {
                const chunks: Buffer[] = [];
                for await (const chunk of request) chunks.push(Buffer.from(chunk));
                const body = Buffer.concat(chunks).toString("utf8");
                const result = await app!.inject({
                  method: request.method as "GET",
                  url: path.replace(/^\/api\/(?:billing|core|platform)/u, "") || "/",
                  headers: {
                    ...session.headers,
                    ...(request.headers.cookie ? { cookie: String(request.headers.cookie) } : {}),
                    ...(request.headers["x-codexsun-session-slot"]
                      ? {
                          "x-codexsun-session-slot": String(
                            request.headers["x-codexsun-session-slot"]
                          )
                        }
                      : {}),
                    ...(body ? { "content-type": "application/json" } : {})
                  },
                  ...(body ? { payload: body } : {})
                });
                response.statusCode = result.statusCode;
                for (const [key, value] of Object.entries(result.headers)) {
                  if (key === "content-length" || value === undefined) continue;
                  response.setHeader(key, value as string | string[]);
                }
                response.end(result.rawPayload);
              } catch {
                response.statusCode = 500;
                response.end("fixture-staff-api-failed");
              }
            });
          }
        }
      ],
      server: {
        fs: { allow: [process.cwd()] },
        hmr: false,
        host: "127.0.0.1",
        port: 0
      }
    });
    await platformServer.listen();
    await platformServer.warmupRequest("/src/main.tsx").catch(() => undefined);
    await platformServer.transformRequest("/src/main.tsx").catch(() => undefined);
    let platformOptimized = false;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      try {
        if (
          (await readdir(resolve("dist/.cache/vite/platform-web/deps"))).includes("_metadata.json")
        ) {
          platformOptimized = true;
          break;
        }
      } catch {
        // The optimizer creates its cache directory after the first transform.
      }
      await new Promise((done) => setTimeout(done, 200));
    }
    assert.ok(platformOptimized, "Platform Vite dependency optimization did not finish.");
    await new Promise((done) => setTimeout(done, 500));
    const platformAddress = platformServer.httpServer.address();
    assert.ok(platformAddress && typeof platformAddress !== "string");
    const platformOrigin = `http://127.0.0.1:${platformAddress.port}`;
    await page.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 900,
      mobile: false,
      width: 1440
    });
    await page.send("Page.navigate", {
      url: `${platformOrigin}/login?corporateId=${encodeURIComponent(tenantACode)}`
    });
    await page.waitFor(
      `document.querySelector('input[type="password"]')!==null&&!document.body.innerText.includes('Checking this workspace')`,
      "staff login form",
      450
    );
    await page.waitFor(
      `(()=>{if(location.pathname.startsWith('/app/'))return true;const button=document.querySelector('button[type="submit"]');return button!==null&&!button.disabled&&button.textContent.trim()==='Sign in';})()`,
      "idle staff login form",
      450
    );
    await page.fill({
      corporateId: tenantACode,
      email: adminEmail,
      password: adminPassword
    });
    await page.evaluate(`document.querySelector('button[type="submit"]').click()`);
    await page.waitFor(
      `location.pathname.startsWith('/app/')&&!document.body.innerText.includes('Preparing your workspace')`,
      "staff authenticated workspace",
      900
    );
    const catalogShows = [
      {
        marker: "Item details",
        path: "product-information",
        query: `?q=${encodeURIComponent(`E2E A15 Browser Item ${runId}`)}`,
        term: `E2E A15 Browser Item ${runId}`,
        name: "product"
      },
      {
        marker: "Attribute details",
        path: "product-attributes",
        term: "Colour",
        name: "attribute"
      },
      {
        marker: "Specification details",
        path: "product-specifications",
        term: "Material",
        name: "specification"
      },
      {
        marker: "Collection details",
        path: "product-collections",
        term: "A15 featured",
        name: "collection"
      }
    ] as const;
    const loadStaffRoute = async (url: string, ready: string, label: string) => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await page.send("Page.navigate", { url });
          await page.waitFor(ready, label, 120);
          return;
        } catch (error) {
          lastError = error;
          await new Promise((done) => setTimeout(done, 1000));
        }
      }
      throw lastError;
    };
    for (const show of catalogShows) {
      for (const width of [1440, 768, 390, 320]) {
        await page.send("Emulation.setDeviceMetricsOverride", {
          deviceScaleFactor: 1,
          height: width === 1440 ? 900 : 844,
          mobile: width !== 1440,
          width
        });
        await loadStaffRoute(
          `${platformOrigin}/app/ecommerce/${show.path}${"query" in show ? show.query : ""}`,
          `document.readyState==='complete'&&document.body.innerText.includes(${JSON.stringify(show.term)})`,
          `${show.name} list at ${width}px`
        );
        if (show.name === "product") {
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='New item')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes('Item content')`,
            `product form at ${width}px`
          );
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Save')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes('Select a Core product.')&&document.body.innerText.includes('Storefront title is required.')&&document.body.innerText.includes('Slug is required.')`,
            `product field errors at ${width}px`
          );
          const productFormOverflow = await page.evaluate(
            "document.documentElement.scrollWidth>document.documentElement.clientWidth+1"
          );
          assert.equal(productFormOverflow, false, `Product form overflowed at ${width}px.`);
          await page.screenshot(resolve(browserRoot, `staff-product-form-errors-${width}.png`));
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Cancel')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes(${JSON.stringify(show.term)})`,
            `product list after validation at ${width}px`
          );
        }
        if (show.name === "attribute") {
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='New attribute')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes('Attributes are reusable, filterable product characteristics.')`,
            `attribute form at ${width}px`
          );
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Save')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes('Attribute code is required.')&&document.body.innerText.includes('Attribute name is required.')`,
            `attribute field errors at ${width}px`
          );
          const formOverflow = await page.evaluate(
            "document.documentElement.scrollWidth>document.documentElement.clientWidth+1"
          );
          assert.equal(formOverflow, false, `Attribute form overflowed at ${width}px.`);
          await page.screenshot(resolve(browserRoot, `staff-attribute-form-errors-${width}.png`));
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Cancel')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes(${JSON.stringify(show.term)})`,
            `attribute list after validation at ${width}px`
          );
        }
        if (show.name === "specification") {
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='New specification')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes('Specifications are labelled product facts shown on the storefront.')`,
            `specification form at ${width}px`
          );
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Save')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes('Choose a product.')&&document.body.innerText.includes('Specification label is required.')&&document.body.innerText.includes('Specification value is required.')`,
            `specification field errors at ${width}px`
          );
          const formOverflow = await page.evaluate(
            "document.documentElement.scrollWidth>document.documentElement.clientWidth+1"
          );
          assert.equal(formOverflow, false, `Specification form overflowed at ${width}px.`);
          await page.screenshot(
            resolve(browserRoot, `staff-specification-form-errors-${width}.png`)
          );
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Cancel')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes(${JSON.stringify(show.term)})`,
            `specification list after validation at ${width}px`
          );
        }
        if (show.name === "collection") {
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='New collection')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes('Curate an ordered product collection and publish it to the storefront.')`,
            `collection form at ${width}px`
          );
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Save')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes('Collection slug is required.')&&document.body.innerText.includes('Collection title is required.')`,
            `collection field errors at ${width}px`
          );
          const formOverflow = await page.evaluate(
            "document.documentElement.scrollWidth>document.documentElement.clientWidth+1"
          );
          assert.equal(formOverflow, false, `Collection form overflowed at ${width}px.`);
          await page.screenshot(resolve(browserRoot, `staff-collection-form-errors-${width}.png`));
          await page.evaluate(
            `[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Cancel')?.click()`
          );
          await page.waitFor(
            `document.body.innerText.includes(${JSON.stringify(show.term)})`,
            `collection list after validation at ${width}px`
          );
        }
        const opened = await page.evaluate(`(() => {
          const row = [...document.querySelectorAll('tbody tr')].find((candidate) =>
            candidate.innerText.includes(${JSON.stringify(show.term)})
          );
          const view = row
            ? [...row.querySelectorAll('button')].find(
                (button) => button.textContent.trim() === 'View'
              )
            : undefined;
          view?.click();
          return Boolean(view);
        })()`);
        assert.equal(opened, true, `${show.name} View action was missing at ${width}px.`);
        await page.waitFor(
          `location.search.includes('view=')&&document.body.innerText.includes(${JSON.stringify(show.marker)})&&document.body.innerText.includes('Activity')&&document.body.innerText.includes('created')`,
          `${show.name} show with activity at ${width}px`,
          450
        );
        const showState = JSON.parse(
          (await page.evaluate(`JSON.stringify((() => ({
            activity: document.body.innerText.includes('Recent changes by staff users.'),
            overflow: document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
            showAction: document.body.innerText.includes(${JSON.stringify(
              show.name === "product"
                ? "Archive"
                : show.name === "collection"
                  ? "Unpublish"
                  : "Deactivate"
            )})
          }))())`)) as string
        ) as { activity: boolean; overflow: boolean; showAction: boolean };
        assert.equal(showState.activity, true, `${show.name} activity was missing at ${width}px.`);
        assert.equal(showState.showAction, true, `${show.name} action was missing at ${width}px.`);
        assert.equal(showState.overflow, false, `${show.name} show overflowed at ${width}px.`);
        await page.screenshot(resolve(browserRoot, `staff-${show.name}-show-${width}.png`));
      }
    }

    const productQuery = `q=${encodeURIComponent(`E2E Pagination ${runId}`)}&page=2&pageSize=20`;
    for (const width of [1440, 1024, 390]) {
      await page.send("Emulation.setDeviceMetricsOverride", {
        deviceScaleFactor: 1,
        height: width === 390 ? 844 : 900,
        mobile: width === 390,
        width
      });
      await loadStaffRoute(
        `${platformOrigin}/app/ecommerce/product-information?${productQuery}`,
        `document.readyState==='complete'&&document.body.innerText.includes('Total product: 130')&&document.body.innerText.includes('Showing 21 to 40 of 130')`,
        `staff product pagination at ${width}px`
      );
      const staffProduct = JSON.parse(
        (await page.evaluate(`JSON.stringify((() => ({
          hasPager: document.body.innerText.includes('Rows per page')&&document.body.innerText.includes('Showing 21 to 40 of 130'),
          overflow: document.documentElement.scrollWidth>document.documentElement.clientWidth+1
        }))())`)) as string
      ) as { hasPager: boolean; overflow: boolean };
      assert.equal(staffProduct.hasPager, true, `Staff product pager missing at ${width}px.`);
      assert.equal(staffProduct.overflow, false, `Staff product page overflowed at ${width}px.`);
      await page.screenshot(resolve(browserRoot, `staff-product-${width}.png`));
    }

    await page.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 900,
      mobile: false,
      width: 1440
    });
    await loadStaffRoute(
      `${platformOrigin}/app/ecommerce/product-information?${productQuery}`,
      `document.readyState==='complete'&&document.body.innerText.includes('Showing 21 to 40 of 130')`,
      "staff product page-size selector"
    );
    await page.evaluate(
      `document.querySelector('[role="combobox"]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}))`
    );
    await page.waitFor(
      `document.querySelectorAll('[role="option"]').length>=3`,
      "staff page-size options"
    );
    const pageSizeOptions = JSON.parse(
      (await page.evaluate(
        `JSON.stringify([...document.querySelectorAll('[role="option"]')].map((option)=>option.textContent.trim()))`
      )) as string
    ) as string[];
    assert.deepEqual([...pageSizeOptions].sort(), ["100", "20", "50"]);

    const variantQuery = `q=${encodeURIComponent(`E2E-PAGE-SKU-${runId}`)}&page=2&pageSize=20`;
    for (const width of [1440, 1024, 390]) {
      await page.send("Emulation.setDeviceMetricsOverride", {
        deviceScaleFactor: 1,
        height: width === 390 ? 844 : 900,
        mobile: width === 390,
        width
      });
      await loadStaffRoute(
        `${platformOrigin}/app/ecommerce/product-variants?${variantQuery}`,
        `document.readyState==='complete'&&document.body.innerText.includes('Total variant: 105')&&document.body.innerText.includes('Showing 21 to 40 of 105')`,
        `staff variant pagination at ${width}px`
      );
      const staffVariant = JSON.parse(
        (await page.evaluate(`JSON.stringify((() => ({
          hasPager: document.body.innerText.includes('Rows per page')&&document.body.innerText.includes('Showing 21 to 40 of 105'),
          overflow: document.documentElement.scrollWidth>document.documentElement.clientWidth+1
        }))())`)) as string
      ) as { hasPager: boolean; overflow: boolean };
      assert.equal(staffVariant.hasPager, true, `Staff variant pager missing at ${width}px.`);
      assert.equal(staffVariant.overflow, false, `Staff variant page overflowed at ${width}px.`);
      await page.screenshot(resolve(browserRoot, `staff-variant-${width}.png`));
    }

    await page.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 900,
      mobile: false,
      width: 1440
    });
    await loadStaffRoute(
      `${platformOrigin}/app/ecommerce/product-information?q=${encodeURIComponent(`E2E Pagination ${runId} 007`)}&page=9&pageSize=20`,
      `document.readyState==='complete'&&document.body.innerText.includes(${JSON.stringify(`E2E Pagination ${runId} 007`)})&&!document.body.innerText.includes('Rows per page')`,
      "staff single-row product page"
    );
    const staffNarrow = JSON.parse(
      (await page.evaluate(`JSON.stringify((() => ({
        hasPager: document.body.innerText.includes('Rows per page'),
        search: location.search
      }))())`)) as string
    ) as { hasPager: boolean; search: string };
    assert.equal(
      staffNarrow.hasPager,
      false,
      "Staff pager must hide at one hundred rows or fewer."
    );
    assert.equal(new URLSearchParams(staffNarrow.search).has("page"), false);
    assert.equal(new URLSearchParams(staffNarrow.search).has("pageSize"), false);
    await page.screenshot(resolve(browserRoot, "staff-single-row-1440.png"));
    console.log(`[e2e] fixture browser screenshots in ${browserRoot}`);
  } finally {
    await page?.send("Browser.close").catch(() => undefined);
    await control?.send("Browser.close").catch(() => undefined);
    browser.kill();
    await platformServer?.close();
    await server.close();
  }
}
