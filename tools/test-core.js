// Headless smoke test of the game core (econ/state/quests/game) with stubbed art/audio/UI.
const load = require('./load.js');
const c = load(['econ', 'data', 'ink', 'util', 'zones', 'state']);
c.run(`
var document = { getElementById: () => null };
var localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
var SFX = { play() {}, music() {}, init() {}, setVolume() {}, setMusicOn() {}, duck() {} };
var matchMedia = () => ({ matches: false });
var UI = { toast() {}, hint() {}, bump() {}, refreshAll() {}, refreshMenu() {} };
var CINE = { active: false, log: [], play(id, p, cb) { if (p && p.zone) this.log.push(p.zone.k + '@' + (G.T / 60).toFixed(0) + 'm'); cb && cb(); } };
var TUT = { active: false };
var DRAW = {}, WORLD = {};
var G = { S: STATE.fresh(), T: 0, W: 900, H: 700, vW: 900, vH: 700, zoom: 1, cam: 0, mouse: { x: 0, y: 0, in: false }, follow: true };
`);
for (const f of ['quests', 'game']) c.run(require('fs').readFileSync(__dirname + '/../src/js/' + f + '.js', 'utf8').replace(/^const ([A-Z_]+) =/gm, 'var $1 ='));
c.run(`
const S = G.S; S.flags.tut = 1; GAME.refreshPay();
let t = 0, lastGrow = 0, dt = 0.05, log = [];
const minutes = ${+process.argv[2] || 60};
while (t < minutes * 60) {
  GAME.step(dt); QUESTS.update(dt); t += dt; G.T = t;
  if (Math.round(t / dt) % 20 === 0) {             // ~ every second: act like a player
    for (const k in S.bk) if (S.bk[k] > 0) GAME.collect(+k, 0, 0, true);
    if (Math.random() < 0.5 && GAME.socks.length) { S.soc += ECON.sockVal(S); S.stats.socks++; GAME.socks.shift(); }
    if (GAME.visitors.length && Math.random() < 0.3) { const o = GAME.visitors.shift(); GAME.reward(o.v.rw, 0, 0); S.stats.visitors++; }
    for (let k = 0; k < 400; k++) {
      if (S.m >= ECON.spC(S, S.n) * 1.0) { GAME.grow(true); lastGrow = t; continue; }
      const [i, cc] = GAME.cheapestUp(); if (i < 0 || S.m < cc * 3) break;
      GAME.upgrade(i, 0);
    }
    for (const d of ECON.SHOP) { const l = ECON.shopL(S, d.id); if (l < d.max && S.m > ECON.shopCost(S, d, l) * 4) GAME.buyShop(d); }
    for (const q of S.quests.slice()) if (q.done) QUESTS.claim(q.id);
    for (const d of ECON.PERKS) { const l = ECON.perkL(S, d.id); if (l < d.max && S.mu >= ECON.cost(d, l)) GAME.buyPerk(d); }
    if (ECON.mulchGain(S) >= 1 && t - lastGrow > 90) { log.push('compost@' + (t/60).toFixed(1) + 'm n=' + S.n + ' alt=' + ECON.alt(S)); GAME.compost(); lastGrow = t; }
  }
  if (!isFinite(S.m) || isNaN(S.m)) { console.log('BAD MONEY at', t); break; }
}
console.log('time', minutes, 'min | zone', S.zone, '| alt', ECON.alt(S), '| n', S.n, '| mtn', S.mtn, '| money', U.money(S.m), '| socks', S.soc, '| quests done', S.stats.quests);
console.log('cines', CINE.log.join(' '));
console.log(log.slice(0, 12).join(' | '));
console.log('relics', Object.keys(S.relics).join(','), '| hats', Object.keys(S.hats).join(','));
console.log('active quests', S.quests.map(q => q.t + ':' + Math.floor(QUESTS.progress(q)) + '/' + q.n + (q.sp !== undefined ? '(sp' + q.sp + ')' : '')).join(' '));
console.log('beans in flight', GAME.beans.length, 'stats', JSON.stringify(S.stats));
`);
