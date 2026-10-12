/* Gerald Wants Up — cutscenes. CINE.play(id, params, onDone) shows a full-window cinematic overlay
   (own DOM + canvas + rAF loop). ids: intro | compost | compostShort | zone | reward.
   Every call into DRAW / WORLD / SFX / G is guarded: a missing or broken function falls back to a simple
   built-in drawing (or silence), so a scene can never crash or get stuck. Skip / Esc always ends a scene,
   onDone fires exactly once, and a play() while a scene is active is queued. */
const CINE = {
  active: false,
  _q: [], _s: null, _bad: {}, _gc: {},

  /* ---------- guarded access to the other modules ---------- */
  _G() { return typeof G !== "undefined" ? G : null; },
  _fn(mod, name) {
    if (CINE._bad[mod + name]) return null;
    const M = mod === "W" ? (typeof WORLD !== "undefined" ? WORLD : null) : (typeof DRAW !== "undefined" ? DRAW : null);
    return M && typeof M[name] === "function" ? M[name] : null;
  },
  /* call DRAW/WORLD fn; false if missing/broken (it is then disabled) so the caller draws a fallback */
  _call(mod, name, ctx, a, b, c, d) {
    const f = CINE._fn(mod, name);
    if (!f) return false;
    ctx.save();
    try { f(ctx, a, b, c, d); ctx.restore(); return true; } catch (e) {
      ctx.restore(); CINE._bad[mod + name] = 1;
      try { console.warn("CINE: " + (mod === "W" ? "WORLD." : "DRAW.") + name + " threw; using fallback.", e); } catch (_) { }
      return false;
    }
  },
  sfx(name, o) { try { if (typeof SFX !== "undefined" && SFX && SFX.play) SFX.play(name, o); } catch (e) { } },
  _au(fn, a) { try { if (typeof SFX !== "undefined" && SFX && typeof SFX[fn] === "function") SFX[fn](a); } catch (e) { } },
  _spk(key) {
    const S = typeof DATA !== "undefined" && DATA.SPEAKERS;
    return (S && S[key]) || { name: key, col: "#fff3dc", pitch: 200 };
  },
  reduced() { const g = CINE._G(); return !!(g && g.S && g.S.settings && g.S.settings.shake === false); },
  shake(sc, a) { if (!CINE.reduced()) sc.shake = Math.max(sc.shake, a); },
  /* unit-ish look vector from (x,y) toward the cursor (or toward (fx,fy) when there is no cursor) */
  look(sc, x, y, fx, fy) {
    let dx, dy;
    if (sc.mx >= 0) { dx = sc.mx - x; dy = sc.my - y; } else { dx = (fx == null ? sc.L.W / 2 : fx) - x; dy = (fy == null ? sc.L.H / 2 : fy) - y; }
    const m = Math.hypot(dx, dy) || 1, k = Math.min(1, m / 160);
    return { x: (dx / m) * k, y: (dy / m) * k };
  },
  lookAt(x, y, tx, ty) { const dx = tx - x, dy = ty - y, m = Math.hypot(dx, dy) || 1; return { x: dx / m, y: dy / m }; },

  /* ---------- character wrappers (DRAW first, fallback otherwise) ---------- */
  gerald(ctx, x, y, s, o) {
    // when he stands on a beanstalk this frame, the stalk itself is his neck (same look as in the game)
    if (CINE._hadStalk && (!o || o.neck === undefined)) o = Object.assign({}, o, { neck: false });
    CINE._hadStalk = false;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (!CINE._call("D", "gerald", ctx, o)) CINE._fbGerald(ctx, o);
    ctx.restore();
  },
  portrait(ctx, key, x, y, size, t) {
    if (key === "narr" || key === "you") return;
    ctx.save(); ctx.translate(x, y);
    if (!CINE._call("D", "portrait", ctx, key, size, t)) CINE._fbPortrait(ctx, key, size, t);
    ctx.restore();
  },
  worm(ctx, x, y, o) {
    ctx.save(); ctx.translate(x, y);
    if (!CINE._call("D", "worm", ctx, o)) CINE._fbWorm(ctx, o);
    ctx.restore();
  },
  moon(ctx, x, y, r, o) {
    ctx.save(); ctx.translate(x, y);
    if (!CINE._call("D", "moonFace", ctx, r, o)) CINE._fbMoon(ctx, r, o);
    ctx.restore();
  },
  plant(ctx, x, y, s, p, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (!CINE._call("D", "plant", ctx, p, o)) CINE._fbPlant(ctx, p, o);
    ctx.restore();
  },
  bean(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (!CINE._call("D", "bean", ctx, false, t, 7)) {
      ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 2;
      INK.blob(ctx, 0, 0, 8, 6, INK.C.bean, true, 5, 0.06);
      INK.oval(ctx, -2.5, -1, 1.3, 1.3, INK.C.ink); INK.oval(ctx, 2.5, -1, 1.3, 1.3, INK.C.ink);
      INK.oval(ctx, 0, 2.5, 1.4, 1.8, INK.C.ink);
    }
    ctx.restore();
  },
  sky(ctx, W, H, zone, alt, t) { if (!CINE._call("W", "sky", ctx, W, H, alt, t)) CINE._fbSky(ctx, W, H, zone, t); },

  /* ---------- fallbacks (used only when DRAW / WORLD are missing or broken) ---------- */
  _fbGerald(ctx, o) {
    const C = INK.C, t = o.t || 0, mood = o.mood || "grump", lk = o.look || { x: 0, y: 0 }, bl = o.blink || 0;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.lineCap = "round";
    const sw = Math.sin(t * 2) * 0.12;
    ctx.save(); ctx.rotate(sw); INK.blob(ctx, -12, -44, 13, 6, C.leaf, true, 31); ctx.restore();
    ctx.save(); ctx.rotate(-sw); INK.blob(ctx, 12, -46, 13, 6, C.leaf, true, 32); ctx.restore();
    INK.blob(ctx, 0, 0, 34, 42, "#6bd36b", true, 33, 0.04);
    INK.eye(ctx, -13, -8, 11, lk, { blink: bl, lid: "#5cbf5c" });
    INK.eye(ctx, 13, -8, 11, lk, { blink: bl, lid: "#5cbf5c" });
    const a = mood === "happy" ? -0.5 : mood === "sad" || mood === "shock" ? -1 : 1;
    ctx.lineWidth = 4;
    INK.wline(ctx, [[-23, -25 - a * 3], [-6, -24 + a * 3]], 34); INK.wline(ctx, [[23, -25 - a * 3], [6, -24 + a * 3]], 35);
    ctx.lineWidth = 3;
    if (mood === "shock" || (o.spit || 0) > 0.3) INK.oval(ctx, 0, 19, 6, 8, C.ink);
    else if (mood === "happy") { ctx.beginPath(); ctx.arc(0, 12, 11, 0.25, Math.PI - 0.25); ctx.stroke(); }
    else if (mood === "talk") INK.oval(ctx, 0, 18, 7, 2 + Math.abs(Math.sin(t * 17)) * 6, C.ink);
    else if (mood === "sad") { ctx.beginPath(); ctx.arc(0, 28, 9, Math.PI + 0.4, -0.4); ctx.stroke(); }
    else INK.wline(ctx, [[-9, 19], [9, 17]], 36);
    ctx.save(); ctx.rotate(Math.sin(t * 3) * 0.2);
    INK.blob(ctx, -40, 14, 9, 4, C.leaf, true, 37); INK.blob(ctx, 40, 14, 9, 4, C.leaf, true, 38);
    ctx.restore();
  },
  _fbPortrait(ctx, key, size, t) {
    if (key === "gerald") { const k = size / 120; ctx.scale(k, k); CINE._fbGerald(ctx, { t, mood: "grump" }); return; }
    if (key === "moon") { CINE._fbMoon(ctx, size * 0.4, { t, mood: "smug" }); return; }
    const sp = CINE._spk(key), r = size * 0.34, b = Math.sin(t * 2.2 + key.length) * size * 0.02;
    ctx.strokeStyle = INK.C.ink; ctx.lineWidth = Math.max(2, size * 0.025);
    INK.blob(ctx, 0, b, r, r * 1.1, sp.col, true, key.length * 7 + 3, 0.09);
    INK.eye(ctx, -r * 0.36, b - r * 0.18, r * 0.24, { x: Math.sin(t * 0.7), y: 0.2 }, { blink: Math.sin(t * 1.3 + 2) > 0.97 ? 1 : 0 });
    INK.eye(ctx, r * 0.36, b - r * 0.18, r * 0.24, { x: Math.sin(t * 0.7), y: 0.2 }, { blink: Math.sin(t * 1.3 + 2) > 0.97 ? 1 : 0 });
    ctx.beginPath(); ctx.arc(0, b + r * 0.3, r * 0.25, 0.3, Math.PI - 0.3); ctx.stroke();
  },
  _CR: [[-0.45, -0.42, 0.16], [0.52, 0.3, 0.13], [-0.18, 0.58, 0.11], [0.3, -0.58, 0.09], [-0.62, 0.22, 0.08]],
  _fbMoon(ctx, r, o) {
    const mood = o.mood || "smug", lk = o.look || { x: 0, y: 0 }, C = INK.C;
    ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2, r * 0.035);
    INK.blob(ctx, 0, 0, r, r, "#fff3c4", true, 61, 0.025);
    for (const c of CINE._CR) INK.oval(ctx, c[0] * r, c[1] * r, c[2] * r, c[2] * r * 0.8, "#eadb9f", true);
    const bl = mood === "sleep" ? 1 : mood === "smug" ? 0.42 : 0, st = mood === "nervous" ? "wide" : "round";
    INK.eye(ctx, -r * 0.3, -r * 0.06, r * 0.16, lk, { blink: bl, lid: "#f4e3a6", style: st });
    INK.eye(ctx, r * 0.3, -r * 0.06, r * 0.16, lk, { blink: bl, lid: "#f4e3a6", style: st });
    ctx.lineWidth = Math.max(2, r * 0.03);
    if (mood === "bye") INK.oval(ctx, 0, r * 0.38, r * 0.12, r * 0.14, C.ink);
    else if (mood === "nervous") INK.wline(ctx, [[-r * 0.2, r * 0.36], [-r * 0.07, r * 0.31], [r * 0.07, r * 0.37], [r * 0.2, r * 0.31]], 62, r * 0.01);
    else { ctx.beginPath(); ctx.arc(r * 0.05, r * 0.2, r * 0.2, 0.4, Math.PI - 1.1); ctx.stroke(); }
  },
  /* worm: origin = ground point; mouth sits at about y = -4.3 * size when fully risen */
  _fbWorm(ctx, o) {
    const C = INK.C, z = (o.size || 40) / 40, t = o.t || 0, rise = U.clamp(o.rise == null ? 1 : o.rise, 0, 1);
    if (rise <= 0) return;
    const h = 230 * z * rise, hy = -h + 40 * z, sway = k => Math.sin(t * 1.8 + k * 0.7) * 5 * z;
    ctx.save(); ctx.beginPath(); ctx.rect(-300 * z, -600 * z, 600 * z, 600 * z); ctx.clip();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
    for (let y = 10 * z, k = 0; y > hy + 30 * z; y -= 30 * z, k++) INK.blob(ctx, sway(k), y, 36 * z, 20 * z, k % 2 ? "#e8998a" : "#d9887a", true, 90 + k, 0.05);
    const hx = sway(8), mood = o.mood || "smug";
    INK.blob(ctx, hx, hy, 44 * z, 40 * z, "#f0a493", true, 99, 0.04);
    const lk = o.look || { x: -0.5, y: 0.2 };
    INK.eye(ctx, hx - 15 * z, hy - 6 * z, 9 * z, lk, { blink: mood === "happy" ? 0.5 : 0, lid: "#e08f80" });
    INK.eye(ctx, hx + 15 * z, hy - 6 * z, 10 * z, lk, { lid: "#e08f80" });
    ctx.strokeStyle = C.gold; ctx.lineWidth = 2.5 * z; INK.oval(ctx, hx + 15 * z, hy - 6 * z, 13 * z, 13 * z, null, true);
    ctx.beginPath(); ctx.moveTo(hx + 27 * z, hy - 2 * z); ctx.quadraticCurveTo(hx + 34 * z, hy + 16 * z, hx + 26 * z, hy + 28 * z); ctx.stroke();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
    const m = U.clamp(o.mouth || 0, 0, 1) + (mood === "chew" ? Math.abs(Math.sin(t * 12)) * 0.35 : 0);
    INK.oval(ctx, hx, hy + 18 * z, (8 + m * 8) * z, (2 + m * 12) * z, "#5a2236", true);
    INK.oval(ctx, hx, hy - 38 * z, 50 * z, 8 * z, "#2a2233", true);
    INK.blob(ctx, hx, hy - 52 * z, 30 * z, 20 * z, "#2a2233", true, 98, 0.03);
    ctx.fillStyle = "#7a5a8a"; ctx.fillRect(hx - 28 * z, hy - 46 * z, 56 * z, 6 * z);
    ctx.restore();
  },
  _fbPlant(ctx, p, o) {
    const C = INK.C, t = o.t || 0, g = o.grow == null ? 1 : o.grow, sd = p.seed || 1;
    ctx.rotate(Math.sin(t * 2 + sd) * 0.07); ctx.scale(g, g);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
    const n = p.pt || 6;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + t * 0.3;
      INK.blob(ctx, Math.cos(a) * 25, Math.sin(a) * 25, 11, 11, p.c2 || C.pink, true, sd + k, 0.1);
    }
    INK.blob(ctx, 0, 0, 23, 21, p.c1 || C.gold, true, sd, 0.08);
    const bl = o.sad ? 0.35 : 0, lk = o.look || { x: 0, y: 0 };
    if ((p.eyes || 2) === 1) INK.eye(ctx, 0, -4, 8, lk, { blink: bl, style: p.eyeStyle });
    else { INK.eye(ctx, -8, -4, 6.5, lk, { blink: bl, style: p.eyeStyle }); INK.eye(ctx, 8, -4, 6.5, lk, { blink: bl, style: p.eyeStyle }); }
    ctx.lineWidth = 2;
    if (o.wob > 0.3 || o.sad) { ctx.beginPath(); ctx.arc(0, 14, 5, Math.PI + 0.4, -0.4); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(0, 6, 6, 0.4, Math.PI - 0.4); ctx.stroke(); }
  },
  _fbSky(ctx, W, H, z, t) {
    const key = z.k + ":" + H; let g = CINE._gc[key];
    if (!g) { g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, z.sky[0]); g.addColorStop(1, z.sky[1]); CINE._gc[key] = g; }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (z.stars > 0) CINE._stars(ctx, W, H, z.stars, t, z.k + 1);
  },
  _stars(ctx, W, H, a, t, seed) {
    ctx.fillStyle = "#fff8e0";
    for (let k = 0; k < 80; k++) {
      const x = (INK.n(seed + 3, k) * 0.5 + 0.5) * W, y = (INK.n(seed + 9, k) * 0.5 + 0.5) * H, r = 1 + (k % 3) * 0.6;
      ctx.globalAlpha = U.clamp(a * (0.55 + 0.45 * Math.sin(t * 1.7 + k * 1.3)), 0, 1);
      ctx.fillRect(x, y, r, r);
    }
    ctx.globalAlpha = 1;
  },

  /* ---------- own props ---------- */
  /* beanstalk from ground point (bx,by) up to the head (hx,hy) */
  stalk(ctx, bx, by, hx, hy, s, t) {
    // callers pass the point just under the head; the stalk now runs on up into the middle of the head
    hy -= 34 * s; CINE._hadStalk = true;
    const C = INK.C, mx = (bx + hx) / 2 + Math.sin(t * 1.3) * 16 * s, my = (by + hy) / 2;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(mx, my, hx, hy);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 13 * s + 6; ctx.stroke();
    ctx.strokeStyle = "#5cbf5c"; ctx.lineWidth = 13 * s; ctx.stroke();
    ctx.strokeStyle = "#7ed87e"; ctx.lineWidth = 3 * s; ctx.stroke();
    const n = Math.min(14, Math.floor(Math.abs(by - hy - 60 * s) / (58 * s)));   // leaves stop below his chin
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
    for (let k = 1; k <= n; k++) {
      const u = (k / (n + 1)) * (1 - 60 * s / Math.max(1, by - hy)), v = 1 - u, x = v * v * bx + 2 * u * v * mx + u * u * hx, y = v * v * by + 2 * u * v * my + u * u * hy, d = k % 2 ? 1 : -1;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-d * (0.55 + Math.sin(t * 2 + k) * 0.15));
      INK.blob(ctx, d * 15 * s, 0, 15 * s, 6.5 * s, C.leaf, true, 80 + k); ctx.restore();
    }
  },
  /* x of the stalk drawn by stalk(bx,by,hx,hy,s,t) at height y (for attaching branches) */
  stalkX(bx, by, hx, hy, s, t, y) {
    hy -= 34 * s;
    const mx = (bx + hx) / 2 + Math.sin(t * 1.3) * 16 * s, u = U.clamp((by - y) / Math.max(1, by - hy), 0, 1), v = 1 - u;
    return v * v * bx + 2 * u * v * mx + u * u * hx;
  },
  /* a branch from the stalk to a plant's stem base */
  branch(ctx, sx, sy, ex, ey, s) {
    const d = ex > sx ? 1 : -1;
    for (const [w, col] of [[12 * s, INK.C.ink], [6.5 * s, "#5cbf5c"]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.bezierCurveTo(sx + d * 24 * s, sy + 6 * s, ex - d * 20 * s, ey + 10 * s, ex, ey); ctx.stroke();
    }
  },
  /* Gnome Dave, feet at (x,y) */
  gnome(ctx, x, y, s, look, o) {
    const C = INK.C; o = o || {};
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.lineJoin = "round";
    if (o.shovel) {
      ctx.lineWidth = 3; INK.wline(ctx, [[-14, -14], [-26, -58]], 76);
      INK.wpoly(ctx, [[-31, -58], [-21, -58], [-20, -70], [-26, -76], [-32, -70]], "#9aa3b5", true, 77, 0.8);
    }
    INK.blob(ctx, 0, -17, 15, 18, "#4a7fe8", true, 71);
    INK.oval(ctx, -7, -1, 6, 3, "#3a2a1a", true); INK.oval(ctx, 7, -1, 6, 3, "#3a2a1a", true);
    INK.blob(ctx, 0, -40, 13, 12, "#ffd9b8", true, 72);
    INK.wpoly(ctx, [[-13, -36], [13, -36], [0, -12]], "#ffffff", true, 74, 0.8);
    INK.wpoly(ctx, [[-15, -46], [15, -46], [4 + Math.sin(INK.t * 1.5) * 1.5, -86]], "#ff5a5a", true, 73, 0.8);
    INK.eye(ctx, -5, -45, 3.8, look); INK.eye(ctx, 5, -45, 3.8, look);
    INK.oval(ctx, 0, -40, 3.6, 3, "#ff9a9a", true);
    if (o.sweat) { INK.blob(ctx, 16, -50 + (INK.t * 20) % 8, 3, 4.5, "#9fe0ff", true, 79, 0.1); }
    ctx.restore();
  },
  /* garden ground: grass edge at y = gy, dirt below; night 0..1 darkens it */
  ground(ctx, W, H, gy, night, hole) {
    const C = INK.C, x0 = -W, x1 = W * 2;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
    ctx.fillStyle = night > 0 ? INK.mix(C.soil, "#1c1233", night * 0.55) : C.soil;
    ctx.fillRect(x0, gy + 8, x1 - x0, H * 3);
    const pts = [[x0, gy + 22], [x0, gy]];
    for (let x = x0; x <= x1; x += 26) pts.push([x + 13, gy - 6 - Math.abs(INK.n(7, x | 0)) * 6], [x + 26, gy]);
    pts.push([x1, gy + 22]);
    INK.wpoly(ctx, pts, night > 0 ? INK.mix(C.moss, "#1c3a40", night * 0.55) : C.moss, true, 41, 0.8);
    ctx.fillStyle = INK.rgba("#000000", 0.18);
    for (let k = 0; k < 18; k++) { ctx.beginPath(); ctx.ellipse((INK.n(11, k) * 0.5 + 0.5) * W, gy + 30 + Math.abs(INK.n(12, k)) * 160, 4 + (k % 3) * 2, 3, 0, 0, 7); ctx.fill(); }
    if (hole) INK.blob(ctx, hole[0], gy + 6, hole[1], hole[1] * 0.35, "#3e2614", true, 43, 0.12);
  },
  /* wrap text into lines that fit maxW with the current ctx.font */
  wrap(ctx, text, maxW) {
    const words = String(text).split(" "), out = []; let line = "";
    for (const w of words) {
      const tryL = line ? line + " " + w : w;
      if (line && ctx.measureText(tryL).width > maxW) { out.push(line); line = w; } else line = tryL;
    }
    if (line) out.push(line);
    return out;
  },
  /* chunky rounded panel */
  panel(ctx, x, y, w, h, fill, r) {
    r = r || 18; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    ctx.fillStyle = INK.C.ink; ctx.save(); ctx.translate(0, 6); ctx.fill(); ctx.restore();
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 4; ctx.stroke();
  },

  /* ---------- DOM + style ---------- */
  _css() {
    if (document.getElementById("cine-style")) return;
    const st = document.createElement("style"); st.id = "cine-style";
    const F = INK.FONT, Hd = INK.HAND;
    st.textContent = [
      "#cine{position:fixed;inset:0;z-index:50;overflow:hidden;background:#0b0612;opacity:0;transition:opacity .35s;cursor:pointer;",
      "user-select:none;-webkit-user-select:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;--bar:48px}",
      "#cine.on{opacity:1}#cine.clear{background:transparent}",
      "#cine .cine-cv{position:absolute;left:0;top:0;width:100%;height:100%;display:block}",
      "#cine .cine-bar{position:absolute;left:0;right:0;height:var(--bar);background:#0b0612;z-index:2;transition:transform .8s cubic-bezier(.2,.8,.2,1)}",
      "#cine .cine-bar.t{top:0;transform:translateY(-101%)}#cine .cine-bar.b{bottom:0;transform:translateY(101%)}",
      "#cine.bars .cine-bar{transform:none}",
      "#cine .cine-box{position:absolute;left:50%;bottom:max(10px,calc(var(--bar)*.3));width:min(880px,calc(100% - 20px));box-sizing:border-box;",
      "min-height:128px;display:flex;gap:14px;align-items:flex-start;padding:22px 18px 26px;background:#1d0f2b;color:#fff3dc;",
      "border:3px solid #fff3dc;border-radius:20px;box-shadow:0 0 0 3px #0b0612,0 8px 0 3px #0b0612;z-index:3;",
      "opacity:0;transform:translate(-50%,24px);transition:opacity .25s,transform .3s cubic-bezier(.3,1.6,.5,1);pointer-events:none}",
      "#cine .cine-box.show{opacity:1;transform:translate(-50%,0);pointer-events:auto}",
      "#cine .cine-box.pop .cine-main{animation:cineLine .28s ease-out}",
      "@keyframes cineLine{0%{transform:translateY(4px);opacity:.4}100%{transform:none;opacity:1}}",
      "#cine .cine-name{position:absolute;top:-19px;left:20px;max-width:calc(100% - 40px);font:20px/1.15 " + F + ";color:#1d0f2b;",
      "padding:3px 14px 2px;border:3px solid #0b0612;border-radius:12px;transform:rotate(-2deg);box-shadow:0 3px 0 #0b0612;letter-spacing:.5px}",
      "#cine .cine-name:empty{display:none}",
      "#cine .cine-por{width:84px;height:84px;flex:0 0 84px;border-radius:16px;background:rgba(255,243,220,.07);border:3px solid #0b0612}",
      "#cine .cine-por.none{display:none}",
      "#cine .cine-main{flex:1;min-width:0}",
      "#cine .cine-txt{font:bold 22px/1.3 " + Hd + ";white-space:pre-wrap;overflow-wrap:break-word}",
      "#cine .cine-txt.narr{font-style:italic;color:#d9c6f2;text-align:center;padding-top:6px}",
      "#cine .cine-rest{opacity:0}",
      "#cine .cine-hint{position:absolute;right:16px;bottom:5px;font:15px " + F + ";color:#ffd23f;opacity:0;transition:opacity .2s}",
      "#cine .cine-hint.show{opacity:.85;animation:cineBob 1s ease-in-out infinite}",
      "@keyframes cineBob{50%{transform:translateY(-3px)}}",
      "#cine .cine-ch{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}#cine .cine-ch:empty{display:none}",
      "#cine .cine-ch button{font:bold 21px " + Hd + ";background:#fff3dc;color:#1d0f2b;border:3px solid #0b0612;border-radius:14px;",
      "padding:5px 18px;box-shadow:0 4px 0 #0b0612;cursor:pointer;animation:cinePop .35s cubic-bezier(.3,1.7,.5,1) backwards}",
      "#cine .cine-ch button:hover,#cine .cine-ch button:focus-visible{background:#ffd23f;transform:translateY(-2px) rotate(-1.5deg);outline:none}",
      "@keyframes cinePop{0%{transform:scale(.4);opacity:0}100%{transform:none;opacity:1}}",
      "#cine .cine-skip{position:absolute;top:calc(var(--bar)/2);right:12px;transform:translateY(-50%);z-index:6;font:17px " + F + ";",
      "color:#fff3dc;background:#1d0f2b;border:3px solid #fff3dc;border-radius:12px;padding:3px 13px;cursor:pointer;opacity:.75;box-shadow:0 3px 0 #0b0612}",
      "#cine .cine-skip:hover{opacity:1;background:#3a2152}",
      "@media (max-width:560px){#cine .cine-txt{font-size:18px}#cine .cine-por{width:58px;height:58px;flex-basis:58px}",
      "#cine .cine-name{font-size:16px}#cine .cine-box{min-height:112px;gap:10px;padding:20px 12px 24px}#cine .cine-ch button{font-size:18px;padding:4px 12px}}",
    ].join("");
    document.head.appendChild(st);
  },

  /* ---------- public API ---------- */
  play(id, params, onDone) {
    params = params || {};
    if (CINE.active) { CINE._q.push([id, params, onDone]); return; }
    let steps = null;
    try { steps = typeof document !== "undefined" && CINE.SCENES[id] ? CINE.SCENES[id](params) : null; } catch (e) { console.error("CINE: building scene '" + id + "' failed", e); }
    if (!steps || !steps.length) {
      if (typeof document !== "undefined") console.warn("CINE: unknown or empty scene '" + id + "'");
      if (onDone) setTimeout(onDone, 0);
      return;
    }
    CINE.active = true;
    try { CINE._start(id, params, steps, onDone); } catch (e) {
      console.error("CINE: start failed", e);
      const s = CINE._s; if (s) CINE._teardown(s); else { CINE.active = false; if (onDone) setTimeout(onDone, 0); }
    }
  },
  /* end the current scene now (same as pressing Skip) */
  skip() { if (CINE._s) CINE._end(CINE._s); },

  _start(id, p, steps, cb) {
    CINE._css(); CINE._gc = {};
    const root = document.createElement("div");
    root.id = "cine"; root.className = "cine-" + id + (id === "reward" ? " clear" : "");
    root.innerHTML = '<canvas class="cine-cv"></canvas><div class="cine-bar t"></div><div class="cine-bar b"></div>' +
      '<div class="cine-box"><div class="cine-name"></div><canvas class="cine-por"></canvas><div class="cine-main">' +
      '<div class="cine-txt"><span></span><span class="cine-rest"></span></div><div class="cine-ch"></div></div>' +
      '<div class="cine-hint">click / space &#9656;</div></div><button class="cine-skip" type="button">Skip &#9656;&#9656;</button>';
    document.body.appendChild(root);
    const q = s => root.querySelector(s);
    const el = { root, cv: q(".cine-cv"), box: q(".cine-box"), name: q(".cine-name"), por: q(".cine-por"), txt: q(".cine-txt"),
      typed: q(".cine-txt span"), rest: q(".cine-rest"), ch: q(".cine-ch"), hint: q(".cine-hint"), skip: q(".cine-skip") };
    const sc = { id, p, steps, cb, el, i: -1, t: 0, st: 0, lt: 0, dt: 0, v: {}, L: {}, shot: null, xf: 0, xfT: 99,
      shake: 0, flash: 0, mx: -1, my: -1, ty: null, choiceOpen: false, doneT: 0, cam: { x: 0, y: 0, z: 1 }, camSnap: true, camRate: 2.2,
      ctx: el.cv.getContext("2d"), pctx: el.por.getContext("2d"), snap: document.createElement("canvas"), cw: -1, chh: -1, dpr: 1,
      bars: id !== "reward", dead: false, ending: false, last: performance.now() };
    sc.loop = now => CINE._frame(sc, now);
    sc.onClick = e => { if (e.target.closest && e.target.closest(".cine-skip,.cine-ch")) return; CINE._adv(sc); };
    sc.onMove = e => { const r = root.getBoundingClientRect(); sc.mx = e.clientX - r.left; sc.my = e.clientY - r.top; };
    sc.onSkip = e => { e.stopPropagation(); e.preventDefault(); CINE.sfx("click"); CINE._end(sc); };
    root.addEventListener("click", sc.onClick);
    root.addEventListener("pointermove", sc.onMove);
    root.addEventListener("pointerdown", sc.onMove);
    el.skip.addEventListener("click", sc.onSkip);
    window.addEventListener("keydown", CINE._key, true);
    CINE._s = sc;
    CINE._au("duck", true);
    CINE._resize(sc);
    CINE._next(sc);
    sc.raf = requestAnimationFrame(sc.loop);
  },
  _key(e) {
    const sc = CINE._s;
    if (!sc || sc.dead) return;
    const k = e.key;
    if (k === " " || k === "Spacebar" || k === "Enter") { e.preventDefault(); e.stopPropagation(); if (!e.repeat) CINE._adv(sc); }
    else if (k === "Escape") { e.preventDefault(); e.stopPropagation(); CINE._end(sc); }
    else if (sc.choiceOpen && k >= "1" && k <= "9" && +k <= sc.choiceN) { e.preventDefault(); e.stopPropagation(); CINE._pick(sc, +k - 1); }
  },
  _end(sc) {
    if (sc.ending || sc.dead) return;
    sc.ending = true;
    sc.el.root.classList.remove("on", "bars");
    sc.el.box.classList.remove("show");
    sc.el.ch.innerHTML = ""; sc.choiceOpen = false;
    sc.kill = setTimeout(() => CINE._teardown(sc), 400);
  },
  _teardown(sc) {
    if (sc.dead) return;
    sc.dead = true; sc.ending = true;
    clearTimeout(sc.kill); cancelAnimationFrame(sc.raf);
    window.removeEventListener("keydown", CINE._key, true);
    sc.el.root.removeEventListener("click", sc.onClick);
    sc.el.root.removeEventListener("pointermove", sc.onMove);
    sc.el.root.removeEventListener("pointerdown", sc.onMove);
    sc.el.skip.removeEventListener("click", sc.onSkip);
    try { sc.el.root.remove(); } catch (e) { }
    if (CINE._s === sc) CINE._s = null;
    CINE.active = false;
    CINE._au("duck", false);
    const cb = sc.cb; sc.cb = null;
    if (typeof cb === "function") { try { cb(); } catch (e) { console.error("CINE: onDone threw", e); } }
    if (!CINE.active && CINE._q.length) { const n = CINE._q.shift(); CINE.play(n[0], n[1], n[2]); }
  },

  /* ---------- step machine ---------- */
  _next(sc) {
    if (sc.ending) return;
    let s;
    for (;;) { s = sc.steps[++sc.i]; if (!s) return CINE._end(sc); if (s.if && !s.if(sc)) continue; break; }
    sc.step = s; sc.st = 0; sc.doneT = 0; sc.choiceShown = false; sc.choiceOpen = false; sc.el.ch.innerHTML = "";
    if (s.shot && s.shot !== sc.shot) {
      if (sc.shot && s.xf !== 0) {
        const x = sc.snap.getContext("2d"); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, sc.snap.width, sc.snap.height);
        x.drawImage(sc.el.cv, 0, 0); sc.xf = s.xf || 0.5; sc.xfT = 0;
      }
      sc.shot = s.shot; sc.lt = 0; sc.camSnap = !s.ease;
    }
    if (s.cam) { sc.v.cam = s.cam; if (s.snap) sc.camSnap = true; }
    sc.camRate = s.rate || 2.2;
    if (s.mood !== undefined) sc.v.mood = s.mood;
    if (s.mark) [].concat(s.mark).forEach(m => { sc.v[m] = sc.t; });
    if (s.shake) CINE.shake(sc, s.shake);
    if (s.flash) sc.flash = Math.max(sc.flash, s.flash);
    if (s.sfx) CINE.sfx(s.sfx);
    if (s.cue) CINE._au("cue", s.cue);
    if (s.set) Object.assign(sc.v, s.set);
    if (s.bars !== undefined) sc.bars = s.bars;
    try { if (s.at) s.at(sc); } catch (e) { console.error("CINE step error", e); }
    const say = typeof s.say === "function" ? s.say(sc) : s.say;
    if (say) CINE._say(sc, say[0], say[1]);
    else if (!s.choice) { sc.ty = null; sc.el.box.classList.remove("show"); }
    sc.el.hint.classList.remove("show");
  },
  _say(sc, spk, text) {
    const sp = CINE._spk(spk), el = sc.el, z = sc.p.zone;
    let name = sp.name;
    if (spk === "local" && z && z.whoName) name = z.whoName;
    if (spk === "plant" && sc.p.top) name = sc.p.top;
    sc.spk = spk;
    el.name.textContent = spk === "narr" ? "" : name;
    el.name.style.background = sp.col;
    el.txt.className = "cine-txt" + (spk === "narr" ? " narr" : "");
    el.por.classList.toggle("none", spk === "narr" || spk === "you");
    text = String(text);
    sc.ty = { s: text, n: 0, acc: 0, k: 0, cps: 44, pitch: sp.pitch || 0 };
    el.typed.textContent = ""; el.rest.textContent = text;
    el.box.classList.add("show"); el.box.classList.remove("pop"); void el.box.offsetWidth; el.box.classList.add("pop");
  },
  _typing(sc) { return !!(sc.ty && sc.ty.n < sc.ty.s.length); },
  _finishLine(sc) { const ty = sc.ty; ty.n = ty.s.length; sc.el.typed.textContent = ty.s; sc.el.rest.textContent = ""; },
  _showChoices(sc, opts) {
    sc.choiceShown = true; sc.choiceOpen = true; sc.choiceN = opts.length;
    const ch = sc.el.ch; ch.innerHTML = "";
    if (!sc.ty) sc.el.box.classList.add("show");
    opts.forEach((o, i) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = o; b.style.animationDelay = i * 0.09 + "s";
      b.addEventListener("click", e => { e.stopPropagation(); CINE._pick(sc, i); });
      ch.appendChild(b);
    });
  },
  _pick(sc, i) {
    if (!sc.choiceOpen || sc.ending) return;
    sc.choiceOpen = false; sc.el.ch.innerHTML = "";
    const s = sc.step; sc.v.pick = i; if (s.key) sc.v[s.key] = i;
    CINE.sfx("click");
    try { if (s.onPick) s.onPick(sc, i); } catch (e) { console.error(e); }
    CINE._next(sc);
  },
  _adv(sc) {
    if (sc.ending || sc.dead || sc.t < 0.25) return;
    if (sc.choiceOpen) return;
    if (CINE._typing(sc)) { CINE._finishLine(sc); return; }
    const s = sc.step;
    if (s && s.choice && !sc.choiceShown) return;
    if (s && s.lock && sc.st < s.lock) return;
    CINE.sfx("tick");
    CINE._next(sc);
  },

  /* ---------- loop ---------- */
  _resize(sc) {
    const W = Math.max(1, sc.el.root.clientWidth || window.innerWidth), H = Math.max(1, sc.el.root.clientHeight || window.innerHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (W === sc.cw && H === sc.chh && dpr === sc.dpr) return;
    sc.cw = W; sc.chh = H; sc.dpr = dpr; CINE._gc = {};
    sc.el.cv.width = Math.round(W * dpr); sc.el.cv.height = Math.round(H * dpr);
    sc.snap.width = sc.el.cv.width; sc.snap.height = sc.el.cv.height; sc.xfT = 99;
    const bar = Math.round(U.clamp(H * 0.075, 22, 70));
    sc.el.root.style.setProperty("--bar", bar + "px");
    sc.bar = bar;
    const ps = sc.el.por.offsetWidth || 84;
    sc.el.por.width = Math.round(ps * dpr); sc.el.por.height = Math.round(ps * dpr); sc.pSize = ps;
  },
  _layout(sc) {
    const L = sc.L, W = sc.cw, H = sc.chh;
    L.W = W; L.H = H; L.bar = sc.bar; L.top = sc.bar;
    const bt = sc.el.box.offsetTop;
    L.boxTop = bt > H * 0.3 ? bt : H - sc.bar - 130;
    L.floor = L.boxTop - 8; L.sh = Math.max(120, L.floor - L.top);
    L.s = U.clamp(Math.min(W / 640, L.sh / 400), 0.55, 2.1);
    L.port = W < H * 0.85;
    return L;
  },
  _frame(sc, now) {
    if (sc.dead) return;
    sc.raf = requestAnimationFrame(sc.loop);
    let dt = (now - sc.last) / 1000; sc.last = now;
    if (!(dt > 0)) dt = 0; if (dt > 0.1) dt = 0.1;
    CINE._step(sc, dt, true);
  },
  /* advance the scene by dt seconds (draw = also render a frame); also usable by test pages */
  _step(sc, dt, draw) {
    if (!sc || sc.dead) return;
    sc.dt = dt; sc.t += dt; sc.st += dt; sc.lt += dt; sc.xfT += dt;
    if (!sc.on && sc.t > 0.02) { sc.on = true; sc.el.root.classList.add("on"); }
    sc.el.root.classList.toggle("bars", !!sc.bars && !sc.ending);
    try { CINE._tick(sc, dt); } catch (e) { if (!sc.errT) { sc.errT = 1; console.error("CINE tick error", e); } }
    if (draw) try { CINE._render(sc); } catch (e) { if (!sc.errR) { sc.errR = 1; console.error("CINE render error", e); } }
  },
  _tick(sc, dt) {
    const ty = sc.ty, el = sc.el;
    if (ty && ty.n < ty.s.length) {
      ty.acc += dt * ty.cps;
      let ch = false;
      while (ty.acc >= 1 && ty.n < ty.s.length) {
        ty.acc -= 1; const c = ty.s[ty.n++], nx = ty.s[ty.n]; ch = true;
        if (c !== " " && ++ty.k % 2 === 0 && ty.pitch) CINE.sfx("blip", { pitch: ty.pitch });
        if ((c === "." || c === "!" || c === "?") && (nx === " " || nx === undefined)) ty.acc -= 7;
        else if (c === "." && nx === ".") ty.acc -= 3;
        else if ((c === "," || c === ":") && nx === " ") ty.acc -= 3;
      }
      if (ch) { el.typed.textContent = ty.s.slice(0, ty.n); el.rest.textContent = ty.s.slice(ty.n); }
    }
    sc.shake = sc.shake > 0.2 ? sc.shake * Math.exp(-dt * 5) : 0;
    if (sc.v.rumble && !CINE.reduced()) sc.shake = Math.max(sc.shake, sc.v.rumble);
    sc.flash = Math.max(0, sc.flash - dt * 2.5);
    const s = sc.step;
    if (!s || sc.ending) return;
    if (s.tick) s.tick(sc, dt);
    const typing = CINE._typing(sc);
    if (s.choice && !sc.choiceShown && !typing) CINE._showChoices(sc, s.choice);
    el.hint.classList.toggle("show", !!sc.ty && !typing && !sc.choiceOpen && !(s.auto != null));
    if (sc.choiceOpen) return;
    if (!sc.ty && !s.choice && s.wait != null && sc.st >= s.wait) return CINE._next(sc);
    if (sc.ty && !typing && s.auto != null) { sc.doneT += dt; if (sc.st >= s.auto && sc.doneT > 0.5) return CINE._next(sc); }
  },
  _render(sc) {
    CINE._resize(sc);
    const L = CINE._layout(sc), ctx = sc.ctx, W = L.W, H = L.H, dpr = sc.dpr;
    INK.setTime(sc.t);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (sc.shake > 0.3) ctx.translate((Math.random() - 0.5) * 2 * sc.shake, (Math.random() - 0.5) * 2 * sc.shake);
    const f = CINE.SH[sc.shot];
    if (f) { ctx.save(); f(ctx, W, H, sc, sc.lt); ctx.restore(); }
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
    if (sc.xfT < sc.xf) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1 - U.smooth(sc.xfT / sc.xf);
      ctx.drawImage(sc.snap, 0, 0); ctx.globalAlpha = 1; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (sc.flash > 0) { ctx.fillStyle = "rgba(255,250,235," + (sc.flash * (CINE.reduced() ? 0.3 : 0.8)).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); }
    const s = sc.step;
    if (s && !sc.ty && !s.choice && s.wait == null && !sc.ending && sc.st > (s.lock || 0.6)) {
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(sc.t * 4);
      INK.label(ctx, s.hint || "click / space to continue", W / 2, H - L.bar - 14, Math.round(U.clamp(W / 40, 14, 19)), INK.C.gold, "center", INK.FONT, 4);
      ctx.globalAlpha = 1;
    }
    if (sc.ty && sc.el.box.classList.contains("show") && sc.spk !== "narr" && sc.spk !== "you") CINE._drawPortrait(sc);
  },
  _drawPortrait(sc) {
    const c = sc.pctx, d = sc.dpr, ps = sc.pSize, tk = CINE._typing(sc);
    c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, ps, ps);
    c.save(); c.translate(ps / 2, ps / 2 + (tk ? Math.sin(sc.t * 22) * 1.5 : 0));
    const key = sc.spk;
    if (!CINE._call("D", "portrait", c, key, ps * 0.92, sc.t)) CINE._fbPortrait(c, key, ps * 0.92, sc.t);
    c.restore();
  },
  /* ease the shared camera toward (tx,ty) zoom tz and apply it */
  camera(ctx, sc, tx, ty, tz) {
    const c = sc.cam, k = sc.camSnap ? 1 : 1 - Math.exp(-sc.dt * sc.camRate);
    sc.camSnap = false;
    c.x += (tx - c.x) * k; c.y += (ty - c.y) * k; c.z += (tz - c.z) * k;
    const L = sc.L, br = Math.sin(sc.t * 0.6) * 2;
    ctx.translate(L.W / 2, L.H / 2 + br); ctx.scale(c.z, c.z); ctx.translate(-c.x, -c.y);
  },

  /* ---------- shots: draw functions (ctx, W, H, sc, lt) ---------- */
  SH: {
    /* the intro garden: bean, sprout, night, Moon rise, stare, measuring line (all driven by sc.v marks) */
    garden(ctx, W, H, sc, lt) {
      const L = sc.L, s = L.s, v = sc.v, t = sc.t, C = INK.C, cx = W / 2, gy = L.floor - 26 * s;
      const night = v.nightT != null ? U.clamp((t - v.nightT) / 2.4, 0, 1) : 0;
      const sp = v.sproutT != null ? t - v.sproutT : -1;
      const grow = sp < 0.7 ? 0 : U.easeOutElastic(U.clamp((sp - 0.7) / 1.5, 0, 1));
      const pop = sp < 0.7 ? 0 : U.easeOutBack(U.clamp((sp - 0.7) / 0.5, 0, 1));
      const gs = s * 0.95, stH = 120 * s * grow, hx = cx + Math.sin(t * 1.1) * 3 * s, hy = gy - 34 * gs - stH;
      const beanIn = v.beanT != null && t > v.beanT + 0.45;
      const gx = beanIn ? cx + 84 * s : cx + 178 * s;
      const mr = night > 0 ? U.smooth(U.clamp((t - v.nightT - 0.5) / 2.8, 0, 1)) : 0, r = (L.port ? 44 : 54) * s;
      const mx = cx + Math.min(W * 0.3, 300 * s), my = U.lerp(gy + r * 1.3, L.top + (gy - L.top) * 0.24, mr);
      /* sky (screen space) with a parallax lift while the camera looks up */
      const alt = 0.6 + Math.max(0, H / 2 - sc.cam.y) / 92;
      CINE.sky(ctx, W, H, ZONES.get(0), alt, t);
      if (night > 0) {
        ctx.fillStyle = "rgba(14,8,44," + (0.82 * night).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H);
        CINE._stars(ctx, W, H * 0.75, night, t, 5);
      }
      /* camera */
      let tx = cx, ty = H / 2, tz = 1;
      switch (v.cam) {
        case "sky": ty = H / 2 - H * 1.15; break;
        case "gnome": tx = gx; ty = gy - 45 * s; tz = 2.1; break;
        case "bean": tx = cx + 30 * s; ty = gy - 22 * s; tz = 2; break;
        case "sprout": ty = gy - 90 * s; tz = 1.4; break;
        case "gerald": tx = hx; ty = hy; tz = 2.3; break;
        case "geraldXL": tx = hx; ty = hy - 8 * gs; tz = 4.6; break;
        case "night": tx = cx + (mx - cx) * 0.3; ty = (L.top + gy) / 2 + 10 * s; break;
        case "moon": tx = mx; ty = my; tz = 2.7; break;
        case "moonXL": tx = mx; ty = my - r * 0.06; tz = 5.6; break;
      }
      CINE.camera(ctx, sc, tx, ty, tz);
      /* the Moon */
      if (mr > 0) {
        const lk = v.moonLookT != null ? CINE.lookAt(mx, my, hx, hy) : { x: -0.2, y: 0.4 };
        ctx.save(); ctx.globalAlpha = 0.25 * night; INK.oval(ctx, mx, my, r * 1.5, r * 1.5, "#fff3c4"); ctx.restore();
        CINE.moon(ctx, mx, my, r, { t, mood: v.moonLookT != null ? "smug" : "sleep", look: lk });
      }
      CINE.ground(ctx, W, H, gy, night, [cx, 26 * s]);
      /* the bean / sprout */
      if (beanIn && sp < 0.75) {
        const wig = sp > 0 ? Math.sin(t * 38) * 0.35 : 0;
        ctx.save(); ctx.translate(cx, gy + 2); ctx.rotate(wig); CINE.bean(ctx, 0, 0, s * 1.5, t); ctx.restore();
      }
      if (sp > 0.4 && sp < 1.6) {
        ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
        const q = (sp - 0.4) / 1.2;
        for (let k = 0; k < 9; k++) {
          const a = -Math.PI * (0.1 + 0.8 * (k / 8)), d = q * (50 + k * 7) * s;
          INK.blob(ctx, cx + Math.cos(a) * d, gy + Math.sin(a) * d + q * q * 60 * s, 5 * s * (1 - q * 0.6), 4 * s, "#6b4226", true, 140 + k);
        }
      }
      if (grow > 0) {
        CINE.stalk(ctx, cx, gy + 4, hx, hy + 30 * gs, s * (0.5 + grow * 0.5), t);
        const wk = v.wakeT != null ? t - v.wakeT : -1;
        let bl = wk < 0 ? 1 : 1 - U.clamp(wk / 0.7, 0, 1);
        if (wk > 2.4 && (t % 3.7) < 0.13) bl = 1;
        let lk = CINE.look(sc, hx, hy, gx, gy - 40 * s);
        if (wk > 0.9 && wk < 1.5) lk = { x: -1, y: 0.1 }; else if (wk >= 1.5 && wk < 2.1) lk = { x: 1, y: 0.1 };
        if (v.stare || (v.moonLookT != null && mr > 0.5 && !v.measT)) lk = CINE.lookAt(hx, hy, mx, my);
        let mood = v.mood || "grump"; if (sc.spk === "gerald" && CINE._typing(sc)) mood = "talk";
        CINE.gerald(ctx, hx, hy, gs * pop, { t, look: lk, mood, blink: v.stare ? Math.max(bl, 0.38) : bl, hat: "none" });
      }
      CINE.SH._gardenGnome(ctx, sc, gx, gy, s, v, t);
      CINE.SH._measure(ctx, sc, hx, hy - 40 * gs, mx, my + r, s, t);
      if (night > 0) { ctx.fillStyle = "rgba(14,8,44," + (0.28 * night).toFixed(3) + ")"; ctx.fillRect(-W, gy + 10, W * 3, H * 3); }
      ctx.setTransform(sc.dpr, 0, 0, sc.dpr, 0, 0);
      if (v.beanT != null) {
        const bt = t - v.beanT, a = bt < 0.15 ? bt / 0.15 : bt < 0.8 ? 1 : 1 - (bt - 0.8) / 0.25;
        if (a > 0) {
          ctx.fillStyle = "rgba(11,6,18," + U.clamp(a, 0, 1).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H);
          if (bt > 0.2 && bt < 0.8) INK.label(ctx, "(rustling)", W / 2 + Math.sin(t * 30) * 2, H / 2, Math.round(20 * s), C.cream, "center", INK.HAND, 4);
        }
      }
    },
    _gardenGnome(ctx, sc, gx, gy, s, v, t) {
      const beanIn = v.beanT != null && t > v.beanT + 0.45;
      let lk = beanIn ? CINE.lookAt(gx, gy - 45 * s, sc.L.W / 2, gy - (v.sproutT != null ? 120 * s : 0)) : { x: -0.6, y: 0.5 };
      if (v.gnomeLookT != null && v.sproutT == null) { const k = U.clamp((t - v.gnomeLookT) / 1.2, 0, 1); lk = { x: lk.x * (1 - k), y: lk.y * (1 - k) }; }
      CINE.gnome(ctx, gx, gy + 4, s * 1.05, lk, { shovel: beanIn, sweat: v.gnomeLookT != null && v.sproutT == null });
    },
    /* measuring tape from Gerald to the Moon + scientists' rival estimates */
    _measure(ctx, sc, x0, y0, x1, y1, s, t) {
      const v = sc.v; if (v.measT == null) return;
      const p = U.smooth(U.clamp((t - v.measT) / 1.1, 0, 1)), ex = U.lerp(x0, x1, p), ey = U.lerp(y0, y1, p);
      ctx.save(); ctx.setLineDash([7 * s, 7 * s]); ctx.lineDashOffset = -t * 20;
      ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = INK.C.gold; ctx.lineWidth = 3 * s; ctx.stroke(); ctx.restore();
      if (p < 1) return;
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, k = U.easeOutBack(U.clamp((t - v.measT - 1.1) / 0.4, 0, 1));
      const txt = U.ft(ECON.zoneAt(6)), fs = Math.round(22 * s);
      ctx.save(); ctx.translate(mx, my); ctx.scale(k, k); ctx.rotate(-0.06);
      ctx.font = fs + "px " + INK.FONT; const w = ctx.measureText(txt).width + 22 * s;
      CINE.panel(ctx, -w / 2, -fs * 0.95, w, fs * 1.6, INK.C.gold, 10 * s);
      INK.label(ctx, txt, 0, fs * 0.32, fs, INK.C.ink, "center", INK.FONT, 0.01);
      ctx.restore();
      if (v.sciT == null) return;
      const GU = [U.metric() ? "3 m?" : "11 ft?", "a lot", "3 giraffes", "rude to ask", "SIX"];
      for (let i = 0; i < GU.length; i++) {
        const q = U.easeOutBack(U.clamp((t - v.sciT - 0.3 - i * 0.35) / 0.35, 0, 1)); if (q <= 0) continue;
        const a = i * 1.9 + 0.6, d = (70 + (i % 2) * 34) * s, lx = mx + Math.cos(a) * d * 1.3, ly = my + Math.sin(a) * d;
        ctx.save(); ctx.translate(lx, ly); ctx.scale(q, q); ctx.rotate(INK.n(3, i) * 0.25);
        ctx.font = Math.round(17 * s) + "px " + INK.HAND; const w = ctx.measureText(GU[i]).width + 14 * s;
        CINE.panel(ctx, -w / 2, -14 * s, w, 24 * s, INK.C.cream, 6 * s);
        INK.label(ctx, GU[i], 0, 4 * s, Math.round(17 * s), INK.C.ink, "center", INK.HAND, 0.01);
        ctx.strokeStyle = INK.C.red; ctx.lineWidth = 2.5 * s; INK.wline(ctx, [[-w / 2 + 4, 0], [w / 2 - 4, -2]], 200 + i);
        ctx.restore();
      }
    },
    /* the complaint, written out by hand */
    paper(ctx, W, H, sc, lt) {
      const L = sc.L, s = L.s, C = INK.C, t = sc.t, v = sc.v;
      ctx.fillStyle = "#24133a"; ctx.fillRect(0, 0, W, H);
      const gk = "pg" + W + "x" + H; let g = CINE._gc[gk];
      if (!g) { g = ctx.createRadialGradient(W / 2, H * 0.42, 10, W / 2, H * 0.42, Math.max(W, H) * 0.6); g.addColorStop(0, "rgba(255,206,120,0.42)"); g.addColorStop(1, "rgba(255,206,120,0)"); CINE._gc[gk] = g; }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      let ph = Math.min(L.sh * 0.92, 600), pw = ph * 0.78;
      if (pw > W * 0.88) { pw = W * 0.88; ph = pw / 0.78; }
      const py = L.top + L.sh / 2 + (1 - U.easeOutBack(U.clamp(lt / 0.7, 0, 1))) * H * 0.7;
      ctx.save(); ctx.translate(W / 2, py); ctx.rotate(-0.035 + Math.sin(t * 0.8) * 0.008); ctx.scale(1 + lt * 0.006, 1 + lt * 0.006);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 4;
      const hw = pw / 2, hh = ph / 2;
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(-hw + 8, -hh + 10, pw, ph);
      INK.wpoly(ctx, [[-hw, -hh], [hw, -hh + 3], [hw - 2, hh], [-hw + 3, hh - 2]], "#fff8e6", true, 300, 1.5);
      ctx.lineWidth = 1.5; ctx.strokeStyle = "#a9c8f0";
      for (let y = -hh + ph * 0.2; y < hh - 10; y += ph * 0.077) { ctx.beginPath(); ctx.moveTo(-hw + 6, y); ctx.lineTo(hw - 6, y); ctx.stroke(); }
      ctx.strokeStyle = "#f08a8a"; ctx.beginPath(); ctx.moveTo(-hw + pw * 0.12, -hh + 4); ctx.lineTo(-hw + pw * 0.12, hh - 4); ctx.stroke();
      CINE.SH._writing(ctx, sc, lt, pw, ph, s, t);
      ctx.restore();
      const gp = U.easeOutBack(U.clamp((lt - 0.5) / 0.6, 0, 1)), gs = s * (L.port ? 0.8 : 1.1);
      let mood = v.mood || "grump"; if (sc.spk === "gerald" && CINE._typing(sc)) mood = "talk";
      const gx = W - 62 * gs - 8, gyy = L.floor + 40 * gs - gp * 80 * gs;
      CINE.gerald(ctx, gx, gyy, gs, { t, look: CINE.lookAt(gx, gyy, W / 2, py), mood, blink: (t % 3.3) < 0.12 ? 1 : 0 });
    },
    _ROWS: [["COMPLAINT #1", 0.14, 1.45, 1], ["To: The Moon", 0.27, 1, 0], ["The Moon looked at me", 0.425, 1, 0], ["funny.", 0.502, 1, 0],
      ["Severity: ", 0.656, 1, 0], ["EXTREME", 0.656, 1.15, 2], ["- Gerald", 0.81, 1.15, 3]],
    _writing(ctx, sc, lt, pw, ph, s, t) {
      const v = sc.v, hw = pw / 2, hh = ph / 2, f = ph * 0.056, x0 = -hw + pw * 0.16, R = CINE.SH._ROWS;
      let n = Math.max(0, Math.floor((lt - 0.8) * 17)), px = x0, py = -hh + ph * 0.14, ex = 0, done = true;
      if (n > (v.pn || 0) + 4) { CINE.sfx("tick"); v.pn = n; }
      ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
      for (let i = 0; i < R.length; i++) {
        const r = R[i], fs = Math.round(f * r[2]);
        ctx.font = (r[3] === 1 ? fs + "px " + INK.FONT : "bold " + fs + "px " + INK.HAND);
        let x = r[3] === 3 ? hw - pw * 0.12 - ctx.measureText(r[0]).width : x0;
        if (r[3] === 2) x = ex;
        const y = -hh + ph * r[1];
        if (r[3] === 0 && r[0] === "Severity: ") ex = x0 + ctx.measureText(r[0]).width;
        const part = r[0].slice(0, Math.min(r[0].length, n)); n -= part.length;
        if (part.length < r[0].length) done = false;
        if (!part.length) break;
        ctx.fillStyle = r[3] === 2 ? INK.C.red : "#2a1a4a";
        ctx.fillText(part, x, y);
        px = x + ctx.measureText(part).width; py = y;
        if (r[3] === 2 && part.length === r[0].length) {
          if (v.exT == null) { v.exT = lt; CINE.shake(sc, 4); }
          const u = Math.min(3, Math.floor((lt - v.exT) / 0.22) + 1), w = ctx.measureText(r[0]).width;
          ctx.strokeStyle = INK.C.red; ctx.lineWidth = 2.5 * s;
          for (let k = 0; k < u; k++) INK.wline(ctx, [[x - 4, y + 7 + k * 6], [x + w * 0.5, y + 9 + k * 6], [x + w + 6, y + 6 + k * 6]], 310 + k, 1.4);
        }
      }
      if (!done) {
        ctx.save(); ctx.translate(px + 4, py - 4); ctx.rotate(0.6 + Math.sin(t * 30) * 0.08);
        ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 2;
        INK.wpoly(ctx, [[0, 0], [8, -6], [8, -60], [-8, -60], [-8, -6]], INK.C.gold, true, 320, 0.5);
        INK.wpoly(ctx, [[-8, -60], [8, -60], [8, -72], [-8, -72]], INK.C.pink, true, 321, 0.5);
        ctx.restore();
      } else {
        if (v.wdT == null) v.wdT = lt;
        const q = U.clamp((lt - v.wdT) / 0.6, 0, 1), r = ph * 0.055, dx = hw - pw * 0.2, dy = hh - ph * 0.11;
        ctx.strokeStyle = "#2a1a4a"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2 * q); ctx.stroke();
        if (q >= 1) {
          INK.wline(ctx, [[dx - r * 0.55, dy - r * 0.4], [dx - r * 0.15, dy - r * 0.2]], 330); INK.wline(ctx, [[dx + r * 0.55, dy - r * 0.4], [dx + r * 0.15, dy - r * 0.2]], 331);
          ctx.beginPath(); ctx.arc(dx, dy + r * 0.55, r * 0.3, Math.PI + 0.5, -0.5); ctx.stroke();
          ctx.font = "bold " + Math.round(f * 0.8) + "px " + INK.HAND; ctx.fillStyle = "#2a1a4a"; ctx.textAlign = "right"; ctx.fillText("(him) ->", dx - r * 1.3, dy + r * 0.35); ctx.textAlign = "left";
        }
      }
    },
    /* title card: letters drop in over a rising sky */
    title(ctx, W, H, sc, lt) {
      const L = sc.L, s = L.s, t = sc.t, C = INK.C, v = sc.v;
      CINE.sky(ctx, W, H, ZONES.get(0), 0.6 + lt * 1.5, t);
      ctx.fillStyle = "rgba(29,15,43,0.22)"; ctx.fillRect(0, 0, W, H);
      const f = Math.round(Math.min(W * 0.115, L.sh * 0.16, 120)), y1 = L.top + L.sh * 0.34, y2 = y1 + f * 1.75;
      const words = [["GERALD", C.moss, f, y1], ["WANTS", C.cream, f, y1], ["UP", C.gold, f * 1.9, y2]];
      ctx.font = f + "px " + INK.FONT;
      const w1 = ctx.measureText("GERALD WANTS").width, sp = ctx.measureText(" ").width;
      let x = W / 2 - w1 / 2, li = 0, upW = 0;
      for (let wi = 0; wi < 3; wi++) {
        const wd = words[wi], fs = wd[2];
        ctx.font = fs + "px " + INK.FONT;
        if (wi === 2) { upW = ctx.measureText("UP").width; x = W / 2 - upW / 2; }
        for (let i = 0; i < wd[0].length; i++, li++) {
          const ch = wd[0][i], cw = ctx.measureText(ch).width, d = 0.2 + li * 0.07 + (wi === 2 ? 0.35 : 0);
          const p = U.clamp((lt - d) / 0.55, 0, 1);
          if (p > 0) {
            const bob = wi === 2 && p >= 1 ? -Math.abs(Math.sin(t * 3)) * 8 * s : 0;
            ctx.save(); ctx.translate(x + cw / 2, wd[3] - (1 - U.easeOutBack(p)) * H * 0.6 + bob);
            ctx.rotate(INK.n(9, li) * 0.1 + Math.sin(t * 2 + li) * 0.03);
            INK.label(ctx, ch, 3, 5, fs, C.ink, "center", INK.FONT, fs * 0.12);
            INK.label(ctx, ch, 0, 0, fs, wd[1], "center", INK.FONT, fs * 0.12);
            ctx.restore();
          }
          x += cw;
        }
        x += sp;
      }
      if (!v.upLand && lt > 0.2 + 13 * 0.07 + 0.35 + 0.4) { v.upLand = 1; CINE.shake(sc, 9); CINE.sfx("stamp"); }
      const gp = U.easeOutBack(U.clamp((lt - 1.9) / 0.6, 0, 1));
      if (gp > 0) {
        const gs = s * 0.9, gx = W / 2 - upW / 2 - 70 * gs, gyy = y2 - f * 0.6 + (1 - gp) * H * 0.5;
        CINE.stalk(ctx, gx, H + 30, gx, gyy + 30 * gs, gs, t);
        CINE.gerald(ctx, gx, gyy, gs, { t, look: { x: 0.4, y: -1 }, mood: "grump", blink: (t % 3.1) < 0.12 ? 1 : 0, hat: "none" });
      }
      const sa = U.clamp((lt - 2.3) / 0.8, 0, 1);
      if (sa > 0) { ctx.globalAlpha = sa; INK.label(ctx, "a story about a complaint", W / 2, y2 + f * 0.75, Math.round(f * 0.32), C.cream, "center", INK.HAND, 4); ctx.globalAlpha = 1; }
    },
    /* compost: plant tower on the stalk, Wormsley, slurping, the mulch mountain (driven by sc.v marks) */
    tower(ctx, W, H, sc, lt) {
      const L = sc.L, v = sc.v, t = sc.t, C = INK.C, pl = v.pl, n = pl.length, gy = L.floor - 6;
      const ts = U.clamp(Math.min(L.s, (gy - L.top - 30) / (n * 58 + 210)), 0.45, 2);
      const sx = L.port ? W * 0.3 : W * 0.36, wx = L.port ? W * 0.74 : W * 0.68;
      const realW = !!CINE._fn("D", "worm"), wsz = realW ? Math.min(W * (L.port ? 0.15 : 0.13), L.sh * 0.15, 115) : Math.min(W * (L.port ? 0.12 : 0.1), L.sh * 0.1, 80);
      const mT = v.moundT != null ? U.easeInOut(U.clamp((t - v.moundT) / (v.mdur || 2.0), 0, 1)) : 0, mh = mT * Math.min(170 * ts, L.sh * 0.3);
      let rise = v.wormT != null ? U.easeOutBack(U.clamp((t - v.wormT) / (v.rdur || 1.3), 0, 1)) : 0;
      if (v.sinkT != null) rise *= 1 - U.smooth(U.clamp((t - v.sinkT) / 1.2, 0, 1));
      /* mouth position: DRAW.worm puts the head centre at R * (2 - 5 * rise); the fallback worm is taller */
      const mouthX = wx, mouthY = realW ? gy + wsz * (2.45 - 5 * rise) : gy - wsz * 4.3 * rise, base = gy - mh;
      const headY = base - 70 * ts - n * 58 * ts - 26 * ts - (v.hopT != null && t - v.hopT < 0.7 ? Math.sin((t - v.hopT) / 0.7 * Math.PI) * 30 * ts : 0);
      const g = CINE._G(), alt = ((g && g.S && g.S.mtn) || 0) + 1.5 + mh / 92;
      CINE.sky(ctx, W, H, ZONES.get(ECON.zoneOf(alt)), alt, t);
      let tx = W / 2, ty = H / 2, tz = 1;
      if (v.cam === "worm") { if (!L.port) { tx = W / 2 + (wx - W / 2) * 0.45; ty = H / 2 - 10 * ts; tz = 1.12; } }
      else if (v.cam === "plants") { tx = L.port ? W / 2 : sx + 30 * ts; ty = (gy + headY) / 2; tz = L.port ? 1.05 : 1.2; }
      else if (v.cam === "head") { tx = sx; ty = headY + 40 * ts; tz = 1.8; }
      else if (v.cam === "top") { const tot = gy - headY + 90 * ts; tz = U.clamp(L.sh * 0.95 / tot, 0.6, 1.1); tx = W / 2 + (sx - W / 2) * 0.3; ty = (headY - 40 * ts + gy) / 2 + (H / 2 - (L.top + L.floor) / 2) / tz; }
      CINE.camera(ctx, sc, tx, ty, tz);
      CINE.ground(ctx, W, H, gy, 0, null);
      if (mh > 1) CINE.SH._mound(ctx, sx, gy, mh, Math.min(W * 0.46, 380 * ts), ts, t, sc.p.top);
      const sway = Math.sin(t * 1.1) * 4 * ts;
      CINE.stalk(ctx, sx, base + 6, sx + sway, headY + 34 * ts, ts, t);
      /* Wormsley */
      if (rise > 0) {
        INK.blob(ctx, wx, gy + 4, wsz * 1.3, wsz * 0.32, "#3e2614", true, 410, 0.1);
        let flying = false;
        for (let k = 0; k < n; k++) { const e = v.slurpT != null ? t - v.slurpT - k * v.gap : -1; if (e > v.fl * 0.4 && e < v.fl + 0.1) flying = true; }
        const talk = sc.spk === "worm" && CINE._typing(sc);
        const mood = v.sinkT != null && t > v.sinkT ? "happy" : v.nomT != null && t - v.nomT < 0.9 ? "chew" : "smug";
        CINE.worm(ctx, wx, gy, { t, size: wsz, rise, mood, mouth: flying ? 1 : talk ? 0.25 + Math.abs(Math.sin(t * 14)) * 0.35 : 0, look: CINE.lookAt(wx, mouthY, sx, (base + headY) / 2) });
      }
      if (v.wormT != null && t >= v.wormT && t - v.wormT < 1.4) {
        const q = (t - v.wormT) / 1.4; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
        for (let k = 0; k < 12; k++) {
          const a = -Math.PI * (0.08 + 0.84 * (k / 11)), d = q * (70 + (k % 4) * 30) * ts;
          INK.blob(ctx, wx + Math.cos(a) * d * 1.4, gy + Math.sin(a) * d + q * q * 140 * ts, 7 * ts * (1 - q * 0.5), 5 * ts, k % 2 ? "#6b4226" : "#4a2e18", true, 420 + k);
        }
      }
      /* branches from the stalk to every plant still on it (same look as in the game) */
      for (let k = 0; k < n; k++) {
        const e = v.slurpT != null ? t - v.slurpT - k * v.gap : -1;
        if (e > 0) continue;
        const d = k % 2 ? 1 : -1, px = sx + sway * (k / n) + d * 56 * ts, py = base - 70 * ts - k * 58 * ts, sy0 = py + 40 * ts;
        CINE.branch(ctx, CINE.stalkX(sx, base + 6, sx + sway, headY + 34 * ts, ts, t, sy0), sy0, px, py + 44 * ts * 0.92, ts * 0.9);
      }
      /* plants */
      const nerv = v.nerv && v.slurpT == null;
      for (let k = 0; k < n; k++) {
        const d = k % 2 ? 1 : -1, px = sx + sway * (k / n) + d * 56 * ts, py = base - 70 * ts - k * 58 * ts;
        const e = v.slurpT != null ? t - v.slurpT - k * v.gap : -1;
        if (e >= v.fl) {
          if ((v.eatN || 0) <= k) { v.eatN = k + 1; v.nomT = t; CINE.sfx(k % 2 ? "chew" : "gulp"); CINE.shake(sc, 2); }
          continue;
        }
        let lk = CINE.look(sc, px, py);
        if (nerv) lk = { x: Math.sin(t * 2.7 + k * 1.7), y: -0.6 + Math.sin(t * 1.9 + k) * 0.3 };
        if (rise > 0.3) lk = CINE.lookAt(px, py, mouthX, mouthY);
        const o = { t, wob: v.rumble ? 0.6 : v.shockT != null && t - v.shockT < 0.8 ? 1 : 0, grow: 1, look: lk, talk: sc.spk === "plant" && k === n - 1 && CINE._typing(sc), sad: e > 0 || v.wormT != null, dir: d };
        if (e > 0) {
          const q = e / v.fl, cx2 = (px + mouthX) / 2, cy2 = Math.min(py, mouthY) - 140 * ts, u = 1 - q;
          const fx = u * u * px + 2 * u * q * cx2 + q * q * mouthX, fy = u * u * py + 2 * u * q * cy2 + q * q * mouthY;
          ctx.save(); ctx.translate(fx, fy); ctx.rotate(q * 5 * d); CINE.plant(ctx, 0, 0, ts * 0.92 * (1 - q * 0.65), pl[k], o); ctx.restore();
        } else CINE.plant(ctx, px, py, ts * 0.92, pl[k], o);
      }
      if (v.nomT != null && t - v.nomT < 0.6) {
        const q = (t - v.nomT) / 0.6; ctx.globalAlpha = 1 - q;
        INK.label(ctx, (v.eatN || 0) % 3 === 1 ? "nom." : (v.eatN || 0) % 3 === 2 ? "*polite chew*" : "mm.", mouthX + wsz * 1.3, mouthY - q * 30 * ts, Math.round(18 * ts), C.cream, "left", INK.HAND, 4);
        ctx.globalAlpha = 1;
      }
      if (v.burpT != null && t - v.burpT < 1.2) {
        const q = (t - v.burpT) / 1.2; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
        ctx.globalAlpha = q < 0.85 ? 0.8 : (1 - q) * 5; INK.blob(ctx, mouthX + 10 * ts, mouthY - q * 60 * ts, 6 * ts + q * 16 * ts, 6 * ts + q * 16 * ts, "rgba(200,240,255,0.5)", true, 430, 0.06); ctx.globalAlpha = 1;
      }
      let mood = v.mood || "grump"; if (sc.spk === "gerald" && CINE._typing(sc)) mood = "talk";
      const glk = rise > 0.3 ? CINE.lookAt(sx, headY, mouthX, mouthY) : CINE.look(sc, sx, headY);
      CINE.gerald(ctx, sx + sway, headY, ts * 0.85, { t, look: glk, mood, blink: (t % 3.4) < 0.12 ? 1 : 0 });
    },
    _mound(ctx, sx, gy, mh, mw, ts, t, top) {
      const C = INK.C, N = 18, Y = u => gy + 6 - mh * Math.pow(Math.max(0, 1 - u * u), 0.7);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx - mw, gy + 8);
      for (let i = 0; i <= N; i++) { const u = (i / N) * 2 - 1; ctx.lineTo(sx + u * mw + INK.j(450, i) * 1.2, Y(u) + INK.j(451, i) * 1.2); }
      ctx.lineTo(sx + mw, gy + 8); ctx.closePath();
      ctx.fillStyle = "#7a4a2a"; ctx.fill(); ctx.save(); ctx.clip();
      const cols = ["#5e3a20", "#9a6a3a", "#6e4426", "#8a5a32"];
      for (let b = 0; b < 4; b++) { ctx.fillStyle = cols[b]; ctx.fillRect(sx - mw, gy - mh * (b + 0.6) / 4.4, mw * 2, mh * 0.11); }
      ctx.strokeStyle = "rgba(29,15,43,0.45)"; ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) { const x = sx + INK.n(460, k) * mw * 0.7, y = gy - mh * (0.15 + Math.abs(INK.n(461, k)) * 0.6); INK.wline(ctx, [[x, y], [x + 14 * ts, y - 6 * ts], [x + 26 * ts, y + 2 * ts], [x + 38 * ts, y - 4 * ts]], 470 + k); }
      ctx.fillStyle = "#f3ead0";
      for (let k = 0; k < 4; k++) { const x = sx + INK.n(480, k) * mw * 0.6, y = gy - mh * (0.2 + Math.abs(INK.n(481, k)) * 0.5); ctx.fillRect(x - 6 * ts, y - 1.5 * ts, 12 * ts, 3 * ts); INK.oval(ctx, x - 6 * ts, y, 2.5 * ts, 2.5 * ts, "#f3ead0"); INK.oval(ctx, x + 6 * ts, y, 2.5 * ts, 2.5 * ts, "#f3ead0"); }
      ctx.restore();
      ctx.lineCap = "round"; ctx.beginPath();
      for (let i = 4; i <= N - 4; i++) { const u = (i / N) * 2 - 1; i === 4 ? ctx.moveTo(sx + u * mw, Y(u)) : ctx.lineTo(sx + u * mw, Y(u)); }
      ctx.strokeStyle = C.ink; ctx.lineWidth = 11 * ts + 4; ctx.stroke(); ctx.strokeStyle = C.moss; ctx.lineWidth = 11 * ts; ctx.stroke();
      const rx = sx + mw * 0.42, ry = Y(0.42);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
      INK.wpoly(ctx, [[rx - 11 * ts, ry + 4], [rx - 11 * ts, ry - 16 * ts], [rx - 6 * ts, ry - 22 * ts], [rx + 6 * ts, ry - 22 * ts], [rx + 11 * ts, ry - 16 * ts], [rx + 11 * ts, ry + 4]], "#b8b4c8", true, 490, 0.6);
      INK.label(ctx, "RIP", rx, ry - 6 * ts, Math.round(9 * ts), C.ink, "center", INK.FONT, 0.01);
    },
    csum(ctx, W, H, sc, lt) {
      const L = sc.L, p = sc.p, C = INK.C, v = sc.v;
      ctx.save(); CINE.SH.tower(ctx, W, H, sc, lt); ctx.restore();
      ctx.setTransform(sc.dpr, 0, 0, sc.dpr, 0, 0);
      ctx.fillStyle = "rgba(11,6,18," + (0.5 * U.clamp(lt / 0.4, 0, 1)).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H);
      if (!v.csumS) { v.csumS = 1; CINE.sfx("reward"); }
      const k = U.easeOutBack(U.clamp(lt / 0.5, 0, 1)), cw = Math.min(W - 32, 460), fz = Math.round(Math.min(46, cw * 0.1)), ch = fz * 5.6;
      ctx.translate(W / 2, L.top + L.sh * 0.48); ctx.scale(k, k); ctx.rotate(-0.02);
      CINE.panel(ctx, -cw / 2, -ch / 2, cw, ch, "#1d0f2b", 22);
      ctx.strokeStyle = "rgba(255,243,220,0.8)"; ctx.lineWidth = 2; ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-cw / 2 + 8, -ch / 2 + 8, cw - 16, ch - 16, 15); else ctx.rect(-cw / 2 + 8, -ch / 2 + 8, cw - 16, ch - 16); ctx.stroke();
      INK.label(ctx, "COMPOSTED!", 0, -ch / 2 + fz * 1.3, fz, C.gold, "center", INK.FONT, 5);
      const q = U.smooth(U.clamp((lt - 0.35) / 1.0, 0, 1));
      INK.label(ctx, "+" + CINE._fmtMulch(p.mulch, q) + " mulch", 0, -ch / 2 + fz * 2.6, Math.round(fz * 0.85), "#f0c070", "center", INK.FONT, 5);
      INK.label(ctx, "+" + CINE._fmtFt(p, q) + " higher", 0, -ch / 2 + fz * 3.7, Math.round(fz * 0.85), C.moss, "center", INK.FONT, 5);
      ctx.globalAlpha = U.clamp((lt - 1.2) / 0.5, 0, 1);
      INK.label(ctx, v.short ? "Wormsley thanks you for your business." : "Your plants are a mountain now. They say hi.", 0, -ch / 2 + fz * 4.75, Math.round(fz * 0.42), C.cream, "center", INK.HAND, 3);
      ctx.globalAlpha = 1;
    },
    /* centred text whose letters drop in one by one; returns time when the last letter lands */
    _drop(ctx, text, cx, y, fs, col, t0, lt, t, seed) {
      ctx.font = fs + "px " + INK.FONT;
      let x = cx - ctx.measureText(text).width / 2;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i], cw = ctx.measureText(ch).width, p = U.clamp((lt - t0 - i * 0.045) / 0.5, 0, 1);
        if (p > 0 && ch !== " ") {
          ctx.save(); ctx.translate(x + cw / 2, y - (1 - U.easeOutBack(p)) * fs * 3);
          ctx.globalAlpha = Math.min(1, p * 3); ctx.rotate(INK.n(seed, i) * 0.09 + Math.sin(t * 2 + i) * 0.025);
          INK.label(ctx, ch, 3, 4, fs, INK.C.ink, "center", INK.FONT, fs * 0.12);
          INK.label(ctx, ch, 0, 0, fs, col, "center", INK.FONT, fs * 0.12);
          ctx.restore();
        }
        x += cw;
      }
      return t0 + text.length * 0.045 + 0.5;
    },
    ztitle(ctx, W, H, sc, lt) {
      const L = sc.L, s = L.s, z = sc.p.zone, t = sc.t, C = INK.C, v = sc.v;
      CINE.sky(ctx, W, H, z, z.at + 1 + lt * 0.5, t);
      const bw = U.easeInOut(U.clamp(lt / 0.5, 0, 1)), by = L.top + L.sh * 0.5;
      ctx.fillStyle = z.finale ? "rgba(29,15,43,0.12)" : "rgba(11,6,18,0.42)";
      ctx.fillRect(W / 2 - W * bw / 2, by - L.sh * 0.26, W * bw, L.sh * 0.52);
      let fs = Math.round(Math.min(W * 0.1, 92 * s, z.big || z.finale ? 120 : 92));
      ctx.font = fs + "px " + INK.FONT;
      let lines = CINE.wrap(ctx, z.name, W * 0.88);
      while (lines.length > 2 && fs > 20) { fs = Math.round(fs * 0.85); ctx.font = fs + "px " + INK.FONT; lines = CINE.wrap(ctx, z.name, W * 0.88); }
      const top = by - (lines.length - 1) * fs * 0.55;
      INK.label(ctx, (z.finale ? "...WAIT. " : "NOW ENTERING  ") + U.ft(z.at), W / 2, top - fs * 0.95, Math.round(Math.max(13, fs * 0.28)), z.finale ? C.ink : C.gold, "center", INK.FONT, 4);
      let end = 0;
      lines.forEach((ln, i) => { end = CINE.SH._drop(ctx, ln, W / 2, top + i * fs * 1.08, fs, z.finale ? C.cream : z.k === 6 ? "#fff3c4" : C.cream, 0.2 + i * 0.3, lt, t, z.k * 7 + i); });
      if (!v.tLand && lt > end) { v.tLand = 1; CINE.shake(sc, z.big || z.finale ? 12 : 5); if (z.big) sc.flash = 0.35; }
      const sa = U.clamp((lt - end - 0.1) / 0.5, 0, 1);
      if (sa > 0 && z.sub) {
        const sf = Math.round(Math.max(15, fs * 0.32)); ctx.font = "bold " + sf + "px " + INK.HAND;
        const sl = CINE.wrap(ctx, z.sub, Math.min(W * 0.86, 720));
        ctx.globalAlpha = sa;
        sl.forEach((ln, i) => INK.label(ctx, ln, W / 2, top + (lines.length - 1) * fs * 1.08 + fs * 0.75 + i * sf * 1.2 + (1 - sa) * 10, sf, z.finale ? C.ink : C.cream, "center", INK.HAND, 4));
        ctx.globalAlpha = 1;
      }
    },
    /* generic arrival conversation: resident (portrait) + Gerald on his stalk */
    ztalk(ctx, W, H, sc, lt) {
      const L = sc.L, s = L.s, z = sc.p.zone, t = sc.t, v = sc.v, who = z.who || "local", spk = sc.spk, typing = CINE._typing(sc);
      CINE.sky(ctx, W, H, z, z.at + 2 + lt * 0.02, t);
      let rx, ry, ps, gx, ghy;
      if (L.port) { rx = W * 0.62; ry = L.top + L.sh * 0.3; ps = Math.min(W * 0.62, L.sh * 0.42); gx = W * 0.27; ghy = L.top + L.sh * 0.74; }
      else { rx = W * 0.67; ry = L.top + L.sh * 0.47; ps = Math.min(W * 0.36, L.sh * 0.8); gx = W * 0.3; ghy = L.top + L.sh * 0.56; }
      const gs = s * (L.port ? 1.35 : 1.05);
      let tx = W / 2, ty = H / 2, tz = 1;
      if (v.cam === "res") { tx = rx; ty = ry; tz = 1.45; }
      else if (spk === who && who !== "gerald") { tx += (rx - W / 2) * 0.16; ty += (ry - H / 2) * 0.1; tz = 1.05; }
      else if (spk === "gerald") { tx += (gx - W / 2) * 0.16; ty += (ghy - H / 2) * 0.1; tz = 1.05; }
      CINE.camera(ctx, sc, tx, ty, tz);
      const ein = U.easeOutBack(U.clamp((lt - 0.15) / 0.7, 0, 1)), rT = spk === who && typing;
      const bob = Math.sin(t * 2) * 6 * s + (rT ? Math.sin(t * 18) * 2.5 * s : 0), rs = rT ? 1.04 : spk === who ? 1.02 : 0.97;
      ctx.save(); ctx.globalAlpha = 0.25; INK.oval(ctx, rx + (1 - ein) * W * 0.7, ry + ps * 0.46, ps * 0.32, ps * 0.06, "#000"); ctx.restore();
      ctx.save(); ctx.translate(rx + (1 - ein) * W * 0.7, ry + bob); ctx.scale(rs, rs); CINE.portrait(ctx, who, 0, 0, ps, t); ctx.restore();
      CINE.SH._guest(ctx, W, H, sc, spk, who, ps, typing);
      const gin = U.easeOutBack(U.clamp((lt - 0.05) / 0.6, 0, 1)), sway = Math.sin(t * 1.1) * 4 * s, gyy = ghy + (1 - gin) * H * 0.7;
      CINE.stalk(ctx, gx, H + 60, gx + sway, gyy + 34 * gs, gs, t);
      let mood = v.mood || "grump"; if (spk === "gerald" && typing) mood = "talk";
      const lk = spk === "narr" || spk === "gerald" && !typing ? CINE.look(sc, gx, gyy, rx, ry) : CINE.lookAt(gx, gyy, rx, ry);
      CINE.gerald(ctx, gx + sway, gyy, gs, { t, look: lk, mood, blink: (t % 3.6) < 0.12 ? 1 : 0, hat: CINE._hat() });
    },
    /* a speaker who is not the zone resident: the Sun is a glow from off-screen, others pop in small */
    _guest(ctx, W, H, sc, spk, who, ps, typing) {
      const L = sc.L, t = sc.t, v = sc.v;
      if (!spk || spk === who || spk === "gerald" || spk === "narr" || spk === "you") return;
      if (spk === "sun") {
        const gk = "sun" + W + "x" + H; let g = CINE._gc[gk];
        if (!g) { g = ctx.createRadialGradient(W, 0, 10, W, 0, Math.max(W, H) * 0.75); g.addColorStop(0, "rgba(255,250,200,0.95)"); g.addColorStop(0.35, "rgba(255,180,80,0.45)"); g.addColorStop(1, "rgba(255,140,40,0)"); CINE._gc[gk] = g; }
        ctx.save(); ctx.setTransform(sc.dpr, 0, 0, sc.dpr, 0, 0); ctx.globalAlpha = 0.75 + Math.sin(t * 9) * 0.15 * (typing ? 1 : 0.3);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
        return;
      }
      if (v.guestK !== spk) { v.guestK = spk; v.guestT = t; }
      const q = U.easeOutBack(U.clamp((t - v.guestT) / 0.5, 0, 1)), gsz = ps * 0.5;
      ctx.save(); ctx.translate(L.port ? W * 0.22 : W * 0.86, L.top + gsz * 0.6 - (1 - q) * gsz * 2 + (typing ? Math.sin(t * 18) * 2 : 0));
      CINE.portrait(ctx, spk, 0, 0, gsz, t); ctx.restore();
    },
    _paperProp(ctx, x, y, w, rot, text, stamps, t) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot + Math.sin(t * 2.3) * 0.03);
      const h = w * 0.8; ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 2.5;
      INK.wpoly(ctx, [[-w / 2, -h / 2], [w / 2, -h / 2 + 2], [w / 2 - 1, h / 2], [-w / 2 + 2, h / 2 - 1]], "#fff8e6", true, 500, 1);
      ctx.fillStyle = "#2a1a4a"; ctx.font = "bold " + Math.round(w * 0.13) + "px " + INK.HAND; ctx.textAlign = "center";
      ctx.fillText(text, 0, -h * 0.18, w * 0.9);
      ctx.strokeStyle = "rgba(42,26,74,0.5)"; ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) INK.wline(ctx, [[-w * 0.38, h * (0.02 + k * 0.12)], [w * 0.38, h * (0.02 + k * 0.12)]], 505 + k, 0.8);
      (stamps || []).forEach((sTxt, i) => {
        ctx.save(); ctx.translate(-w * 0.18 + i * w * 0.3, h * 0.3); ctx.rotate(-0.25 + i * 0.3);
        ctx.strokeStyle = "rgba(220,60,60,0.8)"; ctx.lineWidth = 1.5; ctx.strokeRect(-w * 0.15, -w * 0.05, w * 0.3, w * 0.1);
        ctx.fillStyle = "rgba(220,60,60,0.85)"; ctx.font = Math.round(w * 0.07) + "px " + INK.FONT; ctx.fillText(sTxt, 0, w * 0.025);
        ctx.restore();
      });
      ctx.restore();
    },
    /* zone 6: the Moon is the backdrop character; it flees on 'BYE!' */
    zmoon(ctx, W, H, sc, lt) {
      const L = sc.L, s = L.s, z = sc.p.zone, t = sc.t, v = sc.v, spk = sc.spk, typing = CINE._typing(sc);
      CINE.sky(ctx, W, H, z, z.at + 2 + lt * 0.02, t);
      let mx, my, r, gx, ghy;
      if (L.port) { mx = W * 0.6; my = L.top + L.sh * 0.3; r = Math.min(W * 0.33, L.sh * 0.22); gx = W * 0.27; ghy = L.top + L.sh * 0.74; }
      else { mx = W * 0.66; my = L.top + L.sh * 0.45; r = Math.min(W * 0.21, L.sh * 0.37); gx = W * 0.28; ghy = L.top + L.sh * 0.58; }
      const gs = s * (L.port ? 1.35 : 1.05), lq = v.leaveT != null ? U.clamp((t - v.leaveT) / 1.1, 0, 1) : 0, gone = lq >= 1;
      let tx = W / 2, ty = H / 2, tz = 1;
      if (spk === "moon" && !lq) { tx += (mx - W / 2) * 0.15; tz = 1.06; } else if (spk === "gerald") { tx += (gx - W / 2) * 0.15; tz = 1.05; }
      if (v.cam === "moon") { tx = mx; ty = my; tz = 1.5; }
      CINE.camera(ctx, sc, tx, ty, tz);
      const ein = U.smooth(U.clamp(lt / 1.2, 0, 1)), mood = lq > 0 ? "bye" : v.moonMood || "smug";
      if (!gone) {
        const yy = my + (1 - ein) * r * 0.6 - lq * lq * (H * 1.6), rr = r * (1 - lq * 0.55), mt = spk === "moon" && typing ? 1 + Math.sin(t * 16) * 0.015 : 1;
        ctx.save(); ctx.globalAlpha = 0.18; INK.oval(ctx, mx, yy, rr * 1.35, rr * 1.35, "#fff3c4"); ctx.restore();
        if (lq > 0) {
          ctx.strokeStyle = "rgba(255,243,196,0.6)"; ctx.lineWidth = 4 * s;
          for (let k = 0; k < 7; k++) { const lx = mx + (k - 3) * rr * 0.3; ctx.beginPath(); ctx.moveTo(lx, yy + rr * (0.9 + (k % 2) * 0.3)); ctx.lineTo(lx, yy + rr * (1.6 + lq * 3 + (k % 3) * 0.4)); ctx.stroke(); }
        }
        ctx.save(); ctx.translate(mx, yy); ctx.rotate(lq * 0.8); ctx.scale(mt, mt);
        const lk = mood === "nervous" ? { x: Math.sin(t * 3) * 0.9, y: -0.2 } : CINE.lookAt(mx, my, gx, ghy);
        CINE.moon(ctx, 0, 0, rr, { t, mood, look: lk }); ctx.restore();
      } else {
        const dq = U.easeOutBack(U.clamp((t - v.leaveT - 1.2) / 0.8, 0, 1)), sy = L.top + (my - L.top) * 0.8 * dq, sw = Math.sin(t * 2.2) * 0.08;
        ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 2; ctx.save(); ctx.translate(mx, L.top - 10); ctx.rotate(sw);
        ctx.beginPath(); ctx.moveTo(-30 * s, 0); ctx.lineTo(-30 * s, sy - L.top); ctx.moveTo(30 * s, 0); ctx.lineTo(30 * s, sy - L.top); ctx.stroke();
        CINE.panel(ctx, -70 * s, sy - L.top, 140 * s, 44 * s, INK.C.cream, 8 * s);
        INK.label(ctx, "BACK IN 5 MIN", 0, sy - L.top + 29 * s, Math.round(17 * s), INK.C.ink, "center", INK.FONT, 0.01);
        ctx.restore();
      }
      const sway = Math.sin(t * 1.1) * 4 * s, gin = U.easeOutBack(U.clamp(lt / 0.6, 0, 1)), gyy = ghy + (1 - gin) * H * 0.7;
      CINE.stalk(ctx, gx, H + 60, gx + sway, gyy + 34 * gs, gs, t);
      let gm = v.mood || "grump"; if (spk === "gerald" && typing) gm = "talk";
      const glk = gone ? CINE.look(sc, gx, gyy, mx, L.top) : CINE.lookAt(gx, gyy, mx, my - lq * H);
      CINE.gerald(ctx, gx + sway, gyy, gs, { t, look: glk, mood: gm, blink: (t % 3.6) < 0.12 ? 1 : 0, hat: CINE._hat() });
      if (v.paperT != null && v.leaveT == null) CINE.SH._paperProp(ctx, gx + sway + 70 * gs, gyy + 10 * gs - U.easeOutBack(U.clamp((t - v.paperT) / 0.5, 0, 1)) * 20 * gs, 64 * gs, 0.12, "COMPLAINT #1", null, t);
      if (v.noteT != null) {
        const nq = U.clamp((t - v.noteT) / 2.4, 0, 1), nx = U.lerp(mx, gx + 60 * gs, nq) + Math.sin(t * 3) * 30 * s * (1 - nq), ny = U.lerp(L.top - 40, gyy - 30 * gs, U.smooth(nq));
        CINE.SH._paperProp(ctx, nx, ny, 58 * gs, Math.sin(t * 2.5) * 0.4 * (1 - nq), "FWD: UP", null, t);
      }
    },
    /* zone 14: Gerald meets the player */
    zwall(ctx, W, H, sc, lt) {
      const L = sc.L, s = L.s, z = sc.p.zone, t = sc.t, v = sc.v, spk = sc.spk, typing = CINE._typing(sc);
      CINE.sky(ctx, W, H, z, z.at + 2 + lt * 0.01, t);
      const gs = s * (L.port ? 1.3 : 1.55), gx = W / 2, ghy = L.top + L.sh * 0.5;
      const cz = v.cam === "close" ? 1.25 : v.cam === "closer" ? 1.55 : 1;
      CINE.camera(ctx, sc, gx + (v.paperT != null && cz > 1 ? 40 * gs : 0), ghy - (cz > 1 ? 8 * s : 0), cz);
      const sway = Math.sin(t * 1.1) * 4 * s, gin = U.easeOutBack(U.clamp(lt / 0.7, 0, 1)), gyy = ghy + (1 - gin) * H * 0.7;
      CINE.stalk(ctx, gx, H + 80, gx + sway, gyy + 34 * gs, gs, t);
      let mood = v.mood || "grump"; if (spk === "gerald" && typing && mood !== "shock") mood = "talk";
      const lk = v.noticed ? (sc.mx >= 0 ? CINE.look(sc, W / 2, H / 2) : { x: 0, y: 0 }) : { x: 0.2 + Math.sin(t * 0.7) * 0.2, y: -1 };
      CINE.gerald(ctx, gx + sway, gyy, gs, { t, look: lk, mood, blink: (t % 3.6) < 0.12 ? 1 : 0, hat: CINE._hat() });
      if (v.paperT == null) return;
      const pq = U.easeOutBack(U.clamp((t - v.paperT) / 0.5, 0, 1)), pw = 74 * gs, px = gx + sway + 96 * gs, py = gyy + 30 * gs - pq * 26 * gs;
      CINE.SH._paperProp(ctx, px, py, pw * pq, 0.1, "THE MOON LOOKED", ["FWD", "ALMOST"], t);
      if (v.stampT == null) return;
      const q = t - v.stampT, hit = 0.38;
      if (q >= hit) {
        if (!v.stampHit) { v.stampHit = 1; CINE.shake(sc, 16); sc.flash = 0.6; CINE.sfx("stamp"); }
        const k = 1 + Math.max(0, 1 - (q - hit) / 0.22) * 0.6, txt = v.ok === 1 ? "APPROVED?" : "APPROVED.";
        ctx.save(); ctx.translate(px, py + pw * 0.05); ctx.rotate(-0.22); ctx.scale(k, k);
        ctx.strokeStyle = "rgba(225,40,50,0.9)"; ctx.lineWidth = 3; ctx.strokeRect(-pw * 0.52, -pw * 0.13, pw * 1.04, pw * 0.26);
        INK.label(ctx, txt, 0, pw * 0.07, Math.round(pw * 0.19), "#e1283a", "center", INK.FONT, 0.01); ctx.restore();
      }
      let sy = py;
      if (q < hit) sy = U.lerp(py - H * 1.2, py, (q / hit) * (q / hit)); else if (q > 0.75) sy = U.lerp(py, py - H * 1.2, U.smooth(U.clamp((q - 0.75) / 0.6, 0, 1)));
      if (q < 1.4) {
        const sw = pw * 1.15; ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 3;
        INK.wpoly(ctx, [[px - sw / 2, sy - sw * 0.22], [px + sw / 2, sy - sw * 0.22], [px + sw / 2, sy], [px - sw / 2, sy]], "#e1283a", true, 520, 1);
        INK.wpoly(ctx, [[px - sw * 0.42, sy - sw * 0.34], [px + sw * 0.42, sy - sw * 0.34], [px + sw * 0.42, sy - sw * 0.22], [px - sw * 0.42, sy - sw * 0.22]], "#b07a48", true, 521, 1);
        INK.wpoly(ctx, [[px - sw * 0.1, sy - sw * 0.75], [px + sw * 0.1, sy - sw * 0.75], [px + sw * 0.13, sy - sw * 0.34], [px - sw * 0.13, sy - sw * 0.34]], "#c98d55", true, 522, 1);
        INK.blob(ctx, px, sy - sw * 0.85, sw * 0.2, sw * 0.16, "#c98d55", true, 523, 0.06);
      }
    },
    /* the end card: Gerald keeps climbing */
    zend(ctx, W, H, sc, lt) {
      const L = sc.L, s = L.s, z = sc.p.zone, t = sc.t, C = INK.C, v = sc.v;
      CINE.sky(ctx, W, H, z, z.at + 2 + lt * 0.9, t);
      const gs = s * 1.05, gx = W / 2, gyy = L.top + L.sh * 0.76, sway = Math.sin(t * 1.1) * 5 * s;
      CINE.stalk(ctx, gx, H + 80, gx + sway, gyy + 34 * gs, gs, t);
      CINE.gerald(ctx, gx + sway, gyy, gs, { t, look: CINE.look(sc, gx, gyy, gx, L.top), mood: "happy", blink: (t % 3.6) < 0.12 ? 1 : 0, hat: CINE._hat() });
      const pq = U.clamp((lt - 0.4) / 5, 0, 1);
      if (pq < 1) CINE.SH._paperProp(ctx, gx + 120 * s + Math.sin(t * 2) * 40 * s, U.lerp(L.top - 60, H + 80, pq), 56 * s, Math.sin(t * 2.6) * 0.5, "THE MOON LOOKED", ["APPROVED"], t);
      const fs = Math.round(Math.min(W * 0.14, 96 * s, L.sh * 0.17)), y = L.top + fs * 0.95 + 8;
      const end = CINE.SH._drop(ctx, "THE END", W / 2, y, fs, C.cream, 0.3, lt, t, 77);
      if (!v.endLand && lt > end) { v.endLand = 1; CINE.shake(sc, 6); }
      let a = U.clamp((lt - end - 0.2) / 0.6, 0, 1);
      if (a > 0) { ctx.globalAlpha = a; INK.label(ctx, "(of the story)", W / 2, y + fs * 0.62, Math.round(fs * 0.3), C.cream, "center", INK.HAND, 4); }
      a = U.clamp((lt - end - 1.4) / 0.8, 0, 1);
      if (a > 0) {
        const f2 = Math.round(U.clamp(W / 26, 16, 30)); ctx.globalAlpha = a; ctx.font = f2 + "px " + INK.HAND;
        CINE.wrap(ctx, "The sky, however, does not end.", W * 0.86).forEach((ln, i) => INK.label(ctx, ln, W / 2, y + fs * 0.62 + f2 * 1.7 + i * f2 * 1.2 - (1 - a) * 8, f2, C.gold, "center", INK.HAND, 4));
      }
      ctx.globalAlpha = 1;
    },
    /* small celebratory card over the dimmed game */
    reward(ctx, W, H, sc, lt) {
      const L = sc.L, p = sc.p, t = sc.t, C = INK.C, v = sc.v, s = U.clamp(Math.min(W / 520, H / 640), 0.7, 1.4);
      ctx.fillStyle = "rgba(11,6,18," + (0.6 * U.clamp(lt / 0.3, 0, 1)).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H);
      if (!v.rS) { v.rS = 1; CINE.sfx("reward"); }
      const cw = Math.min(W - 32, 420 * s), k = U.easeOutBack(U.clamp(lt / 0.45, 0, 1)), fz = Math.round(Math.min(34 * s, cw * 0.085));
      const lf = Math.round(Math.max(16, fz * 0.62)); ctx.font = lf + "px " + INK.HAND;
      const lines = []; (p.lines || []).forEach(l => CINE.wrap(ctx, l, cw - 40).forEach(x => lines.push(x)));
      ctx.font = fz + "px " + INK.FONT;
      const tl = CINE.wrap(ctx, p.title || "Something found!", cw - 36);
      const ic = Math.round(64 * s), ch = ic * 1.2 + tl.length * fz * 1.15 + lines.length * lf * 1.25 + 40;
      const cx = W / 2, cy = H * 0.47, top = cy - ch / 2;
      ctx.save(); ctx.translate(cx, top + ic * 0.55); ctx.rotate(t * 0.35); ctx.globalAlpha = 0.22 * k; ctx.fillStyle = C.gold;
      const R = Math.max(W, H);
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.lineTo(Math.cos(a + 0.18) * R, Math.sin(a + 0.18) * R); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      const cols = [C.gold, C.pink, C.sky, C.moss, C.lil, C.or];
      for (let i = 0; i < 44; i++) {
        const sp = 70 + Math.abs(INK.n(601, i)) * 90, y = ((lt * sp + Math.abs(INK.n(602, i)) * H) % (H + 40)) - 20, x = (INK.n(600, i) * 0.5 + 0.5) * W + Math.sin(t * 2 + i) * 12;
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * 3 + i); ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-4, -2.5, 8, 5); ctx.restore();
      }
      ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
      CINE.panel(ctx, cx - cw / 2, top, cw, ch, "#1d0f2b", 22);
      ctx.font = ic + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.save(); ctx.translate(cx, top + ic * 0.15 + Math.sin(t * 3) * 5); ctx.rotate(Math.sin(t * 2) * 0.12); ctx.fillText(p.icon || "🎁", 0, 0); ctx.restore();
      ctx.textBaseline = "alphabetic";
      let y = top + ic * 0.95 + fz * 0.8;
      tl.forEach(l => { INK.label(ctx, l, cx, y, fz, C.gold, "center", INK.FONT, 5); y += fz * 1.15; });
      y += lf * 0.2;
      lines.forEach(l => { INK.label(ctx, l, cx, y, lf, C.cream, "center", INK.HAND, 3); y += lf * 1.25; });
      ctx.restore();
    },
  },

  /* ---------- scene scripts: arrays of steps ----------
     step: { shot, cam, snap, rate, ease, xf, say:[spk,text] | fn(sc), choice:[...], key, auto, wait, lock, hint,
             mood, mark (sc.v[mark] = sc.t), set {..}, shake, flash, sfx, cue, bars, at(sc), tick(sc,dt), if(sc) } */
  SCENES: {
    intro(p) {
      return [
        { shot: "garden", cam: "sky", cue: "intro", mood: "grump", wait: 1.1 },
        { cam: "wide", rate: 0.9, say: ["narr", "This is the Garden of Mild Unease."] },
        { say: ["narr", "Nothing bad has ever happened here. Nothing good, either. Things are just... mild."] },
        { cam: "gnome", rate: 1.4, say: ["narr", "The sunflowers watch. Gnome Dave watches. Nobody knows what for."] },
        { cam: "wide", mark: "beanT", wait: 1.25 },
        { cam: "bean", say: ["narr", "One day, a bean appeared in the dirt."] },
        { say: ["narr", "Nobody saw who planted it."] },
        { cam: "gnome", mark: "gnomeLookT", say: ["narr", "Nobody."] },
        { cam: "sprout", mark: "sproutT", sfx: "grow", shake: 7, wait: 2.4 },
        { say: ["narr", "The bean grew. It grew into Gerald."] },
        { cam: "gerald", mark: "wakeT", wait: 2.5 },
        { shake: 4, say: ["gerald", "No."] },
        { cam: "sprout", say: ["narr", "That was his first word. Nobody had asked him anything."] },
        { cam: "gerald", say: ["gerald", "Still no."] },
        { cam: "night", rate: 1.2, mark: "nightT", sfx: "whoosh", wait: 3.1 },
        { say: ["narr", "That night, the Moon rose."] },
        { mark: "moonLookT", say: ["narr", "It looked at Gerald."] },
        { cam: "moon", snap: true, cue: "moon", set: { stare: 1 }, wait: 1.5 },
        { cam: "gerald", snap: true, wait: 1.3 },
        { cam: "moonXL", snap: true, wait: 0.9 },
        { cam: "geraldXL", snap: true, shake: 3, wait: 1.0 },
        { cam: "night", snap: true, set: { stare: 0 }, say: ["narr", "Something passed between them."] },
        { say: ["narr", "Nobody knows what. Not even the gnome. ESPECIALLY not the gnome."] },
        { cam: "gerald", mood: "shock", shake: 5, say: ["gerald", "It looked at me FUNNY."] },
        { shot: "paper", mood: "grump", say: ["narr", "So Gerald wrote a complaint."] },
        { say: ["gerald", "This is going straight to the top."] },
        { say: ["narr", "Complaints must be delivered in person. That's the rule. Gerald made the rule just now."] },
        { shot: "garden", cam: "night", mark: "measT", say: ["narr", "The Moon is " + U.ft(ECON.zoneAt(6)) + " up."] },
        { mark: "sciT", say: ["narr", "Scientists disagree."] },
        { say: ["gerald", "I don't care what scientists think."] },
        { mood: "shock", shake: 9, say: ["gerald", "I'm going UP."] },
        { shot: "title", xf: 0.7, lock: 1.6, hint: "click to begin" },
      ];
    },
    compost(p) { return CINE._compost(p, false); },
    compostShort(p) { return CINE._compost(p, true); },
    zone(p) {
      const g = CINE._G(), z = typeof p.zone === "number" ? ZONES.get(p.zone) : p.zone || ZONES.get((g && g.S && g.S.zone) || 0); p.zone = z;
      if (z.finale) return CINE._finale(z);
      const moon = z.k === 6, shot = moon ? "zmoon" : "ztalk";
      const lines = z.arrive && z.arrive.length ? z.arrive : [["narr", U.ft(z.at) + ". " + z.name + "."], [z.who || "gnome", "..."], ["gerald", "Noted. Up."]];
      const steps = [{ shot: "ztitle", sfx: "zone", cue: moon ? "moon" : null, wait: moon ? 3.6 : 3.0 }];
      let bye = -1, spoke = false, paper = false, note = false;
      lines.forEach((l, i) => { if (l[0] === "moon" && /BYE/.test(l[1])) bye = i; });
      if (moon && bye < 0) lines.forEach((l, i) => { if (l[0] === "moon") bye = i; });
      lines.forEach((l, i) => {
        if (l[0] === "choice") { steps.push({ choice: l[1], key: "c" + i }); return; }
        const st = { say: [l[0], l[1]], set: {} };
        if (i === 0) { st.shot = shot; st.mood = "grump"; }
        if (l[0] === "sun") { st.shake = 6; st.flash = 0.25; }
        if (/points directly at you/i.test(l[1])) st.cam = "res";
        if (moon) {
          if (i === 0) st.set.moonMood = "sleep";
          if (l[0] === "moon" && !spoke) { spoke = true; st.set.moonMood = "smug"; st.shake = 3; }
          if (l[0] === "gerald" && /COMPLAINT/.test(l[1]) && !paper) { paper = true; st.mark = "paperT"; st.sfx = "pop"; }
          else if (paper && l[0] === "moon") st.set.moonMood = "nervous";
          if (i === bye) { st.mark = "leaveT"; st.sfx = "whoosh"; st.shake = 9; }
          if (bye >= 0 && i > bye && l[0] === "narr" && !note) { note = true; st.mark = "noteT"; }
        }
        steps.push(st);
      });
      return steps;
    },
    reward(p) { return [{ shot: "reward", bars: false, lock: 0.5 }]; },
    /* the first Transplant: Wormsley has a new pot, on a new planet. It looks suspiciously like the old garden. */
    transplant(p) {
      p.zone = Object.assign({}, ZONES.get(14), { who: "worm" });
      const planet = p.planet || "a new planet", dust = typeof p.dust === "number" ? U.num(p.dust) : "some";
      return [
        { shot: "ztalk", mood: "grump", say: ["worm", "Ahem. Wormsley. I also do pots."] },
        { say: ["worm", "You've gone up a very long way. The old pot is tired. Frankly, so is the planet."] },
        { mood: "shock", say: ["gerald", "I am not tired. I am FURIOUS. Completely different thing."] },
        { say: ["worm", "There's a new pot. On " + planet + ". You'd start small again."] },
        { say: ["worm", "But the stars remember everything you did. " + dust + " Stardust's worth. Spend it on the Star Chart."] },
        { say: ["gerald", "Does the new planet have a Moon?"] },
        { say: ["worm", "It has several. They all look at you funny."] },
        { mood: "happy", shake: 7, say: ["gerald", "...PACK THE POT."] },
        { shot: "garden", cam: "wide", rate: 0.9, wait: 1.0 },
        { cam: "bean", mark: "beanT", say: ["narr", "Far away, a bean landed in an empty pot."] },
        { cam: "sprout", mark: "sproutT", sfx: "grow", shake: 7, wait: 2.4 },
        { cam: "gerald", mark: "wakeT", say: ["gerald", "...This looks exactly like the old garden."] },
        { cam: "gnome", mark: "gnomeLookT", say: ["narr", "Gnome Dave is already here. Nobody knows how. Nobody asks."] },
        { cam: "gerald", mood: "shock", shake: 5, say: ["gerald", "UP. AGAIN. FASTER."] },
      ];
    },
  },
  _compost(p, short) {
    const n = CINE._plants(p.plants).length;
    const init = sc => {
      const v = sc.v; v.pl = CINE._plants(p.plants); v.gap = short ? 0.13 : 0.5; v.fl = short ? 0.28 : 0.45; v.short = short;
      if (short) { v.rdur = 0.7; v.mdur = 0.9; }
    };
    const full = v => v.gap * n + v.fl + 0.05;
    const risen = sc => { const v = sc.v; if (v.wormT == null || sc.t - v.wormT < 1.3) v.wormT = sc.t - 1.3; v.rumble = 0; v.nerv = 0; };
    const done = sc => {   /* jump every animation to its end state (used after a click skips ahead) */
      const v = sc.v, t = sc.t; risen(sc);
      if (v.slurpT == null || t - v.slurpT < full(v)) { v.slurpT = t - full(v); v.eatN = n; }
    };
    if (short) return [
      { shot: "tower", cam: "tower", cue: "compost", sfx: "compost",
        at: sc => { init(sc); const v = sc.v, t = sc.t; v.rumble = 3; v.wormT = t + 0.25; v.slurpT = t + 0.8; v.moundT = t + 0.8 + full(v); v.sinkT = v.moundT + 0.15; },
        tick: sc => { if (sc.st > 0.45) sc.v.rumble = 0; if (sc.st > 0.8 + full(sc.v) && !sc.v.gs) { sc.v.gs = 1; CINE.sfx("grow"); } }, wait: 1.1 + full({ gap: 0.13, fl: 0.28 }) },
      { shot: "csum", at: sc => { done(sc); const v = sc.v, t = sc.t; if (v.moundT > t - 0.3) v.moundT = t - 0.3; if (v.sinkT > t) v.sinkT = t; }, wait: 1.6 },
    ];
    return [
      { shot: "tower", cam: "plants", rate: 0.8, at: init, say: ["narr", "Gerald's plants had a funny feeling."] },
      { set: { nerv: 1 }, say: ["plant", "Does anyone else feel... rumbly?"] },
      { cam: "tower", set: { rumble: 3 }, sfx: "compost", say: ["narr", "The ground rumbled. Politely, but firmly."] },
      { cam: "worm", set: { rumble: 0, nerv: 0 }, mark: "wormT", cue: "compost", shake: 12, wait: 2.0 },
      { at: risen, say: ["worm", "Good afternoon. Wormsley. I do the composting."] },
      { mark: "shockT", say: ["worm", "I'm going to eat your plants."] },
      { say: ["plant", "Will it hurt?"] },
      { say: ["worm", "No. It will be nutritious."] },
      { cam: "tower", say: ["gerald", "Will it make ME taller?"] },
      { say: ["worm", "Considerably."] },
      { say: ["gerald", "...Carry on."] },
      { mark: "slurpT", say: ["narr", "(Polite chewing.)"], auto: n * 0.5 + 0.9 },
      { at: done, say: ["worm", "Mm. Notes of regret. A hint of cardamom."] },
      { mark: "burpT", sfx: "pop", say: ["worm", "Pardon me. Do call again when your garden grows back. Cheerio."] },
      { cam: "top", rate: 1.5, mark: "moundT", at: sc => { done(sc); sc.v.sinkT = sc.t + 0.4; }, sfx: "grow", shake: 6, wait: 2.5 },
      { at: sc => { const v = sc.v; if (sc.t - v.moundT < 2.1) v.moundT = sc.t - 2.1; if (sc.t - v.sinkT < 1.3) v.sinkT = sc.t - 1.3; }, cam: "head", rate: 3, mood: "shock", say: ["gerald", "...I'm higher."] },
      { cam: "top", rate: 4, mood: "happy", mark: "hopT", shake: 6, say: ["gerald", "I'm HIGHER."] },
      { shot: "csum", lock: 0.8 },
    ];
  },
  _finale(z) {
    return [
      { shot: "ztitle", sfx: "zone", wait: 3.4 },
      { shot: "zwall", mood: "grump", say: ["narr", U.ft(z.at) + ". The Fourth Wall. There is nothing up here except a very clean wall."] },
      { say: ["narr", "And, on the other side of it..."] },
      { cam: "close", rate: 0.7, mood: "shock", set: { noticed: 1 }, shake: 4, say: ["gerald", "...Oh."] },
      { mood: "grump", say: ["gerald", "Hello. You've been there the whole time, haven't you."] },
      { say: ["gerald", "Clicking things. Watching me spit. I KNEW something was watching. I thought it was the Moon."] },
      { say: ["gerald", "Are you the manager?"], choice: ["Yes.", "Sure, why not.", "I'm just a person."], key: "mgr" },
      { say: sc => ["gerald", ["Finally. A straight answer. Everyone else just said 'up'.", "That is the most managerial thing anyone has ever said to me.",
        "A person. At the very top. Suspicious. You'll do."][sc.v.mgr || 0]] },
      { say: ["gerald", "I would like to file a complaint."] },
      { mark: "paperT", sfx: "pop", say: ["narr", "Gerald holds up the complaint. It has been forwarded, washed, shrunk, and stamped ALMOST."] },
      { cam: "closer", say: ["gerald", "COMPLAINT NUMBER ONE. The Moon looked at me funny. Severity: EXTREME."] },
      { say: ["gerald", "Do you approve it?"], choice: ["APPROVED.", "...approved?"], key: "ok" },
      { mark: "stampT", wait: 1.9 },
      { at: sc => { if (!sc.v.stampHit) { sc.v.stampT = sc.t - 1.5; } }, cam: "close", mood: "shock",
        say: sc => ["gerald", sc.v.ok === 1 ? "You don't sound sure. Doesn't matter. It's stamped. It counts." : "It's... approved."] },
      { mood: "grump", say: ["gerald", "..."] },
      { say: ["gerald", "Huh."] },
      { say: ["gerald", "I thought I'd feel different. Taller. Vindicated. Moon-proof."] },
      { mood: "sad", say: ["gerald", "I don't. I feel exactly the same as on the way up."] },
      { cam: "wide", rate: 0.6, mood: "happy", say: ["gerald", "...I think I just like going up."] },
      { say: ["gerald", "Is that allowed? Don't answer that. I'm doing it anyway."] },
      { cue: "finale", say: ["narr", "And so Gerald kept growing. Not for the complaint. Not for the Moon. Just because up was there."] },
      { shot: "zend", xf: 0.9, lock: 2.5, hint: "click to keep going up" },
    ];
  },

  /* ---------- small helpers ---------- */
  _DEFP: [
    { i: 0, name: "A Plant", type: "daisy", c1: "#ffd23f", c2: "#ff7eb6", hue: 50, eyes: 2, eyeStyle: "round", mouth: "smile", acc: "none", pt: 7, seed: 11 },
    { i: 1, name: "Another Plant", type: "shroom", c1: "#ff7a7a", c2: "#fff3dc", hue: 0, eyes: 1, eyeStyle: "wide", mouth: "o", acc: "bow", pt: 5, seed: 23 },
    { i: 2, name: "A Third Plant", type: "cactus", c1: "#7be07b", c2: "#ff9ad5", hue: 120, eyes: 3, eyeStyle: "sleepy", mouth: "flat", acc: "tophat", pt: 6, seed: 37 },
  ],
  _plants(list) {
    const a = (Array.isArray(list) ? list : []).filter(x => x && typeof x === "object").slice(0, 8);
    return a.length ? a : CINE._DEFP;
  },
  _fmtMulch(x, q) {
    if (typeof x === "number" && isFinite(x)) return U.num(q >= 1 ? x : Math.round(x * q));
    return x == null ? "some" : String(x);
  },
  /* params.ft = feet gained (number or preformatted string); params.slots also accepted */
  _fmtFt(p, q) {
    if (typeof p.ft === "number" && isFinite(p.ft)) return U.ft(p.ft * q / ECON.FT);     // feet -> slots, shown in the player's units
    if (typeof p.ft === "string") return /ft/.test(p.ft) ? p.ft : p.ft + " ft";
    if (typeof p.slots === "number") return U.ft(p.slots * q);
    return "a bit";
  },
  _hat() { const g = CINE._G(); return (g && g.S && typeof g.S.hat === "string" && g.S.hat) || "none"; },
};
