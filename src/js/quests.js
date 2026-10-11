/* Gerald Wants Up — quests: 3 rotating side quests + one special request per story zone. */
const QUESTS = {
  SLOTS: 3, refillT: 0,
  maxLv() { const S = G.S; let m = 0; for (let i = 0; i < S.n; i++) m = Math.max(m, S.lv[i] || 0); return m; },
  stat(t) {
    const S = G.S, st = S.stats;
    switch (t) {
      case "tall": return S.n;
      case "level": return QUESTS.maxLv();
      case "compost": return st.composts;
      case "visit": return st.visitors;
      default: return st[t] || 0;
    }
  },
  abs: t => t === "tall" || t === "level",
  progress(q) {
    if (q.t === "earn") return q.acc || 0;
    return QUESTS.abs(q.t) ? QUESTS.stat(q.t) : QUESTS.stat(q.t) - q.base;
  },
  cash() { const S = G.S; return Math.max(ECON.ips(S) * 60, ECON.spC(S, S.n) * 0.1); },   // ~1 minute of income
  label(q) { return q.t === "earn" ? U.money(q.n) : U.num(q.n); },
  nice(x) { const e = 10 ** Math.floor(Math.log10(x) - 1); return Math.ceil(x / e) * e; },
  make() {
    const S = G.S, r = Math.random, active = S.quests.filter(q => q.sp === undefined).map(q => q.t);
    const rate = 1 / GAME.spitI, gc = ECON.goldChance(S);
    const opts = DATA.QUESTS.filter(tp => !active.includes(tp.t) &&
      !(tp.t === "golden" && gc <= 0) && !(tp.t === "earn" && ECON.ips(S) <= 0));
    const tp = U.pick(opts.length ? opts : DATA.QUESTS);
    let n;
    switch (tp.t) {
      case "sprouts": n = 3 + Math.floor(r() * 3); break;
      case "socks": n = Math.round((5 + r() * 5) * (1 + S.zone * 0.08)); break;
      case "upgrades": n = Math.round((25 + r() * 35) * (1 + S.zone * 0.25)); break;
      case "bubbles": n = Math.round(30 + r() * 40); break;
      case "beans": n = Math.max(100, Math.round(rate * (180 + r() * 150) / 10) * 10); break;
      case "golden": n = Math.max(3, Math.round(rate * gc * (240 + r() * 180))); break;
      case "visitors": n = 2 + (r() < 0.3 ? 1 : 0); break;
      case "pokes": n = 30 + Math.floor(r() * 40); break;
      case "earn": n = QUESTS.nice(Math.max(20, ECON.ips(S) * (300 + r() * 300))); break;
      case "tall": n = S.n + 2 + (S.n > 15 ? 1 : 0); break;
    }
    const k = r() < 0.45 || (!S.cc && r() < 0.6) ? "cash" : (r() < 0.65 || !S.cc ? "socks" : "mulch");
    const rw = { k };
    if (k === "socks") rw.v = Math.max(3, Math.round(ECON.sockVal(S) * (3 + r() * 3)));
    if (k === "mulch") rw.v = Math.max(1, Math.floor((S.lastMulch || 1) * 0.1));
    const text = U.pick(tp.texts).split("{n}").join(tp.t === "earn" ? U.money(n) : U.num(n));
    S.quests.push({ id: ++S.qSeq, t: tp.t, n, base: QUESTS.abs(tp.t) ? 0 : QUESTS.stat(tp.t), acc: 0, text, giver: U.pick(DATA.GIVERS), rw, done: false });
  },
  addSpecial(k) {
    const S = G.S, z = ZONES.get(k), zq = z.quest;
    if (!zq || S.quests.some(q => q.sp === k) || (S.flags.spDone && S.flags.spDone[k])) return;
    const t = zq.type === "visit" ? "visitors" : zq.type;
    let n = zq.n;
    if (zq.rel) n = (t === "tall" ? S.n : QUESTS.maxLv()) + zq.n;
    S.quests.unshift({ id: ++S.qSeq, sp: k, t, n, base: QUESTS.abs(t) ? 0 : QUESTS.stat(t), acc: 0, text: zq.text,
      giver: (DATA.SPEAKERS[zq.giver] || {}).name || "Someone", rw: { k: "relic", relic: zq.relic, hat: zq.hat }, done: false });
  },
  update(dt) {
    const S = G.S;
    if (!S.flags.tut) return;
    const d = S.run - (S.qRun || 0); S.qRun = S.run;
    for (const q of S.quests) {
      if (q.t === "earn" && !q.done) q.acc = (q.acc || 0) + (d > 0 ? d : 0);
      if (!q.done && QUESTS.progress(q) >= q.n) {
        q.done = true; SFX.play("quest");
        UI.toast("Quest complete: " + q.text.split(".")[0] + ". Claim it in Quests!", "quest");
      }
    }
    const side = S.quests.filter(q => q.sp === undefined).length;
    if (!QUESTS.primed) { QUESTS.primed = true; for (let k = side; k < QUESTS.SLOTS; k++) QUESTS.make(); }   // full board on load
    else if (side < QUESTS.SLOTS) {
      QUESTS.refillT += dt;
      if (QUESTS.refillT > 25) { QUESTS.refillT = 0; QUESTS.make(); }   // after that, a new odd job every 25 s at most
    }
  },
  rewardText(q) {
    const rw = q.rw, S = G.S;
    if (rw.k === "cash") return "💰 " + U.money(QUESTS.cash());
    if (rw.k === "socks") return "🧦 " + U.num(rw.v) + " socks";
    if (rw.k === "mulch") return "🪱 " + U.num(rw.v) + " mulch";
    const rel = DATA.RELICS.find(r => r.id === rw.relic);
    return (rel ? rel.ic + " " + rel.name : "a relic") + (rw.hat ? " + a hat" : "");
  },
  claim(id) {
    const S = G.S, q = S.quests.find(x => x.id === id);
    if (!q || !q.done) return;
    const rw = q.rw, lines = [];
    if (rw.k === "cash") { const v = QUESTS.cash(); GAME.earn(v); lines.push("💰 " + U.money(v)); }
    if (rw.k === "socks") { S.soc += rw.v; lines.push("🧦 " + U.num(rw.v) + " socks"); }
    if (rw.k === "mulch") { S.mu += rw.v; S.tm += rw.v; lines.push("🪱 " + U.num(rw.v) + " mulch"); }
    if (rw.k === "relic") {
      const rel = DATA.RELICS.find(r => r.id === rw.relic);
      if (rel && !S.relics[rel.id]) { S.relics[rel.id] = 1; lines.push(rel.ic + " " + rel.name + " (" + rel.desc + ")"); }
      if (rw.hat && !S.hats[rw.hat]) { S.hats[rw.hat] = 1; lines.push("🎩 New hat: " + DATA.HATS.find(h => h.id === rw.hat).name); }
      S.flags.spDone = S.flags.spDone || {}; S.flags.spDone[q.sp] = 1;
    } else {
      S.qDone++;
      if (S.qDone % 8 === 0) {
        const h = DATA.QUEST_HATS.find(id => !S.hats[id]);
        if (h) { S.hats[h] = 1; lines.push("🎩 Bonus hat for 8 quests: " + DATA.HATS.find(x => x.id === h).name); }
      }
    }
    S.stats.quests++;
    S.quests = S.quests.filter(x => x !== q);
    GAME.refreshPay(); SFX.play("claim");
    if (rw.k === "relic" || lines.length > 1) CINE.play("reward", { title: "Request complete!", icon: "📜", lines });
    else UI.toast("Claimed " + lines.join(", "), "claim");
    UI.refreshAll();
  },
};
