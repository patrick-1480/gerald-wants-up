/* Gerald Wants Up — core simulation: beans, plants, bubbles, socks, visitors, buffs,
   automation, zones, composting. Rendering of the stalk scene lives in GAME.draw(). */
const GAME = {
  beans: [], socks: [], visitors: [], parts: [], floats: [], says: [],
  sp: {}, wob: {}, payC: [], payT: 0, sel: -1,
  buffs: { frenzy: 0, spit: 0, gold: 0 },
  tm: { seed: 0, sock: 6, visit: 45, auto: 0, intern: 0, chat: 6, gerald: 14, poke: 0 },
  spitAnim: 0, geraldMood: "grump", moodT: 0, gSay: null, ipsM: 0, lastRun: 0, ipsT: 0,
  zoneQueue: [], musicZone: -1,
  HOP: 0.32, BASE: 70,
  base: () => GAME.BASE / G.zoom,      // bottom margin stays 70 real px at any zoom

  /* ---------- geometry (world y up, px) ----------
     The world is laid out in a *virtual* view G.vW x G.vH = real canvas size / G.zoom, so zooming out
     (when you scroll down into the compost mountain) shows more of the world without changing layout. */
  mtnTop: () => G.S.mtn * ECON.GAP,
  plantWY: i => GAME.mtnTop() + 140 + i * ECON.GAP,
  geraldWY: () => GAME.plantWY(G.S.n - 1) + 92,
  side: i => (i % 2 ? 1 : -1),
  toY: wy => G.vH - GAME.base() - (wy - G.cam),
  plantSX: i => G.vW / 2 + GAME.side(i) * 74,
  bubbleSX: i => G.vW / 2 + GAME.side(i) * 134,
  // Gerald's head (and his speech bubble above it) must stay below the HUD cards, which stack taller on narrow screens
  topSafe: () => Math.max(120, (UI.hudBottom || 0) + 80),
  // highest you can scroll: Gerald sitting about mid-screen (never above the follow position)
  camMax: () => Math.max(0, GAME.geraldWY() - (G.vH - GAME.base() - Math.max(G.vH * 0.5, GAME.topSafe() + 60))),
  camFollow: () => Math.max(0, GAME.geraldWY() - (G.vH - GAME.base() - Math.max(G.vH * 0.34, GAME.topSafe() + 60))),
  camAlt: () => (G.cam + (G.vH - GAME.base()) - G.vH / 2) / ECON.GAP,
  visRange() {
    const lo = Math.floor((G.cam - GAME.mtnTop() - 300) / ECON.GAP), hi = Math.ceil((G.cam + G.vH - GAME.mtnTop()) / ECON.GAP);
    return [Math.max(0, lo), Math.min(G.S.n - 1, hi)];
  },
  /* zoom target: 1 normally, zooming out as the view sinks below the mountain top */
  zoomTop: () => (G.W < 520 ? 0.85 : 1),      // normal zoom: phones draw the world a bit smaller so more fits
  zoomTarget() {
    const d = GAME.mtnTop() - G.cam, minZ = U.clamp(G.H / (GAME.mtnTop() + 800), 0.3, 1);
    return Math.min(GAME.zoomTop(), U.clamp(1 - Math.max(0, d - 350) / 1500, minZ, 1));
  },

  /* ---------- plant identity (new weird plants every run; past runs are remembered for the mountain) ---------- */
  _pi: {},
  plantInfo(i) { return GAME.plantInfoFor(G.S.cc, i); },
  plantInfoFor(cc, i) {
    const S = G.S, key = S.sd + ":" + cc + ":" + i;
    if (GAME._pi[key]) return GAME._pi[key];
    const r = U.rng(S.sd + cc * 100003 + i * 7919 + 1), sp = U.pick(DATA.SPECIES, r);
    const name = U.pick(DATA.ADJ, r) + " " + U.pick(sp.nouns, r) + (r() < 0.45 ? " " + U.pick(DATA.SUF, r) : "");
    const hue = Math.floor(r() * 360), fk = U.pick(DATA.FACTS, r);
    return (GAME._pi[key] = {
      i, name, type: sp.t, hue,
      c1: INK.hsl(hue, 72, 66), c2: INK.hsl((hue + 120 + r() * 120) % 360, 75, 60),
      eyes: r() < 0.15 ? 1 : r() < 0.8 ? 2 : 3,
      eyeStyle: U.pick(["round", "round", "round", "sleepy", "wide", "side", "spiral"], r),
      mouth: U.pick(["smile", "smile", "flat", "o", "teeth", "tongue", "wobbly"], r),
      acc: r() < 0.5 ? "none" : U.pick(["tophat", "bow", "glasses", "monocle", "mustache", "unibrow", "flower", "bandaid", "earring"], r),
      pt: 5 + Math.floor(r() * 5), seed: Math.floor(r() * 1e6),
      fact: fk[0] + ": " + U.pick(fk[1], r),
    });
  },

  /* ---------- buffs & payouts ---------- */
  buffMult: () => (GAME.buffs.frenzy > 0 ? 7 : 1),
  spitMult: () => (GAME.buffs.spit > 0 ? 4 : 1),
  refreshPay() {
    const S = G.S, b = GAME.buffMult();
    GAME.payC.length = 0;
    for (let i = 0; i < S.n; i++) GAME.payC.push(ECON.pay(S, i, b));
    const raw = ECON.rawSpit(S) / GAME.spitMult();
    GAME.spitI = Math.max(ECON.MIN_SPIT, raw); GAME.bx = Math.max(1, ECON.MIN_SPIT / raw);
  },
  spitI: 1.6, bx: 1,
  owned: (kind, i) => kind === "up" ? !!G.S.ua[i] : !!(G.S.ac[i] || G.S.pa[i]),
  isOff: (kind, i) => !!(kind === "up" ? G.S.uo[i] : G.S.co && G.S.co[i]),
  auto: i => GAME.owned("col", i) && !GAME.isOff("col", i),
  /* every plant slot that owns this automation: how many are on / off (the Sock Butler counts as an
     auto-upgrader, so the global switch pauses it too) */
  autoState(kind) {
    const S = G.S; let on = 0, off = 0;
    const slots = new Set(Object.keys(kind === "up" ? S.ua : Object.assign({}, S.ac, S.pa)).map(Number));
    for (const i of slots) { if (!GAME.owned(kind, i)) continue; GAME.isOff(kind, i) ? off++ : on++; }
    if (kind === "up" && S.sockAuto) S.sbOff ? off++ : on++;
    return { on, off, mixed: on > 0 && off > 0, none: on + off === 0 };
  },
  setAll(kind, on) {
    const S = G.S, flag = kind === "up" ? "uo" : "co";
    S[flag] = S[flag] || {};
    const slots = new Set(Object.keys(kind === "up" ? S.ua : Object.assign({}, S.ac, S.pa)).map(Number));
    for (const i of slots) { if (on) delete S[flag][i]; else S[flag][i] = 1; }
    if (kind === "up") S.sbOff = on ? 0 : 1;
    if (kind === "col" && on) GAME.sweepBanks();
  },
  setOne(kind, i, on) {
    const S = G.S, flag = kind === "up" ? "uo" : "co";
    S[flag] = S[flag] || {};
    if (on) delete S[flag][i]; else S[flag][i] = 1;
    if (kind === "col" && on) GAME.sweepBanks();
  },
  /* money sitting in bubbles of plants that collect by themselves goes straight into the wallet */
  sweepBanks() { const S = G.S; for (const k in S.bk) if (S.bk[k] > 0 && GAME.auto(+k)) { S.m += S.bk[k]; S.bk[k] = 0; } },
  ips() {   // current theoretical income incl. buffs
    let s = 0;
    for (const v of GAME.payC) s += v;
    return s * GAME.bx * (GAME.buffs.gold > 0 ? ECON.GOLD_X : ECON.goldAvg(G.S)) / GAME.spitI;
  },
  earn(x, sx, sy) {
    const S = G.S;
    S.m += x; S.run += x; STATE.addEarned(S, x);
    if (sx !== undefined) GAME.float("+" + U.money(x), sx, sy, INK.C.gold);
  },

  /* ---------- beans ---------- */
  spit(poke) {
    const S = G.S;
    if (S.n < 1) return;
    const gold = GAME.buffs.gold > 0 || Math.random() < ECON.goldChance(S);
    GAME.beans.push({ cur: S.n - 1, u: 0, first: 1, gold, x: 0, y: GAME.geraldWY() + 6, gx: (Math.random() - 0.5) * 90, seed: Math.random() * 1e5 | 0 });
    S.stats.beans++; if (gold) S.stats.golden++;
    GAME.spitAnim = 0.25;
    if (!poke || Math.random() < 0.5) SFX.play("spit");
    if (gold) SFX.play("golden");
  },
  hit(i, gold, sx, sy) {
    const S = G.S, v = (GAME.payC[i] || 0) * GAME.bx * (gold ? ECON.GOLD_X : 1);
    S.run += v; STATE.addEarned(S, v);
    if (GAME.auto(i)) S.m += v; else S.bk[i] = (S.bk[i] || 0) + v;
    GAME.wob[i] = 1;
    SFX.play("hit", { i });
    if (gold && Math.random() < 0.5 && G.zoom > 0.6) GAME.burst(sx * G.zoom, sy * G.zoom, INK.C.gold, 4);
  },
  collect(i, sx, sy, quiet) {
    const S = G.S, b = S.bk[i] || 0;
    if (b <= 0) return false;
    S.m += b; S.bk[i] = 0; S.stats.bubbles++;
    if (!quiet) {
      GAME.float("+" + U.money(b), sx, sy - 10, INK.C.gold);
      GAME.burst(sx, sy, "#bfe9ff", 8, 1);
      GAME.flyTo("hudMoney", sx, sy, "coin", 3);
      SFX.play("pop"); SFX.play("coin");
    }
    return true;
  },
  collectAll() {
    const S = G.S; let got = 0;
    for (const k in S.bk) if (S.bk[k] > 0) { got += S.bk[k]; S.m += S.bk[k]; S.bk[k] = 0; S.stats.bubbles++; }
    return got;
  },

  /* ---------- buying ---------- */
  grow(silent) {
    const S = G.S, c = ECON.spC(S, S.n);
    if (S.m < c) { if (!silent) SFX.play("error"); return false; }
    S.m -= c; GAME.sp[S.n] = 0; S.n++; S.stats.sprouts++;
    if (!silent) UI.toast(GAME.plantInfo(S.n - 1).name + " has sprouted", "grow");
    if (S.n >= ECON.MIN_COMPOST && !S.cc) UI.hint("compost", "Psst. Your stalk is tall enough to feed me now. When growing gets slow, open the Compost tab: I eat the plants, you get mulch and a mountain. Everybody wins. Mostly me.");
    SFX.play("grow");
    // Sock Butler: every new plant gets both forever automations, if you can pay the socks
    if (S.sockAuto && !S.sbOff) { const i = S.n - 1; if (!S.pa[i] && S.soc >= ECON.cPa(S, i)) GAME.buySock("pa", i, true); if (!S.ua[i] && S.soc >= ECON.cUa(S, i)) GAME.buySock("ua", i, true); }
    GAME.refreshPay();
    return true;
  },
  growMax() {
    let n = 0;
    while (n < 200 && G.S.m >= ECON.spC(G.S, G.S.n)) { GAME.grow(true); n++; }
    if (n) UI.toast("Grew " + n + " plant" + (n > 1 ? "s" : ""), "grow", 1.6); else SFX.play("error");
    return n;
  },
  upgrade(i, mode) {    // mode: 0 = x1, 1 = x10, 2 = max
    const S = G.S;
    let [n, cost] = ECON.upAfford(S, i, S.m);
    if (mode === 0) n = Math.min(n, 1); else if (mode === 1) n = Math.min(n, 10);
    if ((S.lv[i] || 0) >= ECON.cap(S, i)) { SFX.play("error"); UI.toast("Maxed at Lv " + ECON.cap(S, i) + "! Compost to raise this plant's cap by " + ECON.CAPSTEP + ".", "grow"); return 0; }
    if (n < 1) { SFX.play("error"); return 0; }
    if (mode !== 2) { const c0 = ECON.upC(S, i, S.lv[i] || 0); cost = c0 * (ECON.K.lq ** n - 1) / (ECON.K.lq - 1); }
    S.m = Math.max(0, S.m - cost); S.lv[i] = (S.lv[i] || 0) + n; S.stats.upgrades += n;
    GAME.wob[i] = 0.8; SFX.play("upgrade", { n });
    GAME.float("Lv " + S.lv[i], GAME.plantSX(i) * G.zoom, (GAME.toY(GAME.plantWY(i)) - 40) * G.zoom, INK.C.moss);
    GAME.refreshPay();
    return n;
  },
  upInfo(i, mode) {
    const S = G.S, l = S.lv[i] || 0, c0 = ECON.upC(S, i, l), room = ECON.cap(S, i) - l;
    let [n, cost] = ECON.upAfford(S, i, S.m);
    if (mode === 0) n = 1; else if (mode === 1) n = 10; else if (n < 1) n = 1;
    n = Math.max(1, Math.min(n, room));
    if (mode !== 2 || n === 1) cost = c0 * (ECON.K.lq ** n - 1) / (ECON.K.lq - 1);
    return [n, cost, S.m >= cost];
  },
  cheapestUp() {
    const S = G.S; let best = -1, bc = Infinity;
    for (let i = 0; i < S.n; i++) {
      if ((S.lv[i] || 0) >= ECON.cap(S, i)) continue;
      const c = ECON.upC(S, i, S.lv[i] || 0); if (c < bc) { bc = c; best = i; }
    }
    return [best, bc];
  },
  /* best value upgrade: most extra income per $ (so money doesn't drain into the bottom plants) */
  bestUp() {
    const S = G.S; let best = -1, bv = -1, bc = Infinity;
    for (let i = 0; i < S.n; i++) {
      const l = S.lv[i] || 0;
      if (l >= ECON.cap(S, i)) continue;
      const c = ECON.upC(S, i, l), gain = (GAME.payC[i] || 0) * (ECON.K.lp * ((l + 1) % ECON.K.ms === 0 ? 2 : 1) - 1), v = gain / c;
      if (v > bv) { bv = v; best = i; bc = c; }
    }
    return [best, bc];
  },
  buyShop(d) {
    const S = G.S, l = ECON.shopL(S, d.id), c = ECON.shopCost(S, d, l);
    if (l >= d.max || S.m < c) { SFX.play("error"); return; }
    S.m -= c; S.shop[d.id] = l + 1; SFX.play("shop"); GAME.refreshPay();
  },
  buyPerk(d) {
    const S = G.S, l = ECON.perkL(S, d.id), c = ECON.cost(d, l);
    if (l >= d.max || S.mu < c) { SFX.play("error"); return; }
    S.mu -= c; S.perk[d.id] = l + 1; SFX.play("upgrade", { n: 3 }); GAME.refreshPay();
  },
  buySock(kind, i, quiet) {
    const S = G.S;
    if (kind === "super") {
      if (S.sockAuto || S.soc < ECON.SUPER_SOCK) { SFX.play("error"); return; }
      S.soc -= ECON.SUPER_SOCK; S.sockAuto = 1; SFX.play("upgrade", { n: 5 });
      UI.toast("Sock Butler hired! New plants automate themselves (if you have the socks).", "zone", 4);
      return;
    }
    const c = kind === "ua" ? ECON.cUa(S, i) : kind === "ac" ? ECON.cAc(S, i) : ECON.cPa(S, i);
    if (S.soc < c || S[kind][i]) { if (!quiet) SFX.play("error"); return; }
    S.soc -= c; S[kind][i] = 1; if (!quiet) SFX.play("shop");
    if (kind !== "ua") { const b = S.bk[i] || 0; if (b) { S.m += b; S.bk[i] = 0; } }
  },
  /* Sock Shrine: spend socks on a buff (frenzy or golden hour) */
  shrine(kind) {
    const S = G.S, c = ECON.shrine(S, kind);
    if (S.soc < c) { SFX.play("error"); return; }
    S.soc -= c; GAME.reward(kind === "gold" ? "gold" : "frenzy");
    UI.toast(kind === "gold" ? "The sky accepts your socks. GOLDEN HOUR!" : "The sky accepts your socks. BEAN FRENZY x7!", "visitor", 3);
  },
  /* automate every plant at once (socks): returns [count, cost] for kind */
  bulkSock(kind, doIt) {
    const S = G.S; let cost = 0, n = 0;
    for (let i = 0; i < S.n; i++) {
      if (S[kind][i] || (kind === "ac" && S.pa[i])) continue;
      const c = kind === "ua" ? ECON.cUa(S, i) : kind === "ac" ? ECON.cAc(S, i) : ECON.cPa(S, i);
      if (doIt) { if (S.soc < c) break; S.soc -= c; S[kind][i] = 1; if (kind !== "ua" && S.bk[i]) { S.m += S.bk[i]; S.bk[i] = 0; } }
      cost += c; n++;
    }
    if (doIt && n) SFX.play("shop");
    return [n, cost];
  },

  /* ---------- simulation step ---------- */
  step(dt) {
    const S = G.S, T = GAME.tm;
    S.runT += dt; S.stats.time += dt;
    for (const k in GAME.buffs) if (GAME.buffs[k] > 0) { GAME.buffs[k] -= dt; if (GAME.buffs[k] <= 0) { GAME.buffs[k] = 0; GAME.refreshPay(); } }
    GAME.payT -= dt; if (GAME.payT <= 0) { GAME.payT = 0.2; GAME.refreshPay(); }
    // Gerald spits
    T.seed += dt; let c = 0;
    while (T.seed >= GAME.spitI && c++ < 40) { T.seed -= GAME.spitI; GAME.spit(); }
    T.poke = Math.max(0, T.poke - dt);
    GAME.spitAnim = Math.max(0, GAME.spitAnim - dt);
    // beans hop down the tower
    for (let j = GAME.beans.length - 1; j >= 0; j--) {
      const b = GAME.beans[j];
      b.u += dt / GAME.HOP;
      while (b.u >= 1) {
        b.u -= 1;
        if (b.cur >= 0 && b.cur < S.n) {
          const i = b.cur;
          GAME.hit(i, b.gold, GAME.plantSX(i), GAME.toY(GAME.plantWY(i)));
          b.x = GAME.side(i) * 74; b.y = GAME.plantWY(i) + 26; b.first = 0; b.cur--;
        } else { GAME.beans.splice(j, 1); break; }
      }
    }
    // socks
    T.sock -= dt;
    if (T.sock <= 0) { T.sock = ECON.sockInt(S) * (0.7 + Math.random() * 0.6); GAME.addSock(); }
    for (let j = GAME.socks.length - 1; j >= 0; j--) {
      const k = GAME.socks[j]; k.t += dt; k.y += dt * k.vy; k.x += Math.sin(k.t * 1.4 + k.ph) * dt * 32;
      if (k.y > G.H + 50) GAME.socks.splice(j, 1);
    }
    // weird visitors
    T.visit -= dt;
    if (T.visit <= 0) { T.visit = ECON.visitInt(S) * (0.7 + Math.random() * 0.6); if (!GAME.visitors.length) GAME.addVisitor(); }
    for (let j = GAME.visitors.length - 1; j >= 0; j--) {
      const v = GAME.visitors[j]; v.t += dt;
      if (v.t > v.life) GAME.visitors.splice(j, 1);
    }
    // automation
    T.auto += dt;
    if (T.auto >= 0.25) {
      T.auto = 0;
      GAME.sweepBanks();
      for (const k in S.ua) {
        const i = +k; if (i >= S.n || S.uo[k] || (S.lv[i] || 0) >= ECON.cap(S, i)) continue;
        const cst = ECON.upC(S, i, S.lv[i] || 0);
        if (S.m >= cst) { S.m -= cst; S.lv[i] = (S.lv[i] || 0) + 1; S.stats.upgrades++; GAME.wob[i] = Math.max(GAME.wob[i] || 0, 0.4); }
      }
      // Shop Steward perk: buys the cheapest affordable Sky Shop upgrade
      if (ECON.perkL(S, "shop")) {
        let best = null, bc = Infinity;
        for (const d of ECON.SHOP) { const l = ECON.shopL(S, d.id); if (l < d.max) { const c = ECON.shopCost(S, d, l); if (c < bc) { bc = c; best = d; } } }
        if (best && S.m >= bc) { S.m -= bc; S.shop[best.id] = ECON.shopL(S, best.id) + 1; GAME.refreshPay(); }
      }
    }
    // animation decay
    for (const k in GAME.wob) { GAME.wob[k] -= dt * 3; if (GAME.wob[k] <= 0) delete GAME.wob[k]; }
    for (const k in GAME.sp) { GAME.sp[k] += dt * 1.4; if (GAME.sp[k] >= 1) delete GAME.sp[k]; }
    GAME.stepFx(dt);
    // measured income (smoothed)
    GAME.ipsT += dt;
    if (GAME.ipsT >= 1) { const d = S.run - GAME.lastRun; GAME.ipsM = GAME.ipsM * 0.6 + Math.max(0, d) / GAME.ipsT * 0.4; GAME.lastRun = S.run; GAME.ipsT = 0; }
    // zones
    const alt = ECON.alt(S);
    if (alt > S.rec) S.rec = alt;
    if (!GAME.zoneQueue.length && ECON.zoneOf(alt) > S.zone) GAME.arrive(S.zone + 1);
    // chatter
    GAME.chatter(dt);
    STATE.shift(S);
  },
  addSock(fast) {
    GAME.socks.push({ x: G.W * (0.1 + Math.random() * 0.8), y: -40 - Math.random() * (fast ? 200 : 0), t: 0,
      vy: fast ? 120 + Math.random() * 60 : 52, ph: Math.random() * 6, k: Math.random() * 4 | 0, seed: Math.random() * 1e5 | 0 });
  },
  addVisitor() {
    const z = ZONES.get(ECON.zoneOf(ECON.alt(G.S)));
    const id = U.pick(z.visitors || ["pigeon_tie"]), v = DATA.VISITORS[id];
    if (!v) return;
    const fromL = Math.random() < 0.5;
    const yTop = (UI.hudBottom || 0) + 70;   // fly below the HUD cards so they can always be clicked
    GAME.visitors.push({ id, v, t: 0, life: 15, fromL, y0: U.clamp(G.H * (0.2 + Math.random() * 0.35), yTop, Math.max(yTop, G.H - 140)) });
    SFX.play("visitor");
    UI.hint("visitor", "A weird visitor appeared! Click it before it leaves. Something good happens. Probably.");
  },
  visitorPos(o) {
    const p = o.t / o.life, x = o.fromL ? U.lerp(-60, G.W + 60, p) : U.lerp(G.W + 60, -60, p);
    return [x, o.y0 + Math.sin(o.t * 1.6) * 24];
  },
  reward(rw, sx, sy) {
    const S = G.S;
    if (rw === "frenzy") GAME.buffs.frenzy = Math.min(60, GAME.buffs.frenzy + 20);
    if (rw === "spit") GAME.buffs.spit = Math.min(60, GAME.buffs.spit + 20);
    if (rw === "gold") GAME.buffs.gold = Math.min(60, GAME.buffs.gold + 20);
    if (rw === "socks") for (let k = 0; k < 8; k++) GAME.addSock(true);
    if (rw === "cash") GAME.earn(Math.max(ECON.ips(S) * 60, ECON.spC(S, S.n) * 0.1), sx, sy);
    GAME.refreshPay();
    SFX.play(rw === "cash" ? "coin" : "buff");
  },

  /* ---------- zones ---------- */
  arrive(k) {
    const S = G.S, z = ZONES.get(k), got = [];
    S.zone = Math.max(S.zone, k);
    const rel = DATA.RELICS.find(r => r.id === z.relic);
    if (rel && !S.relics[rel.id]) { S.relics[rel.id] = 1; got.push(rel.ic + " " + rel.name + " (" + rel.desc + ")"); }
    if (z.hat && !S.hats[z.hat]) { S.hats[z.hat] = 1; got.push("🎩 New hat: " + DATA.HATS.find(h => h.id === z.hat).name); }
    if (z.trinket) { S.trinkets.push(Object.assign({ z: k }, z.trinket)); got.push("✨ " + z.trinket.name + " (" + z.trinket.desc + ")"); }
    got.push("📈 Zone bonus: all payouts x1.35");
    if (z.quest) QUESTS.addSpecial(k);
    if (k === 6) S.flags.moonGone = 1;
    if (k === 14) S.flags.finale = 1;
    GAME.refreshPay();
    GAME.mood("shock", 3);
    GAME.zoneQueue.push(k);
    SFX.play("zone");
    const done = () => {
      GAME.zoneQueue.shift();
      CINE.play("reward", { title: z.name, icon: rel ? rel.ic : "✨", lines: got }, () => { UI.refreshAll(); });
      STATE.save(S);
    };
    if (S.settings.cine !== false && z.arrive) CINE.play("zone", { zone: z }, done);
    else { UI.toast("You reached " + z.name + "!", "zone"); done(); }
  },

  /* ---------- composting ---------- */
  compost() {
    const S = G.S, g = ECON.mulchGain(S);
    if (g < 1) { SFX.play("error"); UI.toast("Wormsley only eats a stalk taller than the last one. Grow to " + ECON.compostNeed(S) + " plants.", "zone", 4); return; }
    const gain = ECON.mtnGain(S), top = GAME.plantInfo(S.n - 1);
    const plants = [];
    for (let i = Math.max(0, S.n - 8); i < S.n; i++) plants.push(GAME.plantInfo(i));
    // remember a few of the eaten plants: they show up buried in this layer of the mountain
    const nG = Math.min(3, Math.max(1, Math.floor(gain / 3))), ghosts = [];
    for (let k = 0; k < nG; k++) ghosts.push(Math.min(S.n - 1, Math.floor(S.n * (k + 0.3 + Math.random() * 0.4) / nG)));
    S.strata.push({ h: gain, name: top.name, n: S.n, hue: top.hue, cc: S.cc, ghosts });
    S.lastN = S.n;
    S.caps = S.caps || {};
    for (let i = 0; i < S.n; i++) S.caps[i] = (S.caps[i] || 0) + 1;   // every slot you reached gets +5 level cap
    S.mu += g; S.tm += g; S.cc++; S.mtn += gain; S.lastMulch = g; S.stats.composts++;
    S.m = 0; S.run = 0; S.n = Math.max(1, ECON.headStart(S)); S.lv = {}; S.bk = {}; S.ac = {}; S.shop = {}; S.runT = 0;
    GAME.beans.length = 0; GAME.visitors.length = 0; GAME.socks.length = 0; GAME.parts.length = 0; GAME.floats.length = 0;
    GAME.sel = -1; GAME.lastRun = 0; GAME.ipsM = 0;
    GAME.buffs.frenzy = GAME.buffs.spit = GAME.buffs.gold = 0;
    GAME.refreshPay(); G.follow = true;
    SFX.play("compost");
    const first = !S.flags.composted;
    S.flags.composted = 1;
    STATE.save(S);
    const p = { mulch: g, ft: gain * ECON.FT, plants, top: top.name };
    const after = () => {
      G.cam = GAME.camFollow(); UI.refreshAll();
      if (first) UI.hint("perks", "Spend mulch on permanent perks in the Compost tab. They survive every compost, forever.", true);
    };
    if (first) CINE.play("compost", p, after);
    else if (S.settings.cine !== false) CINE.play("compostShort", p, after);
    else { UI.toast("Composted! +" + U.num(g) + " mulch, +" + U.ft(gain), "zone"); after(); }
  },

  /* ---------- offline ---------- */
  offline(sec) {
    const S = G.S, s = Math.min(sec, ECON.offCap(S));
    if (s < 30) return null;
    GAME.refreshPay();
    const cash = ECON.ips(S) * s * ECON.offRate(S);
    const socks = Math.floor(s / (ECON.sockInt(S) * 4)) * ECON.sockVal(S);
    S.m += cash; S.run += cash; STATE.addEarned(S, cash); S.soc += socks;
    return { sec, s, cash, socks, beans: Math.floor(s / ECON.spitInt(S)) };
  },

  /* ---------- talking ---------- */
  mood(m, t) { GAME.geraldMood = m; GAME.moodT = t; },
  chatter(dt) {
    const S = G.S, T = GAME.tm;
    GAME.moodT -= dt; if (GAME.moodT <= 0 && GAME.geraldMood !== "grump") GAME.geraldMood = "grump";
    for (let j = GAME.says.length - 1; j >= 0; j--) { GAME.says[j].t -= dt; if (GAME.says[j].t <= 0) GAME.says.splice(j, 1); }
    if (GAME.gSay) { GAME.gSay.t -= dt; if (GAME.gSay.t <= 0) GAME.gSay = null; }
    if (!S.settings.chatter) return;
    T.chat -= dt;
    if (T.chat <= 0) {
      T.chat = 6 + Math.random() * 6;
      const [lo, hi] = GAME.visRange();
      if (hi >= lo && GAME.says.length < 2) {
        const i = lo + Math.floor(Math.random() * (hi - lo + 1));
        GAME.says.push({ i, text: U.pick(DATA.PLANT_TALK), t: 3.4 });
      }
    }
    T.gerald -= dt;
    if (T.gerald <= 0) {
      T.gerald = 20 + Math.random() * 15;
      const z = ZONES.get(ECON.zoneOf(ECON.alt(S)));
      GAME.say(U.pick(DATA.GERALD_TALK.concat(z.quips && Math.random() < 0.3 ? [] : [])), 4);
    }
  },
  say(text, t = 3.5) { GAME.gSay = { text, t }; },

  /* ---------- effects ---------- */
  float(s, x, y, col) { if (GAME.floats.length < 40) GAME.floats.push({ s, x, y, col, t: 0 }); },
  burst(x, y, col, n, ring) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, sp = 60 + Math.random() * 120;
      GAME.parts.push({ k: "dot", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, t: 0, life: 0.5 + Math.random() * 0.3, col, r: 2 + Math.random() * 3 });
    }
    if (ring) GAME.parts.push({ k: "ring", x, y, t: 0, life: 0.35, col });
  },
  /* particle that flies from canvas point to a HUD element (by id) */
  flyTo(id, x, y, kind, n = 1) {
    const el = document.getElementById(id);
    if (!el || !el.offsetParent) return;
    const r = el.getBoundingClientRect(), c = G.canvas.getBoundingClientRect();
    const tx = r.left + r.width / 2 - c.left, ty = r.top + r.height / 2 - c.top;
    for (let k = 0; k < n; k++) GAME.parts.push({ k: kind, x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, sx: x, sy: y, tx, ty, t: -k * 0.06, life: 0.7, seed: Math.random() * 1e5 | 0 });
  },
  stepFx(dt) {
    for (let j = GAME.parts.length - 1; j >= 0; j--) {
      const p = GAME.parts[j]; p.t += dt;
      if (p.t > p.life) { GAME.parts.splice(j, 1); if (p.k === "coin" || p.k === "sock") UI.bump(p.k === "coin" ? "hudMoney" : "hudSocks"); continue; }
      if (p.k === "dot") { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; }
    }
    for (let j = GAME.floats.length - 1; j >= 0; j--) { GAME.floats[j].t += dt; if (GAME.floats[j].t > 1.2) GAME.floats.splice(j, 1); }
  },

  /* ---------- input ---------- */
  bubbleHit: [], ghost: null,
  click(mx, my, touch) {
    const S = G.S, fat = touch ? 14 : 0;     // fingers are bigger than cursors
    for (let j = GAME.socks.length - 1; j >= 0; j--) {
      const k = GAME.socks[j];
      if (Math.hypot(mx - k.x, my - k.y) < 38 + fat) {
        const v = ECON.sockVal(S);
        S.soc += v; S.stats.socks++;
        GAME.socks.splice(j, 1);
        GAME.float("+" + U.num(v) + " 🧦", k.x, k.y, INK.C.pink);
        GAME.flyTo("hudSocks", k.x, k.y, "sock", 1);
        GAME.burst(k.x, k.y, INK.C.pink, 6, 1);
        SFX.play("sock");
        if (S.soc >= 6) UI.hint("socks", "Socks buy automation! Click a plant and spend socks so it upgrades or collects by itself.");
        return;
      }
    }
    for (let j = GAME.visitors.length - 1; j >= 0; j--) {
      const o = GAME.visitors[j], [x, y] = GAME.visitorPos(o);
      if (Math.hypot(mx - x, my - y) < 52 + fat) {
        GAME.visitors.splice(j, 1); S.stats.visitors++;
        GAME.burst(x, y, INK.C.lil, 14, 1);
        GAME.reward(o.v.rw, x, y);
        UI.toast(o.v.name + ": " + o.v.line, "visitor", 5);
        GAME.float(DATA.REWARD_NAMES[o.v.rw], x, y - 30, INK.C.gold);
        return;
      }
    }
    // everything below lives in the (possibly zoomed) world: convert to virtual coordinates
    const z = G.zoom, vx = mx / z, vy = my / z, vf = fat / z;
    for (const b of GAME.bubbleHit) if (Math.hypot(vx - b.x, vy - b.y) < b.r + 10 + vf) { GAME.collect(b.i, b.x * z, b.y * z); return; }
    const g = GAME.ghost;
    if (g && Math.hypot(vx - g.x, vy - g.y) < 40 + vf) { GAME.grow(); return; }
    const gy = GAME.toY(GAME.geraldWY());
    if (Math.hypot(vx - G.vW / 2, vy - gy) < 48 + vf) { GAME.poke(); return; }
    const [lo, hi] = GAME.visRange();
    for (let i = lo; i <= hi; i++) {
      if (Math.hypot(vx - GAME.plantSX(i), vy - GAME.toY(GAME.plantWY(i))) < 46 + vf) {
        GAME.sel = GAME.sel === i ? -1 : i; GAME.wob[i] = 0.5; SFX.play("click"); UI.refreshMenu(); return;
      }
    }
    GAME.sel = -1; UI.refreshMenu();
  },
  poke() {
    const S = G.S;
    GAME.mood("shock", 0.35);
    if (GAME.tm.poke > 0) return;
    GAME.tm.poke = 0.3; S.stats.pokes++;
    GAME.spit(true); SFX.play("poke");
    if (Math.random() < 0.08) GAME.say(U.pick(["Hnk.", "Rude.", "Again. Do it again.", "I felt that.", "OI.", "*spits harder*"]), 1.6);
  },

  /* ---------- rendering ---------- */
  _err: {},
  safe(key, fn) {
    try { fn(); } catch (e) { if (!GAME._err[key]) { GAME._err[key] = 1; console.error("[draw " + key + "]", e); } }
  },
  look(px, py) {      // px, py in the (zoomed) world view; the mouse is in screen pixels
    const m = G.mouse; if (!m.in) return { x: 0, y: 0.3 };
    const dx = m.x / G.zoom - px, dy = m.y / G.zoom - py, d = Math.max(80, Math.hypot(dx, dy));
    return { x: dx / d, y: dy / d };
  },
  draw() {
    const ctx = G.ctx, W = G.W, H = G.H, S = G.S, t = G.T, z = G.zoom, vW = G.vW, vH = G.vH, cx = vW / 2;
    const view = { W: vW, H: vH, cx, toY: GAME.toY, gap: ECON.GAP, cam: G.cam, zoom: z };
    const near = z > 0.55;              // small labels and chatter only when not zoomed far out
    const topV = ((UI.hudBottom || 0) + 8) / z;   // nothing important may be drawn above this (HUD covers it)
    ctx.save();
    GAME.safe("sky", () => WORLD.sky(ctx, W, H, GAME.camAlt(), t));
    ctx.scale(z, z);
    GAME.safe("landmarks", () => WORLD.landmarks(ctx, view, t));
    GAME.safe("ground", () => WORLD.ground(ctx, view, t));
    GAME.safe("buried", () => GAME.drawBuried(ctx, cx, t));
    GAME.safe("stalk", () => GAME.drawStalk(ctx, cx, t));
    if (z < GAME.zoomTop() - 0.05) GAME.safe("zoneLines", () => GAME.drawZoneLines(ctx, z, vW, vH));
    const [lo, hi] = GAME.visRange();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (let i = lo; i <= hi; i++) {
      const px = GAME.plantSX(i), py = GAME.toY(GAME.plantWY(i)), info = GAME.plantInfo(i);
      const grow = GAME.sp[i] !== undefined ? U.easeOutBack(Math.min(1, GAME.sp[i])) : 1;
      if (i === GAME.sel) {
        ctx.save(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 18;
        INK.oval(ctx, px, py + 4, 54, 54, null, true); ctx.restore();
      }
      ctx.save(); ctx.translate(px, py);
      const talk = GAME.says.some(s => s.i === i);
      GAME.safe("plant", () => DRAW.plant(ctx, info, { t, wob: GAME.wob[i] || 0, grow, look: GAME.look(px, py), talk, dir: GAME.side(i) }));
      ctx.restore();
    }
    if (near) for (let i = lo; i <= hi; i++) {
      const px = GAME.plantSX(i), py = GAME.toY(GAME.plantWY(i)), l = S.lv[i] || 0, c = ECON.upC(S, i, l);
      const cap = ECON.cap(S, i), mx = l >= cap;
      INK.label(ctx, (mx ? "MAX " + l : "Lv " + l + "/" + cap) + (S.ua[i] && !S.uo[i] ? " ⟳" : "") + (GAME.auto(i) ? " ⚲" : ""), px, py + 62, 14, mx ? INK.C.gold : INK.C.cream);
      if (!mx) INK.label(ctx, U.money(c), px, py + 78, 13, S.m >= c ? INK.C.moss : "#cdb8ee");
    }
    GAME.safe("beans", () => GAME.drawBeans(ctx, cx, t));
    // ghost of the next plant: click to grow
    const nx = GAME.plantSX(S.n), ny = GAME.toY(GAME.plantWY(S.n)), nc = ECON.spC(S, S.n);
    if (near && ny > -60 && ny < vH + 60) {
      const ok = S.m >= nc;
      ctx.save(); ctx.globalAlpha = ok ? 0.95 : 0.55; ctx.setLineDash([6, 6]); ctx.lineWidth = 3;
      ctx.strokeStyle = ok ? INK.C.moss : "#ffffff"; ctx.lineDashOffset = t * 10;
      INK.oval(ctx, nx, ny, 30 + (ok ? Math.sin(t * 5) * 3 : 0), 30 + (ok ? Math.sin(t * 5) * 3 : 0), "rgba(29,15,43,0.25)", true);
      ctx.setLineDash([]);
      INK.label(ctx, "+", nx, ny + 9, 28, ok ? INK.C.moss : INK.C.cream);
      INK.label(ctx, U.money(nc), nx, ny + 50, 13, ok ? INK.C.moss : "#cdb8ee");
      ctx.restore();
      GAME.ghost = { x: nx, y: ny };
    } else GAME.ghost = null;
    // Gerald
    const gy = GAME.toY(GAME.geraldWY());
    if (gy > -120 && gy < vH + 120) {
      ctx.save(); ctx.translate(cx, gy);
      const blink = (t % 4.3) < 0.13 ? 1 : 0;
      GAME.safe("gerald", () => DRAW.gerald(ctx, { t, spit: GAME.spitAnim / 0.25, look: GAME.look(cx, gy), hat: S.hat, mood: GAME.geraldMood, blink, neck: false }));
      ctx.restore();
      if (GAME.gSay && near) GAME.speech(ctx, cx, gy - 74, GAME.gSay.text, INK.C.cream, 1, topV, gy);
    }
    GAME.safe("bubbles", () => GAME.drawBubbles(ctx, lo, hi, t, near));
    if (near) for (const s of GAME.says) {
      if (s.i < lo || s.i > hi) continue;
      const py = GAME.toY(GAME.plantWY(s.i));
      GAME.speech(ctx, GAME.plantSX(s.i) + GAME.side(s.i) * 30, py - 50, s.text, "#ffffff", GAME.side(s.i), topV, py);
    }
    ctx.restore();
    // screen-space things: visitors, socks, effects, paper overlay
    ctx.save();
    for (const o of GAME.visitors) {
      const [x, y] = GAME.visitorPos(o), a = Math.min(1, o.t * 2, (o.life - o.t) * 2);
      ctx.save(); ctx.globalAlpha = a;
      ctx.strokeStyle = INK.rgba("#ffffff", 0.5 + 0.3 * Math.sin(t * 6)); ctx.lineWidth = 3; ctx.setLineDash([4, 7]);
      INK.oval(ctx, x, y, 50, 50, null, true); ctx.setLineDash([]);
      ctx.translate(x, y);
      GAME.safe("visitor", () => DRAW.visitor(ctx, o.v, t));
      ctx.restore();
      INK.label(ctx, o.v.name, x, y + 66, 14, INK.C.gold);
    }
    for (const k of GAME.socks) {
      ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(Math.sin(k.t * 2 + k.ph) * 0.5);
      GAME.safe("sock", () => DRAW.sock(ctx, k.k, t, k.seed));
      ctx.restore();
    }
    GAME.drawFx(ctx, t);
    GAME.safe("overlay", () => WORLD.overlay(ctx, W, H, t));
    ctx.restore();
  },
  drawStalk(ctx, cx, t) {
    // the stalk runs right up into the middle of Gerald's head (it IS his neck), straightening out just below him
    // ...and at the bottom it dives straight into the mountain, lined up with the buried stalk
    const S = G.S, base = GAME.mtnTop(), top = GAME.geraldWY();
    const y0 = Math.max(base - 26, G.cam - 120), y1 = Math.min(top, G.cam + G.vH + 120);
    if (y1 <= y0) return;
    const wx = wy => cx + Math.sin(wy * 0.022 + t * 1.1) * 6 * U.clamp((top - wy) / 130, 0, 1) * U.clamp((wy - base) / 130, 0, 1);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const pass = (w, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
      for (let wy = y0; wy <= y1 + 1; wy += 16) { const y = GAME.toY(Math.min(wy, y1)); wy === y0 ? ctx.moveTo(wx(wy), y) : ctx.lineTo(wx(wy), y); }
      ctx.stroke();
    };
    // branches: from the stalk out to each plant's own stem base, at (0, +44) below the plant's centre
    const [lo, hi] = GAME.visRange();
    for (const [w, col] of [[13, INK.C.ink], [7, "#5fb85a"]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      for (let i = lo; i <= hi; i++) {
        const wy = GAME.plantWY(i), py = GAME.toY(wy), d = GAME.side(i), sx = wx(wy - 40), ex = GAME.plantSX(i), ey = py + 44;
        ctx.beginPath(); ctx.moveTo(sx, py + 40);
        ctx.bezierCurveTo(sx + d * 26, py + 46, ex - d * 22, ey + 10, ex, ey); ctx.stroke();
      }
    }
    pass(20, INK.C.ink); pass(13, "#5fb85a"); pass(4, "#8fe08a");
    // leaves and the occasional stalk eye (it watches you)
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK.C.ink;
    const step = 46, s0 = Math.ceil(Math.max(y0, base + 12) / step) * step;   // none underground...
    for (let wy = s0; wy < Math.min(y1, top - 55); wy += step) {     // ...and none on Gerald's chin
      const k = Math.round(wy / step), y = GAME.toY(wy), x = wx(wy), d = k % 2 ? 1 : -1;
      if (k % 9 === 4) {
        const bl = ((t + k * 0.37) % 5) < 0.14 ? 1 : 0;
        INK.eye(ctx, x, y, 7, GAME.look(x, y), { blink: bl, lid: "#5fb85a" });
        continue;
      }
      ctx.save(); ctx.translate(x + d * 8, y); ctx.rotate(d * (0.6 + Math.sin(t * 2 + k) * 0.15));
      INK.blob(ctx, d * 9, 0, 11, 5, "#6bd36b", true, k, 0.08); ctx.restore();
    }
  },
  /* the old stalk buried in the compost mountain: leaves, no live plants, roots at the very bottom,
     and a few of the plants Wormsley ate, resting in the layer they were composted into */
  drawBuried(ctx, cx, t) {
    const S = G.S, top = GAME.mtnTop(), vH = G.vH;
    const wx = wy => cx + Math.sin(wy * 0.013) * 7 * U.clamp((top - wy) / 160, 0, 1);   // straight where it meets the live stalk
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const y0 = Math.max(-40, G.cam - 160), y1 = Math.min(top + 6, G.cam + vH + 160);
    if (y1 > y0) {
      for (const [w, col] of [[20, INK.C.ink], [13, "#4f7f40"], [4, "#6f9d55"]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
        for (let wy = y0; wy <= y1 + 1; wy += 20) { const y = GAME.toY(Math.min(wy, y1)); wy === y0 ? ctx.moveTo(wx(wy), y) : ctx.lineTo(wx(wy), y); }
        ctx.stroke();
      }
      ctx.lineWidth = 2.5; ctx.strokeStyle = INK.C.ink;
      const step = 64, s0 = Math.max(step, Math.ceil(y0 / step) * step);
      for (let wy = s0; wy < y1 - 20; wy += step) {
        const k = Math.round(wy / step), d = k % 2 ? 1 : -1;
        ctx.save(); ctx.translate(wx(wy) + d * 8, GAME.toY(wy)); ctx.rotate(d * 0.95);
        INK.blob(ctx, d * 10, 0, 12, 5, "#5a8a46", true, k, 0.08); ctx.restore();
      }
    }
    // roots, spreading into the garden soil under everything
    const gy = GAME.toY(0);
    if (gy > -60 && gy < vH + 140) {
      for (const [w, col] of [[8, INK.C.ink], [4.5, "#d8b98a"]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w;
        for (let k = 0; k < 7; k++) {
          const d = k % 2 ? 1 : -1, spread = (16 + k * 22) * d, deep = 34 + ((k * 37) % 5) * 14;
          ctx.beginPath(); ctx.moveTo(wx(0), gy - 4);
          ctx.bezierCurveTo(wx(0) + spread * 0.2, gy + deep * 0.5, wx(0) + spread * 0.8, gy + deep * 0.6, wx(0) + spread, gy + deep);
          ctx.lineTo(wx(0) + spread * 1.25, gy + deep + 12);
          ctx.stroke();
        }
      }
    }
    // remembered plants, a few per compost layer, spread through that layer
    let base = 0;
    for (let j = 0; j < S.strata.length; j++) {
      const st = S.strata[j], h = (st.h || 0) * ECON.GAP, lo = base, hi = base + h;
      base = hi;
      if (h < 60 || hi < G.cam - 120 || lo > G.cam + vH + 120) continue;
      const n = st.n || 8, gh = st.ghosts || [Math.floor(n * 0.3), Math.floor(n * 0.7)], cc = st.cc != null ? st.cc : j;
      gh.forEach((i, k) => {
        const wy = lo + ((k + 0.5) / gh.length) * h, d = (j + k) % 2 ? 1 : -1;
        const x = cx + d * (64 + ((j * 37 + k * 23) % 40)), y = GAME.toY(wy);
        if (y < -60 || y > vH + 60) return;
        ctx.save(); ctx.translate(x, y); ctx.rotate(d * (0.25 + ((j + k) % 3) * 0.12)); ctx.scale(1.1, 1.1);
        ctx.globalAlpha = 0.92;
        GAME.safe("buriedPlant", () => DRAW.plant(ctx, GAME.plantInfoFor(cc, i), { t, sad: true, grow: 1, look: { x: -d, y: -0.4 }, dir: d }));
        ctx.globalAlpha = 0.18; INK.oval(ctx, 0, 6, 46, 50, "#5a3820");
        ctx.restore();
      });
    }
  },
  /* zoomed out: dashed lines + names where each zone starts, so you can read the mountain like a ruler */
  drawZoneLines(ctx, z, vW, vH) {
    const S = G.S, a = U.clamp((GAME.zoomTop() - 0.05 - z) / 0.3, 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    ctx.setLineDash([12 / z, 10 / z]); ctx.lineWidth = 2 / z; ctx.strokeStyle = "rgba(255,243,220,0.75)";
    for (let k = 1; k <= S.zone + 1; k++) {
      const at = ECON.zoneAt(k), y = GAME.toY(at * ECON.GAP);
      if (y < -30 / z || y > vH + 30 / z) continue;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(vW, y); ctx.stroke();
      INK.label(ctx, (k > S.zone ? "NEXT: " : "") + ZONES.get(k).short + " · " + U.ft(at), 12 / z, y - 7 / z, 16 / z, k > S.zone ? INK.C.pink : INK.C.gold, "left", INK.FONT, 4 / z);
    }
    ctx.restore();
  },
  drawBeans(ctx, cx, t) {
    const vH = G.vH, mt = GAME.mtnTop();
    let drawn = 0;
    for (const b of GAME.beans) {
      const tx = b.cur >= 0 ? GAME.side(b.cur) * 74 : b.gx, ty = b.cur >= 0 ? GAME.plantWY(b.cur) + 26 : mt + 6;
      const u = b.u, wy = U.lerp(b.y, ty, u) + (b.first ? 0 : 36 * Math.sin(Math.PI * u)), sy = GAME.toY(wy);
      if (sy < -20 || sy > vH + 20) continue;
      if (++drawn > 160) break;
      ctx.save(); ctx.translate(cx + U.lerp(b.x, tx, u), sy); ctx.rotate(u * 6 + b.seed);
      DRAW.bean(ctx, b.gold, t, b.seed);
      ctx.restore();
    }
  },
  drawBubbles(ctx, lo, hi, t, near) {
    const S = G.S; GAME.bubbleHit.length = 0;
    for (let i = lo; i <= hi; i++) {
      const b = S.bk[i] || 0;
      if (b <= 0 || GAME.auto(i)) continue;
      const x = GAME.bubbleSX(i), y = GAME.toY(GAME.plantWY(i)) + Math.sin(t * 3 + i) * 4;
      const r = 15 + Math.min(14, Math.log10(1 + b / ((GAME.payC[i] || 1) * 2)) * 6);
      ctx.save(); ctx.translate(x, y); DRAW.bubble(ctx, r, t); ctx.restore();
      if (near) INK.label(ctx, U.money(b), x, y - r - 7, 13, INK.C.gold);
      GAME.bubbleHit.push({ i, x, y, r });
    }
  },
  /* speech bubble whose tail points at (x, y). minTop: keep it below the HUD; anchor: the speaker's y,
     so if the bubble has to be pushed down it moves beside the speaker instead of over its face */
  speech(ctx, x, y, text, bg, dir, minTop = 6, anchor = y) {
    ctx.save();
    ctx.font = "bold 16px " + INK.HAND;
    const vW = G.vW, w = Math.min(230, vW - 16, ctx.measureText(text).width + 22), lines = [];
    let line = "";
    for (const word of text.split(" ")) {
      const tt = line ? line + " " + word : word;
      if (ctx.measureText(tt).width > w - 18 && line) { lines.push(line); line = word; } else line = tt;
    }
    lines.push(line);
    const h = lines.length * 18 + 12;
    let bx = U.clamp(x - w / 2, 6, vW - w - 6), by = y - h, tail = true;
    if (by < minTop) {                      // would hide under the HUD: put it beside the speaker
      by = Math.max(minTop, anchor - h / 2); tail = false;
      const right = x + 46, left = x - 46 - w;
      if (right + w < vW - 6) bx = right;
      else if (left > 6) bx = left;
      else { bx = U.clamp(x - w / 2, 6, vW - w - 6); by = anchor + 48; }   // no room beside: go under the speaker
    }
    ctx.fillStyle = bg; ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(bx, by, w, h, 12); ctx.fill(); ctx.stroke();
    if (tail) {
      const tx = U.clamp(x, bx + 14, bx + w - 14);
      ctx.beginPath(); ctx.moveTo(tx - 7, by + h - 1); ctx.lineTo(tx - dir * 4, by + h + 12); ctx.lineTo(tx + 7, by + h - 1);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = bg; ctx.fillRect(tx - 6, by + h - 3, 12, 4);
    }
    ctx.fillStyle = INK.C.ink; ctx.textAlign = "center";
    lines.forEach((l, k) => ctx.fillText(l, bx + w / 2, by + 20 + k * 18));
    ctx.restore();
  },
  drawFx(ctx, t) {
    for (const p of GAME.parts) {
      if (p.t < 0) continue;
      const a = 1 - p.t / p.life;
      if (p.k === "dot") { ctx.globalAlpha = a; INK.oval(ctx, p.x, p.y, p.r, p.r, p.col); }
      else if (p.k === "ring") { ctx.globalAlpha = a; ctx.strokeStyle = p.col; ctx.lineWidth = 3; INK.oval(ctx, p.x, p.y, 10 + p.t * 120, 10 + p.t * 120, null, true); }
      else {
        const e = U.easeInOut(p.t / p.life), x = U.lerp(p.sx, p.tx, e) + Math.sin(e * 3.14) * 40, y = U.lerp(p.sy, p.ty, e) - Math.sin(e * 3.14) * 80;
        ctx.globalAlpha = 1; ctx.save(); ctx.translate(x, y); ctx.scale(0.7, 0.7);
        if (p.k === "coin") DRAW.coin(ctx, 9); else DRAW.sock(ctx, 0, t, p.seed);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    for (const f of GAME.floats) {
      const e = f.t / 1.2;
      ctx.globalAlpha = Math.min(1, (1 - e) * 2);
      INK.label(ctx, f.s, f.x, f.y - e * 60, 17 + (1 - e) * 3, f.col);
    }
    ctx.globalAlpha = 1;
  },
};
