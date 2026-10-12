// Long-run balance bot: composting + Transplanting + Star Chart (no challenges / shinies / trophies, so it's a
// conservative estimate). Usage: node tools/sim-long.js [hours]   -> zone reached over time, transplant log
const E = require('../src/js/econ.js');
const HOURS = +process.argv[2] || 300, STAG = 75;
const S = { m: 0, run: 0, n: 1, lv: {}, shop: {}, perk: {}, relics: {}, mtn: 0, zone: 0, tm: 0, mu: 0, cc: 0, u: 0, caps: {},
  star: {}, dust: 0, dustEver: 0, tEarnL: -1, best: { zone: 0 }, marks: 0, planet: 0, lastN: 0 };
const addL = (L, x) => { if (!(x > 0)) return L; const b = Math.log10(x) + S.u; return L < 0 ? b : Math.max(L, b) + Math.log10(1 + 10 ** (Math.min(L, b) - Math.max(L, b))); };
let t = 0, lastBuyNew = 0, runStart = 0, plantStart = 0;
const log = [], byHour = {};
const fmt = s => (s / 3600).toFixed(1) + 'h';
function bestBuy() {
  const ips = E.ips(S), opts = [];
  if (S.n < E.maxPlants(S)) opts.push({ k: 'new', c: E.spC(S, S.n), v: E.pay(S, S.n) * E.beanX(S) * E.goldAvg(S) / E.spitInt(S) * 3 });
  for (let i = Math.max(0, S.n - 40); i < S.n; i++) {     // only the top 40 plants matter late (bottom ones pay nothing in comparison)
    const l = S.lv[i] || 0; if (l >= E.cap(S, i)) continue;
    const d = E.pay(S, i) * (E.K.lp * ((l + 1) % E.K.ms === 0 ? 2 : 1) - 1) * E.beanX(S) * E.goldAvg(S) / E.spitInt(S);
    opts.push({ k: 'up', i, c: E.upC(S, i, l), v: d });
  }
  for (const d of E.SHOP) {
    const l = S.shop[d.id] || 0; if (l >= d.max) continue;
    let v = 0;
    if (d.id === 'spit' || d.id === 'gold') { S.shop[d.id] = l + 1; v = E.ips(S) - ips; S.shop[d.id] = l; }
    if (d.id === 'cheap') v = ips * 0.05;
    if (v > 0) opts.push({ k: 'shop', id: d.id, c: E.shopCost(S, d, l), v });
  }
  opts.forEach(o => o.r = o.v / o.c); opts.sort((a, b) => b.r - a.r);
  return opts[0];
}
function spendMulch() {
  const order = ['pay', 'head', 'worm', 'spit2', 'dirt', 'pay', 'pay', 'gold2', 'shop'];
  for (let bought = true; bought;) { bought = false;
    for (const id of order) { const d = E.PERKS.find(p => p.id === id), l = S.perk[id] || 0;
      if (l < d.max && S.mu >= E.cost(d, l)) { S.mu -= E.cost(d, l); S.perk[id] = l + 1; bought = true; } } }
}
function spendDust() {
  const order = ['light', 'sling', 'bedrock', 'mover', 'vault', 'feast', 'light', 'cellar', 'memory', 'nursery', 'comet', 'light', 'timer', 'qshop', 'lucky', 'light', 'feast'];
  for (let bought = true; bought;) { bought = false;
    for (const id of order) { const d = E.STARS.find(p => p.id === id), l = E.starL(S, id);
      if ((!d.max || l < d.max) && S.dust >= E.starCost(d, l)) { S.dust -= E.starCost(d, l); S.star[id] = l + 1; bought = true; } } }
}
function newRun() {
  S.m = 0; S.run = 0; S.lv = {}; S.shop = {}; S.n = E.headStart(S);
  for (const d of E.SHOP) S.shop[d.id] = Math.min(d.max, E.starL(S, 'qshop'));
  runStart = t; lastBuyNew = t;
}
function transplant() {
  const g = E.dustGain(S);
  S.dust += g; S.dustEver += g;
  log.push({ t: fmt(t), planet: S.planet, len: fmt(t - plantStart), dust: g, zone: S.zone, alt: E.alt(S), composts: S.cc });
  const keepM = Math.floor(S.mtn * E.bedrock(S)), mem = 0.1 * E.starL(S, 'memory');
  for (const id in S.perk) S.perk[id] = Math.floor(S.perk[id] * mem);
  S.mtn = keepM; S.mu = 0; S.tm = 0; S.cc = 0; S.lastN = 0; S.caps = {}; S.zone = E.zoneOf(S.mtn + 1); S.tEarnL = -1; S.planet++;
  spendDust(); newRun(); plantStart = t;
}
let dt = 0.5;
while (t < HOURS * 3600) {
  dt = t < 8 * 3600 ? 0.5 : 2;   // coarser steps later on (much faster, same results)
  const inc = E.ips(S) * dt; S.m += inc; S.run += inc; S.tEarnL = addL(S.tEarnL, inc); t += dt;
  for (let g = 0; g < 50; g++) {
    const b = bestBuy(); if (!b || S.m < b.c) break;
    S.m -= b.c;
    if (b.k === 'new') { S.n++; lastBuyNew = t; } else if (b.k === 'up') S.lv[b.i] = (S.lv[b.i] || 0) + 1; else S.shop[b.id] = (S.shop[b.id] || 0) + 1;
  }
  const z = E.zoneOf(E.alt(S));
  if (z > S.zone) { S.zone = z; if (z > S.best.zone) { S.best.zone = z; S.marks = Math.max(0, Math.floor((z - 14) / 10)); } }
  const sh = E.needShift(S); if (sh) { S.u += sh; S.m /= 10 ** sh; S.run /= 10 ** sh; }
  const hr = Math.floor(t / 3600); if (!byHour[hr]) byHour[hr] = { zone: S.best.zone, planet: S.planet, dust: S.dustEver };
  const g = E.mulchGain(S);
  if (g >= 1 && t - lastBuyNew > STAG) {
    // transplant instead, when it pays: Stardust gain at least ~doubles what we've ever had
    if (E.transplantOpen(S) && E.dustGain(S) >= Math.max(2, S.dustEver * 0.9)) { transplant(); continue; }
    for (let i = 0; i < S.n; i++) S.caps[i] = (S.caps[i] || 0) + 1;
    S.lastN = S.n; S.mu += g; S.tm += g; S.cc++; S.mtn += E.mtnGain(S);
    spendMulch(); newRun();
  }
}
console.log('Transplants:'); log.forEach(r => console.log('  ' + JSON.stringify(r)));
console.log('Best zone by hour:', Object.entries(byHour).filter(([h]) => [1, 2, 3, 5, 8, 12, 20, 30, 50, 75, 100, 150, 200, 250, 299].includes(+h)).map(([h, v]) => h + 'h:z' + v.zone + '/p' + v.planet + '/d' + v.dust).join('  '));
console.log('stars', JSON.stringify(S.star), 'dust ever', S.dustEver);
