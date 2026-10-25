const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

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
  const viewports = [
    { name: '320', width: 320, height: 640 },
    { name: '390', width: 390, height: 844 },
    { name: '430', width: 430, height: 932 }
  ];

  try {
    for (const vp of viewports) {
      const outPath = path.resolve(`dist/apps/cxmobile/candidates/cxmobile-viewport-${vp.name}.png`).replace(/\//g, '\\');
      const cmd = `"${chromePath}" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=${vp.width},${vp.height} "--screenshot=${outPath}" http://127.0.0.1:18099/`;
      await execAsync(cmd);
      const buf = fs.readFileSync(outPath);
      console.log(`Viewport ${vp.name} (${vp.width}x${vp.height}): ${buf.length} bytes, Header: ${buf.subarray(0, 8).toString('hex')}`);
    }
    console.log('All responsive screenshots captured successfully.');
  } catch (err) {
    console.error('Error capturing screenshot:', err);
  } finally {
    server.close(() => {
      process.exit(0);
    });
  }
});
