// CS2Freitag Zero-Dependency Node.js Server
const http = require('http');
const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../offline');
const ports = [8000, 8080, 8888, 3001];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  
  let filePath = path.join(targetDir, reqPath);
  
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(targetDir, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

function tryListen(index) {
  if (index >= ports.length) {
    console.error('Kein freier Port gefunden.');
    process.exit(1);
  }
  const p = ports[index];
  const s = server.listen(p, () => {
    const url = `http://localhost:${p}/`;
    console.log(`CS2Freitag Server laeuft unter: ${url}`);
    try {
      const { exec } = require('child_process');
      if (process.platform === 'win32') exec(`start ${url}`);
      else if (process.platform === 'darwin') exec(`open ${url}`);
      else exec(`xdg-open ${url}`);
    } catch (e) {}
  });
  s.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      tryListen(index + 1);
    } else {
      console.error(err);
      process.exit(1);
    }
  });
}

tryListen(0);
