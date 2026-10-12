/* Gerald Wants Up — boot, title screen, main loop, camera, input, offline, autosave. */
const G = { S: null, T: 0, W: 800, H: 600, vW: 800, vH: 600, zoom: 1, cam: 0, camTo: null, follow: true, fling: 0, mouse: { x: 0, y: 0, in: false },
  canvas: null, ctx: null, started: false, wiping: false };

const MAIN = {
  last: performance.now(), uiT: 0, saveT: 0, musT: 0, hiddenAt: 0, drag: null,
  boot() {
    G.S = STATE.load();
    G.canvas = $("c"); G.ctx = G.canvas.getContext("2d");
    MAIN.resize(); addEventListener("resize", MAIN.resize);
    UI.init(); GAME.refreshPay();
    G.cam = GAME.camFollow();
    MAIN.input();
    const S = G.S;
    $("btnPlay").textContent = S.flags.intro ? "Continue" : "Play";
    $("titleFine").textContent = S.flags.intro ? "Gerald is at " + U.ft(ECON.alt(S)) + ". He has been waiting. Impatiently." : "Sound on is recommended. Socks are optional.";
    $("btnPlay").onclick = MAIN.start;
    document.addEventListener("visibilitychange", MAIN.vis);
    addEventListener("beforeunload", () => { if (!G.wiping && G.started) STATE.save(G.S); });
    requestAnimationFrame(MAIN.frame);
  },
  async start() {
    const S = G.S;
    SFX.init(); UI.applySound(); SFX.play("click");
    $("btnPlay").disabled = true;
    if (await GUARD.otherCopy()) {        // a second copy would pay the same offline time twice
      $("btnPlay").disabled = false;
      UI.modal("<h3>Gerald is already open</h3><div class='dim'>The game is running in another tab or window. Close that one first (or keep playing there).</div>", [["OK", null, "green"]]);
      return;
    }
    GUARD.setLive(true);
    $("title").style.transition = "opacity .6s"; $("title").style.opacity = 0;
    setTimeout(() => $("title").classList.add("hidden"), 600);
    G.started = true;
    MAIN.musicCheck(true);
    if (S.flags.legacy && !S.flags.legacyGiven) { S.flags.legacyGiven = 1; S.soc += 25; setTimeout(() => UI.toast("Gerald found an old save from before he got weird. He remembers nothing. Here are 25 socks.", "zone", 6), 1500); }
    if (STATE.rejected) setTimeout(() => UI.toast("Your save was changed outside the game, so it couldn't be trusted. Loaded the last good backup instead.", "zone", 8), 1800);
    if (S.flags.refund) { const r = S.flags.refund; S.flags.refund = 0; setTimeout(() => UI.toast("Some old perks were too strong and got retired. Wormsley refunded " + U.num(r) + " mulch.", "zone", 7), 2500); }
    if (!S.flags.intro) {
      CINE.play("intro", {}, () => { S.flags.intro = 1; STATE.save(S); TUT.start(); });
      MAIN.offlineCheck(false);
      return;
    }
    MAIN.offlineCheck(true);
    if (!S.flags.tut) TUT.start();
  },
  /* offline rewards use server time only (GUARD.CLOCK), never the computer's clock. If the server can't be
     reached yet, keep trying: the away time is still owed, and playing meanwhile is never counted as away. */
  bootPaid: false,
  async offlineCheck(show, tries = 0) {
    await GUARD.CLOCK.sync();
    if (!GUARD.CLOCK.anchor) { if (tries < 20) setTimeout(() => MAIN.offlineCheck(show, tries + 1), 30000); return; }
    if (MAIN.bootPaid) return;
    MAIN.bootPaid = true;
    const sec = GUARD.CLOCK.awayAtBoot();
    if (show && sec > 0) MAIN.welcomeBack(sec);
    if (!G.wiping) STATE.save(G.S);     // stamps the server time right away, so the same time can't be paid twice
    setInterval(() => GUARD.CLOCK.sync(), 10 * 60 * 1000);
  },
  welcomeBack(sec) {
    const r = GAME.offline(sec);
    if (!r) return;
    const S = G.S;
    UI.modal("<h3>Welcome back!</h3><p>You were gone for <b>" + U.time(r.sec) + "</b>" + (r.s < r.sec ? " (the plants only count the first " + U.time(r.s) + ")" : "") + ".</p>" +
      "<p>Gerald spat <b>" + U.num(r.beans) + "</b> beans out of pure spite. The plants earned <b style='color:var(--gold)'>" + U.money(r.cash) +
      "</b> (they work at " + Math.round(ECON.offRate(S) * 100) + "% speed when nobody's watching)" + (r.socks ? " and <b>" + U.num(r.socks) + "</b> socks fell in the garden." : ".") + "</p>",
      [["Nice", () => { SFX.play("coin"); }, "green"]]);
  },
  vis() {
    if (document.hidden) {
      MAIN.hideP = performance.now(); MAIN.hideStamp = GUARD.CLOCK.stamp();
      if (G.started && !G.wiping) STATE.save(G.S);   // never undo a wipe/import
    } else if (MAIN.hideP && G.started) {
      const hp = MAIN.hideP, hs = MAIN.hideStamp; MAIN.hideP = 0;
      MAIN.last = performance.now();
      // server time if we can get it, otherwise the browser's own stopwatch (also immune to clock changes)
      GUARD.CLOCK.sync().then(now => {
        const sec = now && hs ? (now - hs) / 1000 : (performance.now() - hp) / 1000;
        if (sec > 60 && !G.wiping) { MAIN.welcomeBack(sec); STATE.save(G.S); }
      });
    }
  },
  resize() {
    const st = $("stage"), d = Math.min(2, devicePixelRatio || 1);
    G.W = st.clientWidth; G.H = st.clientHeight; G.vW = G.W / G.zoom; G.vH = G.H / G.zoom;
    G.canvas.width = Math.round(G.W * d); G.canvas.height = Math.round(G.H * d);
    G.ctx.setTransform(d, 0, 0, d, 0, 0);
    const tc = $("titleCanvas");
    tc.width = Math.round(innerWidth * d); tc.height = Math.round(innerHeight * d);
    tc.getContext("2d").setTransform(d, 0, 0, d, 0, 0);
  },
  musicCheck(force) {
    const z = ECON.zoneOf(ECON.alt(G.S));
    if (force || z !== GAME.musicZone) { GAME.musicZone = z; SFX.music(ZONES.get(z)); }
  },
  frame(now) {
    const dt = Math.min(0.1, (now - MAIN.last) / 1000);
    MAIN.last = now;
    G.T += dt; INK.setTime(G.T);
    if (!$("title").classList.contains("hidden")) MAIN.drawTitle();
    if (G.started) {
      if (!CINE.active) { GAME.step(dt); QUESTS.update(dt); }
      // camera (zooms out while you look down into the compost mountain)
      // eased, and never faster than ~1.8x per second, so leaving the mountain zooms back in gently
      const zt = GAME.zoomTarget(), lim = Math.pow(1.8, dt);
      G.zoom = U.clamp(G.zoom + (zt - G.zoom) * Math.min(1, dt * 2), G.zoom / lim, G.zoom * lim);
      if (Math.abs(G.zoom - zt) < 0.002) G.zoom = zt;
      G.vW = G.W / G.zoom; G.vH = G.H / G.zoom;
      const mx = GAME.camMax();
      if (G.fling) {        // touch flick momentum
        if (G.follow || G.camTo !== null || MAIN.drag) G.fling = 0;
        else { G.cam += G.fling * dt; G.fling *= Math.exp(-3.2 * dt); if (Math.abs(G.fling) < 30) G.fling = 0; if (G.cam >= mx - 30 && G.fling > 0) { G.fling = 0; G.follow = true; } }
      }
      if (G.follow) G.cam += (GAME.camFollow() - G.cam) * Math.min(1, dt * 3);
      else if (G.camTo !== null) { G.cam += (G.camTo - G.cam) * Math.min(1, dt * 4); if (Math.abs(G.camTo - G.cam) < 2) G.camTo = null; }
      G.cam = U.clamp(G.cam, -90, mx);   // a little below 0 so the roots clear the news ticker
      if (!CINE.active) GAME.draw();
      UI.placeMenu(); TUT.update(dt);
      if (UI.tab === "quests") UI.drawQuestIcons();
      MAIN.uiT += dt; if (MAIN.uiT > 0.15) { MAIN.uiT = 0; UI.update(); }
      MAIN.musT += dt; if (MAIN.musT > 1) { MAIN.musT = 0; MAIN.musicCheck(); }
      MAIN.saveT += dt; if (MAIN.saveT > 5) { MAIN.saveT = 0; STATE.save(G.S); }
    }
    requestAnimationFrame(MAIN.frame);
  },
  drawTitle() {
    const c = $("titleCanvas").getContext("2d"), W = innerWidth, H = innerHeight, t = G.T;
    c.clearRect(0, 0, W, H);
    for (let k = 0; k < 70; k++) {
      const x = (Math.sin(k * 91.7) * 0.5 + 0.5) * W, y = (Math.sin(k * 37.3) * 0.5 + 0.5) * H * 0.7;
      c.globalAlpha = 0.4 + 0.4 * Math.sin(t * 2 + k); c.fillStyle = "#fff"; c.fillRect(x, y, 2, 2);
    }
    c.globalAlpha = 1;
    const mr = Math.min(W, H) * 0.11;
    c.save(); c.translate(W * 0.82, H * 0.2 + Math.sin(t * 0.7) * 6);
    c.strokeStyle = INK.C.ink; c.lineWidth = 4;
    GAME.safe("titlemoon", () => DRAW.moonFace(c, mr, { t, mood: "smug", look: { x: -1, y: 0.6 } }));
    c.restore();
    const gx = W * 0.2, gy = H * 0.86;
    c.strokeStyle = INK.C.ink; c.lineWidth = 18; c.lineCap = "round";
    c.beginPath(); c.moveTo(gx, H + 20); c.quadraticCurveTo(gx + Math.sin(t) * 10, gy + 70, gx, gy); c.stroke();   // runs up into his head
    c.strokeStyle = "#5fb85a"; c.lineWidth = 11; c.stroke();
    c.save(); c.translate(gx, gy); c.scale(1.4, 1.4);
    GAME.safe("titlegerald", () => DRAW.gerald(c, { t, spit: 0, look: { x: 1, y: -0.7 }, hat: G.S.hat || "none", mood: "grump", blink: (t % 3.7) < 0.12 ? 1 : 0, neck: false }));
    c.restore();
  },
  /* ---------- input ---------- */
  pt(e) { const r = G.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; },
  input() {
    const cv = G.canvas;
    cv.addEventListener("pointerdown", e => {
      if (UI.mobile() && $("panel").classList.contains("open")) UI.sheet(false);   // tapping the game closes the sheet
      const [x, y] = MAIN.pt(e), touch = e.pointerType !== "mouse";
      G.mouse.x = x; G.mouse.y = y; G.mouse.in = true; G.fling = 0;
      if (G.started && !CINE.active && GAME.catchAt(x, y, touch)) { MAIN.drag = null; return; }   // socks: caught on press
      MAIN.drag = { x, y, ly: y, lt: performance.now(), v: 0, moved: false, tol: touch ? 11 : 7 };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", e => {
      const [x, y] = MAIN.pt(e);
      G.mouse.x = x; G.mouse.y = y; G.mouse.in = true;
      const d = MAIN.drag;
      if (d) {
        if (Math.abs(y - d.y) > d.tol || Math.abs(x - d.x) > d.tol) d.moved = true;
        if (d.moved) {
          // relative to the last move (not the press point), so the camera never runs away while the zoom changes
          const now = performance.now(), dy = (y - d.ly) / G.zoom, dt = Math.max(1, now - d.lt) / 1000;
          d.v = d.v * 0.5 + (dy / dt) * 0.5; d.ly = y; d.lt = now;
          G.follow = false; G.camTo = null; G.cam = U.clamp(G.cam + dy, -90, GAME.camMax());
          if (G.cam >= GAME.camMax() - 30) G.follow = true;
        }
      }
    });
    cv.addEventListener("pointerup", e => {
      const d = MAIN.drag; MAIN.drag = null;
      if (!d) return;
      if (!d.moved) { if (G.started && !CINE.active) { const [x, y] = MAIN.pt(e); GAME.click(x, y, e.pointerType !== "mouse"); } }
      else if (performance.now() - d.lt < 90 && Math.abs(d.v) > 250 && !G.follow) G.fling = U.clamp(d.v, -9000, 9000);   // flick to keep scrolling
    });
    cv.addEventListener("pointercancel", () => (MAIN.drag = null));
    cv.addEventListener("pointerleave", () => { if (!MAIN.drag) G.mouse.in = false; });
    cv.addEventListener("wheel", e => {
      e.preventDefault();
      G.follow = false; G.camTo = null; G.fling = 0;
      G.cam = U.clamp(G.cam - e.deltaY / G.zoom, -90, GAME.camMax());
      if (G.cam >= GAME.camMax() - 30) G.follow = true;
    }, { passive: false });
    addEventListener("keydown", e => {
      if (!G.started || CINE.active || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); GAME.poke(); }
      else if (e.key === "g" || e.key === "G") GAME.grow();
      else if (e.key === "Escape") { GAME.sel = -1; UI.refreshMenu(); UI.closeModal(); }
      else if (e.key === "ArrowUp" || e.key === "PageUp") { G.follow = false; G.camTo = U.clamp(G.cam + G.vH * 0.6, 0, GAME.camMax()); }
      else if (e.key === "ArrowDown" || e.key === "PageDown") { G.follow = false; G.camTo = U.clamp(G.cam - G.vH * 0.6, 0, GAME.camMax()); }
      else if (e.key === "Home") G.follow = true;
    });
  },
};
MAIN.boot();
