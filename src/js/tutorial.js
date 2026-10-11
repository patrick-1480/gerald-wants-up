/* Gerald Wants Up — Wormsley's guided tour + the speech box used for later hints.
   Each step: text, optional target (DOM id or a function returning canvas coords), and a
   done() condition; steps without done() wait for the Next button. */
const TUT = {
  active: false, step: 0, hideT: 0, target: null,
  STEPS: [
    { text: "Hello. I'm Wormsley. I live in the dirt and I am contractually obligated to explain things.", next: "Hello?" },
    { text: "That big green fella is Gerald. He spits beans. Beans bounce down through the plants, and plants pay money for being bonked. Don't ask me. I'm a worm.", at: "gerald", next: "Okay" },
    { text: "When a bean hits a plant, money piles up in a bubble next to it. Wait for one, then click the $ bubble to pop it.", at: "bubble", done: S => S.stats.bubbles >= 1 },
    { text: "You can also poke Gerald to make him spit faster. He pretends to hate it. Poke him 3 times.", at: "gerald", done: S => S.stats.pokes >= 3 },
    { text: "Now grow a new plant! Click the dotted circle above the top plant, or the big green Grow button.", at: "ghost", el: "growBtn", done: S => S.n >= 2 },
    { text: "Click a plant to open its menu, then hit Upgrade. Upgraded plants pay more per bean, and reaching Lv 10 doubles them. Lv 10 is the cap for now; composting raises it later.", at: "plant0", done: S => S.stats.upgrades >= 1 },
    { text: "Socks fall out of the sky sometimes. Nobody knows whose they are. Catch that one! Socks buy automation later.", at: "sock", spawnSock: 1, done: S => S.stats.socks >= 1 },
    { text: "Now. The point. Gerald wants to reach THE MOON to file a complaint. That's {moon} up, and every plant is 100 ft. First stop: the Clouds.", el: "objective", next: "Why?" },
    { text: "The Moon looked at him funny. That's all I know. Weird visitors up there hand out jobs; check the Quests tab. When things slow down, call me in the Compost tab. I'll be in the dirt.", el: "tabQuests", next: "Bye, Wormsley" },
  ],
  start() {
    const S = G.S;
    TUT.active = true; TUT.step = S.flags.tutStep || 0; TUT.show();
  },
  show() {
    const st = TUT.STEPS[TUT.step];
    if (!st) return TUT.finish();
    if (st.spawnSock) { GAME.socks.push({ x: G.W * 0.5, y: -30, t: 0, vy: 34, ph: 0, k: 1, seed: 7 }); }
    TUT.say(st.text.split("{moon}").join(U.ft(ECON.zoneAt(6))), st.next ? [[st.next, () => TUT.advance()]] : [], st);
  },
  advance() {
    SFX.play("click");
    TUT.step++; G.S.flags.tutStep = TUT.step; TUT.show();
  },
  finish() {
    const S = G.S;
    TUT.active = false; TUT.hide();
    if (S.flags.tut) return;
    S.flags.tut = 1;
    S.hats.party = 1; S.hat = "party";
    if (!S.relics.sus_seed) S.relics.sus_seed = 1;
    QUESTS.addSpecial(0);
    GAME.refreshPay();
    CINE.play("reward", { title: "Wormsley's Welcome Gift", icon: "🫘", lines: ["🫘 A Suspicious Seed (Payouts x1.25)", "🎉 A Party Hat (Gerald is wearing it. He is not happy about it.)", "📜 Gnome Dave has a Special Request in the Quests tab"] }, () => UI.refreshAll());
  },
  /* the speech box; buttons = [[label, fn], ...]; st = step for pointing */
  say(text, buttons, st, autoHide) {
    $("tutor").classList.remove("hidden");
    $("tutText").textContent = text;
    const bb = $("tutBtns"); bb.innerHTML = "";
    for (const [label, fn] of buttons) {
      const b = document.createElement("button");
      b.className = "btn green"; b.textContent = label; b.onclick = fn; bb.appendChild(b);
    }
    const c = $("tutFace").getContext("2d");
    TUT.face = c; TUT.target = st || null;
    TUT.hideT = autoHide || 0;
    document.querySelectorAll(".tutRing").forEach(e => e.classList.remove("tutRing"));
    if (st && st.el && $(st.el)) $(st.el).classList.add("tutRing");
    SFX.play("blip", { pitch: 190 });
  },
  hide() {
    $("tutor").classList.add("hidden"); $("tutArrow").classList.add("hidden");
    document.querySelectorAll(".tutRing").forEach(e => e.classList.remove("tutRing"));
    TUT.target = null;
  },
  where(at) {
    const W = G.W;
    if (at === "gerald") return [W / 2, GAME.toY(GAME.geraldWY()) - 46];
    if (at === "ghost") return GAME.ghost ? [GAME.ghost.x, GAME.ghost.y - 34] : null;
    if (at === "bubble") { const b = GAME.bubbleHit[0]; return b ? [b.x, b.y - b.r - 22] : [GAME.bubbleSX(0), GAME.toY(GAME.plantWY(0)) - 30]; }
    if (at === "plant0") return [GAME.plantSX(0), GAME.toY(GAME.plantWY(0)) - 44];
    if (at === "sock") { const k = GAME.socks[0]; return k ? [k.x, k.y - 28] : null; }
    return null;
  },
  update(dt) {
    if (TUT.hideT > 0) { TUT.hideT -= dt; if (TUT.hideT <= 0) TUT.hide(); }
    if ($("tutor").classList.contains("hidden")) return;
    // animated Wormsley face
    const c = TUT.face;
    if (c) { c.clearRect(0, 0, 96, 96); c.save(); c.translate(48, 50); GAME.safe("tutface", () => DRAW.portrait(c, "worm", 92, G.T)); c.restore(); }
    const st = TUT.target, arrow = $("tutArrow");
    if (TUT.active && st && st.done && st.done(G.S)) { TUT.advance(); return; }
    const p = st && st.at ? TUT.where(st.at) : null;
    if (!p || CINE.active) { arrow.classList.add("hidden"); if (TUT.atTop) { TUT.atTop = false; $("tutor").style.cssText = ""; } return; }
    arrow.classList.remove("hidden");
    arrow.style.left = p[0] + "px"; arrow.style.top = p[1] + "px";
    // keep the box from covering what it points at: flip it to the top if the target sits behind it
    const box = $("tutor"), boxTop = G.H - 56 - box.offsetHeight;
    const low = p[1] + 90 > boxTop;
    if (low !== TUT.atTop) {
      TUT.atTop = low;
      const ob = $("objective"), under = ob.offsetTop + ob.offsetHeight + 10;   // sit just below the objective banner
      box.style.cssText = low ? "top:" + under + "px;bottom:auto" : "";
    }
  },
};
