// Balance simulator: a greedy bot plays the real economy (src/js/econ.js).
// Usage: node tools/sim.js [hours] [stagnationSeconds]
const E = require('../src/js/econ.js');
const HOURS = +process.argv[2] || 8, STAG = +process.argv[3] || 75;
const fresh = () => ({ m: 0, run: 0, n: 1, lv: {}, shop: {}, perk: {}, relics: {}, mtn: 0, zone: 0, tm: 0, mu: 0, cc: 0, u: 0, caps: {} });
const S = fresh();
let t = 0, lastBuyNew = 0, runStart = 0;
const reached = { 0: 0 }, plantTimes = {};
const runs = [];
const fmt = s => (s / 60).toFixed(1) + 'm';
function bestBuy() {
  const ips = E.ips(S), opts = [];
  // new plant (weighted: future upgrade potential)
  opts.push({ k: 'new', c: E.spC(S, S.n), v: E.pay(S, S.n) * E.beanX(S) * E.goldAvg(S) / E.spitInt(S) * 3 });
  for (let i = 0; i < S.n; i++) {
    const l = S.lv[i] || 0; if (l >= E.cap(S, i)) continue;
    const d = E.pay(S, i) * (E.K.lp * ((l + 1) % E.K.ms === 0 ? 2 : 1) - 1) * E.beanX(S) * E.goldAvg(S) / E.spitInt(S);
    opts.push({ k: 'up', i, c: E.upC(S, i, l), v: d });
  }
  for (const d of E.SHOP) {
    const l = S.shop[d.id] || 0; if (l >= d.max) continue;
    let v = 0;
    if (d.id === 'spit') { S.shop.spit = l + 1; v = E.ips(S) - ips; S.shop.spit = l; }
    if (d.id === 'gold') { S.shop.gold = l + 1; v = E.ips(S) - ips; S.shop.gold = l; }
    if (d.id === 'cheap') v = ips * 0.05;
    if (v > 0) opts.push({ k: 'shop', id: d.id, c: E.shopCost(S, d, l), v });
  }
  opts.forEach(o => o.r = o.v / o.c);
  opts.sort((a, b) => b.r - a.r);
  return opts[0];
}
function spendMulch() {
  const order = ['pay', 'head', 'worm', 'spit2', 'dirt', 'pay', 'pay', 'gold2', 'shop'];
  let bought = true;
  while (bought) {
    bought = false;
    for (const id of order) {
      const d = E.PERKS.find(p => p.id === id), l = S.perk[id] || 0;
      if (l < d.max && S.mu >= E.cost(d, l)) { S.mu -= E.cost(d, l); S.perk[id] = l + 1; bought = true; }
    }
  }
}
const dt = 0.5;
while (t < HOURS * 3600) {
  const inc = E.ips(S) * dt; S.m += inc; S.run += inc; t += dt;
  for (let g = 0; g < 50; g++) {
    const b = bestBuy();
    if (!b || S.m < b.c) break;
    S.m -= b.c;
    if (b.k === 'new') { S.n++; lastBuyNew = t; if (S.cc === 0) plantTimes[S.n] = t; }
    else if (b.k === 'up') S.lv[b.i] = (S.lv[b.i] || 0) + 1;
    else S.shop[b.id] = (S.shop[b.id] || 0) + 1;
  }
  const z = E.zoneOf(E.alt(S));
  if (z > S.zone) { for (let k = S.zone + 1; k <= z; k++) reached[k] = t; S.zone = z; }
  const sh = E.needShift(S); if (sh) { S.u += sh; S.m /= 10 ** sh; S.run /= 10 ** sh; }
  const g = E.mulchGain(S);
  if (g >= 1 && t - lastBuyNew > STAG) {
    runs.push({ t: fmt(t), len: fmt(t - runStart), n: S.n, mtn: S.mtn, gain: g, alt: E.alt(S), z: S.zone, lm: +Math.log10(E.mulchMult(S)).toFixed(1), lp: +Math.log10(1.5 ** E.perkL(S, 'pay')).toFixed(1), lmt: +Math.log10(E.mtnMult(S)).toFixed(1), lz: +Math.log10(E.zoneMult(S)).toFixed(1), sp: +E.spitInt(S).toFixed(2), bx: +E.beanX(S).toFixed(1), top: S.lv[S.n-1]||0, lv0: S.lv[0]||0 });
    for (let i = 0; i < S.n; i++) S.caps[i] = (S.caps[i] || 0) + 1;
    S.lastN = S.n;
    S.mu += g; S.tm += g; S.cc++; S.mtn += E.mtnGain(S);
    S.m = 0; S.run = 0; S.lv = {}; S.shop = {}; S.n = E.headStart(S);
    spendMulch(); runStart = t; lastBuyNew = t;
  }
}
console.log('First run plant times:', Object.entries(plantTimes).map(([n, s]) => n + '@' + fmt(s)).join(' '));
console.log('Zones reached:');
for (const k in reached) console.log('  zone', k, 'at', E.zoneAt(+k), 'slots ->', fmt(reached[k]));
console.log('Runs (first 40):');
runs.slice(0, 40).forEach((r, i) => console.log('  #' + (i + 1), JSON.stringify(r)));
console.log('total composts', runs.length, 'final alt', E.alt(S), 'tm', S.tm, 'perks', JSON.stringify(S.perk));
// summary line for sweeps
const z1 = reached[1], z14 = reached[14];
console.log('SUMMARY clouds', z1 && fmt(z1), 'moon', reached[6] && fmt(reached[6]), 'z14', z14 && fmt(z14), 'maxZone', S.zone, 'n', S.n, 'log10$', (Math.log10(E.ips(S)) + S.u).toFixed(1), 'u', S.u);
