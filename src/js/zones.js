/* Gerald Wants Up — zone lookup. Story zones come from DATA.ZONES; after the story,
   endless procedural layers are generated deterministically from the zone index. */
const ZONES = {
  _c: {},
  get(k) {
    if (ZONES._c[k]) return ZONES._c[k];
    let z;
    if (k < DATA.ZONES.length) {
      z = Object.assign({ k, at: ECON.zoneAt(k), proc: false }, DATA.ZONES[k]);
      if (z.arrive) z.arrive = z.arrive.map(([who, text]) => [who, text.split("{ft}").join(U.ft(z.at))]);
    } else {
      const r = U.rng(9973 * k + 17), P = DATA.PROC;
      const adj = U.pick(P.adj, r), place = U.pick(P.place, r);
      const h = Math.floor(r() * 360), h2 = (h + 20 + r() * 80) % 360, dark = r() < 0.5;
      const local = U.pick(P.names, r) + ", " + U.pick(P.titles, r) + " " + adj + " " + place;
      const scales = ["major", "minor", "dorian", "lydian", "mixo", "penta", "phryg", "whole"];
      const k2 = k - DATA.ZONES.length + 1;
      const tk = ["pay", "pay", "mulch", "sockVal", "spit", "visit", "gold", "off"][Math.floor(r() * 8)];
      const tv = { pay: 1.15, mulch: 1.06, sockVal: 1.2, spit: 1.03, visit: 1.05, gold: 0.005, off: 1.1 }[tk];
      z = {
        k, at: ECON.zoneAt(k), proc: true,
        name: "Layer " + k2 + ": The " + adj + " " + place, short: "The " + adj + " " + place,
        sub: U.pick(["Nobody knows who built this.", "It smells faintly of soup.", "Gravity is optional here.",
          "Everything is slightly too big.", "The walls are listening. Politely.", "It's always 4:17pm here.",
          "Something here is humming your favourite song.", "Population: unclear."], r),
        sky: dark ? [INK.hsl(h, 55, 9), INK.hsl(h2, 50, 28)] : [INK.hsl(h, 60, 55), INK.hsl(h2, 70, 85)],
        stars: dark ? 0.6 + r() * 0.4 : r() * 0.2,
        decor: U.pick(P.decor, r),
        mus: [55 + Math.floor(r() * 12), U.pick(scales, r), 70 + Math.floor(r() * 45)],
        who: "local", whoName: local,
        arrive: [["narr", U.ft(ECON.zoneAt(k)) + ". " + "Layer " + k2 + ": The " + adj + " " + place + "."],
          ["local", U.pick(P.greet, r)], ["gerald", U.pick(P.gerald, r)]],
        trinket: { name: "A " + U.pick(P.trinketAdj, r) + " " + U.pick(P.trinketObj, r), k: tk, v: tv,
          desc: { pay: "Payouts x1.15", mulch: "Mulch +6%", sockVal: "Socks worth +20%", spit: "Beans 3% faster",
            visit: "Visitors 5% more often", gold: "+0.5% golden bean chance", off: "Offline earnings x1.1" }[tk] },
        visitors: (() => { const all = Object.keys(DATA.VISITORS); return [U.pick(all, r), U.pick(all, r), U.pick(all, r)]; })(),
        obj: "Keep going up. Forever. Up is always there.",
        quips: [], hue: h,
      };
    }
    return (ZONES._c[k] = z);
  },
  /* objective shown while heading to zone k */
  objective(k) { return ZONES.get(k).obj; },
};
