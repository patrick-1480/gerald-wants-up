// Release build: bundles src/ into ONE protected HTML file.
//   - every module is wrapped in a single closure, so nothing (money, socks, the save code...) can be reached
//     from the browser console
//   - all code is minified (terser); the anti-cheat and save modules are also obfuscated (javascript-obfuscator)
//   - BUILD_TIME is baked in (old unsealed saves are only accepted by builds made before 15 Nov 2026)
// Output: public/index.html (what the website serves) and "Gerald Wants Up.html" (shareable copy).
// Usage: npm install (once), then  npm run build   (or node tools/build.js)
// tools/build.js is also used by steam/tools/sync.js through bundle().
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = path.join(root, 'src');
const OBFUSCATE = { 'js/guard.js': 'g', 'js/state.js': 's' };      // file -> unique prefix for its helper names

function scripts() {
  const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
}
function obfuscate(code, prefix) {
  const JO = require('javascript-obfuscator');
  return JO.obfuscate(code, {
    compact: true, target: 'browser', renameGlobals: false, identifiersPrefix: '_' + prefix,
    identifierNamesGenerator: 'mangled-shuffled', stringArray: true, stringArrayEncoding: ['base64'],
    stringArrayThreshold: 1, stringArrayRotate: true, stringArrayShuffle: true, splitStrings: true,
    splitStringsChunkLength: 5, numbersToExpressions: true, transformObjectKeys: true, simplify: true,
    controlFlowFlattening: true, controlFlowFlatteningThreshold: 0.6, deadCodeInjection: false, selfDefending: false,
  }).getObfuscatedCode();
}
/* one closure with every module inside; extra = [{ before: 'js/main.js', file: '/abs/path.js' }] */
async function bundle(opts = {}) {
  const list = scripts();
  for (const x of opts.extra || []) list.splice(list.indexOf(x.before), 0, x.file);
  let out = 'var BUILD_TIME = ' + Date.now() + ', ECON;\n';
  for (const f of list) {
    let code = fs.readFileSync(path.isAbsolute(f) ? f : path.join(src, f), 'utf8');
    code = code.replace(/^const ([A-Za-z_$][\w$]*) =/gm, 'var $1 =');   // var: no temporal-dead-zone surprises
    if (f === 'js/econ.js') code = code.replace('root.ECON = E;', 'ECON = E;');   // keep ECON private too
    if (OBFUSCATE[f]) code = obfuscate(code, OBFUSCATE[f]);
    out += '/* ' + path.basename(f) + ' */\n' + code + '\n;\n';
  }
  out = '(function () {\n' + out + '})();';
  const { minify } = require('terser');
  const r = await minify(out, { ecma: 2020, compress: { passes: 2 }, mangle: true, format: { comments: false } });
  return r.code;
}
async function main() {
  let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, f) => '<style>\n' + fs.readFileSync(path.join(src, f), 'utf8') + '\n</style>');
  const js = await bundle();
  let first = true;
  html = html.replace(/\s*<script src="[^"]+"><\/script>/g, () => {
    if (!first) return '';
    first = false;
    return '\n<script>' + js.split('</script').join('<\/script') + '</script>';
  });
  fs.mkdirSync(path.join(root, 'public'), { recursive: true });
  for (const out of [path.join(root, 'public', 'index.html'), path.join(root, 'Gerald Wants Up.html')]) fs.writeFileSync(out, html);
  console.log('built public/index.html and "Gerald Wants Up.html":', (html.length / 1024).toFixed(0) + ' KB (' + (js.length / 1024).toFixed(0) + ' KB protected code)');
}
module.exports = { bundle, scripts };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
