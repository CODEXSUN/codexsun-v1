/**
 * EC storefront browser verification (desktop / tablet / phone).
 *
 * Drives the locally installed Chrome over CDP (the repository has no Playwright/Puppeteer
 * dependency) against the running Ecommerce storefront dev server, and records for each measure:
 * horizontal overflow, broken images, client-rendered heading/title, and a full-page screenshot.
 * It also proves what a crawler receives without JavaScript, which is the EC-D05 SEO limit.
 *
 * Prerequisites: the Platform API (7010) and the Ecommerce storefront dev server (7030) are running.
 * Run: node tools/e2e/ecommerce-storefront-browser.e2e.mjs
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const origin = process.env.ECOM_BROWSER_ORIGIN ?? "http://127.0.0.1:7030";
const outputDirectory = resolve(`dist/ecommerce-scratch/browser`);
const profileDirectory = resolve(`dist/.cache/ecommerce-browser-${Date.now()}`);
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const delay = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));
const widths = [
  { height: 1000, label: "desktop-1440", mobile: false, width: 1440 },
  { height: 1024, label: "tablet-768", mobile: false, width: 768 },
  { height: 844, label: "phone-390", mobile: true, width: 390 },
  { height: 800, label: "phone-320", mobile: true, width: 320 }
];

class Page {
  constructor(socket) {
    this.socket = socket;
    this.sequence = 0;
    this.pending = new Map();
    this.exceptions = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") {
        this.exceptions.push(message.params?.exceptionDetails?.text ?? "runtime exception");
      }
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((done, reject) => {
      socket.addEventListener("open", done, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new Page(socket);
  }

  send(method, params = {}) {
    const id = ++this.sequence;
    return new Promise((done, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Browser command timed out: ${method}`));
      }, 20000);
      this.pending.set(id, { reject, resolve: done, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      awaitPromise: true,
      expression,
      returnByValue: true
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description ?? "Browser script failed.");
    }
    return response.result.value;
  }

  async waitFor(expression, label, attempts = 150) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (await this.evaluate(expression).catch(() => false)) return;
      await delay(200);
    }
    await this.screenshot(resolve(outputDirectory, "failure.png")).catch(() => undefined);
    throw new Error(`Browser did not show ${label}.`);
  }

  async screenshot(path) {
    const result = await this.send("Page.captureScreenshot", {
      captureBeyondViewport: true,
      format: "png"
    });
    await writeFile(path, Buffer.from(result.data, "base64"));
  }
}

async function bootstrapProduct() {
  const response = await fetch(`${origin}/api/platform/storefront/bootstrap`, {
    headers: { host: "localhost" }
  });
  if (!response.ok) return null;
  const body = await response.json();
  const catalog = body?.data?.catalog ?? [];
  const expectedSlug = process.env.ECOM_BROWSER_PRODUCT_SLUG;
  if (expectedSlug) {
    const expected = catalog.find((item) => item.slug === expectedSlug);
    if (!expected) throw new Error(`Fixture product "${expectedSlug}" is not published.`);
    return expected;
  }
  return catalog[0] ?? null;
}

const waitForImages = (page, label) =>
  page.waitFor(
    `document.readyState==='complete'&&[...document.images].every((image)=>image.complete||!image.currentSrc)`,
    `${label} images`
  );

const imageMetrics = `(() => {
  const images = [...document.images];
  return {
    brokenImages: images.filter((image) => image.currentSrc && (!image.complete || image.naturalWidth === 0)).map((image) => image.currentSrc),
    imageCount: images.length,
    loadedImages: images.filter((image) => image.currentSrc && image.complete && image.naturalWidth > 0).length
  };
})()`;

await mkdir(outputDirectory, { recursive: true });
await mkdir(profileDirectory, { recursive: true });
const fixtureProduct = await bootstrapProduct().catch((error) => {
  if (process.env.ECOM_BROWSER_PRODUCT_SLUG) throw error;
  return null;
});
const slug = fixtureProduct?.slug ?? null;
const requireFixtures = process.env.ECOM_BROWSER_REQUIRE_FIXTURES === "1";
if (requireFixtures && !slug) {
  throw new Error("ECOM_BROWSER_REQUIRE_FIXTURES=1 requires a published fixture product.");
}
const browser = spawn(
  chrome,
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    `--user-data-dir=${profileDirectory}`,
    "--remote-debugging-port=0",
    "about:blank"
  ],
  { stdio: "ignore", windowsHide: true }
);

let control;
let page;
const measurements = [];
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      port = Number(
        (await readFile(`${profileDirectory}/DevToolsActivePort`, "utf8")).split("\n")[0]
      );
      if (port) break;
    } catch {
      /* The port file appears once Chrome is ready. */
    }
    await delay(150);
  }
  if (!port) throw new Error("Chrome did not start or expose a debugging port.");
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  control = await Page.connect(version.webSocketDebuggerUrl);
  const { targetId } = await control.send("Target.createTarget", { url: "about:blank" });
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  page = await Page.connect(targets.find((target) => target.id === targetId).webSocketDebuggerUrl);
  await page.send("Page.enable");
  await page.send("Runtime.enable");

  for (const viewport of widths) {
    await page.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: viewport.height,
      mobile: viewport.mobile,
      width: viewport.width
    });
    await page.send("Page.navigate", { url: `${origin}/shop` });
    await page.waitFor(
      `document.readyState==='complete'&&Boolean(document.querySelector('.cx-store main'))`,
      `the shop page at ${viewport.width}px`
    );
    await waitForImages(page, `${viewport.label} shop`);
    await delay(1200);
    const metrics = await page.evaluate(`(() => {
      const images = [...document.images];
      return {
        brokenImages: images.filter((image) => image.currentSrc && (!image.complete || image.naturalWidth === 0)).map((image) => image.currentSrc),
        clientWidth: document.documentElement.clientWidth,
        heading: document.querySelector('h1,h2')?.textContent?.trim().slice(0, 120) ?? '',
        imageCount: images.length,
        loadedImages: images.filter((image) => image.currentSrc && image.complete && image.naturalWidth > 0).length,
        scrollWidth: document.documentElement.scrollWidth,
        textLength: document.body.innerText.trim().length,
        title: document.title
      };
    })()`);
    await page.screenshot(resolve(outputDirectory, `shop-${viewport.label}.png`));
    const record = { ...viewport, ...metrics, path: "/shop" };
    measurements.push(record);
    assert.equal(
      metrics.scrollWidth <= metrics.clientWidth + 1,
      true,
      `${viewport.label}: horizontal overflow (${metrics.scrollWidth} > ${metrics.clientWidth}).`
    );
    assert.deepEqual(metrics.brokenImages, [], `${viewport.label}: broken images rendered.`);
    assert.ok(metrics.heading.length > 0, `${viewport.label}: the shop page rendered no heading.`);
    assert.equal(
      metrics.loadedImages,
      metrics.imageCount,
      `${viewport.label}: not every rendered image finished loading.`
    );
    if (requireFixtures) {
      assert.ok(metrics.imageCount > 0, `${viewport.label}: fixture acceptance requires images.`);
    }
    console.log(
      `PASS: /shop ${viewport.label} rendered (${metrics.imageCount} images, ${metrics.textLength} chars, no overflow).`
    );
  }

  // Cart page on the narrowest phone width. `/cart` is the storefront route; `/shop/cart` is not
  // an alias and would silently render the catalog instead (EC-R03).
  await page.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height: 800,
    mobile: true,
    width: 320
  });
  await page.send("Page.navigate", { url: `${origin}/cart` });
  await page.waitFor(
    `document.readyState==='complete'&&Boolean(document.querySelector('main.cx-cart'))`,
    "the cart page"
  );
  await waitForImages(page, "cart");
  await delay(1000);
  const cart = await page.evaluate(`(() => ({
    clientWidth: document.documentElement.clientWidth,
    hasCartItems: Boolean(document.querySelector('[aria-label="Cart items"]')),
    hasEmptyState: Boolean(document.querySelector('.cx-cart__empty')),
    heading: document.querySelector('.cx-cart h1')?.textContent?.trim() ?? '',
    path: window.location.pathname,
    scrollWidth: document.documentElement.scrollWidth,
    textLength: document.body.innerText.trim().length
  }))()`);
  await page.screenshot(resolve(outputDirectory, "cart-phone-320.png"));
  measurements.push({ label: "cart-phone-320", path: "/cart", width: 320, ...cart });
  assert.equal(cart.path, "/cart", `Cart route identity changed: ${cart.path}`);
  assert.equal(cart.heading, "Shopping cart", "The cart page rendered a different heading.");
  assert.equal(
    cart.hasCartItems || cart.hasEmptyState,
    true,
    "The cart page rendered neither cart items nor its empty state."
  );
  assert.equal(cart.scrollWidth <= cart.clientWidth + 1, true, "cart 320: horizontal overflow.");
  console.log("PASS: /cart rendered its cart-specific heading and state at 320px.");

  if (slug) {
    await page.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 900,
      mobile: false,
      width: 1440
    });
    await page.send("Page.navigate", { url: `${origin}/shop/product/${slug}` });
    await page.waitFor(
      `document.readyState==='complete'&&Boolean(document.querySelector('main.cx-detail'))`,
      "the product page"
    );
    await waitForImages(page, "product");
    await delay(1200);
    const product = await page.evaluate(`(() => {
      const images = [...document.images];
      const hero = document.querySelector('.cx-detail__image img');
      return {
        brokenImages: images.filter((image) => image.currentSrc && (!image.complete || image.naturalWidth === 0)).map((image) => image.currentSrc),
        clientWidth: document.documentElement.clientWidth,
        heading: document.querySelector('.cx-detail h1')?.textContent?.trim() ?? '',
        heroLoaded: Boolean(hero && hero.complete && hero.naturalWidth > 0),
        heroObjectFit: hero ? getComputedStyle(hero).objectFit : '',
        imageCount: images.length,
        scrollWidth: document.documentElement.scrollWidth,
        title: document.title
      };
    })()`);
    await page.screenshot(resolve(outputDirectory, "product-desktop-1440.png"));
    measurements.push({
      label: "product-desktop-1440",
      path: `/shop/product/${slug}`,
      width: 1440,
      ...product
    });
    assert.deepEqual(product.brokenImages, [], "product page: broken images rendered.");
    assert.equal(
      product.heading,
      String(fixtureProduct?.name ?? product.heading),
      "The product page did not render the expected product identity."
    );
    assert.equal(product.heroLoaded, true, "The product hero image did not load.");
    assert.equal(
      product.heroObjectFit,
      "contain",
      "The product image is cropped instead of contained."
    );
    assert.equal(
      product.scrollWidth <= product.clientWidth + 1,
      true,
      "product 1440: horizontal overflow."
    );
    console.log(`PASS: /shop/product/${slug} rendered its exact product identity at 1440px.`);
  } else {
    console.log(
      "LIMIT: no published product slug was returned by bootstrap; product page not visited."
    );
  }

  // Raw HTML (no JavaScript) is what a crawler receives today.
  const raw = await fetch(`${origin}/shop`).then((response) => response.text());
  const rawTitle = /<title>([^<]*)<\/title>/u.exec(raw)?.[1]?.trim() ?? "";
  const rawDescription =
    /<meta\s+name="description"\s+content="([^"]*)"/u.exec(raw)?.[1]?.trim() ?? "";
  const rawHasProductHeading = /<h1[^>]*>\s*\S/u.test(raw);
  await writeFile(
    resolve(outputDirectory, "raw-html-check.json"),
    JSON.stringify({ rawDescription, rawHasProductHeading, rawTitle }, null, 2)
  );
  console.log(
    `RAW_HTML title=${JSON.stringify(rawTitle)} description=${JSON.stringify(rawDescription)} productHeading=${rawHasProductHeading}`
  );
  // EC-D05 remains deferred: a client-only shell is recorded as a limit, never as an SEO pass.
  console.log(
    rawHasProductHeading
      ? "SEO: raw HTML contains a server-rendered heading; re-run the EC-D05 rendering contract review."
      : "SEO_LIMIT: raw HTML is the static SPA shell; no raw-HTML metadata contract is implemented (EC-D05 deferred)."
  );

  await writeFile(
    resolve(outputDirectory, "summary.json"),
    JSON.stringify({ measurements, pageExceptions: page.exceptions, slug }, null, 2)
  );
  assert.deepEqual(page.exceptions, [], "The browser reported uncaught runtime exceptions.");
  console.log(`PASS: browser verification complete; screenshots in ${outputDirectory}`);
} finally {
  await page?.send("Browser.close").catch(() => undefined);
  await control?.send("Browser.close").catch(() => undefined);
  browser.kill();
}
