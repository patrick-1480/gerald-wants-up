// Clones the web game (../src) into app/ and applies the Steam changes.
//   - every shared game file is copied over (js/, css/style.css, ...)
//   - index.html is re-made from the web one: Google Fonts links removed (fonts are bundled, the game
//     works offline), css/steam.css + js/steam.js added
//   - Steam-only files are never touched: app/js/steam.js, app/css/steam.css, app/fonts/
// Run it whenever the web version changes:  npm run sync
const fs = require('fs'), path = require('path');
const steam = path.join(__dirname, '..'), web = path.join(steam, '..', 'src'), app = path.join(steam, 'app');
const STEAM_ONLY = new Set(['js/steam.js', 'css/steam.css']);
let n = 0;
function copyDir(from, to, rel = '') {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { copyDir(path.join(from, e.name), path.join(to, e.name), r); continue; }
    if (r === 'index.html' || STEAM_ONLY.has(r)) continue;
    fs.copyFileSync(path.join(from, e.name), path.join(to, e.name)); n++;
  }
}
copyDir(web, app);

// bundled fonts (OFL), from the @fontsource packages
const fonts = path.join(app, 'fonts');
fs.mkdirSync(fonts, { recursive: true });
for (const [pkg, f] of [['chewy', 'chewy-latin-400-normal.woff2'], ['gaegu', 'gaegu-latin-400-normal.woff2'], ['gaegu', 'gaegu-latin-700-normal.woff2']]) {
  const src = path.join(steam, 'node_modules', '@fontsource', pkg, 'files', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(fonts, f));
  else if (!fs.existsSync(path.join(fonts, f))) console.warn('missing font', f, '(run npm install)');
}

let html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
html = html.replace(/\s*<link rel="preconnect"[^>]*>/g, '').replace(/\s*<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g, '');
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<link rel="stylesheet" href="css/steam.css">\n<link rel="stylesheet" href="css/style.css">');
html = html.replace('<script src="js/main.js"></script>', '<script src="js/steam.js"></script>\n<script src="js/main.js"></script>');
html = html.replace(/<meta name="(mobile-web-app-capable|apple-[^"]+)"[^>]*>\s*/g, '');
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; media-src \'self\' data: blob:; font-src \'self\' data:">');
if (!html.includes('js/steam.js') || !html.includes('css/steam.css')) throw new Error('index.html layout changed: patch tools/sync.js');
fs.writeFileSync(path.join(app, 'index.html'), html);
console.log('synced', n, 'files from ../src into app/ (+ index.html patched for Steam)');
