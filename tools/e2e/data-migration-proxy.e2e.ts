import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const binary = process.env.CODEXSUN_TEST_NGINX_BINARY;
const templates = [
  [".container/codexsun-v1/nginx-web.conf", "/api/platform/probe", "/probe"],
  [".container/codexsun-v1/nginx-web.conf", "/api/app/probe", "/probe"]
] as const;

test(
  "production web proxies preserve Data sync and Data Bridge API routes instead of serving HTML",
  { skip: !binary },
  async () => {
    const upstream = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          success: true,
          data: {
            url: request.url,
            method: request.method,
            slot: request.headers["x-codexsun-session-slot"],
            cookie: request.headers.cookie,
            body: Buffer.concat(chunks).toString()
          }
        })
      );
    });
    upstream.listen(0, "127.0.0.1");
    await once(upstream, "listening");
    const address = upstream.address();
    assert.ok(address && typeof address !== "string");
    try {
      for (const [template, legacy, rewritten] of templates) {
        const source = await readFile(template, "utf8");
        await throughProxy(source, address.port, async (url) => {
          for (const path of [
            "/api/data-migration/sources",
            "/api/data-bridge/sources?sourceId=9",
            "/api/data-migration",
            "/api/data-bridge"
          ]) {
            const response = await fetch(url + path, {
              headers: {
                "x-codexsun-session-slot": "fixture-slot",
                cookie: "fixture-session=opaque"
              }
            });
            assert.match(response.headers.get("content-type")!, /application\/json/u, template);
            const body = await response.json();
            assert.equal(body.data.url, path, template);
            assert.equal(body.data.slot, "fixture-slot");
            assert.equal(body.data.cookie, "fixture-session=opaque");
          }
          const payload = JSON.stringify({ sourceId: 7 });
          const mutation = await fetch(url + "/api/data-bridge/connections/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: payload
          });
          const posted = (await mutation.json()).data;
          assert.equal(posted.body, payload);
          assert.equal(posted.method, "POST");
          assert.equal((await (await fetch(url + legacy)).json()).data.url, rewritten);
          assert.match(
            await (await fetch(url + "/sa/data-migration-settings")).text(),
            /codexsun-spa-fixture/u
          );
        });
      }
      const current = (await readFile(templates[0][0], "utf8")).replaceAll("\r\n", "\n");
      const original = current.replace(/\n  # These DevKits[\s\S]*?\n  \}\n/u, "\n");
      assert.notEqual(original, current, "The negative fixture must remove the API routing fix");
      await throughProxy(original, address.port, async (url) => {
        const response = await fetch(url + "/api/data-migration/sources");
        assert.match(await response.text(), /<!doctype html>/u);
      });
    } finally {
      await new Promise<void>((done) => upstream.close(() => done()));
    }
  }
);

async function throughProxy(
  template: string,
  upstreamPort: number,
  check: (url: string) => Promise<void>
) {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((done) => probe.close(() => done()));
  const directory = await mkdtemp(resolve("dist/.cache/verification/nginx-proxy-"));
  await mkdir(resolve(directory, "logs"));
  await mkdir(resolve(directory, "temp"));
  await mkdir(resolve(directory, "html"));
  for (const file of ["index.html", "app.html"])
    await writeFile(
      resolve(directory, "html", file),
      "<!doctype html><title>codexsun-spa-fixture</title>"
    );
  const server = template
    .replaceAll("${PLATFORM_API_PORT}", String(upstreamPort))
    .replaceAll("codexsun-api", "127.0.0.1")
    .replaceAll("platform-api", "127.0.0.1")
    .replace("listen 80;", `listen 127.0.0.1:${port};`)
    .replace(
      "root /usr/share/nginx/html;",
      `root "${resolve(directory, "html").replaceAll("\\", "/")}";`
    );
  await writeFile(
    resolve(directory, "nginx.conf"),
    `worker_processes 1; events { worker_connections 64; } http { ${server} }`
  );
  const prefix = directory.replaceAll("\\", "/") + "/";
  execFileSync(binary!, ["-p", prefix, "-c", "nginx.conf", "-t"], { windowsHide: true });
  const child = spawn(
    binary!,
    ["-p", prefix, "-c", "nginx.conf", "-g", "daemon off; master_process off;"],
    { windowsHide: true, stdio: "ignore" }
  );
  const closed = once(child, "close");
  try {
    const url = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        ready = (await fetch(url + "/health")).ok;
      } catch {}
      if (ready) break;
      await new Promise((done) => setTimeout(done, 50));
    }
    assert.ok(ready, "Local Nginx did not start");
    await check(url);
  } finally {
    child.kill();
    await closed;
  }
}
