// Loads browser modules (classic scripts) into a node vm for quick logic tests.
// Usage: const ctx = require('./load.js')(['econ','data','ink','util','zones']); ctx.run('code')
const fs = require('fs'), vm = require('vm'), path = require('path');
module.exports = files => {
  const ctx = vm.createContext({ console, Math, JSON, Date, setTimeout, clearTimeout });
  ctx.window = ctx; ctx.globalThis = ctx;
  for (const f of files) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', f + '.js'), 'utf8')
      .replace(/^const ([A-Z_]+) =/gm, 'var $1 =');   // expose top-level module objects
    vm.runInContext(src, ctx, { filename: f + '.js' });
  }
  ctx.run = code => vm.runInContext(code, ctx);
  return ctx;
};
