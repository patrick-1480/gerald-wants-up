/* Gerald Wants Up — economy.
   Pure functions over the save state S, shared with tools/sim.js so the balance
   simulator and the real game can never disagree.

   Money is stored in units of 10^S.u dollars. When numbers get huge the game
   redenominates (S.u += 150, every stored amount / 1e150), so values never hit
   Infinity no matter how long anyone plays. All payouts and prices are computed
   in log-space for the same reason. */
(function (root) {
  const E = {};
  const LN10 = Math.LN10;
  E.GAP = 92;            // px between plants on the stalk
  E.FT = 100;            // feet per slot (one plant = one slot of height)
  E.MIN_COMPOST = 8;     // plants needed before Wormsley will eat them
  E.BASE_SPIT = 1.6;     // seconds between beans at the start
  E.MIN_SPIT = 0.11;     // fastest bean interval; extra speed turns into bean value
  E.GOLD_X = 6;          // golden bean payout multiplier
  E.CAP0 = 10;           // every plant slot starts capped at this level...
  E.CAPSTEP = 5;         // ...and each compost raises the cap of every slot you had grown by this much

  /* ---------- Tunables (tools/sim.js can override via GWU_K) ---------- */
  E.K = {
    pb: 3,      // payout ratio between neighbouring plants
    a0: 3.3,    // sprout cost ratio for the first plants...
    pa: 6.0,    // ...ramping up to this ratio...
    ramp: 14,   // ...over this many plants
    p0: 4,      // first sprout cost scale
    lp: 1.2,    // payout growth per level
    lq: 1.7,    // upgrade cost growth per level
    lc: 4,      // upgrade cost scale (x plant base)
    ms: 10,     // every ms levels: payout x2 (so hitting the starting cap of 10 doubles a plant)
    mr: 1.1,    // mulch ratio per extra plant at compost
    mf: 0.35,   // share of the grown stalk the compost mountain keeps
  };
  if (typeof process !== 'undefined' && process.env && process.env.GWU_K) Object.assign(E.K, JSON.parse(process.env.GWU_K));
  const K = E.K;

  /* ---------- Sky Shop: bought with $, reset by composting ---------- */
  E.SHOP = [
    { id: 'spit',  name: 'Spicy Spit',      desc: 'Gerald spits beans 11% faster',          c: 15,  g: 3.6, max: 25 },
    { id: 'gold',  name: 'Bean Polish',     desc: '+2% chance of a golden bean (pays x6)', c: 120, g: 3.6, max: 10 },
    { id: 'cheap', name: 'Coupon Clipping', desc: 'Sprouting new plants costs 7% less',    c: 400, g: 4.2, max: 10 },
    { id: 'rate',  name: 'Gossipy Sky',     desc: 'Socks fall 10% more often',             c: 250, g: 4.0, max: 8 },
    { id: 'val',   name: 'Fancier Socks',   desc: 'Socks are worth 15% more',              c: 600, g: 4.6, max: 10 },
  ];

  /* ---------- Mulch perks: bought with mulch, permanent ---------- */
  E.PERKS = [
    { id: 'pay',   name: 'Fertilized Beans',  desc: 'All payouts x1.5',                                       c: 1,  g: 1.9, max: 400 },
    { id: 'head',  name: 'Head Start',        desc: 'Start each run with +1 free plant',                      c: 4,  g: 2.8, max: 5 },
    { id: 'shop',  name: 'Shop Steward',      desc: 'Auto-buys Sky Shop upgrades (Spicy Spit, Fancier Socks...) when you can afford them', c: 25, g: 1, max: 1 },
    { id: 'worm',  name: 'Wormsley Appetite', desc: '+25% mulch from composting',                              c: 2,  g: 1.9, max: 40 },
    { id: 'dirt',  name: 'Dense Compost',     desc: 'Mountain keeps +5% more of your stalk',                  c: 4,  g: 2.4, max: 5 },
    { id: 'spit2', name: 'Spit Coach',        desc: 'Beans 6% faster, forever',                               c: 3,  g: 2.0, max: 15 },
    { id: 'sockm', name: 'Sock Magnet',       desc: 'Socks worth x1.3',                                       c: 5,  g: 3.0, max: 6 },
    { id: 'rain',  name: 'Sock Rain',         desc: 'Socks fall 12% more often',                              c: 4,  g: 2.4, max: 6 },
    { id: 'gold2', name: 'Golden Gut',        desc: '+1.5% golden bean chance, forever',                      c: 5,  g: 2.4, max: 6 },
    { id: 'visit', name: 'Weirdo Magnet',     desc: 'Weird visitors show up 15% more often',                 c: 5,  g: 2.6, max: 5 },
    { id: 'away',  name: 'Night Shift',       desc: 'Offline earnings +15% (offline time counts up to 2h)',   c: 4,  g: 2.2, max: 5 },
  ];

  /* ---------- Zones: altitude thresholds in slots ---------- */
  // Hand-made zones first, then procedurally generated layers forever.
  E.ZONE_AT = [0, 12, 26, 44, 66, 92, 122, 160, 205, 258, 318, 386, 462, 546, 640];
  E.STORY_ZONES = E.ZONE_AT.length;
  const zc = [];
  E.zoneAt = k => {
    if (k < E.ZONE_AT.length) return E.ZONE_AT[k];
    while (zc.length <= k - E.ZONE_AT.length) {
      const j = zc.length, prev = j ? zc[j - 1] : E.ZONE_AT[E.ZONE_AT.length - 1];
      zc.push(prev + 110 + 15 * j + 3 * j * j);   // endless layers spread out more and more
    }
    return zc[k - E.ZONE_AT.length];
  };
  E.zoneOf = slots => { let k = 0; while (E.zoneAt(k + 1) <= slots) k++; return k; };

  /* ---------- helpers ---------- */
  const lv = (S, i) => S.lv[i] || 0;
  // level cap: +5 per compost the slot survived, but lower plants top out lower (the bottom plant stays at 10)
  E.capMax = i => E.CAP0 + 3 * i;
  E.cap = (S, i) => Math.min(E.capMax(i), E.CAP0 + E.CAPSTEP * ((S.caps && S.caps[i]) || 0));
  E.shopL = (S, id) => S.shop[id] || 0;
  E.perkL = (S, id) => S.perk[id] || 0;
  E.cost = (d, l) => Math.ceil(d.c * d.g ** l);          // perk price in mulch
  E.shopCost = (S, d, l) => d.c * d.g ** l / 10 ** S.u;  // shop price in current money units

  /* ---------- relics & trinkets ---------- */
  E.lnRelic = (S, key) => {
    let s = 0;
    const R = root.RELICS || [];
    for (const r of R) if (S.relics[r.id] && r.k === key) s += Math.log(r.v);
    if (S.trinkets) for (const t of S.trinkets) if (t.k === key) s += Math.log(t.v);
    return s;
  };
  E.relicMult = (S, key) => Math.exp(E.lnRelic(S, key));
  E.relicAdd = (S, key) => {          // additive relics (golden chance)
    let s = 0;
    const R = root.RELICS || [];
    for (const r of R) if (S.relics[r.id] && r.k === key) s += r.v;
    if (S.trinkets) for (const t of S.trinkets) if (t.k === key) s += t.v;
    return s;
  };

  /* ---------- plants (log-space) ---------- */
  const lnC = [Math.log(K.p0)];
  E.lnSp = i => {
    while (lnC.length <= i) {
      const j = lnC.length - 1;
      lnC.push(lnC[j] + Math.log(Math.min(K.pa, K.a0 + (K.pa - K.a0) * j / K.ramp)));
    }
    return lnC[i];
  };
  E.lnBase = i => i * Math.log(K.pb);
  E.lnLv = l => l * Math.log(K.lp) + Math.floor(l / K.ms) * Math.LN2;
  E.lvMult = l => Math.exp(E.lnLv(l));
  E.mtnMult = S => (1 + S.mtn / 15) ** 2;     // polynomial on purpose: exponential here runs away
  E.zoneMult = S => 1.35 ** S.zone;
  E.mulchMult = S => 1 + 0.1 * S.tm;
  E.lnGlobal = S =>
    Math.log(E.mulchMult(S)) + E.perkL(S, 'pay') * Math.log(1.5) + Math.log(E.mtnMult(S)) +
    S.zone * Math.log(1.35) + E.lnRelic(S, 'pay');
  E.globalMult = S => Math.exp(E.lnGlobal(S));
  E.lnUnit = S => S.u * LN10;
  // payout per bean hit, in money units (buff = temporary multiplier)
  E.pay = (S, i, buff = 1) => Math.exp(E.lnBase(i) + E.lnLv(lv(S, i)) + E.lnGlobal(S) - E.lnUnit(S)) * buff;
  E.upC = (S, i, l) => Math.exp(E.lnBase(i) + Math.log(K.lc) + l * Math.log(K.lq) - E.lnUnit(S));
  E.spC = (S, i) => Math.exp(E.lnSp(i) - E.lnUnit(S)) * 0.93 ** E.shopL(S, 'cheap');
  // how many levels of plant i are affordable with money m (closed form, no loops)
  E.upAfford = (S, i, m) => {
    const c = E.upC(S, i, lv(S, i)), q = K.lq, room = E.cap(S, i) - lv(S, i);
    if (m < c || room <= 0) return [0, 0];
    const n = Math.min(room, Math.floor(Math.log(1 + m * (q - 1) / c) / Math.log(q)));
    return [n, c * (q ** n - 1) / (q - 1)];
  };

  /* ---------- beans ---------- */
  E.rawSpit = S => E.BASE_SPIT * 0.89 ** E.shopL(S, 'spit') * 0.94 ** E.perkL(S, 'spit2') / E.relicMult(S, 'spit');
  E.spitInt = S => Math.max(E.MIN_SPIT, E.rawSpit(S));
  E.beanX = S => Math.max(1, E.MIN_SPIT / E.rawSpit(S));    // overflow speed -> bean value
  E.goldChance = S => Math.min(0.5, 0.02 * E.shopL(S, 'gold') + 0.015 * E.perkL(S, 'gold2') + E.relicAdd(S, 'gold'));
  E.goldAvg = S => 1 + E.goldChance(S) * (E.GOLD_X - 1);
  E.sumPay = (S, buff = 1) => { let s = 0; for (let i = 0; i < S.n; i++) s += E.pay(S, i, buff); return s; };
  // income per second if every bubble were collected (offline, UI, quests)
  E.ips = (S, buff = 1) => E.sumPay(S, buff) * E.beanX(S) * E.goldAvg(S) / E.spitInt(S);

  /* ---------- socks ---------- */
  E.sockInt = S => Math.max(4, 15 * 0.9 ** E.shopL(S, 'rate') * 0.88 ** E.perkL(S, 'rain') / E.relicMult(S, 'sockRate'));
  E.sockVal = S => Math.ceil((1 + S.zone / 3) * 1.15 ** E.shopL(S, 'val') * 1.3 ** E.perkL(S, 'sockm') * E.relicMult(S, 'sockVal'));
  // sock automation prices grow with the plant slot, so socks stay worth catching all game
  // Sock prices are counted in "catches": a sock is worth about sockUnit at your zone (before sock perks),
  // so a forever upgrade is ~5 caught socks, auto-upgrade ~3, this-run auto-collect ~1.5, at any point in
  // the game. Higher plant slots cost a little more. Sock perks/shop make each catch worth more.
  E.sockUnit = S => 1 + S.zone / 3;
  E.sockSlot = i => 1 + i / 30;
  E.cUa = (S, i) => Math.ceil(3 * E.sockUnit(S) * E.sockSlot(i));     // auto-upgrade forever
  E.cAc = (S, i) => Math.ceil(1.5 * E.sockUnit(S) * E.sockSlot(i));   // auto-collect this run
  E.cPa = (S, i) => Math.ceil(5 * E.sockUnit(S) * E.sockSlot(i));     // auto-collect forever
  E.shrine = (S, kind) => Math.ceil((kind === "gold" ? 10 : 8) * E.sockUnit(S));   // Sock Shrine: socks -> a buff
  E.SUPER_SOCK = 5000;                         // Sock Butler: auto-buys both forever automations for each new plant

  /* ---------- compost ---------- */
  // Wormsley only eats a stalk taller than the last one he ate (stops compost spamming)
  E.compostNeed = S => Math.max(E.MIN_COMPOST, (S.lastN || 0) + 1);
  E.mulchGain = S => {
    if (S.n < E.compostNeed(S)) return 0;
    return Math.floor(K.mr ** (S.n - 3) * (1 + 0.25 * E.perkL(S, 'worm')) * E.relicMult(S, 'mulch'));
  };
  E.mtnFrac = S => K.mf + 0.05 * E.perkL(S, 'dirt');
  E.mtnGain = S => Math.floor(Math.max(0, S.n - E.perkL(S, 'head')) * E.mtnFrac(S));   // free head-start plants don't count
  E.alt = S => S.mtn + S.n;              // stalk top in slots
  E.headStart = S => 1 + E.perkL(S, 'head');

  /* ---------- offline ---------- */
  E.offRate = S => Math.min(1, (0.4 + 0.15 * E.perkL(S, 'away')) * E.relicMult(S, 'off'));
  E.OFF_MAX = 2 * 3600;                         // offline rewards never count more than 2 hours
  E.offCap = S => E.OFF_MAX;

  /* ---------- visitors ---------- */
  E.visitInt = S => Math.max(30, 90 * 0.85 ** E.perkL(S, 'visit') / E.relicMult(S, 'visit'));

  /* ---------- redenomination ---------- */
  // Returns the shift (in powers of ten) to apply to every stored amount, or 0.
  E.needShift = S => (S.m > 1e200 || S.run > 1e200) ? 150 : 0;

  root.ECON = E;
  if (typeof module !== 'undefined') module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
