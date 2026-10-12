/* Gerald Wants Up — DOM UI: HUD, side panel tabs, plant menu, toasts, hints, modals.
   Lists are rendered once (or when their shape changes) and then updated in place, so
   buttons never get replaced under the cursor. */
const $ = id => document.getElementById(id);
const UI = {
  tab: "grow", sig: {}, menuMode: 0,
  init() {
    UI.buildGrow(); UI.buildCompost(); UI.buildSettings();
    document.querySelectorAll("#tabs button").forEach(b => (b.onclick = () => UI.setTab(b.dataset.tab, true)));
    $("sheetClose").onclick = () => { UI.sheet(!$("panel").classList.contains("open")); SFX.play("click"); };
    $("panel").addEventListener("click", UI.onAct);
    $("plantMenu").addEventListener("click", UI.onAct);
    $("objective").onclick = () => UI.setTab("quests");
    $("btnUp").onclick = () => { G.follow = true; SFX.play("click"); };
    $("btnDown").onclick = () => {   // first press: base of the stalk; press again: all the way down the mountain
      G.follow = false; const base = Math.max(0, GAME.mtnTop() - 60);
      G.camTo = G.cam > base + 20 ? base : -90; SFX.play("click");
    };
    $("btnMute").onclick = () => {
      const S = G.S; S.settings.muted = !S.settings.muted; UI.applySound(); SFX.play("click");
    };
    $("tickerText").addEventListener("animationiteration", UI.nextQuip);
    UI.nextQuip();
    UI.refreshAll();
  },
  mobile: () => matchMedia("(max-width: 760px)").matches,
  sheet(open) { $("panel").classList.toggle("open", open); $("sheetClose").textContent = open ? "▾" : "▴"; },
  setTab(t, fromNav) {
    if (UI.mobile()) {                         // phones: tabs open/close a slide-up sheet
      const open = $("panel").classList.contains("open");
      if (fromNav && open && UI.tab === t) { UI.sheet(false); SFX.play("click"); return; }
      UI.sheet(true);
    }
    UI.tab = t; SFX.play("click");
    document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
    document.querySelectorAll(".tab").forEach(s => s.classList.toggle("on", s.id === "tab-" + t));
    UI.sig = {}; UI.update(true);
  },
  refreshAll() { UI.sig = {}; UI.update(true); UI.refreshMenu(); },
  applySound() {
    const s = G.S.settings, m = s.muted;
    SFX.setVolume(m ? 0 : s.sfx, m ? 0 : s.mus);
    SFX.setMusicOn(!m && s.music);
    $("btnMute").textContent = m ? "🔇" : "🔊";
  },
  nextQuip() {
    const z = ZONES.get(ECON.zoneOf(ECON.alt(G.S))), pool = DATA.QUIPS.concat(z.quips || [], z.quips || []);
    $("tickerText").textContent = U.pick(pool);
  },
  bump(id) { const e = $(id); if (!e) return; e.classList.add("bump"); clearTimeout(e._b); e._b = setTimeout(() => e.classList.remove("bump"), 130); },
  toast(text, kind = "", sec = 3.2) {
    const box = $("toasts");
    while (box.children.length > 3) box.firstChild.remove();
    const e = document.createElement("div");
    e.className = "toast " + kind; e.textContent = text; box.appendChild(e);
    setTimeout(() => e.classList.add("out"), sec * 1000);
    setTimeout(() => e.remove(), sec * 1000 + 450);
  },
  /* one-time Wormsley tips (non-blocking) */
  hint(key, text, force) {
    const S = G.S;
    if (S.flags.hints[key] || (!S.flags.tut && !force) || TUT.active) return;
    S.flags.hints[key] = 1;
    TUT.say(text, [["Got it", () => TUT.hide()]], null, 9);
  },
  modal(html, btns) {
    $("modalBody").innerHTML = html;
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap";
    for (const [label, fn, cls] of btns || [["OK"]]) {
      const b = document.createElement("button");
      b.className = "btn " + (cls || ""); b.textContent = label;
      b.onclick = () => { if (!fn || fn() !== false) UI.closeModal(); };
      row.appendChild(b);
    }
    $("modalBody").appendChild(row);
    $("modal").classList.remove("hidden");
  },
  closeModal() { $("modal").classList.add("hidden"); },
  row(id, name, desc, btnCls = "") {
    return '<div class="row"><div class="m"><b>' + name + ' <span class="lvtag" id="l_' + id + '"></span></b><span class="dim">' + desc +
      '</span></div><button class="btn ' + btnCls + '" id="b_' + id + '" data-act="' + id.split(":")[0] + '" data-id="' + id.split(":")[1] + '"></button></div>';
  },
  set(id, text, dis, cls) {
    const e = $(id); if (!e) return;
    if (text !== undefined && e._t !== text) { e._t = text; e.textContent = text; }
    if (dis !== undefined) e.disabled = !!dis;
    if (cls !== undefined && e._c !== cls) { e._c = cls; e.className = cls; }
  },

  /* ---------- static tab skeletons ---------- */
  buildGrow() {
    $("tab-grow").innerHTML =
      '<div class="objCard"><div style="display:flex;gap:6px"><button class="btn green big glow" style="flex:1" id="growBtn" data-act="grow"></button>' +
      '<button class="btn green" style="flex:0 0 74px" id="growMaxBtn" data-act="growmax" title="Grow as many plants as you can afford">Grow MAX</button></div>' +
      '<div class="pop-row" style="display:flex;gap:6px"><button class="btn lil" style="flex:1" id="cheapBtn" data-act="cheap"></button>' +
      '<button class="btn gold" style="flex:1" id="allBtn" data-act="upall">Upgrade everything</button></div>' +
      '<div class="dim" id="growInfo" style="margin-top:6px"></div></div>' +
      '<div class="dim">Tip: poke Gerald to make him spit. Click a plant to upgrade it (every plant starts capped at Lv ' + ECON.CAP0 + '; each compost raises the cap by ' + ECON.CAPSTEP + ' for every plant slot you reached). Click the ghost circle above the top plant to grow a new one.</div>' +
      "<h2>Sky Shop</h2><div class='dim' style='margin-bottom:6px'>Resets every time you compost.</div>" +
      ECON.SHOP.map(d => UI.row("shop:" + d.id, d.name, d.desc)).join("") +
      "<h2>Sock Automation 🧦</h2><div class='dim' style='margin-bottom:6px'>Socks fall from the sky. Spend them to make plants work by themselves (or click a plant to do it one at a time).</div>" +
      UI.row("bulk:ua", "Auto-Upgrade all", "Every plant slot upgrades itself, forever", "lil") +
      UI.row("bulk:ac", "Auto-Collect all", "Every plant collects its own bubble, this run") +
      UI.row("bulk:pa", "Forever Auto-Collect all", "Every plant slot collects by itself, forever", "pink") +
      UI.row("shrine:frenzy", "Sock Shrine: Frenzy", "Offer socks to the sky: 20 seconds of BEAN FRENZY (x7 money)", "pink") +
      UI.row("shrine:gold", "Sock Shrine: Golden Hour", "Offer socks to the sky: every bean is golden for 20 seconds", "gold") +
      UI.row("sock:super", "Sock Butler", "Whenever you grow a plant, automatically buys its Forever Auto-Collect and Auto-Upgrade (if you have the socks)", "gold") +
      '<button class="btn ghost wide" id="allUp" data-act="allauto" data-id="up"></button>' +
      '<button class="btn ghost wide" id="allCol" data-act="allauto" data-id="col"></button>';
  },
  buildCompost() {
    $("tab-compost").innerHTML =
      '<div class="objCard" style="display:flex;gap:10px;align-items:center"><canvas id="wormFace" width="96" height="96" style="width:76px;height:76px;flex:none"></canvas>' +
      '<div class="dim" style="color:var(--cream)">Wormsley will eat your whole stalk and turn it into <b style="display:inline;color:var(--gold)">mulch</b> and a <b style="display:inline;color:var(--gold)">mountain</b>. Gerald regrows on top of the mountain, higher than before. Mulch makes everything pay more and buys permanent perks.</div></div>' +
      '<div class="stats" id="cStats"></div>' +
      '<button class="btn pink big wide" id="compostBtn" data-act="compost"></button>' +
      '<div class="dim" id="cMulch" style="text-align:center"></div>' +
      "<h2>Perks (forever)</h2>" + ECON.PERKS.map(d => UI.row("perk:" + d.id, d.name, d.desc, "lil")).join("");
  },
  buildSettings() {
    const s = G.S.settings;
    $("tab-settings").innerHTML =
      "<h2>Sound</h2>" +
      '<div class="toggle">Sound effects <input type="range" min="0" max="1" step="0.05" id="setSfx" value="' + s.sfx + '"></div>' +
      '<div class="toggle">Music volume <input type="range" min="0" max="1" step="0.05" id="setMus" value="' + s.mus + '"></div>' +
      '<div class="toggle">Music <input type="checkbox" id="setMusic"' + (s.music ? " checked" : "") + "></div>" +
      "<h2>Game</h2>" +
      '<div class="toggle">Cutscenes for new zones and composting <input type="checkbox" id="setCine"' + (s.cine !== false ? " checked" : "") + "></div>" +
      '<div class="toggle">Plants talk <input type="checkbox" id="setChat"' + (s.chatter ? " checked" : "") + "></div>" +
      '<div class="toggle">Screen shake <input type="checkbox" id="setShake"' + (s.shake ? " checked" : "") + "></div>" +
      '<div class="toggle">Scientific notation <input type="checkbox" id="setSci"' + (s.sci ? " checked" : "") + "></div>" +
      '<div class="toggle">Low effects (for slow computers) <input type="checkbox" id="setLow"' + (s.lowfx ? " checked" : "") + "></div>" +
      "<h2>Save</h2><div class='dim'>The game saves itself every few seconds in this browser.</div>" +
      '<button class="btn lil wide" data-act="replay">Replay the intro</button>' +
      '<button class="btn wide" data-act="export">Export save</button>' +
      '<button class="btn wide" data-act="import">Import save</button>' +
      '<button class="btn ghost wide" data-act="wipe">Wipe save (start over)</button>' +
      "<h2>About</h2><div class='dim'>Gerald Wants Up. A beanstalk with a grievance. Everything you see and hear is generated by code; no Geralds were harmed.</div>";
    const S = () => G.S.settings;
    $("setSfx").oninput = e => { S().sfx = +e.target.value; UI.applySound(); };
    $("setSfx").onchange = () => SFX.play("coin");
    $("setMus").oninput = e => { S().mus = +e.target.value; UI.applySound(); };
    $("setMusic").onchange = e => { S().music = e.target.checked; UI.applySound(); };
    $("setCine").onchange = e => { S().cine = e.target.checked; };
    $("setChat").onchange = e => { S().chatter = e.target.checked; };
    $("setShake").onchange = e => { S().shake = e.target.checked; };
    $("setSci").onchange = e => { S().sci = e.target.checked; UI.refreshAll(); };
    $("setLow").onchange = e => { S().lowfx = e.target.checked; };
  },

  /* ---------- all panel / menu buttons go through here ---------- */
  onAct(e) {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const S = G.S, act = b.dataset.act, id = b.dataset.id, sel = GAME.sel;
    switch (act) {
      case "grow": GAME.grow(); break;
      case "cheap": { const [i, c] = GAME.bestUp(); if (i >= 0 && S.m >= c) GAME.upgrade(i, 0); break; }
      case "growmax": GAME.growMax(); break;
      case "sock": GAME.buySock(id); break;
      case "shrine": GAME.shrine(id); break;
      case "upall": UI.upgradeAll(); break;
      case "shop": GAME.buyShop(ECON.SHOP.find(d => d.id === id)); break;
      case "perk": GAME.buyPerk(ECON.PERKS.find(d => d.id === id)); break;
      case "bulk": GAME.bulkSock(id, true); break;
      case "allauto": {     // all on -> all off; all off or mixed -> all on
        const st = GAME.autoState(id), turnOn = st.off > 0;
        GAME.setAll(id, turnOn); SFX.play("click");
        UI.toast((id === "up" ? "Auto-upgrades" + (S.sockAuto ? " (and the Sock Butler)" : "") : "Auto-collect") + " turned " + (turnOn ? "ON" : "OFF") + " for every plant", "grow", 2.4);
        break;
      }
      case "compost": UI.confirmCompost(); break;
      case "claim": QUESTS.claim(+id); break;
      case "hat": if (S.hats[id]) { S.hat = id; SFX.play("click"); UI.sig.stuff = ""; } break;
      case "replay": CINE.play("intro", {}, () => {}); break;
      case "export": UI.modal("<h3>Export save</h3><div class='dim'>Copy this text somewhere safe.</div><textarea readonly id='expTxt'>" + STATE.exportStr(S) + "</textarea>", [["Done"]]); setTimeout(() => $("expTxt") && $("expTxt").select(), 50); break;
      case "import": UI.modal("<h3>Import save</h3><div class='dim'>Paste an exported save. This replaces your current game.</div><textarea id='impTxt'></textarea>",
        [["Cancel", null, "ghost"], ["Import", () => { try { G.S = STATE.importStr($("impTxt").value); STATE.save(G.S); location.reload(); } catch (err) { UI.toast("That doesn't look like a Gerald save.", "zone"); return false; } }, "green"]]); break;
      case "wipe": UI.modal("<h3>Start over?</h3><div class='dim'>This deletes Gerald, the mountain, every relic and every hat. There is no undo.</div>",
        [["Keep playing", null, "green"], ["Delete everything", () => { G.wiping = true; STATE.wipe(); location.reload(); }, "ghost"]]); break;
      /* plant menu */
      case "pmx": GAME.sel = -1; UI.refreshMenu(); break;
      case "pmup": if (sel >= 0) GAME.upgrade(sel, UI.menuMode); break;
      case "pmmode": UI.menuMode = (UI.menuMode + 1) % 3; SFX.play("click"); break;
      case "pmua": if (sel >= 0) GAME.buySock("ua", sel); break;
      case "pmuat": if (sel >= 0 && S.ua[sel]) { GAME.setOne("up", sel, !!S.uo[sel]); SFX.play("click"); } break;
      case "pmact": if (sel >= 0 && GAME.owned("col", sel)) { GAME.setOne("col", sel, GAME.isOff("col", sel)); SFX.play("click"); } break;
      case "pmac": if (sel >= 0) GAME.buySock("ac", sel); break;
      case "pmpa": if (sel >= 0) GAME.buySock("pa", sel); break;
    }
    UI.update(true);
  },
  upgradeAll() {
    const S = G.S; let n = 0;
    for (let k = 0; k < 3000; k++) {
      const [i, c] = GAME.bestUp();
      if (i < 0 || S.m < c) break;
      S.m -= c; S.lv[i] = (S.lv[i] || 0) + 1; S.stats.upgrades++; GAME.wob[i] = 0.6; n++;
      if (k % 20 === 19) GAME.refreshPay();
    }
    if (n) { SFX.play("upgrade", { n }); GAME.refreshPay(); UI.toast("Bought " + n + " upgrades", "grow", 1.6); } else SFX.play("error");
  },
  confirmCompost() {
    const S = G.S, g = ECON.mulchGain(S);
    if (g < 1) return;
    const go = () => GAME.compost();
    if (!S.flags.composted) go();
    else UI.modal("<h3>Compost?</h3><div class='dim'>Wormsley eats all " + S.n + " plants. You get <b style='color:var(--gold)'>+" + U.num(g) + " mulch</b> and the mountain grows <b style='color:var(--gold)'>" + U.ft(ECON.mtnGain(S)) + "</b>. Money, plant levels and the Sky Shop reset.</div>",
      [["Not yet", null, "ghost"], ["Feed the worm", go, "pink"]]);
  },

  /* ---------- per-tick refresh ---------- */
  update() {
    const S = G.S;
    UI.set("hudMoney", U.money(S.m));
    UI.set("hudIps", U.money(Math.max(GAME.ipsM, 0)));
    UI.set("hudSockN", U.num(S.soc));
    UI.set("hudMulchN", U.num(S.mu));
    $("hudMulch").classList.toggle("hidden", !S.tm);
    // buffs
    const bf = [], sm = G.W < 640;      // small game view: short buff labels so the money card stays narrow
    if (GAME.buffs.frenzy > 0) bf.push((sm ? "🔥 x7 " : "🔥 BEAN FRENZY x7 · ") + Math.ceil(GAME.buffs.frenzy) + "s");
    if (GAME.buffs.spit > 0) bf.push((sm ? "💨 x4 " : "💨 SPIT FRENZY x4 · ") + Math.ceil(GAME.buffs.spit) + "s");
    if (GAME.buffs.gold > 0) bf.push((sm ? "✨ gold " : "✨ GOLDEN HOUR · ") + Math.ceil(GAME.buffs.gold) + "s");
    const bs = bf.join("|");
    if (UI.sig.buffs !== bs) { UI.sig.buffs = bs; $("hudBuffs").innerHTML = bf.map(b => '<span class="buff">' + b + "</span>").join(""); }
    UI.objective();
    UI.altMeter();
    UI.layoutHud();
    // badges
    const qd = S.quests.filter(q => q.done).length;
    UI.set("qBadge", qd ? qd + "" : "", undefined, qd ? "on" : "");
    const cg = ECON.mulchGain(S);
    UI.set("cBadge", cg >= 1 ? "!" : "", undefined, cg >= 1 && (!S.cc || cg >= Math.max(2, S.lastMulch)) ? "on" : "");
    if (UI.tab === "grow") UI.updGrow();
    else if (UI.tab === "quests") UI.updQuests();
    else if (UI.tab === "compost") UI.updCompost();
    else if (UI.tab === "stuff") UI.updStuff();
    UI.updMenu();
  },
  /* the top HUD cards can never overlap: the goal card sits between the money card and the round buttons when
     there is room (centred if it can be), otherwise it drops below the money card */
  layoutHud() {
    const hud = $("hud"), hl = $("hudLeft"), ob = $("objective"), hr = $("hudRight"), gap = 6;
    const HW = hud.clientWidth, left = hl.offsetLeft + hl.offsetWidth + gap, right = hr.offsetLeft - gap;
    const want = Math.min(420, Math.max(230, HW * 0.46)), room = right - left, min = Math.min(want, HW < 520 ? 150 : 230);
    let x, y, w;
    if (room >= min) { w = Math.min(want, room); x = U.clamp((HW - w) / 2, left, right - w); y = hl.offsetTop; }
    else { x = hl.offsetLeft; y = hl.offsetTop + hl.offsetHeight + gap; w = Math.min(want, right - x); }
    const k = x + "|" + y + "|" + w;
    if (UI.sig.hud !== k) {
      UI.sig.hud = k;
      Object.assign(ob.style, { left: x + "px", top: y + "px", width: w + "px", right: "auto", transform: "none" });
    }
    UI.hudBottom = Math.max(ob.offsetTop + ob.offsetHeight, hl.offsetTop + hl.offsetHeight, hr.offsetTop + 46);
    // the alt meter starts below whatever is on the right
    const am = $("altMeter"); if (am.offsetParent) am.style.top = Math.max(hr.offsetTop + hr.offsetHeight, UI.hudBottom) + 14 + "px";
    UI.layoutBottom();
  },
  /* bottom of the game view: the docked plant menu sits above Wormsley's tips, and toasts float above both */
  layoutBottom() {
    const st = $("stage").getBoundingClientRect(), tu = $("tutor"), m = $("plantMenu"), ts = $("toasts");
    const tr = tu.getBoundingClientRect(), tutH = tu.classList.contains("hidden") || tr.top < st.top + st.height / 2 ? 0 : st.bottom - tr.top + 2;
    const docked = m.classList.contains("docked") && !m.classList.contains("hidden");
    if (docked) m.style.bottom = (tutH ? tutH + 8 : 6) + "px";
    let b = innerHeight - st.bottom + (UI.mobile() ? 12 : (G.H > 480 ? 58 : 12));
    if (tutH) b = Math.max(b, innerHeight - tr.top + 8);
    if (docked) b = Math.max(b, innerHeight - m.getBoundingClientRect().top + 8);
    ts.style.bottom = b + "px";
    ts.style.left = (st.left + st.width / 2) + "px";
    ts.style.width = Math.min(520, st.width - 16) + "px";
  },
  objective() {
    const S = G.S, k = S.zone + 1, z = ZONES.get(k), alt = ECON.alt(S);
    const a0 = ECON.zoneAt(S.zone), a1 = ECON.zoneAt(k);
    const head = k <= 14 ? z.obj.split(". ")[0].replace(/\.$/, "") : "Keep going up: " + z.short;
    UI.set("objText", head);
    $("objBar").style.width = (U.clamp((alt - (k === 1 ? 0 : a0)) / (a1 - (k === 1 ? 0 : a0)), 0, 1) * 100).toFixed(1) + "%";
    let sub = U.ft(alt) + " / " + U.ft(a1);
    if (k <= 6) sub += " · 🌙 Moon at " + U.ft(ECON.zoneAt(6));
    if (ECON.mulchGain(S) >= 1 && a1 - alt > S.n * 0.6) sub += " · compost to raise the mountain!";
    UI.set("objSub", sub);
  },
  altMeter() {
    const S = G.S, lo = ECON.zoneAt(Math.max(0, S.zone - 2)), hiK = S.zone + 2, hi = ECON.zoneAt(hiK) * 1.04;
    const sig = S.zone + ":" + hiK;
    const track = $("altTrack"), pct = a => U.clamp((a - lo) / (hi - lo), 0, 1) * 100;
    if (UI.sig.alt !== sig) {
      UI.sig.alt = sig;
      let h = "";
      for (let k = Math.max(0, S.zone - 2); k <= hiK; k++) {
        const z = ZONES.get(k), cls = k <= S.zone ? "" : k === S.zone + 1 ? " next" : " locked";
        h += '<div class="altTick' + cls + '" data-k="' + k + '" style="bottom:' + pct(z.at) + '%">' + (k > S.zone + 1 ? "???" : z.short) + "</div>";
      }
      track.innerHTML = h + '<div class="altMe" id="altMe">🌱</div><div class="altMe" id="altRec" title="record" style="font-size:12px;opacity:.7">▸</div>';
      track.querySelectorAll(".altTick").forEach(e => (e.onclick = () => {
        G.follow = false; G.camTo = Math.max(0, ECON.zoneAt(+e.dataset.k) * ECON.GAP - (G.vH - GAME.base()) + G.vH * 0.5); SFX.play("whoosh");
      }));
    }
    $("altMe").style.bottom = pct(ECON.alt(S)) + "%";
    $("altRec").style.bottom = pct(S.rec) + "%";
  },
  updGrow() {
    const S = G.S, c = ECON.spC(S, S.n), info = GAME.plantInfo(S.n);
    UI.set("growBtn", "Grow " + info.name + " · " + U.money(c), S.m < c);
    const [ci, cc] = GAME.bestUp();
    UI.set("cheapBtn", ci < 0 ? "All plants maxed" : "Best upgrade · " + U.money(cc), ci < 0 || S.m < cc);
    UI.set("growMaxBtn", undefined, S.m < c);
    UI.set("b_sock:super", S.sockAuto ? "Hired ✓" : U.num(ECON.SUPER_SOCK) + " 🧦", !!S.sockAuto || S.soc < ECON.SUPER_SOCK);
    for (const k of ["frenzy", "gold"]) { const c = ECON.shrine(S, k); UI.set("b_shrine:" + k, U.num(c) + " 🧦", S.soc < c); }
    UI.set("l_sock:super", S.sockAuto ? "on" : "");
    UI.set("allBtn", undefined, S.m < cc);
    UI.set("growInfo", S.n + " plants · " + U.ft(ECON.alt(S)) + " up · a bean every " + GAME.spitI.toFixed(2) + "s" + (GAME.bx > 1 ? " (x" + GAME.bx.toFixed(1) + " value)" : ""));
    for (const d of ECON.SHOP) {
      const l = ECON.shopL(S, d.id), mx = l >= d.max, cost = ECON.shopCost(S, d, l);
      UI.set("l_shop:" + d.id, l + "/" + d.max);
      UI.set("b_shop:" + d.id, mx ? "MAX" : U.money(cost), mx || S.m < cost);
    }
    for (const k of ["ua", "ac", "pa"]) {
      const [n, cost] = GAME.bulkSock(k, false);
      UI.set("l_bulk:" + k, n ? n + " left" : "all done");
      UI.set("b_bulk:" + k, n ? U.num(cost) + " 🧦" : "Done ✓", !n || S.soc < cost);
    }
    for (const [id, kind, name] of [["allUp", "up", "Auto-upgrades" + (S.sockAuto ? " + Sock Butler" : "")], ["allCol", "col", "Auto-collect"]]) {
      const st = GAME.autoState(kind);
      UI.set(id, st.none ? name + ": none bought yet" : st.mixed ? name + ": MIXED (" + st.on + " on, " + st.off + " off) · click to turn all ON"
        : st.off ? name + ": all OFF · click to turn all ON" : name + ": all ON · click to turn all OFF", st.none,
        "btn wide " + (st.none ? "ghost" : st.mixed ? "gold" : st.off ? "ghost" : "green"));
    }
  },
  updQuests() {
    const S = G.S, k = S.zone + 1, z = ZONES.get(k);
    const sig = S.zone + "|" + S.quests.map(q => q.id + (q.done ? "d" : "")).join(",");
    if (UI.sig.quests !== sig) {
      UI.sig.quests = sig;
      const qrow = q => '<div class="row' + (q.done ? " done" : "") + (q.sp !== undefined ? " sp" : "") + '"><canvas class="qicon" width="96" height="96" data-qt="' + q.t + '"></canvas><div class="m"><span class="dim">' + q.giver + ":</span> " +
        '<span style="font-weight:400">' + q.text + '</span><div class="qbar"><i id="qb' + q.id + '"></i></div>' +
        '<span class="dim" id="qp' + q.id + '"></span> · <span class="dim" id="qr' + q.id + '"></span></div>' +
        '<button class="btn ' + (q.done ? "green glow" : "ghost") + '" data-act="claim" data-id="' + q.id + '"' + (q.done ? "" : " disabled") + ">" + (q.done ? "Claim!" : "Not yet") + "</button></div>";
      const sp = S.quests.filter(q => q.sp !== undefined), side = S.quests.filter(q => q.sp === undefined);
      $("tab-quests").innerHTML =
        '<div class="objCard"><div class="dim">MAIN GOAL</div><div class="big">' + (k <= 14 ? z.obj : "Keep going up. Forever.") + "</div>" +
        '<div class="bar"><i id="qMainBar"></i></div><div class="dim" id="qMainSub"></div>' +
        (S.zone < 6 ? '<div class="dim" style="margin-top:6px">Gerald\'s complaint must be delivered to <b style="display:inline;color:var(--gold)">THE MOON</b> at ' + U.ft(ECON.zoneAt(6)) + ". Every plant you grow is 100 ft. Composting builds a mountain under him.</div>" :
          S.zone < 14 ? '<div class="dim" style="margin-top:6px">The complaint keeps getting forwarded. Follow it.</div>' :
          '<div class="dim" style="margin-top:6px">The complaint is approved. Gerald just likes going up now. Every new layer gives a trinket.</div>') + "</div>" +
        (sp.length ? "<h2>Special Requests</h2>" + sp.map(qrow).join("") : "") +
        "<h2>Odd Jobs</h2>" + (side.length ? side.map(qrow).join("") : '<div class="dim">' + (S.flags.tut ? "New jobs arriving…" : "Finish Wormsley's tour first.") + "</div>") +
        '<div class="dim" style="margin-top:8px">Every 8 odd jobs: a free hat.</div>';
    }
    const alt = ECON.alt(S), a0 = k === 1 ? 0 : ECON.zoneAt(S.zone), a1 = ECON.zoneAt(k);
    const mb = $("qMainBar"); if (mb) mb.style.width = (U.clamp((alt - a0) / (a1 - a0), 0, 1) * 100).toFixed(1) + "%";
    UI.set("qMainSub", "Next: " + z.name + " at " + U.ft(a1) + " · you are at " + U.ft(alt));
    for (const q of S.quests) {
      const p = Math.min(q.n, QUESTS.progress(q)), e = $("qb" + q.id);
      if (e) e.style.width = (U.clamp(p / q.n, 0, 1) * 100).toFixed(1) + "%";
      UI.set("qp" + q.id, (q.t === "earn" ? U.money(Math.max(0, p)) : U.num(Math.max(0, p))) + " / " + QUESTS.label(q));
      UI.set("qr" + q.id, "reward: " + QUESTS.rewardText(q));
    }
  },
  /* little animated pictures next to quests (drawn every frame while the Quests tab is open) */
  QICON_FALLBACK: { bubbles: "🫧", pokes: "👆", sprouts: "🌱", socks: "🧦", upgrades: "⬆️", beans: "🫘", golden: "✨", visitors: "👁️", earn: "💰", tall: "📏", level: "⭐", compost: "🪱" },
  drawQuestIcons() {
    const list = document.querySelectorAll("#tab-quests canvas.qicon");
    for (const c of list) {
      const x = c.getContext("2d"), tp = c.dataset.qt;
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 96, 96);
      x.save(); x.translate(48, 48); x.scale(1.8, 1.8);
      if (typeof DRAW !== "undefined" && DRAW.questIcon) GAME.safe("questIcon", () => DRAW.questIcon(x, tp, 50, G.T));
      else { x.font = "30px serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(UI.QICON_FALLBACK[tp] || "📜", 0, 2); }
      x.restore();
    }
  },
  updCompost() {
    const S = G.S, g = ECON.mulchGain(S), mg = ECON.mtnGain(S);
    if (!UI.sig.worm) {
      UI.sig.worm = 1;
      const c = $("wormFace"), x = c.getContext("2d"); x.clearRect(0, 0, 96, 96); x.save(); x.translate(48, 48);
      GAME.safe("portrait", () => DRAW.portrait(x, "worm", 90, 0)); x.restore();
    }
    const st = [["Stalk now", S.n + " plants (" + U.ft(S.n) + ")"],
      ["Wormsley needs", ECON.compostNeed(S) + " plants" + (S.lastN ? " (taller than last time: " + S.lastN + ")" : "")],
      ["Mulch you'd get", g >= 1 ? "+" + U.num(g) : "grow " + Math.max(0, ECON.compostNeed(S) - S.n) + " more plants"],
      g >= 1 ? ["One more plant would make it", "+" + U.num(Math.floor(ECON.K.mr ** (S.n - 2) * (1 + 0.25 * ECON.perkL(S, "worm")) * ECON.relicMult(S, "mulch")))]
        : ["Mulch at " + ECON.compostNeed(S) + " plants", "+" + U.num(Math.floor(ECON.K.mr ** (ECON.compostNeed(S) - 3) * (1 + 0.25 * ECON.perkL(S, "worm")) * ECON.relicMult(S, "mulch")))],
      ["Mountain grows", "+" + U.ft(mg) + " (keeps " + Math.round(ECON.mtnFrac(S) * 100) + "% of grown plants)"],
      ["Level caps", "+" + ECON.CAPSTEP + " for these " + S.n + " plant slots"],
      ["Mountain height", U.ft(S.mtn)],
      ["You'd restart at", U.ft(S.mtn + mg + ECON.headStart(S))]];
    const h = st.map(r => "<span>" + r[0] + "</span><span>" + r[1] + "</span>").join("");
    if (UI.sig.cst !== h) { UI.sig.cst = h; $("cStats").innerHTML = h; }
    UI.set("compostBtn", g >= 1 ? "Feed the worm: +" + U.num(g) + " mulch" : "Grow " + Math.max(0, ECON.compostNeed(S) - S.n) + " more plants first", g < 1,
      "btn pink big wide" + (g >= 1 ? " glow" : ""));
    UI.set("cMulch", U.num(S.mu) + " mulch to spend · " + U.num(S.tm) + " made ever (+" + U.num(S.tm * 10) + "% payouts)");
    for (const d of ECON.PERKS) {
      const l = ECON.perkL(S, d.id), mx = l >= d.max, cost = ECON.cost(d, l);
      UI.set("l_perk:" + d.id, d.max > 1 ? l + "/" + d.max : l ? "owned" : "");
      UI.set("b_perk:" + d.id, mx ? (d.max > 1 ? "MAX" : "Owned ✓") : U.num(cost) + " 🪱", mx || S.mu < cost);
    }
  },
  updStuff() {
    const S = G.S, sig = Object.keys(S.relics).length + "|" + S.trinkets.length + "|" + Object.keys(S.hats).length + "|" + S.hat;
    if (UI.sig.stuff !== sig) {
      UI.sig.stuff = sig;
      const nr = DATA.RELICS.filter(r => S.relics[r.id]).length;
      let h = "<h2>Relics " + nr + "/" + DATA.RELICS.length + "</h2><div class='dim' style='margin-bottom:6px'>Permanent bonuses from new zones and Special Requests. Hover or tap for details.</div><div class='grid'>" +
        DATA.RELICS.map(r => S.relics[r.id]
          ? '<div class="relic" title="' + r.name + ": " + r.desc + '" data-act="relic" data-id="' + r.id + '">' + r.ic + "</div>"
          : '<div class="relic no" title="??? (found in ' + ZONES.get(r.z).short + ')">' + r.ic + "</div>").join("") + "</div>";
      h += '<div class="dim" id="relicInfo" style="margin-top:6px;min-height:20px"></div>';
      if (S.trinkets.length) h += "<h2>Trinkets " + S.trinkets.length + "</h2>" + S.trinkets.slice().reverse().map(t => '<div class="dim">✨ <b style="display:inline;color:var(--cream)">' + t.name + "</b> · " + t.desc + "</div>").join("");
      h += "<h2>Hats</h2><div class='dim' style='margin-bottom:6px'>Purely for fashion. Gerald insists.</div><div class='grid' id='hatGrid'>" +
        DATA.HATS.map(hh => '<button class="hatBtn' + (S.hat === hh.id ? " on" : "") + '" data-act="hat" data-id="' + hh.id + '"' + (S.hats[hh.id] ? "" : " disabled") +
          ' title="' + (S.hats[hh.id] ? hh.name : "???") + '"><canvas width="112" height="112" data-hat="' + hh.id + '"></canvas>' + (S.hats[hh.id] ? hh.name : "???") + "</button>").join("") + "</div>";
      h += "<h2>Stats</h2><div class='stats' id='statGrid'></div>";
      $("tab-stuff").innerHTML = h;
      $("tab-stuff").querySelectorAll("canvas[data-hat]").forEach(c => {
        const x = c.getContext("2d"), id = c.dataset.hat;
        x.save(); x.translate(56, 66); x.scale(0.95, 0.95);
        if (S.hats[id]) GAME.safe("hatpreview", () => DRAW.gerald(x, { t: 0, spit: 0, look: { x: 0, y: 0.3 }, hat: id, mood: "grump", blink: 0 }));
        else { x.font = "40px " + INK.FONT; x.textAlign = "center"; x.fillStyle = "#cdb8ee"; x.fillText("?", 0, 14); }
        x.restore();
      });
      $("tab-stuff").querySelectorAll(".relic[data-id]").forEach(e => (e.onmouseenter = e.onclick = () => {
        const r = DATA.RELICS.find(x => x.id === e.dataset.id); UI.set("relicInfo", r.ic + " " + r.name + ": " + r.desc);
      }));
    }
    const st = S.stats, rows = [["Time played", U.time(st.time)], ["Money earned ever", st.earnL < 0 ? "$0" : "$" + U.fmtLog(st.earnL)],
      ["Record altitude", U.ft(S.rec)], ["Zones reached", S.zone + 1], ["Beans spat", U.num(st.beans)], ["Golden beans", U.num(st.golden)],
      ["Gerald poked", U.num(st.pokes)], ["Socks caught", U.num(st.socks)], ["Bubbles popped", U.num(st.bubbles)], ["Upgrades bought", U.num(st.upgrades)],
      ["Plants sprouted", U.num(st.sprouts)], ["Visitors befriended", U.num(st.visitors)], ["Times composted", U.num(st.composts)], ["Quests done", U.num(st.quests)]];
    const h = rows.map(r => "<span>" + r[0] + "</span><span>" + r[1] + "</span>").join("");
    if (UI.sig.stats !== h && $("statGrid")) { UI.sig.stats = h; $("statGrid").innerHTML = h; }
  },

  /* ---------- plant menu ---------- */
  refreshMenu() {
    const i = GAME.sel, m = $("plantMenu");
    if (i < 0 || i >= G.S.n) { m.classList.add("hidden"); m._i = -1; return; }
    if (m._i === i && m._cc === G.S.cc) return;
    m._i = i; m._cc = G.S.cc;
    const p = GAME.plantInfo(i);
    m.innerHTML = '<div class="hd"><b>' + p.name + '</b><button class="x" data-act="pmx">✕</button></div>' +
      '<div class="dim" id="pmStat"></div><div class="fact">' + p.fact + "</div>" +
      '<div class="mr"><button class="btn green" id="pmUp" data-act="pmup"></button><button class="btn sm lil" id="pmMode" data-act="pmmode"></button></div>' +
      '<div class="sec">Sock automation 🧦</div>' +
      '<div class="mr"><button class="btn" id="pmUa" data-act="pmua"></button><button class="btn sm" id="pmUaT" data-act="pmuat"></button></div>' +
      '<div class="mr"><button class="btn" id="pmAc" data-act="pmac"></button><button class="btn sm" id="pmAcT" data-act="pmact" title="Switch auto-collect on/off for this plant"></button></div>' +
      '<div class="mr"><button class="btn pink" id="pmPa" data-act="pmpa"></button></div>';
    m.classList.remove("hidden");
    UI.updMenu();
  },
  updMenu() {
    const i = GAME.sel, S = G.S;
    if (i < 0 || i >= S.n || $("plantMenu").classList.contains("hidden")) return;
    const l = S.lv[i] || 0, cap = ECON.cap(S, i), mx = l >= cap, [n, cost, ok] = GAME.upInfo(i, UI.menuMode);
    const nextX2 = (Math.floor(l / ECON.K.ms) + 1) * ECON.K.ms;
    UI.set("pmStat", "Lv " + l + "/" + cap + " · pays " + U.money(GAME.payC[i] || 0) + " per bean" + (!mx && nextX2 <= cap ? " · x2 at Lv " + nextX2 : ""));
    UI.set("pmUp", mx ? "MAXED · compost for +" + ECON.CAPSTEP + " cap" : "Upgrade x" + n + " · " + U.money(cost), mx || !ok);
    UI.set("pmMode", ["x1", "x10", "MAX"][UI.menuMode]);
    UI.set("pmUa", S.ua[i] ? "Auto-Upgrade ✓ forever" : "Auto-Upgrade forever · " + U.num(ECON.cUa(S, i)) + "🧦", !!S.ua[i] || S.soc < ECON.cUa(S, i));
    UI.set("pmUaT", !S.ua[i] ? "—" : S.uo[i] ? "OFF" : "ON", !S.ua[i], "btn sm " + (!S.ua[i] ? "" : S.uo[i] ? "ghost" : "green"));
    const hasCol = GAME.owned("col", i), colOff = GAME.isOff("col", i);
    UI.set("pmAcT", !hasCol ? "—" : colOff ? "OFF" : "ON", !hasCol, "btn sm " + (!hasCol ? "" : colOff ? "ghost" : "green"));
    const auto = S.ac[i] || S.pa[i];   // owned (it may be switched off with the toggle)
    UI.set("pmAc", auto ? "Auto-Collect ✓" : "Auto-Collect (this run) · " + U.num(ECON.cAc(S, i)) + "🧦", !!auto || S.soc < ECON.cAc(S, i));
    UI.set("pmPa", S.pa[i] ? "Forever Auto-Collect ✓" : "Forever Auto-Collect · " + U.num(ECON.cPa(S, i)) + "🧦", !!S.pa[i] || S.soc < ECON.cPa(S, i));
  },
  placeMenu() {
    const i = GAME.sel, m = $("plantMenu");
    if (i < 0 || m.classList.contains("hidden")) { m._sel = -1; return; }
    const dock = UI.mobile() || G.W < 520;     // small screens: menu docks to the bottom instead of floating
    m.classList.toggle("docked", dock);
    if (dock) {
      m.style.visibility = "visible"; if (!m._dk) { m._dk = 1; UI.layoutBottom(); }
      if (m._sel !== i) {       // nudge the camera so the chosen plant isn't hidden behind the docked menu
        m._sel = i;
        const sy = GAME.toY(GAME.plantWY(i)) * G.zoom, mt = m.offsetTop, want = Math.max((UI.hudBottom || 0) + 70, mt - 80);
        if (sy > mt - 50) { G.follow = false; G.camTo = U.clamp(G.cam - (sy - want) / G.zoom, -90, GAME.camMax()); }
      }
      return;
    }
    m._dk = 0; m.style.bottom = "";
    const sx = GAME.plantSX(i), sy = GAME.toY(GAME.plantWY(i)), w = 240;
    if (sy < -40 || sy > G.H + 40) { m.style.visibility = "hidden"; return; }
    m.style.visibility = "visible";
    const left = GAME.side(i) > 0 ? (sx + 60 + w < G.W ? sx + 60 : sx - 60 - w) : (sx - 60 - w > 0 ? sx - 60 - w : sx + 60);
    m.style.left = U.clamp(left, 6, G.W - w - 6) + "px";
    m.style.top = U.clamp(sy - 80, (UI.hudBottom || 0) + 6, Math.max((UI.hudBottom || 0) + 6, G.H - m.offsetHeight - 50)) + "px";
  },
};
