/* Gerald Wants Up — save state: shape, load/save, export/import, redenomination. */
const STATE = {
  KEY: "gwu4", BACKUP: "gwu4b", OLD: "gwu3",
  // numbers that matter for cheating are kept scrambled in memory (GUARD.protect)
  SAFE: ["m", "run", "u", "soc", "mu", "tm", "mtn", "n", "zone", "rec", "cc"],
  /* saves (and export codes) from before saves were sealed are converted once, from the old save slot only;
     release builds made after this date stop accepting them (otherwise anyone could hand-write an unsealed save) */
  legacyOK: () => typeof BUILD_TIME === "undefined" || BUILD_TIME < Date.UTC(2026, 10, 1),
  fresh() {
    return {
      v: 3, sd: (Math.random() * 1e9) | 0, u: 0,
      // this run (reset by composting)
      m: 0, run: 0, n: 1, lv: {}, bk: { 0: 50 }, ac: {}, shop: {}, runT: 0,   // first plant starts with a $50 bubble for the tutorial
      // permanent
      soc: 0, mu: 0, tm: 0, perk: {}, mtn: 0, strata: [], cc: 0, zone: 0, rec: 1, lastMulch: 0,
      caps: {},   // per plant slot: how many composts it has survived (level cap = 10 + 5 each)
      ua: {}, uo: {}, pa: {}, co: {}, sbOff: 0, mx: 0,   // uo / co: auto-upgrade / auto-collect switched off per slot
      relics: {}, trinkets: [], hats: { none: 1 }, hat: "none",
      quests: [], qDone: 0, qSeq: 0,
      stats: { earnL: -1, beans: 0, golden: 0, socks: 0, bubbles: 0, upgrades: 0, sprouts: 0, visitors: 0,
        pokes: 0, composts: 0, time: 0, quests: 0 },
      flags: { intro: 0, tut: 0, tutStep: 0, moonGone: 0, finale: 0, hints: {} },
      settings: { sfx: 0.7, mus: 0.4, shake: true, chatter: true, sci: false, cine: "all", music: true, metric: false },
      last: Date.now(), srvT: 0,   // srvT: server time of the last save (offline rewards are measured from it)
    };
  },
  /* save text -> save object, or null if it was edited / isn't a Gerald save */
  decode(raw, legacy) {
    if (!raw) return null;
    try {
      let d = null;
      if (GUARD.SEAL.is(raw)) d = JSON.parse(GUARD.SEAL.open(raw));
      else if (legacy && STATE.legacyOK()) {
        const t = String(raw).trim();
        d = JSON.parse(t[0] === "{" ? t : decodeURIComponent(escape(atob(t))));   // old save / old export code
      }
      return d && typeof d === "object" && d.v === 3 ? d : null;
    } catch (e) { return null; }
  },
  encode: S => GUARD.SEAL.seal(JSON.stringify(S)),
  load() {
    let S = STATE.fresh(), d = null;
    try {
      const raw = localStorage.getItem(STATE.KEY);
      d = STATE.decode(raw);
      if (raw && !d) {                     // edited outside the game: keep it aside, fall back to the backup copy
        try { localStorage.setItem("gwu4x", raw); } catch (e) {}
        d = STATE.decode(localStorage.getItem(STATE.BACKUP));
        STATE.rejected = true;
      }
      if (!d && !raw) d = STATE.decode(localStorage.getItem(STATE.OLD), true);
      if (d) S = STATE.merge(d);
      else if (localStorage.getItem("gwu2")) S.flags.legacy = 1;   // an old pre-weird save exists
    } catch (e) { console.warn("load failed", e); }
    if (!d) GUARD.protect(S, STATE.SAFE);
    GUARD.CLOCK.loaded(S.srvT || 0);
    return S;
  },
  merge(d) {
    const f = STATE.fresh(), S = Object.assign(f, d);
    for (const k of ["stats", "flags", "settings"]) S[k] = Object.assign(STATE.fresh()[k], d[k] || {});
    S.flags.hints = S.flags.hints || {};
    for (const k of STATE.SAFE) if (!Number.isFinite(+S[k]) || S[k] < 0) S[k] = 0;   // damaged numbers
    STATE.migrate(S);
    return GUARD.protect(S, STATE.SAFE);
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
  saveN: 0,
  save(S) {
    S.last = Date.now(); S.srvT = GUARD.CLOCK.stamp();
    try {
      const txt = STATE.encode(S);
      // every 12th save the previous copy becomes the backup (used if the main copy is ever damaged)
      if (STATE.saveN++ % 12 === 0) { const cur = localStorage.getItem(STATE.KEY); if (cur && STATE.decode(cur)) localStorage.setItem(STATE.BACKUP, cur); }
      localStorage.setItem(STATE.KEY, txt);
      localStorage.removeItem(STATE.OLD);
    } catch (e) { /* storage full or blocked */ }
  },
  exportStr(S) { S.srvT = GUARD.CLOCK.stamp(); return STATE.encode(S); },
  importStr(str) {
    const d = STATE.decode(str, true);
    if (!d) throw new Error("not a Gerald save (or it was edited)");
    d.srvT = 0;                            // an imported save never pays out offline time
    return STATE.merge(d);
  },
  wipe() { try { for (const k of [STATE.KEY, STATE.BACKUP, STATE.OLD]) localStorage.removeItem(k); } catch (e) {} },
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
