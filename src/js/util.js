/* Gerald Wants Up — small helpers + number formatting. */
const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  smooth: t => t * t * (3 - 2 * t),
  easeOutBack: t => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  easeOutElastic: t => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  easeInOut: t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  /* seeded RNG (mulberry32): U.rng(seed)() -> [0,1) */
  rng(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  pick: (arr, r = Math.random) => arr[Math.floor(r() * arr.length)],
  /* number formatting from log10 so nothing ever overflows */
  SUF: ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc", "UDc", "DDc", "TDc", "QaDc", "QiDc", "SxDc", "SpDc", "OcDc", "NoDc", "Vg"],
  fmtLog(l) {
    if (!isFinite(l)) return "0";
    if (l < 3) { const v = 10 ** l; return v < 10 && v % 1 ? v.toFixed(1) : Math.floor(v + 1e-9) + ""; }
    let e3 = Math.floor(l / 3), m3 = 10 ** (l - e3 * 3);
    if (+m3.toFixed(2) >= 1000) { e3++; m3 /= 1000; }          // 999.996 must read 1.00K, not 1000.00
    const sci = typeof G !== "undefined" && G.S && G.S.settings && G.S.settings.sci;
    if (!sci && e3 < U.SUF.length) return m3.toFixed(2) + U.SUF[e3];
    let e = Math.floor(l), m = 10 ** (l - e);
    if (+m.toFixed(2) >= 10) { e++; m /= 10; }
    return m.toFixed(2) + "e" + e;
  },
  num: x => (x <= 0 ? "0" : x < 1000 ? (x < 10 && x % 1 ? x.toFixed(1) : Math.floor(x) + "") : U.fmtLog(Math.log10(x))),
  /* money values are stored in units of 10^S.u */
  money: x => "$" + (x <= 0 ? "0" : U.fmtLog(Math.log10(x) + ((typeof G !== "undefined" && G.S && G.S.u) || 0))),
  /* heights: one plant ("slot") is 100 ft. Settings > Metric switches everything to m / km */
  metric: () => typeof G !== "undefined" && !!(G && G.S && G.S.settings && G.S.settings.metric),
  ft: slots => {
    const f = Math.max(0, slots * 100);
    if (U.metric()) {
      const m = Math.round(f * 0.3048);
      if (m < 10000) return m.toLocaleString("en-US") + " m";
      const km = m / 1000;
      return (km < 100 ? km.toFixed(1) : km < 1e6 ? Math.round(km).toLocaleString("en-US") : U.fmtLog(Math.log10(km))) + " km";
    }
    const r = Math.round(f);
    return (r < 1e6 ? r.toLocaleString("en-US") : U.fmtLog(Math.log10(r))) + " ft";
  },
  time(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? h + "h " + m + "m" : m ? m + "m " + s + "s" : s + "s";
  },
};
