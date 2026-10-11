// Builds tools/dev-stub.html: the real game page with placeholder DRAW/CINE (and WORLD if missing),
// so the core/UI can be tested before the art and cutscene modules exist.
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', 'src');
const has = f => { try { require('child_process').execSync('node --check "' + path.join(src, 'js', f) + '"', { stdio: 'ignore' }); return true; } catch (e) { return false; } };
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8')
  .replace(/href="css\//g, 'href="../src/css/').replace(/src="js\//g, 'src="../src/js/');
const stub = `<script>
if (typeof DRAW === "undefined") window.DRAW = {
  plant(c, p, o) { const g = o.grow || 1, w = o.wob || 0; c.strokeStyle = INK.C.ink; c.lineWidth = 3; c.scale(g * (1 + w * .2), g * (1 - w * .2));
    INK.blob(c, 0, 0, 26, 24, p.c1, true, p.seed); INK.blob(c, 0, -26, 14, 10, p.c2, true, p.seed + 1);
    for (let k = 0; k < p.eyes; k++) INK.eye(c, (k - (p.eyes - 1) / 2) * 13, -2, 6, o.look); INK.label(c, p.type, 0, 20, 10, "#fff"); },
  gerald(c, o) { c.strokeStyle = INK.C.ink; c.lineWidth = 3; INK.blob(c, 0, 0, 36, 30, "#6bd36b", true, 1); INK.eye(c, -13, -6, 10, o.look, { blink: o.blink }); INK.eye(c, 13, -6, 10, o.look, { blink: o.blink });
    INK.oval(c, 0, 14, 8, 2 + (o.spit || 0) * 8, "#5a1030", true); INK.label(c, o.hat || "", 0, -36, 12, "#ffd23f"); },
  hat() {}, bean(c, g) { c.strokeStyle = INK.C.ink; c.lineWidth = 2; INK.oval(c, 0, 0, 5, 7, g ? "#ffd23f" : "#b5763a", true); },
  sock(c) { c.strokeStyle = INK.C.ink; c.lineWidth = 2; INK.oval(c, 0, 0, 9, 15, "#ff7eb6", true); },
  bubble(c, r) { c.strokeStyle = INK.C.ink; c.lineWidth = 2; INK.oval(c, 0, 0, r, r, "rgba(190,230,255,.55)", true); INK.label(c, "$", 0, 6, 16, "#ffd23f"); },
  coin(c, r) { c.strokeStyle = INK.C.ink; c.lineWidth = 2; INK.oval(c, 0, 0, r, r, "#ffd23f", true); },
  visitor(c, v) { c.strokeStyle = INK.C.ink; c.lineWidth = 3; INK.blob(c, 0, 0, 30, 30, v.col, true, 3); INK.label(c, v.body, 0, 5, 12, "#000"); },
  worm(c) {}, moonFace(c, r) { c.strokeStyle = INK.C.ink; c.lineWidth = 3; INK.oval(c, 0, 0, r, r, "#fff3c4", true); },
  portrait(c, k, s) { c.strokeStyle = INK.C.ink; c.lineWidth = 3; INK.oval(c, 0, 0, s * .4, s * .4, "#ff9fb0", true); INK.label(c, k, 0, 5, 12, "#000"); },
};
if (typeof CINE === "undefined") window.CINE = { active: false, play(id, p, cb) { console.log("[stub CINE]", id, p && p.zone ? p.zone.name : ""); setTimeout(() => cb && cb(), 0); } };
if (typeof WORLD === "undefined") window.WORLD = {
  sky(c, W, H, alt) { const z = ZONES.get(ECON.zoneOf(Math.max(0, alt))), g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, z.sky[0]); g.addColorStop(1, z.sky[1]); c.fillStyle = g; c.fillRect(0, 0, W, H); },
  ground(c, v) { const y = v.toY(0), t = v.toY(G.S.mtn * v.gap); c.fillStyle = "#6b4226"; c.fillRect(0, y, v.W, v.H); c.fillRect(v.cx - 160, t, 320, y - t); },
  landmarks() {}, overlay() {},
};
<\/script>`;
html = html.replace('<script src="../src/js/state.js"></script>', stub + '\n<script src="../src/js/state.js"></script>');
for (const f of ['draw.js', 'cutscene.js', 'world.js']) if (!has(f)) html = html.replace('<script src="../src/js/' + f + '"></script>', '<!-- ' + f + ' missing or broken: stubbed -->');
const v = Date.now().toString(36);   // cache-buster so edits show up on reload
html = html.replace(/(src|href)="(\.\.\/src\/[^"]+\.(js|css))"/g, (m, k, f) => k + '="' + f + '?v=' + v + '"');
fs.writeFileSync(path.join(__dirname, 'dev-stub.html'), html);
console.log('wrote tools/dev-stub.html');
