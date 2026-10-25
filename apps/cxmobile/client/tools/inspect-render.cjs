const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const distDir = path.resolve('dist/apps/cxmobile/client');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  let filePath = path.join(distDir, reqPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(distDir, 'index.html');
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(18099, '127.0.0.1', async () => {
  console.log('Preview server running on 18099');

  const userDataDir = path.resolve('dist/apps/cxmobile/.chrome-temp');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9223',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ]);

  // Wait for CDP port to open
  await new Promise((r) => setTimeout(r, 1500));

  try {
    // Create dedicated page target
    const newTabRes = await fetch('http://127.0.0.1:9223/json/new?http://127.0.0.1:18099/', { method: 'PUT' });
    const tabInfo = await newTabRes.json();
    console.log('Created page tab:', tabInfo);
    const wsUrl = tabInfo.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error('No webSocketDebuggerUrl on new tab');

    const WebSocket = require('ws');
    const ws = new WebSocket(wsUrl);

    let id = 1;
    const pending = new Map();

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.method === 'Console.messageAdded') {
        console.log('BROWSER CONSOLE:', msg.params.message.text);
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('CONSOLE API:', msg.params.type, msg.params.args.map((a) => a.value || a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('BROWSER EXCEPTION:', JSON.stringify(msg.params.exceptionDetails));
      }
      if (msg.method === 'Network.responseReceived') {
        const { url, status } = msg.params.response;
        if (status >= 400) {
          console.error(`NETWORK ERROR [${status}]:`, url);
        }
      }
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    });

    await new Promise((resolve) => ws.on('open', resolve));

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        pending.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await send('Console.enable');
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Network.enable');

    console.log('Waiting for application rendering...');

    // Poll for DOM content
    let rootHtml = '';
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const evalRes = await send('Runtime.evaluate', {
        expression: 'document.getElementById("root") ? document.getElementById("root").innerHTML : "NO_ROOT"'
      });
      rootHtml = evalRes.result?.result?.value || '';
      console.log(`Poll ${i} length:`, rootHtml.length);
      if (rootHtml.includes('auth-card') || rootHtml.includes('form') || rootHtml.length > 200) {
        console.log('Detected auth/app rendering!');
        break;
      }
    }

    console.log('Final Root HTML length:', rootHtml.length);
    console.log('Root HTML snippet:', rootHtml.slice(0, 400));

    // Capture screenshots for 320, 390, 430 viewports
    const viewports = [
      { name: '320', width: 320, height: 640 },
      { name: '390', width: 390, height: 844 },
      { name: '430', width: 430, height: 932 }
    ];

    for (const vp of viewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: true
      });
      await new Promise((r) => setTimeout(r, 500));
      const snapRes = await send('Page.captureScreenshot', { format: 'png' });
      const snapBuf = Buffer.from(snapRes.result.data, 'base64');
      const outPath = path.resolve(`dist/apps/cxmobile/candidates/cxmobile-viewport-${vp.name}.png`);
      fs.writeFileSync(outPath, snapBuf);
      console.log(`Captured ${vp.name} (${vp.width}x${vp.height}): ${snapBuf.length} bytes, Header: ${snapBuf.subarray(0, 8).toString('hex')}`);
    }

    ws.close();
  } catch (err) {
    console.error('CDP Error:', err);
  } finally {
    chromeProc.kill();
    server.close(() => {
      process.exit(0);
    });
  }
});
