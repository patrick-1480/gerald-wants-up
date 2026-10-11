// Bundles src/ into one self-contained HTML file (fonts still load from Google Fonts when online).
// Usage: node tools/build.js   ->  "Gerald Wants Up.html" in the project root
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = path.join(root, 'src');
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, f) =>
  '<style>\n' + fs.readFileSync(path.join(src, f), 'utf8') + '\n</style>');
let count = 0;
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, f) => {
  count++;
  const code = fs.readFileSync(path.join(src, f), 'utf8').split('</script').join('<\/script');
  return '<script>/* ' + f + ' */\n' + code + '\n</script>';
});
const out = path.join(root, 'Gerald Wants Up.html');
fs.writeFileSync(out, html);
console.log('built', out, (html.length / 1024).toFixed(0) + ' KB,', count, 'scripts inlined');
