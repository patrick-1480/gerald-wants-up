// Builds the Steam copy of the game into app/ from the web game (../src) plus the Steam-only files in src/:
//   - all game code + src/steam.js go into ONE protected file, app/js/game.js (same closure/minify/obfuscation as
//     the website build, see ../tools/build.js), so nothing can be reached or changed from outside
//   - index.html is re-made from the web one: Google Fonts removed (fonts are bundled, works offline),
//     a strict Content-Security-Policy, css/steam.css added
// Run it whenever the web version changes:  npm run sync   (npm run dist does it automatically)
// Needs the web build tools once:  cd ..  then  npm install
const fs = require('fs'), path = require('path');
const steam = path.join(__dirname, '..'), web = path.join(steam, '..', 'src'), app = path.join(steam, 'app');
let build;
try { build = require(path.join(steam, '..', 'tools', 'build.js')); require.resolve('terser', { paths: [path.join(steam, '..')] }); }
catch (e) { console.error('The web build tools are missing: run  npm install  in ' + path.join(steam, '..')); process.exit(1); }

(async () => {
  fs.rmSync(app, { recursive: true, force: true });
  for (const d of ['js', 'css', 'fonts']) fs.mkdirSync(path.join(app, d), { recursive: true });
  fs.writeFileSync(path.join(app, 'js', 'game.js'), await build.bundle({ extra: [{ before: 'js/main.js', file: path.join(steam, 'src', 'steam.js') }] }));
  fs.copyFileSync(path.join(web, 'css', 'style.css'), path.join(app, 'css', 'style.css'));
  fs.copyFileSync(path.join(steam, 'src', 'steam.css'), path.join(app, 'css', 'steam.css'));
  for (const [pkg, f] of [['chewy', 'chewy-latin-400-normal.woff2'], ['gaegu', 'gaegu-latin-400-normal.woff2'], ['gaegu', 'gaegu-latin-700-normal.woff2']])
    fs.copyFileSync(path.join(steam, 'node_modules', '@fontsource', pkg, 'files', f), path.join(app, 'fonts', f));

  let html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
  html = html.replace(/\s*<link rel="preconnect"[^>]*>/g, '').replace(/\s*<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g, '');
  html = html.replace(/<meta name="(mobile-web-app-capable|apple-[^"]+)"[^>]*>\s*/g, '');
  html = html.replace('<link rel="stylesheet" href="css/style.css">', '<link rel="stylesheet" href="css/steam.css">\n<link rel="stylesheet" href="css/style.css">');
  let first = true;
  html = html.replace(/\s*<script src="[^"]+"><\/script>/g, () => (first ? ((first = false), '\n<script src="js/game.js"></script>') : ''));
  html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; media-src \'self\' data: blob:; font-src \'self\' data:; connect-src \'none\'">');
  if (!html.includes('js/game.js') || !html.includes('css/steam.css')) throw new Error('index.html layout changed: update tools/sync.js');
  fs.writeFileSync(path.join(app, 'index.html'), html);
  console.log('built app/ (protected game.js ' + (fs.statSync(path.join(app, 'js', 'game.js')).size / 1024).toFixed(0) + ' KB)');
})().catch(e => { console.error(e); process.exit(1); });
