/* Gerald Wants Up — save state: shape, load/save, export/import, redenomination. */
const STATE = {
  KEY: "gwu3",
  fresh() {
    return {
      v: 3, sd: (Math.random() * 1e9) | 0, u: 0,
      // this run (reset by composting)
      m: 0, run: 0, n: 1, lv: {}, bk: {}, ac: {}, shop: {}, runT: 0,
      // permanent
      soc: 0, mu: 0, tm: 0, perk: {}, mtn: 0, strata: [], cc: 0, zone: 0, rec: 1, lastMulch: 0,
      caps: {},   // per plant slot: how many composts it has survived (level cap = 10 + 5 each)
      ua: {}, uo: {}, pa: {}, co: {}, sbOff: 0, mx: 0,   // uo / co: auto-upgrade / auto-collect switched off per slot
      relics: {}, trinkets: [], hats: { none: 1 }, hat: "none",
      quests: [], qDone: 0, qSeq: 0,
      stats: { earnL: -1, beans: 0, golden: 0, socks: 0, bubbles: 0, upgrades: 0, sprouts: 0, visitors: 0,
        pokes: 0, composts: 0, time: 0, quests: 0 },
      flags: { intro: 0, tut: 0, tutStep: 0, moonGone: 0, finale: 0, hints: {} },
      settings: { sfx: 0.7, mus: 0.4, shake: true, chatter: true, sci: false, cine: "all", music: true },
      last: Date.now(),
    };
  },
  load() {
    let S = STATE.fresh();
    try {
      const raw = localStorage.getItem(STATE.KEY);
      if (raw) S = STATE.merge(JSON.parse(raw));
      else if (localStorage.getItem("gwu2")) S.flags.legacy = 1;   // an old pre-weird save exists
    } catch (e) { console.warn("load failed", e); }
    return S;
  },
  merge(d) {
    const f = STATE.fresh(), S = Object.assign(f, d);
    for (const k of ["stats", "flags", "settings"]) S[k] = Object.assign(STATE.fresh()[k], d[k] || {});
    S.flags.hints = S.flags.hints || {};
    STATE.migrate(S);
    return S;
  },
  /* perks that were removed or capped lower: give the mulch back */
  migrate(S) {
    const old = { asp: [6, 1], aup: [8, 2.4], butl: [40, 1] };
    let back = 0;
    for (const id in old) {
      const L = S.perk[id] || 0;
      for (let l = 0; l < L; l++) back += Math.ceil(old[id][0] * old[id][1] ** l);
      delete S.perk[id];
    }
    const hd = ECON.PERKS.find(d => d.id === "head");
    if ((S.perk.head || 0) > hd.max) {
      for (let l = hd.max; l < S.perk.head; l++) back += Math.ceil(3 * 2.1 ** l);
      S.perk.head = hd.max;
    }
    if (back > 0) { S.mu += back; S.flags.refund = (S.flags.refund || 0) + back; }
    S.co = S.co || {};
    if (S.go) { for (const k in S.ua) S.uo[k] = 1; S.sbOff = 1; }   // old global pause -> every plant switched off
    delete S.go;
    if (S.lastN === undefined) S.lastN = S.cc ? Math.max(ECON.MIN_COMPOST, ...S.strata.map(st => st.n || 0)) : 0;
  },
  save(S) {
    S.last = Date.now();
    try { localStorage.setItem(STATE.KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ }
  },
  exportStr(S) { return btoa(unescape(encodeURIComponent(JSON.stringify(S)))); },
  importStr(str) {
    const d = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
    if (!d || typeof d !== "object" || d.v !== 3) throw new Error("not a Gerald save");
    return STATE.merge(d);
  },
  wipe() { try { localStorage.removeItem(STATE.KEY); } catch (e) {} },
  /* add x money units to the all-time earned counter (kept as log10 so it never overflows) */
  addEarned(S, x) {
    if (!(x > 0)) return;
    const b = Math.log10(x) + S.u, a = S.stats.earnL;
    S.stats.earnL = a < 0 ? b : Math.max(a, b) + Math.log10(1 + 10 ** (Math.min(a, b) - Math.max(a, b)));
  },
  /* redenominate when amounts get astronomically large (see econ.js) */
  shift(S) {
    const sh = ECON.needShift(S);
    if (!sh) return;
    const d = 10 ** sh;
    S.u += sh; S.m /= d; S.run /= d;
    for (const k in S.bk) S.bk[k] /= d;
    S.qRun = (S.qRun || 0) / d;
    for (const q of S.quests) if (q.t === "earn") { q.n /= d; q.acc = (q.acc || 0) / d; }
  },
};
