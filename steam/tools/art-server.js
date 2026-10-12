// Serves tools/art.html on http://127.0.0.1:8790 and lets its "Save all" button write the PNGs into the project:
//   build/icon.png (app icon, 512x512) and art/achievements/*.png (64x64 Steamworks achievement icons).
// Usage: npm run art   (then open the address it prints)
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), web = path.join(root, '..'), PORT = 8790;   // serves the whole project (art.html reads ../src)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/save') {
    const name = u.searchParams.get('name') || '';
    if (!/^(build\/icon|art\/[a-z0-9_\-\/]+)\.png$/.test(name) || name.includes('..')) { res.writeHead(400); return res.end('bad name'); }
    let body = '';
    req.on('data', d => { body += d; if (body.length > 8e6) req.destroy(); });
    req.on('end', () => {
      const out = path.join(root, name);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, Buffer.from(body, 'base64'));
      console.log('saved', name);
      res.writeHead(200); res.end('ok');
    });
    return;
  }
  const file = path.join(web, decodeURIComponent(u.pathname === '/' ? '/steam/tools/art.html' : u.pathname));
  if (!file.startsWith(web) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log('art page: http://127.0.0.1:' + PORT + '/'));
