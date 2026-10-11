/* Gerald Wants Up — the world: zone skies, parallax decor for every zone (15 story sets +
   12 procedural sets), the compost mountain, landmarks (signposts, the Moon, Saturn, the Sun)
   and the paper overlay. Everything is seeded (no flicker) and cached (no per-frame canvases
   or gradients). Decor is fogged toward the sky colour so plants + bubbles stay readable. */
const WORLD = (function () {
  const GAP = ECON.GAP, BL = 6, TAU = Math.PI * 2, PI = Math.PI;
  const hr = (a, b) => (INK._h(a, b) + 1) * 0.5;                 // static hash -> [0,1]
  const gS = () => (typeof G !== "undefined" && G && G.S) || null;
  const low = () => { const S = gS(); return !!(S && S.settings && (S.settings.lowfx || S.settings.perf)); };
  let VW = 800, VH = 600;                                         // viewport for look-at maths
  const LK = { x: 0, y: 0 };                                      // reused look vector
  const C = { sky: new Map(), pal: new Map(), fog: new Map(), str: new Map(), img: {}, pat: {}, grad: {} };
  const trim = m => { if (m.size > 500) m.clear(); };
  function canvas(w, h) {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas"); c.width = w; c.height = h; return c;
  }
  /* ---------- tiny drawing helpers (current strokeStyle / lineWidth) ---------- */
  function fs(c, f) { if (f) { c.fillStyle = f; c.fill(); } c.stroke(); }
  function ov(c, x, y, rx, ry, f, st) {
    c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
    if (f) { c.fillStyle = f; c.fill(); } if (st) c.stroke();
  }
  function bl(c, x, y, rx, ry, f, sd, amt) { INK.blob(c, x, y, rx, ry, f, true, sd, amt === undefined ? 0.06 : amt); }
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
  }
  function ln(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  function tx(c, s, x, y, px, col, font, al, wt) {
    c.font = (wt || "") + Math.max(6, Math.round(px)) + "px " + (font || INK.FONT);
    c.textAlign = al || "center"; c.textBaseline = "middle"; c.fillStyle = col; c.fillText(s, x, y);
  }
  /* things slowly turn to watch the stalk (and sometimes look away, then slowly turn back) */
  function look(x, y, sd, t) {
    let dx = VW / 2 - x, dy = VH * 0.42 - y; const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
    const a = U.smooth(U.clamp(0.6 + Math.sin(t * 0.12 + sd * 1.3) * 0.9, 0, 1));
    const rx = Math.cos(sd * 2.1), ry = Math.sin(sd * 2.1) * 0.6;
    LK.x = rx + (dx - rx) * a; LK.y = ry + (dy - ry) * a; return LK;
  }
  function blink(sd, t) {
    const p = 3 + 5 * hr(sd, 77), ph = (t + sd * 0.61) % p;
    return ph < 0.2 ? Math.sin((ph / 0.2) * PI) : 0;
  }
  /* small decor eye: P = fogged palette, lid = sleepy lid colour or null */
  function eye(c, x, y, r, P, sd, t, lid) {
    const b = blink(sd, t);
    if (b > 0.5) { c.beginPath(); c.arc(x, y - r * 0.5, r, 0.2 * PI, 0.8 * PI); c.stroke(); return; }
    ov(c, x, y, r, r, P.w, true);
    const lk = look(x, y, sd, t), k = r * 0.45;
    ov(c, x + lk.x * k, y + lk.y * k, r * 0.5, r * 0.5, P.k, false);
    if (lid) { c.beginPath(); c.ellipse(x, y, r, r, 0, PI, TAU); c.closePath(); fs(c, lid); }
  }
  /* face: s = face width. mood 0 smile, 1 flat, 2 'o', 3 asleep, 4 wobbly, 5 smug (lids) */
  function face(c, x, y, s, P, sd, t, mood, lid) {
    const er = s * 0.17, ex = s * 0.3;
    if (mood === 3) {
      c.beginPath(); c.arc(x - ex, y - er * 0.4, er, 0.2 * PI, 0.8 * PI); c.stroke();
      c.beginPath(); c.arc(x + ex, y - er * 0.4, er, 0.2 * PI, 0.8 * PI); c.stroke();
    } else {
      const l = mood === 5 ? (lid || P.w) : null;
      eye(c, x - ex, y, er, P, sd, t, l); eye(c, x + ex, y, er, P, sd + 1, t, l);
    }
    const my = y + s * 0.32;
    c.beginPath();
    if (mood === 0) c.arc(x, my - s * 0.08, s * 0.14, 0.2 * PI, 0.8 * PI);
    else if (mood === 2 || mood === 3) { c.ellipse(x, my, s * 0.06, s * 0.08, 0, 0, TAU); }
    else if (mood === 4) { c.moveTo(x - s * 0.15, my); c.quadraticCurveTo(x - s * 0.07, my - s * 0.07, x, my); c.quadraticCurveTo(x + s * 0.07, my + s * 0.07, x + s * 0.15, my); }
    else if (mood === 5) { c.moveTo(x - s * 0.12, my); c.quadraticCurveTo(x + s * 0.05, my + s * 0.06, x + s * 0.16, my - s * 0.05); }
    else { c.moveTo(x - s * 0.12, my); c.lineTo(x + s * 0.12, my); }
    c.stroke();
  }
  /* 4-point twinkle star */
  function spark(c, x, y, r, col) {
    c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fillStyle = col; c.fill();
  }
  /* ---------- layers + palettes ---------- */
  // f parallax factor, n items per period, s scale, fog amount, cb centre-avoid multiplier
  const LAY = [
    { f: 0.1, n: 7, s: 0.66, fog: 0.6, cb: 0.45 },
    { f: 0.24, n: 6, s: 0.95, fog: 0.42, cb: 1 },
    { f: 0.42, n: 4, s: 1.22, fog: 0.3, cb: 1.25 },
  ];
  function fogOf(z) {
    let f = C.fog.get(z.k);
    if (!f) { trim(C.fog); f = INK.mix(z.sky[0], z.sky[1], 0.6); C.fog.set(z.k, f); }
    return f;
  }
  function PAL(name, z, l) {
    const key = name + "|" + z.k + "|" + l;
    let P = C.pal.get(key);
    if (P) return P;
    trim(C.pal);
    const fog = fogOf(z), a = LAY[l].fog * (D[name].fog || 1);
    P = D[name].pal(z).map(col => INK.mix(col, fog, a));
    P.i = INK.mix(INK.C.ink, fog, Math.min(0.85, a * 1.08));
    P.w = INK.mix("#ffffff", fog, a * 0.75);
    P.k = INK.mix(INK.C.ink, fog, a * 0.7);
    P.fog = fog;
    C.pal.set(key, P);
    return P;
  }
  function seedOf(name, z) {
    let h = 7;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
    return h + (z.proc ? (z.k * 977) & 0xffff : 0);
  }
  const D = {};   // decor sets, filled in below
  /* ---------- sky ---------- */
  function skyGrad(c, z) {           // unit-height gradient, drawn under scale(1,H): one per zone, any H
    let g = C.sky.get(z.k);
    if (!g) {
      if (C.sky.size > 60) C.sky.clear();
      g = c.createLinearGradient(0, 0, 0, 1);
      g.addColorStop(0, z.sky[0]); g.addColorStop(0.55, INK.mix(z.sky[0], z.sky[1], 0.62)); g.addColorStop(1, z.sky[1]);
      C.sky.set(z.k, g);
    }
    return g;
  }
  function fillSky(c, z, W, H) { c.save(); c.scale(1, H); c.fillStyle = skyGrad(c, z); c.fillRect(0, 0, W, 1); c.restore(); }
  function starTile() {
    if (C.img.stars !== undefined) return C.img.stars;
    const cv = canvas(512, 512); if (!cv) return (C.img.stars = null);
    const g = cv.getContext("2d"), r = U.rng(4242);
    for (let i = 0; i < 120; i++) {
      const x = r() * 512, y = r() * 512, s = r() < 0.86 ? 0.5 + r() * 1.0 : 1.5 + r() * 1.1;
      g.fillStyle = "rgba(255,246,222," + (0.3 + r() * 0.7).toFixed(2) + ")";
      g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    }
    return (C.img.stars = cv);
  }
  function stars(c, W, H, alt, t, a) {
    if (a < 0.02) return;
    const tile = starTile();
    c.save();
    if (tile) {
      if (!C.pat.stars) C.pat.stars = c.createPattern(tile, "repeat");
      c.fillStyle = C.pat.stars;
      for (let l = 0; l < 2; l++) {
        const sc = l ? 1 : 0.62, oy = (alt * GAP * (l ? 0.05 : 0.02)) % (512 * sc), ox = l ? 173 : 0;
        c.globalAlpha = a * (l ? 1 : 0.7);
        c.save(); c.translate(ox, oy); c.scale(sc, sc);
        c.fillRect(-ox / sc - 2, -oy / sc - 2, W / sc + 4, H / sc + 4); c.restore();
      }
    }
    // twinkly big stars
    const per = H + 80;
    for (let i = 0; i < 14; i++) {
      const x = hr(i, 1) * W, y = ((hr(i, 2) * per + alt * GAP * 0.04) % per) - 40;
      const tw = 0.5 + 0.5 * Math.sin(t * (1.2 + hr(i, 3) * 2) + i * 1.7);
      c.globalAlpha = a * (0.4 + 0.6 * tw);
      spark(c, x, y, 2.5 + tw * 4 * (0.5 + hr(i, 4)), "#fff6de");
    }
    // some of the stars are eyes. they blink. they are watching Gerald.
    if (a > 0.45) {
      c.globalAlpha = (a - 0.45) * 1.6; c.strokeStyle = "rgba(255,246,222,0.9)"; c.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const x = (0.08 + hr(i, 31) * 0.84) * W, y = ((hr(i, 32) * per + alt * GAP * 0.05) % per) - 40;
        if (Math.abs(x - W / 2) < 150) continue;
        const b = blink(i * 11 + 3, t * 0.7), lk = look(x, y, i * 5, t);
        for (let e = -1; e <= 1; e += 2) {
          const ex = x + e * 6;
          if (b > 0.5) { ln(c, ex - 3, y, ex + 3, y); continue; }
          ov(c, ex, y, 3.4, 3.4, "#fff6de", false);
          ov(c, ex + lk.x * 1.6, y + lk.y * 1.6, 1.6, 1.6, "#1d0f2b", false);
        }
      }
    }
    c.restore();
  }
  /* the Moon, far away, watching Gerald the whole way up (zones 0-5) */
  function moonFallback(c, r, t, lk, mood) {
    c.strokeStyle = INK.C.ink; c.lineWidth = Math.max(2, r * 0.05);
    bl(c, 0, 0, r, r, "#f4ecd0", 51, 0.025);
    ov(c, -r * 0.42, -r * 0.35, r * 0.17, r * 0.13, "#ddd2b0", false);
    ov(c, r * 0.45, r * 0.42, r * 0.22, r * 0.16, "#ddd2b0", false);
    ov(c, r * 0.5, -r * 0.5, r * 0.1, r * 0.08, "#ddd2b0", false);
    const er = r * 0.16;
    for (let e = -1; e <= 1; e += 2) {
      const ex = e * r * 0.33, ey = -r * 0.05;
      ov(c, ex, ey, er, er, "#fff", true);
      ov(c, ex + lk.x * er * 0.45, ey + lk.y * er * 0.45, er * 0.5, er * 0.5, INK.C.ink, false);
      if (mood !== "nervous") { c.beginPath(); c.ellipse(ex, ey, er, er, 0, PI, TAU); c.closePath(); fs(c, "#e6dcb8"); }
    }
    c.beginPath();
    if (mood === "nervous") { c.moveTo(-r * 0.2, r * 0.38); c.lineTo(-r * 0.07, r * 0.33); c.lineTo(r * 0.07, r * 0.4); c.lineTo(r * 0.2, r * 0.34); }
    else { c.moveTo(-r * 0.2, r * 0.35); c.quadraticCurveTo(r * 0.05, r * 0.45, r * 0.24, r * 0.28); }
    c.stroke();
  }
  function moonAt(c, x, y, r, t, mood, lk) {
    c.save(); c.translate(x, y);
    if (typeof DRAW !== "undefined" && DRAW.moonFace) DRAW.moonFace(c, r, { t, mood, look: lk });
    else moonFallback(c, r, t, lk, mood);
    c.restore();
  }
  function skyMoon(c, W, H, alt, t, night) {
    const mz = ECON.zoneAt(6) - 1, f = U.clamp((mz - alt) / 6, 0, 1); if (f <= 0) return;
    const S = gS(), gone = S && S.flags && S.flags.moonGone;
    const r = 13 + 40 * Math.min(1, alt / mz), x = W * 0.82, y = H * 0.16 + r * 0.3;
    c.save(); c.globalAlpha = f * (0.7 + 0.3 * night);
    if (gone) {
      c.strokeStyle = "rgba(29,15,43,0.45)"; c.lineWidth = 2; c.setLineDash([5, 6]);
      ov(c, x, y, r, r, null, true); c.setLineDash([]);
      tx(c, "brb", x, y, Math.max(11, r * 0.5), "rgba(29,15,43,0.5)", INK.HAND);
    } else {
      const lk = look(x, y, 99, t * 0.3);
      moonAt(c, x, y, r, t, "smug", { x: lk.x, y: lk.y });
    }
    c.restore();
  }
  /* ---------- parallax scatter: seeded, wrapping, stratified so nothing clumps ---------- */
  function scatter(c, name, set, z, l, W, H, alt, t, sb) {
    const L = LAY[l], P = PAL(name, z, l), kinds = set.k[l];
    const m = 170, per = Math.max(1150, H + 2 * m), n = (set.n && set.n[l]) || L.n;
    const scroll = alt * GAP * L.f, half = W / 2;
    const cb = W > 620 ? Math.min(205, W * 0.17) * L.cb : 0, lo = Math.min(cb, half - 50);
    for (let i = 0; i < n; i++) {
      const base = ((i + 0.15 + 0.7 * hr(sb + l * 31, i)) * per) / n;
      const yy = base + scroll, cyc = Math.floor(yy / per), y = yy - cyc * per - m;
      if (y < -m || y > H + m) continue;
      const sd = (sb * 13 + l * 7717 + i * 131 + cyc * 7919) & 0x3fffffff;
      const side = (i + l + cyc) % 2 ? 1 : -1;
      let x = half + side * (lo + hr(sd, 3) * Math.max(10, half - lo - 34));
      x += Math.sin(t * 0.09 + sd) * 12;
      const kind = kinds[Math.floor(hr(sd, 5) * kinds.length) % kinds.length];
      const s = L.s * (0.84 + 0.32 * hr(sd, 7));
      c.lineWidth = Math.max(1, 2.5 * s); c.strokeStyle = P.i;
      set.item(c, kind, x, y, s, sd, t, P, l, W, H);
    }
  }
  function decor(c, z, W, H, alt, t, a) {
    if (a < 0.01) return;
    const name = D[z.decor] ? z.decor : "clouds", set = D[name], sb = seedOf(name, z);
    c.globalAlpha = a;
    if (set.bg) { c.save(); set.bg(c, z, W, H, alt, t, a, name); c.restore(); c.globalAlpha = a; }
    for (let l = low() ? 1 : 0; l < 3; l++) scatter(c, name, set, z, l, W, H, alt, t, sb);
    c.globalAlpha = 1;
  }
  function sky(c, W, H, alt, t) {
    VW = W; VH = H; alt = Math.max(0, alt || 0);
    const k = ECON.zoneOf(alt), nx = ECON.zoneAt(k + 1);
    const b = U.smooth(U.clamp((alt - (nx - BL)) / BL, 0, 1));
    const z = ZONES.get(k), z2 = b > 0 ? ZONES.get(k + 1) : null;
    c.save();
    c.lineCap = "round"; c.lineJoin = "round";
    fillSky(c, z, W, H);
    if (z2) { c.globalAlpha = b; fillSky(c, z2, W, H); c.globalAlpha = 1; }
    const st = U.lerp(z.stars || 0, z2 ? z2.stars || 0 : z.stars || 0, b);
    stars(c, W, H, alt, t, st);
    if (alt < ECON.zoneAt(6)) skyMoon(c, W, H, alt, t, U.clamp(st * 1.5, 0, 1));
    decor(c, z, W, H, alt, t, 1 - b);
    if (z2) decor(c, z2, W, H, alt, t, b);
    c.restore();
  }
  /* ---------- overlay: boiling paper grain + soft vignette ---------- */
  function grainTile() {
    if (C.img.grain !== undefined) return C.img.grain;
    const cv = canvas(256, 256); if (!cv) return (C.img.grain = null);
    const g = cv.getContext("2d"), r = U.rng(777);
    for (let i = 0; i < 2600; i++) {
      const d = r() < 0.55, s = r() < 0.9 ? 1 : 2;
      g.fillStyle = d ? "rgba(60,30,50," + (0.03 + r() * 0.07).toFixed(3) + ")" : "rgba(255,250,235," + (0.03 + r() * 0.08).toFixed(3) + ")";
      g.fillRect(Math.floor(r() * 256), Math.floor(r() * 256), s, s);
    }
    g.lineWidth = 0.6;
    for (let i = 0; i < 26; i++) {             // paper fibres
      const x = r() * 256, y = r() * 256, a = r() * TAU, l = 6 + r() * 14;
      g.strokeStyle = "rgba(80,50,60," + (0.03 + r() * 0.04).toFixed(3) + ")";
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    return (C.img.grain = cv);
  }
  function overlay(c, W, H, t) {
    c.save();
    const tile = low() ? null : grainTile();
    if (tile) {
      if (!C.pat.grain) C.pat.grain = c.createPattern(tile, "repeat");
      const b = INK.boil % 4, ox = (b * 67) % 256, oy = (b * 131) % 256;
      c.translate(-ox, -oy); c.fillStyle = C.pat.grain; c.fillRect(ox, oy, W, H); c.translate(ox, oy);
    }
    if (!C.grad.vig) {
      const g = c.createRadialGradient(0, 0, 0.5, 0, 0, 1.45);
      g.addColorStop(0, "rgba(29,15,43,0)"); g.addColorStop(0.55, "rgba(29,15,43,0.08)"); g.addColorStop(1, "rgba(29,15,43,0.34)");
      C.grad.vig = g;
    }
    c.translate(W / 2, H / 2); c.scale(W / 2, H / 2);
    c.fillStyle = C.grad.vig; c.fillRect(-1, -1, 2, 2);
    c.restore();
  }
  /* ---------- the ground: the original garden + Mt. Compost ---------- */
  const PK = { w: "#ffffff", k: "#1d0f2b", i: "#1d0f2b" };      // full-strength palette for foreground eyes
  const mhw = d => 46 + 13.5 * Math.sqrt(Math.max(0, d));       // mountain half-width at depth d below summit
  const mwob = (d, s) => 7 * Math.sin(d * 0.011 + s * 2.3) + 3 * Math.sin(d * 0.037 + s);
  const wave = (u, w) => 5 * Math.sin(u * 0.028 + w * 0.01) + 3 * Math.sin(u * 0.071 + w * 0.003);
  function cottage(c, x, y, t) {
    c.strokeStyle = INK.C.ink; c.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {                 // chimney smoke, drifting toward the stalk. suspicious.
      const p = (t * 0.22 + i / 3) % 1;
      c.globalAlpha = 0.75 * (1 - p); c.lineWidth = 1.5;
      bl(c, x + 20 + p * 22 + Math.sin(t + i) * 3, y - 84 - p * 46, 4 + p * 8, 3 + p * 6, "#f2f0f7", 300 + i, 0.08);
    }
    c.globalAlpha = 1; c.lineWidth = 2.5;
    rr(c, x + 13, y - 80, 12, 26, 2); fs(c, "#b5654a");
    rr(c, x - 34, y - 50, 68, 50, 3); fs(c, "#ffe2b8");
    INK.wpoly(c, [[x - 43, y - 47], [x, y - 82], [x + 43, y - 47]], "#e0645a", true, 61, 0.8);
    rr(c, x - 8, y - 27, 16, 27, 5); fs(c, "#8a5a3a");
    ov(c, x + 4, y - 13, 1.5, 1.5, INK.C.ink, false);
    for (let e = -1; e <= 1; e += 2) {
      const wx = x + e * 22, wy = y - 33;
      rr(c, wx - 8, wy - 8, 16, 16, 2); fs(c, "#fff3b0");
      eye(c, wx, wy, 5, PK, 400 + e, t, null);
    }
    INK.wline(c, [[x - 60, y - 2], [x - 60, y - 18]], 71, 0.5); INK.wline(c, [[x - 48, y - 2], [x - 48, y - 18]], 72, 0.5);
    INK.wline(c, [[x - 64, y - 13], [x - 40, y - 13]], 73, 0.5);
  }
  function gnome(c, x, y, cx, t) {     // Gnome Dave. He is staring at the stalk. He has always been staring.
    c.strokeStyle = INK.C.ink; c.lineWidth = 2.2;
    const lean = Math.sin(t * 0.3) * 0.03;
    c.save(); c.translate(x, y); c.rotate(lean);
    bl(c, 0, -13, 11, 13, "#5a7fd6", 71, 0.05);
    INK.wpoly(c, [[-10, -24], [10, -24], [0, -6]], "#ffffff", true, 72, 0.6);
    ov(c, 0, -29, 9, 7, "#ffc9a8", true);
    const d = cx > x ? 1 : -1;
    for (let e = -1; e <= 1; e += 2) {
      ov(c, e * 3.6, -30, 2.6, 2.6, "#fff", true);
      ov(c, e * 3.6 + d * 1.1, -30.8, 1.3, 1.3, INK.C.ink, false);
    }
    ov(c, 0, -26.5, 2.4, 2, "#ff9a8a", true);
    INK.wpoly(c, [[-10, -33], [10, -33], [d * 4, -60]], "#ff5a5a", true, 73, 0.8);
    c.restore();
  }
  function gardenGround(c, W, H, cx, y0, t, hwB) {
    c.fillStyle = "#7a4c2c"; c.fillRect(0, y0, W, Math.max(0, H - y0) + 4);
    for (let i = -24; i <= 24; i++) {
      const x = cx + i * 53 + hr(i, 1) * 30; if (x < -10 || x > W + 10) continue;
      ov(c, x, y0 + 34 + hr(i, 2) * 70, 3 + hr(i, 3) * 4, 2.5, "#8f5f3a", false);
    }
    c.beginPath(); c.moveTo(-30, y0 + 16);
    for (let x = -30; x <= W + 30; x += 24) { const u = x - cx; c.lineTo(x, y0 - 4 + Math.sin(u * 0.05) * 3 + Math.sin(u * 0.13) * 2); }
    c.lineTo(W + 30, y0 + 16); c.closePath(); c.fillStyle = "#6cc35a"; c.fill();
    c.strokeStyle = INK.C.ink; c.lineWidth = 3; c.beginPath();
    for (let x = -30; x <= W + 30; x += 24) { const u = x - cx; c.lineTo(x, y0 - 4 + Math.sin(u * 0.05) * 3 + Math.sin(u * 0.13) * 2); }
    c.stroke();
    c.strokeStyle = "#3f8f3f"; c.lineWidth = 2;
    for (let i = -30; i <= 30; i++) {
      const x = cx + i * 31 + hr(i, 8) * 12; if (x < -5 || x > W + 5) continue;
      const sw = Math.sin(t * 1.4 + i) * 1.5;
      c.beginPath(); c.moveTo(x - 3, y0 + 2); c.lineTo(x - 4 + sw, y0 - 9); c.moveTo(x + 2, y0 + 2); c.lineTo(x + 4 + sw, y0 - 7); c.stroke();
    }
    const hx = cx - hwB - 150, gx = cx + hwB + 62;   // house + gnome stand just beyond the mountain's foot
    if (hx > -90) cottage(c, hx, y0 + 2, t);
    if (gx < W + 30) gnome(c, gx, y0 + 2, cx, t);
  }
  function stratCol(i, s) {
    const key = i + "|" + (s.hue | 0);
    let col = C.str.get(key);
    if (!col) {
      trim(C.str);
      const f = INK.mix(INK.hsl(s.hue || 30, 40, 34 + (i % 3) * 6), "#6b4226", 0.72);
      col = { f, d: INK.shade(f, -0.28), l: INK.shade(f, 0.2), k: INK.shade(f, -0.5) };
      C.str.set(key, col);
    }
    return col;
  }
  function tombLayout(c, i, s) {
    const key = "t" + i + "|" + s.name + "|" + s.n;
    let L = C.str.get(key);
    if (L) return L;
    const nm = String(s.name || "a plant"); let l1 = nm, l2 = "";
    if (nm.length > 16) {
      let cut = nm.lastIndexOf(" ", Math.ceil(nm.length / 2) + 3);
      if (cut < 4) cut = nm.indexOf(" ");
      if (cut > 0) { l1 = nm.slice(0, cut); l2 = nm.slice(cut + 1); }
    }
    c.font = "bold 12px " + INK.HAND;
    const w = Math.max(48, Math.min(150, Math.max(c.measureText(l1).width, c.measureText(l2).width) + 18));
    L = { w, l1, l2, fr: (s.n | 0) > 1 ? "+" + ((s.n | 0) - 1) + " friends" : "" };
    C.str.set(key, L);
    return L;
  }
  function tomb(c, x, y, i, s, t) {          // y = base of the stone
    const L = tombLayout(c, i, s), w = L.w, h = 40 + (L.l2 ? 12 : 0) + (L.fr ? 9 : 0);
    c.save(); c.translate(x, y); c.rotate((hr(i, 21) - 0.5) * 0.16);
    c.strokeStyle = INK.C.ink; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2, -h + 14); c.quadraticCurveTo(-w / 2, -h, -w / 2 + 14, -h);
    c.lineTo(w / 2 - 14, -h); c.quadraticCurveTo(w / 2, -h, w / 2, -h + 14); c.lineTo(w / 2, 0); c.closePath();
    fs(c, "#bdb6cc");
    ln(c, -w / 2 + 6, -h + 18, -w / 2 + 6, -6);
    tx(c, "RIP", 0, -h + 12, 13, INK.C.ink, INK.FONT);
    tx(c, L.l1, 0, -h + 25, 12, "#3a2a4a", INK.HAND, "center", "bold ");
    if (L.l2) tx(c, L.l2, 0, -h + 37, 12, "#3a2a4a", INK.HAND, "center", "bold ");
    if (L.fr) tx(c, L.fr, 0, -8, 9, "#5a4a6a", INK.HAND);
    c.lineWidth = 1.5; ln(c, w / 2 + 6, 0, w / 2 + 6, -12);
    bl(c, w / 2 + 6, -14, 4, 4, INK.hsl(s.hue || 300, 80, 72), i * 7 + 1, 0.1);
    c.restore();
  }
  function fossil(c, kind, x, y, r, col, sd) {   // little things buried in the compost
    c.save(); c.translate(x, y); c.rotate(hr(sd, 7) * TAU);
    c.strokeStyle = col.l; c.lineWidth = 1.6;
    if (kind === 0) { c.beginPath(); for (let a = 0; a < 13; a += 0.4) c.lineTo(Math.cos(a) * a * r * 0.08, Math.sin(a) * a * r * 0.08); c.stroke(); }
    else if (kind === 1) { c.beginPath(); c.moveTo(-r, 0); c.quadraticCurveTo(0, -r * 0.7, r, 0); c.quadraticCurveTo(0, r * 0.7, -r, 0); c.stroke(); ln(c, -r * 0.6, 0, r * 0.7, 0); for (let k = -2; k <= 2; k++) ln(c, k * r * 0.25, -r * 0.3, k * r * 0.25, r * 0.3); }
    else { for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; ln(c, 0, 0, Math.cos(a) * r, Math.sin(a) * r); } ov(c, 0, 0, r * 0.3, r * 0.3, null, true); }
    c.restore();
  }
  function beanBone(c, x, y, q) {
    c.save(); c.translate(x, y); c.rotate(hr(q, 3) * TAU); c.strokeStyle = INK.C.ink; c.lineWidth = 1.5;
    bl(c, 0, 0, 10, 6.5, "#efe3c8", q, 0.12);
    ln(c, -4.5, -2.5, -1.5, 0.5); ln(c, -1.5, -2.5, -4.5, 0.5); ln(c, 1.5, -2.5, 4.5, 0.5); ln(c, 4.5, -2.5, 1.5, 0.5);
    c.restore();
  }
  function tunnel(c, x0, ty, len, side, sd, col, t) {
    c.strokeStyle = col.d; c.lineWidth = 11; c.beginPath();
    for (let k = 0; k <= 8; k++) { const u = k / 8; c.lineTo(x0 - side * u * len, ty + Math.sin(u * 7 + sd) * 12); }
    c.stroke(); c.strokeStyle = col.k; c.lineWidth = 6; c.stroke();
    const pk = 0.5 + 0.5 * Math.sin(t * 0.7 + sd), hx = x0 - side * len - side * pk * 7, hy = ty + Math.sin(7 + sd) * 12;
    c.strokeStyle = INK.C.ink; c.lineWidth = 1.5;
    ov(c, hx, hy, 6, 6, "#ff9eb0", true);
    rr(c, hx - 4, hy - 13, 8, 6, 2); fs(c, INK.C.ink); ln(c, hx - 7, hy - 7, hx + 7, hy - 7);
    ov(c, hx - side * 2, hy - 1, 1.6, 1.6, INK.C.ink, false);
  }
  function band(c, i, s, cx, W, H, ya, yb, wa, wb, t, top) {
    const col = stratCol(i, s), st = 32, sl = (ya - yb) / Math.max(1, wb - wa);
    const room = w => mhw(top - w) - 40;           // usable half-width inside the mound at world y w
    c.beginPath();
    for (let x = -st; x <= W + st; x += st) c.lineTo(x, ya + wave(x - cx, wa));
    for (let x = W + st; x >= -st; x -= st) c.lineTo(x, yb + wave(x - cx, wb));
    c.closePath(); c.fillStyle = col.f; c.fill();
    // details on a world-space grid of rows: constant density whatever the band size, only visible rows
    const RH = 46, Y = w => ya - (w - wa) * sl;
    for (let r = Math.floor(wa / RH); r * RH < wb; r++) {
      const wc = (r + 0.5) * RH; if (wc < wa + 8 || wc > wb - 8) continue;
      const y = Y(wc); if (y < -30 || y > H + 30) continue;
      const q = i * 7919 + r * 131;
      if (hr(q, 1) < 0.55) {
        const sx = cx + (hr(q, 2) * 2 - 1) * 420, sw = 60 + hr(q, 3) * 160;
        c.strokeStyle = hr(q, 9) < 0.5 ? col.d : col.l; c.lineWidth = 2; c.beginPath(); c.moveTo(sx - sw / 2, y + 6);
        c.quadraticCurveTo(sx, y + 6 + (hr(q, 4) - 0.5) * 12, sx + sw / 2, y + 6); c.stroke();
      }
      c.strokeStyle = col.d; c.lineWidth = 1.2;
      for (let j = 0; j < 3; j++) {
        const px = cx + (hr(q + j, 5) * 2 - 1) * 470, py = y + (hr(q + j, 6) - 0.5) * RH;
        if (px > -10 && px < W + 10) ov(c, px, py, 2.5 + 4 * hr(q + j, 7), 2 + 2.5 * hr(q + j, 8), col.l, true);
      }
      const bx = cx + (hr(q, 11) * 2 - 1) * 360;
      if (hr(q, 10) < 0.16 + Math.min(0.2, (s.n | 0) / 150) && Math.abs(bx - cx) > 30) beanBone(c, bx, y, q);
      else if (hr(q, 10) > 0.93) fossil(c, q % 3, bx, y, 9 + hr(q, 12) * 6, col, q);
    }
    for (let j = 0; (j + 0.45) * 520 < wb - wa; j++) {          // worm tunnels (with tiny worms in tiny hats)
      const sd = i * 13 + j * 5 + 5, ty = Y(wb - (j + 0.45) * 520 + 140);
      if (ty < -40 || ty > H + 40 || wb - wa < 90) continue;
      const side = (i + j) % 2 ? 1 : -1, wty = wb - (j + 0.45) * 520 + 140, off = Math.min(210 + hr(sd, 1) * 180, room(wty) - 10);
      if (off < 120) continue;
      tunnel(c, cx + side * off, ty, Math.min(80 + hr(sd, 3) * 60, off - 60), side, sd, col, t);
    }
    c.strokeStyle = col.k; c.lineWidth = 2.5; c.beginPath();
    for (let x = -st; x <= W + st; x += st) c.lineTo(x, yb + wave(x - cx, wb));
    c.stroke();
    const tw = Math.max(wa + 4, wb - (wb >= top - 2 ? 120 : 64)), ts = i % 2 ? 1 : -1, tX = cx + ts * Math.max(40, Math.min(95 + hr(i, 9) * 80, room(tw) - 40)), tY = Y(tw) + 8;
    if (tY > -10 && tY < H + 90) tomb(c, tX, tY, i, s, t);
  }
  function mound(c, v, S, W, H, cx, y0, top, t, sl) {
    const wyAt = y => (y0 - y) / sl;
    const dA = Math.max(0, top - wyAt(-40)), dB = Math.min(top, top - wyAt(H + 40));
    if (dA >= dB) return;
    const Y = d => v.toY(top - d), st = 18, base = dB >= top;
    const sidePath = (s, open) => {        // s = -1 left (top->bottom), 1 right (bottom->top)
      if (s < 0) { for (let d = dA; ; d += st) { const q = Math.min(d, dB); const x = cx - mhw(q) - mwob(q, -1); open && q === dA ? c.moveTo(x, Y(q)) : c.lineTo(x, Y(q)); if (q >= dB) break; } }
      else { for (let d = dB; ; d -= st) { const q = Math.max(d, dA); const x = cx + mhw(q) + mwob(q, 1); open && q === dB ? c.moveTo(x, Y(q)) : c.lineTo(x, Y(q)); if (q <= dA) break; } }
    };
    const cap = () => c.quadraticCurveTo(cx, Y(0) - 26, cx - mhw(0) - mwob(0, -1), Y(0));
    // fill: silhouette clip
    c.beginPath(); sidePath(-1, false);
    if (base) { c.lineTo(cx - mhw(top) - 40, y0 + 12); c.lineTo(cx + mhw(top) + 40, y0 + 12); }
    sidePath(1, false); if (dA <= 0) cap(); c.closePath();
    c.save(); c.clip();
    const yT = Math.max(-50, Y(dA) - 40), yB = Math.min(H + 50, Y(dB) + 20);
    c.fillStyle = "#6b4226"; c.fillRect(0, yT, W, yB - yT);
    const st2 = S.strata || [];
    let sum = 0; for (let i = 0; i < st2.length; i++) sum += Math.max(0, st2[i].h || 0);
    const sc = sum > 0 ? Math.min(1, top / (sum * (v.gap || GAP))) : 1;
    let acc = 0;
    for (let i = 0; i < st2.length; i++) {
      const s = st2[i], wa = acc, wb = acc + Math.max(0, s.h || 0) * (v.gap || GAP) * sc; acc = wb;
      const ya = v.toY(wa), yb = v.toY(wb);
      if (ya < -60 || yb > H + 60 || ya - yb < 1) continue;
      band(c, i, s, cx, W, H, ya, yb, wa, wb, t, top);
    }
    if (dA < 60) {                          // grassy summit
      const g = Y(24);
      c.beginPath(); c.moveTo(cx - 420, Y(0) - 60);
      for (let x = cx - 420; x <= cx + 420; x += 20) c.lineTo(x, g + 5 * Math.sin((x - cx) * 0.09) + Math.abs(x - cx) * 0.15);
      c.lineTo(cx + 420, Y(0) - 60); c.closePath(); c.fillStyle = "#6cc35a"; c.fill();
      c.strokeStyle = "#3f8f3f"; c.lineWidth = 2.5; c.stroke();
    }
    c.restore();
    // ink outline (sides + summit only)
    c.strokeStyle = INK.C.ink; c.lineWidth = 3.2;
    c.beginPath(); sidePath(-1, true); c.stroke();
    c.beginPath(); sidePath(1, true); if (dA <= 0) cap(); c.stroke();
    if (dA <= 0) summit(c, cx, Y(0), t);
  }
  function summit(c, cx, y, t) {
    c.strokeStyle = "#3f8f3f"; c.lineWidth = 2;
    for (let j = -3; j <= 3; j++) {
      if (!j) continue;
      const x = cx + j * 15, yy = y - 13 * (1 - (j / 3.6) * (j / 3.6)) + 1, sw = Math.sin(t * 1.6 + j) * 1.5;
      c.beginPath(); c.moveTo(x - 2, yy); c.lineTo(x - 3 + sw, yy - 8); c.moveTo(x + 2, yy); c.lineTo(x + 3 + sw, yy - 6); c.stroke();
    }
    // flag
    const px = cx + 32, py = y - 10, ft = py - 56;
    c.strokeStyle = INK.C.ink; c.lineWidth = 2.5; ln(c, px, py, px, ft);
    const w1 = Math.sin(t * 3) * 3, w2 = Math.sin(t * 3 + 1.2) * 4;
    c.beginPath(); c.moveTo(px, ft); c.quadraticCurveTo(px + 16, ft - 2 + w1, px + 32, ft + 8 + w2);
    c.quadraticCurveTo(px + 16, ft + 12 + w1, px, ft + 19); c.closePath(); fs(c, "#ff7eb6");
    c.lineWidth = 2; ln(c, px + 13, ft + 14, px + 13, ft + 4); ln(c, px + 9, ft + 8, px + 13, ft + 4); ln(c, px + 17, ft + 8, px + 13, ft + 4);
    // a sign, slightly out of date
    const sx = cx - 64, sy = y + 4;
    c.lineWidth = 2.2; ln(c, sx, sy, sx, sy - 22);
    rr(c, sx - 34, sy - 38, 68, 18, 3); fs(c, "#d9a066");
    tx(c, "MT. COMPOST", sx, sy - 29, 11, INK.C.ink, INK.FONT);
  }
  function ground(c, v, t) {
    const S = gS(); if (!S || !v || !v.toY) return;
    const W = v.W, H = v.H, cx = v.cx === undefined ? W / 2 : v.cx, gap = v.gap || GAP;
    VW = W; VH = H;
    const y0 = v.toY(0), sl = y0 - v.toY(1) || 1, top = Math.max(0, S.mtn || 0) * gap, yTop = v.toY(top);
    if (yTop > H + 90) return;
    c.save(); c.lineCap = "round"; c.lineJoin = "round";
    const hwB = top > 0 ? mhw(top) : 30;
    if (y0 < H + 160) gardenGround(c, W, H, cx, y0, t, hwB);
    if (top > 0) mound(c, v, S, W, H, cx, y0, top, t, sl);
    c.restore();
  }
  /* ---------- landmarks (world-fixed, drawn behind the stalk) ---------- */
  function mouseLook(x, y) {
    const m = typeof G !== "undefined" && G && G.mouse;
    if (m && m.in) { const dx = m.x - x, dy = m.y - y, d = Math.max(90, Math.hypot(dx, dy)); return { x: dx / d, y: dy / d }; }
    const lk = look(x, y, 5, 0); return { x: lk.x, y: lk.y };
  }
  function signpost(c, x, y, z, next, t, k) {
    const name = String(z.short || z.name || "???").toUpperCase(), ft = U.ft(z.at);
    c.font = "18px " + INK.FONT;
    const w = Math.max(c.measureText(name).width, 70) + 34;
    y += Math.sin(t * 0.8 + k) * 3;
    c.strokeStyle = INK.C.ink; c.lineWidth = 2.5;
    // the floating clump of dirt that holds the sign up. it is tired.
    const cy = y + 78;
    bl(c, x, cy, 30, 13, "#8a5a3a", 500 + k, 0.08);
    c.beginPath(); c.ellipse(x, cy - 6, 29, 7, 0, PI, TAU); c.fillStyle = "#6cc35a"; c.fill(); c.stroke();
    c.lineWidth = 1.6; c.beginPath(); c.arc(x - 8, cy + 1, 3, 0.15 * PI, 0.85 * PI); c.stroke();
    c.beginPath(); c.arc(x + 8, cy + 1, 3, 0.15 * PI, 0.85 * PI); c.stroke();
    c.lineWidth = 2.5;
    rr(c, x - 5, y + 18, 10, cy - y - 24, 2); fs(c, "#b07a48");
    rr(c, x - w / 2, y - 25, w, 48, 7); fs(c, next ? "#ffd27a" : "#d9a066");
    c.strokeStyle = next ? "#d9a050" : "#b07a48"; c.lineWidth = 1.5; ln(c, x - w / 2 + 8, y - 1, x + w / 2 - 8, y - 1);
    c.strokeStyle = INK.C.ink;
    ov(c, x - w / 2 + 7, y - 18, 2, 2, "#5a4a5a", false); ov(c, x + w / 2 - 7, y - 18, 2, 2, "#5a4a5a", false);
    tx(c, name, x, y - 9, 18, INK.C.ink, INK.FONT);
    tx(c, ft, x, y + 12, 16, "#5a3a2a", INK.HAND, "center", "bold ");
    if (next) {
      const bob = Math.sin(t * 3) * 2;
      c.lineWidth = 2; rr(c, x - w / 2 - 6, y - 44 + bob, 62, 22, 5); fs(c, "#ff5a5a");
      tx(c, "NEXT!", x - w / 2 + 25, y - 33 + bob, 15, INK.C.cream, INK.FONT);
    }
  }
  function bigMoon(c, v, t, gone) {
    const gap = v.gap || GAP, y = v.toY((ECON.zoneAt(6) + 2.4) * gap), r = Math.min(150, v.W * 0.2);
    const x = v.cx + Math.min(250, v.W * 0.3);
    if (y < -r - 130 || y > v.H + r + 130) return;
    if (!gone) {
      const alt = (v.toY(0) - v.H / 2) / ((v.toY(0) - v.toY(1)) || 1) / gap;
      moonAt(c, x, y, r, t, alt > ECON.zoneAt(6) - 6 ? "nervous" : "smug", mouseLook(x, y));
      return;
    }
    // the Moon has left. there is a Moon-shaped hole in the sky.
    c.strokeStyle = INK.C.ink; c.lineWidth = 3;
    bl(c, x, y, r, r, "rgba(4,2,12,0.88)", 77, 0.035);
    c.save(); c.setLineDash([10, 9]); c.lineDashOffset = -t * 6; c.strokeStyle = "rgba(255,246,222,0.55)"; c.lineWidth = 2.5;
    ov(c, x, y, r * 0.9, r * 0.9, null, true); c.restore();
    for (let i = 0; i < 6; i++) {                      // crumbs of moon, floating politely
      const a = i * 1.1 + t * 0.05, rr2 = r * (1.12 + 0.12 * hr(i, 4));
      c.lineWidth = 1.5; bl(c, x + Math.cos(a) * rr2, y + Math.sin(a) * rr2, 5 + 4 * hr(i, 5), 4 + 3 * hr(i, 6), "#e8dfc0", 90 + i, 0.15);
    }
    const sw = Math.sin(t * 1.1) * 0.08, ny = y - r * 0.55;
    c.lineWidth = 2; ov(c, x, ny, 3, 3, "#9a9aa8", true);
    c.save(); c.translate(x, ny); c.rotate(sw);
    ln(c, 0, 0, -38, 34); ln(c, 0, 0, 38, 34);
    c.lineWidth = 2.5; rr(c, -62, 32, 124, 40, 5); fs(c, "#fff3dc");
    tx(c, "BACK IN 5 MIN", 0, 46, 16, INK.C.ink, INK.FONT);
    tx(c, "- the Moon", 22, 62, 12, "#5a4a6a", INK.HAND);
    c.restore();
  }
  function laundryBit(c, kind, x, y, s, col) {   // tiny sock or shirt in Saturn's spin cycle
    c.lineWidth = 1.6;
    if (kind) {
      c.beginPath(); c.moveTo(x - 6 * s, y - 6 * s); c.lineTo(x + 6 * s, y - 6 * s); c.lineTo(x + 9 * s, y - 2 * s);
      c.lineTo(x + 5 * s, y); c.lineTo(x + 5 * s, y + 7 * s); c.lineTo(x - 5 * s, y + 7 * s); c.lineTo(x - 5 * s, y);
      c.lineTo(x - 9 * s, y - 2 * s); c.closePath(); fs(c, col);
    } else {
      c.beginPath(); c.moveTo(x - 3 * s, y - 8 * s); c.lineTo(x + 3 * s, y - 8 * s); c.lineTo(x + 3 * s, y + 2 * s);
      c.lineTo(x + 8 * s, y + 3 * s); c.lineTo(x + 8 * s, y + 8 * s); c.lineTo(x - 3 * s, y + 8 * s); c.closePath(); fs(c, col);
    }
  }
  function saturn(c, v, t) {
    const gap = v.gap || GAP, y = v.toY((ECON.zoneAt(8) + 2.6) * gap), r = Math.min(92, v.W * 0.13);
    const x = v.cx - Math.min(290, v.W * 0.33), rx = r * 2.15, ry = r * 0.52;
    if (y < -r * 2 || y > v.H + r * 2) return;
    const cols = ["#ff7eb6", "#6ad1ff", "#ffd23f", "#c58bff", "#7be07b", "#ffffff"];
    c.save(); c.translate(x, y); c.rotate(-0.2);
    const ring = (a0, a1) => {
      c.lineWidth = 20; c.strokeStyle = "rgba(225,205,160,0.9)";
      c.beginPath(); c.ellipse(0, 0, rx, ry, 0, a0, a1); c.stroke();
      c.lineWidth = 2.5; c.strokeStyle = INK.C.ink;
      c.beginPath(); c.ellipse(0, 0, rx + 10, ry + 10, 0, a0, a1); c.stroke();
      c.beginPath(); c.ellipse(0, 0, rx - 10, ry - 10, 0, a0, a1); c.stroke();
    };
    const bits = front => {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + t * 0.35, sn = Math.sin(a);
        if ((sn > 0) !== front) continue;
        c.strokeStyle = INK.C.ink; laundryBit(c, i % 2, Math.cos(a) * rx, sn * ry, 0.9, cols[i % cols.length]);
      }
    };
    ring(PI, TAU); bits(false);
    c.strokeStyle = INK.C.ink; c.lineWidth = 3;
    bl(c, 0, 0, r, r, "#f2c27a", 88, 0.025);
    c.save(); c.beginPath(); c.arc(0, 0, r - 2, 0, TAU); c.clip();
    c.strokeStyle = "#e0a256"; c.lineWidth = r * 0.14;
    for (let b = -1; b <= 1; b++) { c.beginPath(); c.moveTo(-r, b * r * 0.42 + r * 0.1); c.quadraticCurveTo(0, b * r * 0.42 + r * 0.22, r, b * r * 0.42 + r * 0.08); c.stroke(); }
    c.restore();
    c.strokeStyle = INK.C.ink; c.lineWidth = 2.5;
    // towel turban (spa day)
    bl(c, 0, -r * 0.82, r * 0.68, r * 0.34, "#ff9ec7", 89, 0.06);
    bl(c, r * 0.38, -r * 1.02, r * 0.22, r * 0.16, "#ff9ec7", 90, 0.08);
    c.lineWidth = 1.5; ln(c, -r * 0.5, -r * 0.8, r * 0.4, -r * 0.92); ln(c, -r * 0.4, -r * 0.68, r * 0.5, -r * 0.78);
    // one cucumber slice on; the other eye is watching you
    c.lineWidth = 2.5; ov(c, -r * 0.32, -r * 0.08, r * 0.2, r * 0.2, "#9be07b", true);
    ov(c, -r * 0.32, -r * 0.08, r * 0.13, r * 0.13, "#d8f5c0", false);
    const lk = mouseLook(x + r * 0.32, y), er = r * 0.17;
    ov(c, r * 0.32, -r * 0.08, er, er, "#fff", true);
    ov(c, r * 0.32 + lk.x * er * 0.45, -r * 0.08 + lk.y * er * 0.45, er * 0.5, er * 0.5, INK.C.ink, false);
    c.beginPath(); c.moveTo(-r * 0.15, r * 0.35); c.quadraticCurveTo(r * 0.02, r * 0.45, r * 0.2, r * 0.32); c.stroke();
    ring(0, PI); bits(true);
    c.restore();
  }
  function sunMark(c, v, t) {
    const gap = v.gap || GAP, y = v.toY((ECON.zoneAt(9) + 3.2) * gap), r = Math.min(175, v.W * 0.22);
    const x = v.cx + Math.min(370, v.W * 0.4), R = r * 3.4;
    if (y < -R || y > v.H + R) return;
    if (!C.grad.sun) {
      const g = c.createRadialGradient(0, 0, 0.05, 0, 0, 1);
      g.addColorStop(0, "rgba(255,245,190,0.95)"); g.addColorStop(0.3, "rgba(255,205,100,0.5)"); g.addColorStop(1, "rgba(255,150,60,0)");
      C.grad.sun = g;
    }
    c.save(); c.translate(x, y); c.scale(R, R); c.fillStyle = C.grad.sun; c.fillRect(-1, -1, 2, 2); c.restore();
    if (y < -r * 1.5 || y > v.H + r * 1.5) return;
    c.save(); c.translate(x, y);
    c.strokeStyle = INK.C.ink; c.lineWidth = 3;
    const rot = t * 0.05;
    c.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = rot + (i / 18) * TAU, a2 = a + TAU / 36, L = r * (1.28 + 0.06 * Math.sin(t * 2 + i * 1.3));
      c.lineTo(Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02); c.lineTo(Math.cos(a2) * L, Math.sin(a2) * L);
    }
    c.closePath(); fs(c, "#ffb43a");
    bl(c, 0, 0, r, r, "#ffd84a", 120, 0.02);
    // sunglasses
    c.lineWidth = 3;
    rr(c, -r * 0.62, -r * 0.3, r * 0.52, r * 0.32, r * 0.12); fs(c, "#2a1a3a");
    rr(c, r * 0.1, -r * 0.3, r * 0.52, r * 0.32, r * 0.12); fs(c, "#2a1a3a");
    ln(c, -r * 0.1, -r * 0.2, r * 0.1, -r * 0.2);
    c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 3;
    ln(c, -r * 0.5, -r * 0.2, -r * 0.4, -r * 0.08); ln(c, r * 0.22, -r * 0.2, r * 0.32, -r * 0.08);
    c.strokeStyle = INK.C.ink; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-r * 0.22, r * 0.3); c.quadraticCurveTo(r * 0.05, r * 0.42, r * 0.28, r * 0.24); c.stroke();
    ov(c, -r * 0.55, r * 0.2, r * 0.1, r * 0.06, "rgba(255,120,80,0.5)", false);
    // the door to the waiting room, with a ticket machine
    const dx = -r * 0.62, dy = r * 0.62;
    rr(c, dx - 17, dy - 52, 34, 52, 4); fs(c, "#c9703a");
    ov(c, dx + 9, dy - 25, 2.5, 2.5, "#ffd23f", true);
    rr(c, dx - 40, dy - 74, 80, 18, 4); fs(c, "#fff3dc");
    tx(c, "WAITING ROOM", dx, dy - 65, 11, INK.C.ink, INK.FONT);
    rr(c, dx + 24, dy - 34, 18, 26, 3); fs(c, "#ff5a5a");
    const tk = (t * 0.4) % 1;
    rr(c, dx + 28, dy - 30 + tk * 2, 10, 8 + tk * 10, 1); fs(c, "#fff3dc");
    c.restore();
  }
  function landmarks(c, v, t) {
    const S = gS(); if (!S || !v || !v.toY) return;
    VW = v.W; VH = v.H;
    const gap = v.gap || GAP, H = v.H, y0 = v.toY(0), sl = (y0 - v.toY(1)) || 1;
    const altTop = Math.max(0, y0 / sl / gap), altBot = Math.max(0, (y0 - H) / sl / gap);
    c.save(); c.lineCap = "round"; c.lineJoin = "round";
    if (altTop > ECON.zoneAt(9) - 8 && altBot < ECON.zoneAt(9) + 14) sunMark(c, v, t);
    if (altTop > ECON.zoneAt(8) - 3 && altBot < ECON.zoneAt(8) + 6) saturn(c, v, t);
    if (altTop > ECON.zoneAt(6) - 2 && altBot < ECON.zoneAt(6) + 7) bigMoon(c, v, t, !!(S.flags && S.flags.moonGone));
    const kMax = (S.zone | 0) + 1, side = W2 => Math.min(275, W2 / 2 - 88);
    for (let k = Math.max(1, ECON.zoneOf(altBot) - 1); k <= kMax; k++) {
      const at = ECON.zoneAt(k);
      if (at > altTop + 2) break;
      const y = v.toY(at * gap); if (y < -130 || y > H + 130) continue;
      const x = (v.cx === undefined ? v.W / 2 : v.cx) + (k % 2 ? 1 : -1) * side(v.W);
      signpost(c, x, y, ZONES.get(k), k === kMax, t, k);
    }
    c.restore();
  }
  /* =================== DECOR SETS =================== */
  const CB = [[-0.5, 0.12, 0.42], [-0.22, -0.2, 0.55], [0.18, -0.24, 0.5], [0.48, 0.08, 0.42], [0, 0.2, 0.55]];
  function cloud(c, x, y, w, h, fill, sd) {   // stroke all bumps fat, then fill: only the silhouette is inked
    const lw = c.lineWidth; c.lineWidth = lw * 2;
    for (let i = 0; i < 5; i++) { INK.blobPath(c, x + CB[i][0] * w, y + CB[i][1] * h, CB[i][2] * h * 1.25, CB[i][2] * h, sd + i, 0.06); c.stroke(); }
    c.fillStyle = fill;
    for (let i = 0; i < 5; i++) { INK.blobPath(c, x + CB[i][0] * w, y + CB[i][1] * h, CB[i][2] * h * 1.25, CB[i][2] * h, sd + i, 0.06); c.fill(); }
    c.lineWidth = lw;
  }
  function stem(c, x1, y1, x2, y2, bend) {
    c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2 + bend, (y1 + y2) / 2, x2, y2); c.stroke();
  }
  /* ---- garden: hills, a farmhouse with eyes in the windows, a fence, sunflowers that turn ---- */
  function sunflower(c, x, y, h, P, sd, t) {
    const lk = look(x, y - h, sd, t), hx = x + lk.x * 6, hy = y - h + Math.sin(t * 0.8 + sd) * 2;
    c.lineWidth = 2.5; stem(c, x, y, hx, hy, lk.x * 10);
    bl(c, x + 6, y - h * 0.45, 8, 4, P[1], sd + 3, 0.1);
    c.lineWidth = 2;
    const sq = 1 - 0.3 * Math.abs(lk.x);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + sd;
      ov(c, hx + Math.cos(a) * 12 * sq, hy + Math.sin(a) * 12, 6 * sq + 1, 6, P[4], true);
    }
    ov(c, hx + lk.x * 3, hy, 10 * sq, 10, P[6], true);
    eye(c, hx + lk.x * 5 - 3.5 * sq, hy - 1, 2.6, P, sd, t, null);
    eye(c, hx + lk.x * 5 + 3.5 * sq, hy - 1, 2.6, P, sd + 1, t, null);
  }
  D.garden = {
    pal: () => ["#a9dba0", "#7cc56f", "#ffe2b8", "#e0645a", "#ffd23f", "#ffffff", "#8a5a3a"],
    k: [[0, 0, 2], [0, 1, 2, 3], [1, 3, 0]],
    bg(c, z, W, H, alt, t, a, name) {
      const P0 = PAL(name, z, 0), P1 = PAL(name, z, 1), rise = (alt - z.at) * GAP;
      const hy1 = H * 0.56 + rise * 0.16, hy2 = H * 0.68 + rise * 0.3;
      const f1 = x => hy1 - 30 * Math.sin((x / W) * 5 + 0.7) - 14 * Math.sin((x / W) * 13);
      const f2 = x => hy2 - 26 * Math.sin((x / W) * 3.3 + 2) - 8 * Math.sin((x / W) * 9);
      if (hy1 - 60 < H) {
        c.beginPath(); c.moveTo(-10, H + 10);
        for (let x = -10; x <= W + 30; x += 30) c.lineTo(x, f1(x));
        c.lineTo(W + 30, H + 10); c.closePath(); c.fillStyle = P0[0]; c.fill(); c.strokeStyle = P0.i; c.lineWidth = 2; c.stroke();
        for (let i = 0; i < 7; i++) {             // lollipop trees, all leaning toward the stalk
          const x = W * (0.05 + i * 0.15), y = f1(x) + 4, lean = (W / 2 - x) * 0.02;
          ln(c, x, y, x + lean, y - 18); bl(c, x + lean, y - 24, 9, 9, P0[1], 30 + i, 0.08);
        }
      }
      if (hy2 - 120 < H) {
        c.beginPath(); c.moveTo(-10, H + 10);
        for (let x = -10; x <= W + 30; x += 24) c.lineTo(x, f2(x));
        c.lineTo(W + 30, H + 10); c.closePath(); c.fillStyle = P1[1]; c.fill(); c.strokeStyle = P1.i; c.lineWidth = 2.5; c.stroke();
        // the farmhouse. the windows are eyes. the door is a mouth. it is fine. everything is fine.
        const hx = W / 2 - Math.min(W * 0.4, 500), hy = f2(hx) + 6;
        c.lineWidth = 2.5;
        rr(c, hx + 16, hy - 92, 12, 26, 2); fs(c, P1[3]);
        rr(c, hx - 40, hy - 60, 80, 60, 3); fs(c, P1[2]);
        INK.wpoly(c, [[hx - 50, hy - 57], [hx, hy - 98], [hx + 50, hy - 57]], P1[3], true, 41, 0.8);
        for (let e = -1; e <= 1; e += 2) {
          rr(c, hx + e * 22 - 10, hy - 48, 20, 18, 3); fs(c, P1[4]);
          eye(c, hx + e * 22, hy - 39, 6.5, P1, 700 + e, t, null);
        }
        const mo = 3 + 2 * Math.sin(t * 0.7);
        c.beginPath(); c.ellipse(hx, hy - 10, 8, 6 + mo, 0, 0, TAU); fs(c, P1.k);
        // fence + sunflowers on the right
        c.lineWidth = 2;
        for (let x = W * 0.6; x < W * 0.97; x += 16) {
          const y = f2(x) + 4; rr(c, x - 4, y - 24, 8, 26, 2); fs(c, P1[5]);
        }
        c.beginPath(); c.moveTo(W * 0.6 - 6, f2(W * 0.6) - 12);
        for (let x = W * 0.6; x < W * 0.97; x += 16) c.lineTo(x, f2(x) - 12);
        c.stroke();
        for (let i = 0; i < 4; i++) { const x = W * (0.66 + i * 0.085); sunflower(c, x, f2(x) + 4, 50 + 14 * hr(i, 41), P1, 800 + i, t); }
      }
    },
    item(c, kind, x, y, s, sd, t, P) {
      if (kind === 0) { cloud(c, x, y, 90 * s, 34 * s, P[5], sd); return; }
      if (kind === 1) {                       // butterfly. the spots on its wings are eyes.
        const f = 0.35 + 0.65 * Math.abs(Math.sin(t * 7 + sd)), yy = y + Math.sin(t * 2 + sd) * 8;
        for (let e = -1; e <= 1; e += 2) {
          ov(c, x + e * 13 * s * f, yy - 6 * s, 13 * s * f, 11 * s, P[3], true);
          ov(c, x + e * 9 * s * f, yy + 8 * s, 8 * s * f, 7 * s, P[4], true);
          if (f > 0.5) eye(c, x + e * 13 * s * f, yy - 6 * s, 4 * s, P, sd + e, t, null);
        }
        ln(c, x, yy - 12 * s, x, yy + 12 * s); return;
      }
      if (kind === 2) {                       // dandelion fluff
        const r = 10 * s, a = t * 0.4 + sd;
        c.lineWidth = 1.2; ln(c, x, y, x + Math.sin(a) * 4, y + 18 * s);
        for (let i = 0; i < 8; i++) { const b = (i / 8) * TAU + a * 0.2; ln(c, x, y, x + Math.cos(b) * r, y + Math.sin(b) * r); ov(c, x + Math.cos(b) * r, y + Math.sin(b) * r, 1.6, 1.6, P.w, false); }
        return;
      }
      // a lost balloon with a face drawn on in marker
      const yy = y + Math.sin(t * 1.3 + sd) * 6;
      c.lineWidth = 1.5; stem(c, x, yy + 26 * s, x + 4, yy + 70 * s, Math.sin(t * 2 + sd) * 10);
      c.lineWidth = 2.5 * s; bl(c, x, yy, 20 * s, 25 * s, P[3], sd, 0.04);
      face(c, x, yy - 3 * s, 22 * s, P, sd, t, 0);
    },
  };
  /* ---- clouds: sleepy clouds, a cloud house with a chimney, four clouds named Barbara ---- */
  D.clouds = {
    pal: () => ["#ffffff", "#ffe6f2", "#dfe6ff", "#ff9ec7", "#8a7fb0", "#ffd23f"],
    k: [[3, 3, 0], [0, 1, 2], [0, 2, 1]],
    item(c, kind, x, y, s, sd, t, P) {
      const bob = Math.sin(t * 0.6 + sd) * 4;
      y += bob;
      if (kind === 3) { cloud(c, x, y, 150 * s, 40 * s, P[2], sd); return; }
      if (kind === 0) {
        cloud(c, x, y, 120 * s, 48 * s, P[0], sd);
        face(c, x, y + 2 * s, 40 * s, P, sd, t, 3);
        ov(c, x - 22 * s, y + 10 * s, 6 * s, 3.5 * s, P[1], false); ov(c, x + 22 * s, y + 10 * s, 6 * s, 3.5 * s, P[1], false);
        const zp = (t * 0.35 + hr(sd, 2)) % 1;
        const ga = c.globalAlpha; c.globalAlpha = ga * (1 - zp); tx(c, "z", x + 34 * s + zp * 16 * s, y - 24 * s - zp * 30 * s, (12 + zp * 8) * s, P[4], INK.FONT); c.globalAlpha = ga;
        return;
      }
      if (kind === 1) {                      // cloud house
        for (let i = 0; i < 3; i++) {
          const p = (t * 0.25 + i / 3) % 1;
          bl(c, x + 26 * s + p * 14 * s, y - 58 * s - p * 40 * s, (5 + p * 7) * s, (4 + p * 6) * s, P[0], sd + 20 + i, 0.08);
        }
        rr(c, x + 20 * s, y - 60 * s, 12 * s, 22 * s, 3 * s); fs(c, P[2]);
        cloud(c, x, y + 10 * s, 120 * s, 40 * s, P[0], sd);
        INK.wpoly(c, [[x - 40 * s, y - 20 * s], [x, y - 54 * s], [x + 40 * s, y - 20 * s]], P[1], true, sd, 0.8);
        rr(c, x - 30 * s, y - 22 * s, 60 * s, 34 * s, 8 * s); fs(c, P[0]);
        rr(c, x - 7 * s, y - 6 * s, 14 * s, 18 * s, 6 * s); fs(c, P[4]);
        rr(c, x + 11 * s, y - 16 * s, 14 * s, 12 * s, 3 * s); fs(c, P[5]);
        eye(c, x + 18 * s, y - 10 * s, 4 * s, P, sd, t, null);
        return;
      }
      // Barbara: hair curlers + name tag
      cloud(c, x, y, 110 * s, 44 * s, P[0], sd);
      for (let i = -1; i <= 1; i++) { c.save(); c.translate(x + i * 18 * s, y - 30 * s); c.rotate(i * 0.3); rr(c, -6 * s, -9 * s, 12 * s, 16 * s, 5 * s); fs(c, P[3]); c.restore(); }
      face(c, x - 6 * s, y - 2 * s, 34 * s, P, sd, t, 0);
      rr(c, x + 18 * s, y + 6 * s, 34 * s, 20 * s, 3 * s); fs(c, P.w);
      c.fillStyle = P[3]; c.fillRect(x + 18 * s, y + 6 * s, 34 * s, 6 * s);
      tx(c, "BARBARA", x + 35 * s, y + 18 * s, 7 * s, P.k, INK.FONT);
    },
  };
  /* ---- birds: birds in powdered wigs on floating perches, gavels, scrolls ---- */
  D.birds = {
    pal: () => ["#ffffff", "#9aa3b5", "#b0794a", "#f3e2b3", "#ffb347", "#c0392b"],
    k: [[3, 4, 3], [0, 1, 2, 4], [0, 0, 1, 2]],
    item(c, kind, x, y, s, sd, t, P) {
      if (kind === 3) {                      // a flock, flapping in formation (badly)
        c.lineWidth = Math.max(1, 1.8 * s);
        for (let i = 0; i < 5; i++) {
          const bx = x + (i - 2) * 22 * s, by = y + Math.abs(i - 2) * 9 * s, f = Math.sin(t * 6 + i + sd) * 5 * s;
          c.beginPath(); c.moveTo(bx - 8 * s, by - f); c.quadraticCurveTo(bx - 3 * s, by - 4 * s, bx, by); c.quadraticCurveTo(bx + 3 * s, by - 4 * s, bx + 8 * s, by - f); c.stroke();
        }
        return;
      }
      if (kind === 4) {                      // a floating column. no building. just the column.
        c.save(); c.translate(x, y + Math.sin(t * 0.5 + sd) * 5); c.rotate(Math.sin(sd) * 0.15);
        rr(c, -16 * s, -40 * s, 32 * s, 80 * s, 2); fs(c, P[3]);
        rr(c, -22 * s, -48 * s, 44 * s, 10 * s, 2); fs(c, P[3]); rr(c, -22 * s, 38 * s, 44 * s, 10 * s, 2); fs(c, P[3]);
        c.lineWidth *= 0.6; for (let i = -1; i <= 1; i++) ln(c, i * 8 * s, -34 * s, i * 8 * s, 34 * s);
        c.restore(); return;
      }
      if (kind === 0) {                      // honourable member, in a wig, on a perch
        const yy = y + Math.sin(t * 0.7 + sd) * 4;
        c.lineWidth *= 0.7; ln(c, x - 34 * s, yy + 22 * s, x - 34 * s, yy - 90 * s); ln(c, x + 34 * s, yy + 22 * s, x + 34 * s, yy - 90 * s);
        c.lineWidth /= 0.7;
        rr(c, x - 40 * s, yy + 20 * s, 80 * s, 8 * s, 3 * s); fs(c, P[2]);
        bl(c, x, yy + 2 * s, 20 * s, 17 * s, P[1], sd, 0.05);
        const bob = Math.sin(t * 2.2 + sd) * 2 * s;
        ov(c, x + 4 * s, yy - 20 * s + bob, 12 * s, 12 * s, P[1], true);
        INK.wpoly(c, [[x + 14 * s, yy - 22 * s + bob], [x + 26 * s, yy - 18 * s + bob], [x + 14 * s, yy - 14 * s + bob]], P[4], true, sd, 0.5);
        for (let i = -1; i <= 1; i++) ov(c, x + i * 9 * s, yy - 31 * s + bob, 7 * s, 6 * s, P[0], true);
        for (let i = 0; i < 3; i++) { ov(c, x - 9 * s, yy - 20 * s + i * 8 * s + bob, 5 * s, 4.5 * s, P[0], true); }
        eye(c, x + 6 * s, yy - 21 * s + bob, 4.5 * s, P, sd, t, null);
        ln(c, x - 6 * s, yy + 18 * s, x - 6 * s, yy + 22 * s); ln(c, x + 6 * s, yy + 18 * s, x + 6 * s, yy + 22 * s);
        return;
      }
      if (kind === 1) {                      // gavel, bonking nothing, forever
        const a = -0.6 + Math.max(0, Math.sin(t * 1.8 + sd)) * 0.9;
        c.save(); c.translate(x, y); c.rotate(a);
        rr(c, -4 * s, -6 * s, 8 * s, 52 * s, 3 * s); fs(c, P[2]);
        rr(c, -20 * s, -18 * s, 40 * s, 18 * s, 5 * s); fs(c, P[2]);
        c.restore();
        rr(c, x - 24 * s, y + 52 * s, 48 * s, 10 * s, 4 * s); fs(c, P[2]);
        return;
      }
      // scroll of proclamations
      const w = 46 * s, h = 62 * s;
      rr(c, x - w / 2, y - h / 2, w, h, 2); fs(c, P[3]);
      ov(c, x, y - h / 2, w / 2 + 4 * s, 5 * s, P[3], true); ov(c, x, y + h / 2, w / 2 + 4 * s, 5 * s, P[3], true);
      c.lineWidth *= 0.6;
      for (let i = 0; i < 5; i++) { const ly = y - h * 0.32 + i * 9 * s; INK.wline(c, [[x - w * 0.36, ly], [x + w * (0.1 + 0.25 * hr(sd, i)), ly]], sd + i, 0.6); }
      c.lineWidth /= 0.6;
      ov(c, x + w * 0.25, y + h * 0.3, 6 * s, 6 * s, P[5], true);
    },
  };
  /* ---- planes: planes with faces in the windows, road signs in the sky, traffic cones ---- */
  function arrowUp(c, x, y, s, fill) {
    c.beginPath(); c.moveTo(x, y - 10 * s); c.lineTo(x + 8 * s, y - 1 * s); c.lineTo(x + 3 * s, y - 1 * s); c.lineTo(x + 3 * s, y + 9 * s);
    c.lineTo(x - 3 * s, y + 9 * s); c.lineTo(x - 3 * s, y - 1 * s); c.lineTo(x - 8 * s, y - 1 * s); c.closePath(); fs(c, fill);
  }
  D.planes = {
    pal: () => ["#f4f6ff", "#ff5a5a", "#5aa0ff", "#ffd23f", "#2f9f5f", "#ff9a3c"],
    k: [[3, 2, 3], [0, 1, 2], [0, 1, 2]],
    bg(c, z, W, H, alt, t, a, name) {        // lane markings, painted on the sky
      const P = PAL(name, z, 1), off = (alt * GAP * 0.42) % 90;
      c.strokeStyle = P.w; c.lineWidth = 5; c.globalAlpha = a * 0.55; c.setLineDash([46, 44]); c.lineDashOffset = -off;
      for (let e = -1; e <= 1; e += 2) { const x = W / 2 + e * Math.min(W * 0.36, 420); ln(c, x, -20, x, H + 20); }
      c.setLineDash([]);
    },
    item(c, kind, x, y, s, sd, t, P, l, W) {
      if (kind === 0 || kind === 3) {        // planes actually fly across, behind everything
        const dir = sd % 2 ? 1 : -1, sp = (kind === 3 ? 18 : 40) * (0.7 + hr(sd, 9));
        const span = W + 360, px = ((((x + t * sp * dir) % span) + span) % span) - 180;
        c.save(); c.translate(px, y); c.scale(dir * s, s); c.lineWidth = 2.5;
        if (kind === 3) {
          c.setLineDash([8, 8]); ln(c, -90, 0, -40, 0); c.setLineDash([]);
          rr(c, -30, -6, 60, 12, 6); fs(c, P[0]); INK.wpoly(c, [[-8, 0], [6, 0], [-4, 14]], P[0], true, sd, 0.4);
          c.restore(); return;
        }
        INK.wpoly(c, [[-48, -6], [-62, -30], [-50, -30], [-34, -8]], P[1], true, sd, 0.6);
        rr(c, -60, -14, 116, 28, 14); fs(c, P[0]);
        INK.wpoly(c, [[-10, 2], [18, 2], [0, 30], [-14, 30]], P[0], true, sd + 1, 0.6);
        c.fillStyle = P[1]; c.fillRect(-56, 4, 108, 4);
        for (let i = 0; i < 4; i++) {
          const wx = -36 + i * 18;
          ov(c, wx, -3, 6, 6, P[2], true);
          const lk = look(px, y, sd + i, t), b = blink(sd + i, t);
          if (b < 0.5) { ov(c, wx - 2 + lk.x * dir, -3, 1.4, 1.4, P.k, false); ov(c, wx + 2 + lk.x * dir, -3, 1.4, 1.4, P.k, false); }
        }
        ov(c, 44, -4, 7, 6, P[2], true);
        c.restore(); return;
      }
      if (kind === 1) {                      // road signs, on posts, attached to nothing
        const typ = sd % 3, yy = y + Math.sin(t * 0.5 + sd) * 3;
        ln(c, x, yy, x, yy + 70 * s);
        if (typ === 0) {
          rr(c, x - 36 * s, yy - 26 * s, 72 * s, 40 * s, 5 * s); fs(c, P[4]);
          tx(c, "UP", x - 8 * s, yy - 6 * s, 18 * s, P.w, INK.FONT); arrowUp(c, x + 18 * s, yy - 6 * s, 1.2 * s, P.w);
        } else if (typ === 1) {
          c.save(); c.translate(x, yy - 10 * s); c.rotate(PI / 4); rr(c, -22 * s, -22 * s, 44 * s, 44 * s, 4 * s); fs(c, P[3]); c.restore();
          tx(c, "BEAN", x, yy - 16 * s, 10 * s, P.k, INK.FONT); tx(c, "XING", x, yy - 4 * s, 10 * s, P.k, INK.FONT);
        } else {
          ov(c, x, yy - 8 * s, 24 * s, 24 * s, P.w, true); const lw = c.lineWidth; c.lineWidth = 4 * s; c.strokeStyle = P[1];
          c.beginPath(); c.arc(x, yy - 8 * s, 19 * s, 0, TAU); c.stroke(); ln(c, x - 13 * s, yy - 21 * s, x + 13 * s, yy + 5 * s);
          c.strokeStyle = P.i; c.lineWidth = lw; arrowUp(c, x, yy - 8 * s, 0.9 * s, P[0]);
        }
        return;
      }
      c.save(); c.translate(x, y); c.rotate(Math.sin(t * 0.4 + sd) * 0.6 + sd);   // traffic cone, tumbling
      INK.wpoly(c, [[-14 * s, 16 * s], [-4 * s, -24 * s], [4 * s, -24 * s], [14 * s, 16 * s]], P[5], true, sd, 0.5);
      c.fillStyle = P.w; c.fillRect(-8 * s, -6 * s, 16 * s, 7 * s);
      rr(c, -20 * s, 14 * s, 40 * s, 7 * s, 2 * s); fs(c, P[5]);
      c.restore();
    },
  };
  /* ---- attic: floating boxes (OLD MOONS), old lamps, a rocking horse, a portrait that watches ---- */
  const BOX = ["OLD MOONS", "OLD MOONS", "SPARE WIND", "MISC. CLOUDS", "DO NOT OPEN", "XMAS?", "OLD MOONS"];
  D.attic = {
    pal: () => ["#c9a06a", "#7a5a3a", "#ffe08a", "#e8d9c0", "#b05050", "#d8c08a"],
    k: [[4, 4, 1], [0, 1, 2, 3], [0, 3, 0, 2]],
    bg(c, z, W, H, alt, t, a, name) {
      const P = PAL(name, z, 0);
      c.fillStyle = "rgba(255,240,200,0.07)";
      for (let i = 0; i < 2; i++) {
        const x0 = W * (0.12 + i * 0.5) + Math.sin(t * 0.2 + i) * 20;
        c.beginPath(); c.moveTo(x0, -10); c.lineTo(x0 + 90, -10); c.lineTo(x0 + 420, H + 10); c.lineTo(x0 + 180, H + 10); c.closePath(); c.fill();
      }
      c.fillStyle = P[3];
      for (let i = 0; i < 26; i++) {
        const per = H + 40, x = hr(i, 61) * W + Math.sin(t * 0.3 + i) * 18, y = ((hr(i, 62) * per + alt * GAP * 0.2 + t * 4) % per) - 20;
        c.globalAlpha = a * (0.3 + 0.4 * hr(i, 63)); c.beginPath(); c.arc(x, y, 1.2 + hr(i, 64) * 1.5, 0, TAU); c.fill();
      }
    },
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.5 + sd) * 4;
      if (kind === 0 || kind === 4) {
        const w = 70 * s, h = 52 * s, lab = BOX[sd % BOX.length];
        c.save(); c.translate(x, y); c.rotate((hr(sd, 1) - 0.5) * 0.4);
        if (kind === 0 && lab === "OLD MOONS") {   // an old moon peeks out
          const pk = 0.5 + 0.5 * Math.sin(t * 0.6 + sd);
          ov(c, 6 * s, -h / 2 - 4 * s - pk * 8 * s, 14 * s, 14 * s, P[3], true);
          eye(c, 2 * s, -h / 2 - 6 * s - pk * 8 * s, 3.5 * s, P, sd, t, null); eye(c, 11 * s, -h / 2 - 6 * s - pk * 8 * s, 3.5 * s, P, sd + 1, t, null);
        }
        rr(c, -w / 2, -h / 2, w, h, 3); fs(c, P[0]);
        INK.wpoly(c, [[-w / 2, -h / 2], [-w / 2 - 8 * s, -h / 2 - 12 * s], [-4 * s, -h / 2 - 8 * s], [0, -h / 2]], P[5], true, sd, 0.5);
        c.fillStyle = P[3]; c.fillRect(-6 * s, -h / 2, 12 * s, h);
        if (kind === 0) tx(c, lab, 0, 4 * s, Math.min(12, 100 / lab.length) * s * 1.1, P.k, INK.HAND, "center", "bold ");
        c.restore(); return;
      }
      if (kind === 1) {                      // old lamp, still on. who's paying for this.
        const fl = 0.75 + 0.25 * Math.sin(t * 9 + sd) * Math.sin(t * 2.3);
        const ga = c.globalAlpha; c.globalAlpha = ga * 0.25 * fl; ov(c, x, y - 34 * s, 40 * s, 34 * s, P[2], false); c.globalAlpha = ga;
        ln(c, x, y - 30 * s, x, y + 40 * s); ov(c, x, y + 42 * s, 16 * s, 5 * s, P[1], true);
        INK.wpoly(c, [[x - 14 * s, y - 50 * s], [x + 14 * s, y - 50 * s], [x + 24 * s, y - 24 * s], [x - 24 * s, y - 24 * s]], P[2], true, sd, 0.6);
        for (let i = -2; i <= 2; i++) ln(c, x + i * 10 * s, y - 24 * s, x + i * 10 * s, y - 18 * s);
        return;
      }
      if (kind === 2) {                      // rocking horse, rocking with nobody on it
        c.save(); c.translate(x, y + 20 * s); c.rotate(Math.sin(t * 1.3 + sd) * 0.18);
        const lw = c.lineWidth;
        c.beginPath(); c.arc(0, -60 * s, 70 * s, 0.36 * PI, 0.64 * PI); c.lineWidth = lw * 2; c.stroke(); c.lineWidth = lw;
        ln(c, -18 * s, 0, -14 * s, -16 * s); ln(c, 18 * s, 0, 14 * s, -16 * s);
        bl(c, 0, -22 * s, 26 * s, 12 * s, P[4], sd, 0.05);
        bl(c, 24 * s, -40 * s, 9 * s, 14 * s, P[4], sd + 1, 0.05);
        bl(c, 32 * s, -48 * s, 11 * s, 7 * s, P[4], sd + 2, 0.05);
        for (let i = 0; i < 3; i++) ov(c, 18 * s - i * 4 * s, -52 * s + i * 7 * s, 4 * s, 4 * s, P[3], true);
        eye(c, 30 * s, -50 * s, 3.2 * s, P, sd, t, null);
        c.restore(); return;
      }
      // portrait of a distinguished turnip. the eyes follow the stalk.
      const w = 54 * s, h = 66 * s;
      rr(c, x - w / 2 - 6 * s, y - h / 2 - 6 * s, w + 12 * s, h + 12 * s, 3); fs(c, P[5]);
      rr(c, x - w / 2, y - h / 2, w, h, 2); fs(c, P[1]);
      bl(c, x, y + 4 * s, 18 * s, 22 * s, P[3], sd, 0.05);
      INK.wpoly(c, [[x - 6 * s, y - 16 * s], [x, y - 32 * s], [x + 6 * s, y - 16 * s]], P[4], true, sd + 3, 0.5);
      eye(c, x - 7 * s, y, 4.5 * s, P, sd, t, null); eye(c, x + 7 * s, y, 4.5 * s, P, sd, t, null);
      ln(c, x - 5 * s, y + 12 * s, x + 5 * s, y + 12 * s);
    },
  };
  /* ---- satellites: earth curve below, satellites with faces gossiping ---- */
  const GOSSIP = ["omg", "psst", "did u hear", "no WAY", "he's SO tall", "shh!!", "is that a bean?", "lol"];
  D.satellites = {
    pal: () => ["#b8c4d6", "#3a6ad9", "#ffd23f", "#2c7be5", "#58c46a", "#ffffff"],
    k: [[3, 3, 2], [0, 1, 2], [0, 1, 0]],
    bg(c, z, W, H, alt, t, a, name) {
      const P = PAL(name, z, 1), R = Math.max(W, H) * 1.6;
      const top = H - 140 + (alt - z.at) * GAP * 0.22;
      if (top > H + 30) return;
      const cx = W / 2, cy = top + R;
      c.lineWidth = 26; c.strokeStyle = "rgba(120,190,255,0.12)"; ov(c, cx, cy, R + 14, R + 14, null, true);
      c.lineWidth = 10; c.strokeStyle = "rgba(160,215,255,0.22)"; ov(c, cx, cy, R + 4, R + 4, null, true);
      c.lineWidth = 3; c.strokeStyle = P.i; ov(c, cx, cy, R, R, P[3], true);
      c.save(); c.beginPath(); c.arc(cx, cy, R - 1.5, 0, TAU); c.clip();
      c.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const ang = -PI / 2 + (hr(i, 71) - 0.5) * 0.9 + t * 0.004, d = R - 20 - hr(i, 72) * 60;
        bl(c, cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, 50 + 60 * hr(i, 73), 18 + 16 * hr(i, 74), P[4], 900 + i, 0.12);
      }
      c.restore();
      const px = cx + 30, py = top + 2;           // a pin. YOU WERE HERE.
      c.lineWidth = 2; c.strokeStyle = P.i; ln(c, px, py, px, py - 26);
      ov(c, px, py - 30, 6, 6, "#ff5a5a", true);
      rr(c, px + 8, py - 44, 92, 18, 4); fs(c, P.w); tx(c, "YOU WERE HERE", px + 54, py - 35, 11, P.k, INK.FONT);
    },
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.4 + sd) * 5;
      if (kind === 0 || kind === 3) {
        const far = kind === 3;
        c.save(); c.translate(x, y); c.rotate(Math.sin(t * 0.3 + sd) * 0.2);
        for (let e = -1; e <= 1; e += 2) {
          ln(c, e * 16 * s, 0, e * 26 * s, 0);
          rr(c, e > 0 ? 26 * s : -58 * s, -12 * s, 32 * s, 24 * s, 2); fs(c, P[1]);
          if (!far) { const lw = c.lineWidth; c.lineWidth = lw * 0.5; ln(c, e * 42 * s, -12 * s, e * 42 * s, 12 * s); ln(c, e > 0 ? 26 * s : -58 * s, 0, e > 0 ? 58 * s : -26 * s, 0); c.lineWidth = lw; }
        }
        rr(c, -16 * s, -16 * s, 32 * s, 32 * s, 4 * s); fs(c, P[2]);
        ln(c, 0, -16 * s, 6 * s, -30 * s); ov(c, 6 * s, -31 * s, 3 * s, 3 * s, (Math.sin(t * 4 + sd) > 0) ? "#ff5a5a" : P[0], true);
        if (!far) face(c, 0, -2 * s, 26 * s, P, sd, t, sd % 2 ? 2 : 5, P[2]);
        c.restore();
        if (!far) {                          // signal waves toward the stalk (gossip)
          const d = x < VW / 2 ? 1 : -1, lw = c.lineWidth; c.lineWidth = lw * 0.7;
          for (let i = 0; i < 3; i++) {
            const p = (t * 0.6 + i / 3) % 1, rr2 = (30 + p * 50) * s;
            c.globalAlpha *= 1 - p * 0.9;
            c.beginPath(); c.arc(x + d * 20 * s, y, rr2, d > 0 ? -0.5 : PI - 0.5, d > 0 ? 0.5 : PI + 0.5); c.stroke();
            c.globalAlpha /= 1 - p * 0.9;
          }
          c.lineWidth = lw;
        }
        return;
      }
      if (kind === 1) {
        const msg = GOSSIP[sd % GOSSIP.length];
        c.font = Math.round(13 * s) + "px " + INK.FONT;
        const w = c.measureText(msg).width + 20 * s, h = 26 * s;
        rr(c, x - w / 2, y - h / 2, w, h, 10 * s); fs(c, P.w);
        INK.wpoly(c, [[x - 6 * s, y + h / 2 - 1], [x - 14 * s, y + h / 2 + 10 * s], [x + 4 * s, y + h / 2 - 1]], P.w, false, sd, 0.3);
        tx(c, msg, x, y, 13 * s, P.k, INK.FONT); return;
      }
      c.save(); c.translate(x, y); c.rotate(t * 0.3 + sd);   // a lost wrench
      rr(c, -4 * s, -20 * s, 8 * s, 34 * s, 3 * s); fs(c, P[0]);
      c.beginPath(); c.arc(0, -24 * s, 10 * s, 1.68 * PI, 3.32 * PI); c.closePath(); fs(c, P[0]);
      c.restore();
    },
  };
  /* ---- moon: moon rocks (some with legs), little flags, footprints in the sky, distant earth ---- */
  D.moon = {
    pal: () => ["#c9c3b4", "#a19a8a", "#3a6ad9", "#58c46a", "#ffffff", "#ff7eb6"],
    k: [[3, 0, 3], [0, 1, 2], [0, 1, 2]],
    bg(c, z, W, H, alt, t, a, name) {
      const P = PAL(name, z, 0), x = W * 0.13, y = H * 0.74 + (alt - z.at) * GAP * 0.07, r = 34;
      if (y > H + 50) return;
      c.lineWidth = 2.5; c.strokeStyle = P.i;
      ov(c, x, y, r, r, P[2], true);
      bl(c, x - 10, y - 8, 14, 10, P[3], 61, 0.15); bl(c, x + 14, y + 12, 10, 7, P[3], 62, 0.15);
      face(c, x, y, 26, P, 63, t, 3);
      tx(c, "home?", x, y + r + 14, 13, P.w, INK.HAND);
    },
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.35 + sd) * 5;
      if (kind === 0 || kind === 3) {
        const legs = kind === 0 && sd % 3 === 0;
        if (legs) {
          const w = Math.sin(t * 5 + sd) * 5 * s;
          ln(c, x - 8 * s, y + 14 * s, x - 8 * s + w, y + 28 * s); ln(c, x + 8 * s, y + 14 * s, x + 8 * s - w, y + 28 * s);
        }
        bl(c, x, y, 28 * s, 20 * s, P[0], sd, 0.12);
        ov(c, x - 10 * s, y - 5 * s, 6 * s, 4 * s, P[1], true); ov(c, x + 9 * s, y + 6 * s, 4 * s, 3 * s, P[1], true);
        if (legs) { eye(c, x + 8 * s, y - 6 * s, 3.5 * s, P, sd, t, null); eye(c, x + 16 * s, y - 5 * s, 3.5 * s, P, sd + 1, t, null); }
        return;
      }
      if (kind === 1) {                      // a tiny flag. it says "?"
        bl(c, x, y + 8 * s, 24 * s, 12 * s, P[0], sd, 0.1);
        ln(c, x, y + 2 * s, x, y - 38 * s);
        const w = Math.sin(t * 2 + sd) * 3 * s;
        c.beginPath(); c.moveTo(x, y - 38 * s); c.lineTo(x + 26 * s, y - 32 * s + w); c.lineTo(x, y - 24 * s); c.closePath(); fs(c, P[5]);
        tx(c, "?", x + 9 * s, y - 31 * s, 10 * s, P.k, INK.FONT); return;
      }
      for (let i = 0; i < 2; i++) {          // footprints, walking up the sky
        const fx = x + (i ? 14 : -14) * s, fy = y - i * 30 * s;
        bl(c, fx, fy, 8 * s, 13 * s, null, sd + i, 0.08);
        for (let k = 0; k < 4; k++) ov(c, fx - 6 * s + k * 4 * s, fy - 17 * s - (k === 1 ? 2 : 0) * s, 2.2 * s, 2.6 * s, null, true);
      }
    },
  };
  /* ---- socks: a swirling nebula of every lost sock ---- */
  function sock(c, x, y, s, rot, col, stripe, P, sd, t, eyes) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.beginPath(); c.moveTo(-8 * s, -22 * s); c.lineTo(8 * s, -22 * s); c.lineTo(8 * s, 4 * s);
    c.quadraticCurveTo(8 * s, 8 * s, 14 * s, 9 * s); c.lineTo(20 * s, 10 * s);
    c.quadraticCurveTo(28 * s, 12 * s, 26 * s, 19 * s); c.quadraticCurveTo(24 * s, 24 * s, 14 * s, 23 * s);
    c.lineTo(-2 * s, 22 * s); c.quadraticCurveTo(-10 * s, 21 * s, -9 * s, 10 * s); c.closePath(); fs(c, col);
    c.fillStyle = stripe; c.fillRect(-7 * s, -14 * s, 14 * s, 4 * s); c.fillRect(-7 * s, -6 * s, 14 * s, 4 * s);
    rr(c, -9 * s, -26 * s, 18 * s, 6 * s, 2 * s); fs(c, stripe);
    if (eyes) { eye(c, -3 * s, 4 * s, 3.4 * s, P, sd, t, null); eye(c, 4 * s, 4 * s, 3.4 * s, P, sd + 1, t, null); }
    c.restore();
  }
  function nebula(z) {                     // soft nebula painted once per zone
    const key = "neb" + z.k;
    if (C.img[key] !== undefined) return C.img[key];
    const cv = canvas(256, 256); if (!cv) return (C.img[key] = null);
    const g = cv.getContext("2d"), r = U.rng(z.k * 31 + 5);
    const cols = [INK.mix(z.sky[1], "#ff7eb6", 0.4), INK.mix(z.sky[1], "#c58bff", 0.5), INK.mix(z.sky[0], "#6ad1ff", 0.35), z.sky[1]];
    for (let i = 0; i < 14; i++) {
      const a = i * 0.9, d = 20 + i * 7, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d * 0.8, rad = 30 + r() * 40;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, INK.rgba(cols[i % cols.length], 0.55)); gr.addColorStop(1, INK.rgba(cols[i % cols.length], 0));
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    }
    if (C.img.nebN = (C.img.nebN || 0) + 1, C.img.nebN > 30) { for (const k in C.img) if (k.indexOf("neb") === 0 && k !== key) delete C.img[k]; C.img.nebN = 0; }
    return (C.img[key] = cv);
  }

  D.socks = {
    pal: () => ["#ff7eb6", "#6ad1ff", "#ffd23f", "#c58bff", "#7be07b", "#ffffff"],
    k: [[3, 3, 2], [0, 1, 2], [0, 0, 1]],
    bg(c, z, W, H, alt, t, a) {
      const img = nebula(z); if (!img) return;
      const S = Math.max(W, H) * 1.5, oy = ((alt - z.at) * GAP * 0.05) % 200;
      c.globalAlpha = a * 0.75;
      c.save(); c.translate(W * 0.5, H * 0.45 + oy); c.rotate(t * 0.012); c.drawImage(img, -S / 2, -S / 2, S, S); c.restore();
      c.globalAlpha = a * 0.4;
      c.save(); c.translate(W * 0.3, H * 0.7 + oy * 1.5); c.rotate(-t * 0.008 + 2); c.drawImage(img, -S / 3, -S / 3, S / 1.5, S / 1.5); c.restore();
    },
    item(c, kind, x, y, s, sd, t, P) {
      const col = P[sd % 5], st = P[(sd + 2) % 5];
      if (kind === 0 || kind === 3) { sock(c, x, y, s * 1.8, t * (0.2 + hr(sd, 3) * 0.3) * (sd % 2 ? 1 : -1) + sd, col, st, P, sd, t, kind === 0 && sd % 3 === 0); return; }
      if (kind === 1) {                      // a reunited pair, hugging. 40 years apart.
        const lean = Math.sin(t * 0.8 + sd) * 0.08;
        sock(c, x - 16 * s, y, s * 1.6, -0.25 + lean, col, st, P, sd, t, true);
        c.save(); c.translate(x + 16 * s, y); c.scale(-1, 1); sock(c, 0, 0, s * 1.6, -0.25 + lean, col, st, P, sd + 5, t, false); c.restore();
        const hb = 1 + 0.15 * Math.sin(t * 4);
        c.beginPath(); const hx = x, hy = y - 40 * s, k = 6 * s * hb;
        c.moveTo(hx, hy + k); c.bezierCurveTo(hx - 2 * k, hy - 0.2 * k, hx - k, hy - 1.6 * k, hx, hy - 0.6 * k);
        c.bezierCurveTo(hx + k, hy - 1.6 * k, hx + 2 * k, hy - 0.2 * k, hx, hy + k); fs(c, P[0]);
        return;
      }
      for (let i = 0; i < 6; i++) {          // a tiny galaxy of socks
        const a = (i / 6) * TAU + t * 0.4 * (sd % 2 ? 1 : -1), rd = 46 * s;
        sock(c, x + Math.cos(a) * rd, y + Math.sin(a) * rd * 0.6, s * 0.85, a + PI / 2, P[i % 5], P[(i + 2) % 5], P, sd + i, t, false);
      }
      ov(c, x, y, 6 * s, 6 * s, P[2], true);
    },
  };
  /* ---- laundry: washing machines with galaxies in the portholes, ring arcs, clotheslines ---- */
  D.laundry = {
    pal: () => ["#e8f4ff", "#3d8a9a", "#3a1a6a", "#ffd23f", "#ff7eb6", "#ffffff"],
    k: [[3, 3, 1], [0, 1, 2], [0, 2, 0, 1]],
    bg(c, z, W, H, alt, t, a, name) {
      const P = PAL(name, z, 0), oy = (alt - z.at) * GAP * 0.08;
      c.save(); c.translate(W * 0.5, H * 0.55 + oy); c.rotate(-0.22);
      c.globalAlpha = a * 0.16; c.strokeStyle = "#e8d8b0"; c.lineWidth = 46; ov(c, 0, 0, W * 0.75, H * 0.2, null, true);
      c.globalAlpha = a * 0.3; c.strokeStyle = P.w; c.lineWidth = 2; ov(c, 0, 0, W * 0.75 + 24, H * 0.2 + 24, null, true); ov(c, 0, 0, W * 0.75 - 24, H * 0.2 - 24, null, true);
      c.restore();
    },
    item(c, kind, x, y, s, sd, t, P) {
      if (kind === 0) {
        const sh = Math.sin(t * 22 + sd) * 0.8 * s; x += sh;
        rr(c, x - 34 * s, y - 40 * s, 68 * s, 80 * s, 6 * s); fs(c, P[0]);
        ln(c, x - 34 * s, y - 24 * s, x + 34 * s, y - 24 * s);
        ov(c, x - 20 * s, y - 32 * s, 4 * s, 4 * s, P[1], true); ov(c, x - 8 * s, y - 32 * s, 4 * s, 4 * s, P[1], true);
        ov(c, x + 22 * s, y - 32 * s, 3 * s, 3 * s, (Math.sin(t * 3 + sd) > 0) ? "#7be07b" : P[1], false);
        ov(c, x, y + 8 * s, 24 * s, 24 * s, P[1], true);
        ov(c, x, y + 8 * s, 19 * s, 19 * s, P[2], true);
        const sp = t * 2.5 + sd, lw = c.lineWidth;
        c.strokeStyle = P[4]; c.lineWidth = 2 * s;
        for (let k = 0; k < 2; k++) { c.beginPath(); for (let a = 0; a < 5; a += 0.5) { const rr2 = a * 3.4 * s, an = sp + k * PI + a; c.lineTo(x + Math.cos(an) * rr2, y + 8 * s + Math.sin(an) * rr2); } c.stroke(); }
        c.strokeStyle = P.i; c.lineWidth = lw;
        for (let k = 0; k < 4; k++) spark(c, x + Math.cos(sp * 0.7 + k * 1.6) * 12 * s, y + 8 * s + Math.sin(sp * 0.7 + k * 1.6) * 12 * s, 2.5 * s, P[3]);
        c.beginPath(); c.moveTo(x + 18 * s, y + 20 * s); c.quadraticCurveTo(x + 30 * s, y + 34 * s, x + 26 * s, y + 46 * s);
        c.lineTo(x + 18 * s, y + 46 * s); c.quadraticCurveTo(x + 22 * s, y + 34 * s, x + 12 * s, y + 24 * s); c.closePath(); fs(c, P[4]);
        return;
      }
      if (kind === 1) {
        c.save(); c.translate(x, y); c.rotate(Math.sin(t * 0.3 + sd) * 0.5);
        rr(c, -18 * s, -26 * s, 36 * s, 52 * s, 8 * s); fs(c, P[1]);
        rr(c, -7 * s, -36 * s, 14 * s, 11 * s, 2 * s); fs(c, P[3]);
        rr(c, -14 * s, -10 * s, 28 * s, 20 * s, 3 * s); fs(c, P.w);
        tx(c, "SPACE", 0, -4 * s, 7 * s, P.k, INK.FONT); tx(c, "SUDS", 0, 5 * s, 8 * s, P.k, INK.FONT);
        c.restore(); return;
      }
      if (kind === 2) {                      // clothesline strung between two stars
        const w = 70 * s, sag = 16 * s;
        spark(c, x - w, y, 7 * s, P[3]); spark(c, x + w, y, 7 * s, P[3]);
        c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x, y + sag * 2, x + w, y); c.stroke();
        for (let i = 0; i < 3; i++) {
          const u = (i + 1) / 4, px = x - w + u * 2 * w, py = y + sag * 4 * u * (1 - u), sw = Math.sin(t * 1.5 + i + sd) * 0.15;
          c.save(); c.translate(px, py); c.rotate(sw);
          if (i === 1) laundryBit(c, 1, 0, 10 * s, s * 1.3, P[4]); else laundryBit(c, 0, 0, 10 * s, s * 1.4, P[(i + sd) % 2 ? 0 : 3]);
          c.restore();
        }
        return;
      }
      for (let i = 0; i < 3; i++) {          // soap bubbles
        const bx = x + (i - 1) * 16 * s, by = y + Math.sin(t + i + sd) * 6 * s, r = (8 + 5 * hr(sd, i)) * s;
        ov(c, bx, by, r, r, null, true);
        c.beginPath(); c.arc(bx, by, r * 0.6, 1.1 * PI, 1.4 * PI); c.stroke();
      }
    },
  };
  /* ---- sun: a huge warm glow, waiting-room chairs, ticket numbers, a fake plant ---- */
  const commas = n => String(n).replace(/(\d)(?=(\d{3})+$)/g, "$1,");
  D.sun = {
    pal: () => ["#ff9a3c", "#ffd76b", "#e0603a", "#fff3dc", "#5a3a2a", "#6fcf6a"],
    k: [[5, 1, 5], [0, 1, 2, 4], [0, 1, 3]],
    bg(c, z, W, H, alt, t, a) {
      if (!C.grad.warm) {
        const g = c.createRadialGradient(0, 0, 0.02, 0, 0, 1);
        g.addColorStop(0, "rgba(255,250,215,0.9)"); g.addColorStop(0.35, "rgba(255,220,130,0.35)"); g.addColorStop(1, "rgba(255,180,90,0)");
        C.grad.warm = g;
      }
      const R = Math.max(W, H) * (1.05 + 0.03 * Math.sin(t * 0.8));
      c.globalAlpha = a; c.translate(W * 0.82, -H * 0.05); c.scale(R, R); c.fillStyle = C.grad.warm; c.fillRect(-1, -1, 2, 2);
    },
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.4 + sd) * 4;
      if (kind === 5) { spark(c, x, y, (6 + 5 * Math.sin(t * 2 + sd)) * s, P[1]); return; }
      if (kind === 0) {                      // three waiting-room chairs. one is occupied by a small flame.
        ln(c, x - 50 * s, y + 10 * s, x + 50 * s, y + 10 * s);
        for (let i = -1; i <= 1; i++) {
          const cx = x + i * 32 * s;
          rr(c, cx - 13 * s, y - 26 * s, 26 * s, 24 * s, 6 * s); fs(c, P[2]);
          rr(c, cx - 14 * s, y - 4 * s, 28 * s, 9 * s, 4 * s); fs(c, P[2]);
          ln(c, cx - 10 * s, y + 10 * s, cx - 12 * s, y + 24 * s); ln(c, cx + 10 * s, y + 10 * s, cx + 12 * s, y + 24 * s);
        }
        const fx = x + ((sd % 3) - 1) * 32 * s, fl = Math.sin(t * 6 + sd) * 2 * s;
        c.beginPath(); c.moveTo(fx, y - 34 * s + fl); c.quadraticCurveTo(fx + 14 * s, y - 14 * s, fx + 8 * s, y - 4 * s);
        c.lineTo(fx - 8 * s, y - 4 * s); c.quadraticCurveTo(fx - 14 * s, y - 14 * s, fx, y - 34 * s + fl); fs(c, P[0]);
        eye(c, fx - 4 * s, y - 14 * s, 2.6 * s, P, sd, t, null); eye(c, fx + 4 * s, y - 14 * s, 2.6 * s, P, sd + 1, t, null);
        rr(c, fx - 12 * s, y - 10 * s, 24 * s, 12 * s, 1); fs(c, P[3]);
        return;
      }
      if (kind === 1) {
        const n = "#" + commas(4000000002 + (sd % 9000));
        c.save(); c.translate(x, y); c.rotate(Math.sin(t * 0.5 + sd) * 0.3);
        c.font = Math.round(12 * s) + "px " + INK.FONT;
        const w = c.measureText(n).width + 20 * s;
        rr(c, -w / 2, -13 * s, w, 26 * s, 3 * s); fs(c, P[3]);
        ov(c, -w / 2 + 6 * s, 0, 2.5 * s, 2.5 * s, P[1], true);
        tx(c, n, 4 * s, 0, 12 * s, P.k, INK.FONT);
        c.restore(); return;
      }
      if (kind === 2) {                      // a fake plant. it has a tag that says FAKE.
        INK.wpoly(c, [[x - 14 * s, y + 6 * s], [x + 14 * s, y + 6 * s], [x + 10 * s, y + 32 * s], [x - 10 * s, y + 32 * s]], P[2], true, sd, 0.6);
        for (let i = 0; i < 5; i++) { const a = -PI / 2 + (i - 2) * 0.5; bl(c, x + Math.cos(a) * 20 * s, y + 4 * s + Math.sin(a) * 24 * s, 7 * s, 12 * s, P[5], sd + i, 0.1); }
        rr(c, x + 12 * s, y + 10 * s, 22 * s, 10 * s, 2); fs(c, P.w); tx(c, "FAKE", x + 23 * s, y + 15 * s, 7 * s, P.k, INK.FONT);
        return;
      }
      if (kind === 3) {                      // NOW SERVING
        rr(c, x - 52 * s, y - 22 * s, 104 * s, 44 * s, 5 * s); fs(c, "#2a1a2a");
        tx(c, "NOW SERVING", x, y - 10 * s, 9 * s, P[1], INK.FONT);
        const on = Math.sin(t * 7 + sd) > -0.85;
        if (on) tx(c, "#4,000,000,001", x, y + 7 * s, 12 * s, "#ff6a3a", INK.FONT);
        return;
      }
      rr(c, x - 12 * s, y - 34 * s, 24 * s, 30 * s, 8 * s); fs(c, "#bfe6ff");   // water cooler
      rr(c, x - 14 * s, y - 4 * s, 28 * s, 40 * s, 3 * s); fs(c, P[3]);
      for (let i = 0; i < 2; i++) { const p = (t * 0.5 + i / 2 + hr(sd, i)) % 1; ov(c, x + (i ? 4 : -3) * s, y - 8 * s - p * 22 * s, 2 * s, 2 * s, null, true); }
    },
  };
  /* ---- dairy: cheese planets, milk swirls, missing-moon milk cartons ---- */
  function wedge(c, x, y, s, P, sd, t) {
    c.beginPath(); c.moveTo(x - 22 * s, y + 12 * s); c.lineTo(x + 22 * s, y + 12 * s); c.lineTo(x + 22 * s, y - 2 * s); c.lineTo(x - 22 * s, y - 14 * s); c.closePath(); fs(c, P[0]);
    ov(c, x - 8 * s, y + 3 * s, 3 * s, 2.5 * s, P[2], false); ov(c, x + 10 * s, y + 6 * s, 2.5 * s, 2 * s, P[2], false);
    face(c, x + 6 * s, y + 2 * s, 18 * s, P, sd, t, 5, P[0]);
  }
  D.dairy = {
    fog: 0.7, n: [8, 6, 5],
    bg(c, z, W, H, alt, t, a, name) {        // the Milky Whey itself: a river of milk across the sky
      const P = PAL(name, z, 0), oy = ((alt - z.at) * GAP * 0.06) % (H * 2);
      c.save(); c.translate(W * 0.5, H * 0.5 + oy - H * 0.5); c.rotate(-0.35);
      c.globalAlpha = a * 0.5; c.fillStyle = P.w; c.beginPath(); c.moveTo(-W, -40);
      for (let x = -W; x <= W; x += 40) c.lineTo(x, -40 + Math.sin(x * 0.006 + t * 0.2) * 30);
      for (let x = W; x >= -W; x -= 40) c.lineTo(x, 50 + Math.sin(x * 0.008 + 1 + t * 0.2) * 30);
      c.closePath(); c.fill();
      c.globalAlpha = a * 0.35; c.strokeStyle = P[2]; c.lineWidth = 2;
      for (let i = 0; i < 9; i++) { const x = -W + ((i * 263 + t * 12) % (2 * W)); c.beginPath(); c.arc(x, 5, 9 + (i % 3) * 5, 0, 1.5 * PI); c.stroke(); }
      c.restore();
    },
    pal: () => ["#ffd23f", "#ffffff", "#e0a63a", "#6aa8ff", "#ff7eb6", "#c98a4b"],
    k: [[3, 1, 3], [0, 1, 2, 4], [0, 2, 4]],
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.4 + sd) * 5;
      if (kind === 3) { ov(c, x, y, 5 * s, 6 * s, P[1], true); ov(c, x + 14 * s, y + 8 * s, 3 * s, 4 * s, P[1], true); return; }
      if (kind === 0) {                      // a cheese planet with a cracker ring
        const r = 30 * s, ring = sd % 2;
        if (ring) { c.beginPath(); c.ellipse(x, y, r * 1.8, r * 0.45, -0.3, PI, TAU); c.stroke(); }
        ov(c, x, y, r, r, P[0], true);
        for (let i = 0; i < 5; i++) ov(c, x + (hr(sd, i) - 0.5) * r * 1.3, y + (hr(sd, i + 9) - 0.5) * r * 1.3, (3 + 4 * hr(sd, i + 5)) * s, (3 + 3 * hr(sd, i + 5)) * s, P[2], false);
        face(c, x, y + 2 * s, r * 0.9, P, sd, t, sd % 3 ? 5 : 0, P[0]);
        if (ring) {
          c.beginPath(); c.ellipse(x, y, r * 1.8, r * 0.45, -0.3, 0, PI); c.stroke();
          for (let i = 0; i < 6; i++) { const a = t * 0.3 + i * 1.05, cx = x + Math.cos(a) * r * 1.8, cy = y + Math.sin(a) * r * 0.45 - Math.cos(a) * r * 1.8 * 0.3; if (Math.sin(a) < 0) continue; rr(c, cx - 4 * s, cy - 4 * s, 8 * s, 8 * s, 1); fs(c, P[5]); }
        }
        return;
      }
      if (kind === 1) {                      // milk swirl
        const lw = c.lineWidth, rot = t * 0.3 + sd;
        c.beginPath();
        for (let a = 0; a < 12; a += 0.35) { const rr2 = a * 3 * s; c.lineTo(x + Math.cos(a + rot) * rr2, y + Math.sin(a + rot) * rr2 * 0.8); }
        c.lineWidth = lw * 4 + 2; c.stroke(); c.strokeStyle = P[1]; c.lineWidth = lw * 4 - 2; c.stroke();
        c.strokeStyle = P.i; c.lineWidth = lw; return;
      }
      if (kind === 2) {                      // HAVE YOU SEEN THIS MOON?
        c.save(); c.translate(x, y); c.rotate(Math.sin(t * 0.3 + sd) * 0.2);
        rr(c, -22 * s, -24 * s, 44 * s, 56 * s, 2); fs(c, P[1]);
        INK.wpoly(c, [[-22 * s, -24 * s], [0, -40 * s], [22 * s, -24 * s]], P[1], true, sd, 0.4);
        c.fillStyle = P[3]; c.fillRect(-21 * s, -22 * s, 42 * s, 12 * s);
        tx(c, "MISSING", 0, -16 * s, 9 * s, P.w, INK.FONT);
        ov(c, 0, 4 * s, 10 * s, 10 * s, "#f4ecd0", true);
        ov(c, -3.5 * s, 2 * s, 1.5 * s, 1.5 * s, P.k, false); ov(c, 3.5 * s, 2 * s, 1.5 * s, 1.5 * s, P.k, false);
        tx(c, "seen him?", 0, 22 * s, 8 * s, P.k, INK.HAND);
        c.restore(); return;
      }
      wedge(c, x, y, s * 1.2, P, sd, t);
    },
  };
  /* ---- map: parchment, dashed borders, a compass rose that is literally a rose, sea serpents ---- */
  function parchTile() {
    if (C.img.parch !== undefined) return C.img.parch;
    const cv = canvas(256, 256); if (!cv) return (C.img.parch = null);
    const g = cv.getContext("2d"), r = U.rng(31337);
    for (let i = 0; i < 40; i++) {
      const x = r() * 256, y = r() * 256, rad = 8 + r() * 30, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, "rgba(140,95,40," + (0.05 + r() * 0.08).toFixed(3) + ")"); gr.addColorStop(1, "rgba(140,95,40,0)");
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.strokeStyle = "rgba(110,70,30,0.08)"; g.lineWidth = 0.7;
    for (let i = 0; i < 50; i++) { const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r() * 20 - 10, y + r() * 4 - 2); g.stroke(); }
    return (C.img.parch = cv);
  }
  const MAPL = ["HERE BE GERALD", "vibes", "probably fine", "uncharted (on purpose)", "?", "here be more up"];
  D.map = {
    fog: 0.7, n: [8, 6, 5],
    pal: () => ["#f0dcaa", "#5a3a1a", "#b33a3a", "#3b7f70", "#d9c08a", "#ffffff"],
    k: [[5, 3, 5], [0, 1, 2, 4], [0, 1, 2]],
    bg(c, z, W, H, alt, t, a, name) {
      const P = PAL(name, z, 0), tile = parchTile(), oy = (alt * GAP * 0.2) % 256;
      if (tile) {
        if (!C.pat.parch) C.pat.parch = c.createPattern(tile, "repeat");
        c.save(); c.translate(0, oy); c.fillStyle = C.pat.parch; c.fillRect(0, -oy, W, H); c.restore();
      }
      c.strokeStyle = P[1]; c.lineWidth = 1.5; c.globalAlpha = a * 0.35; c.setLineDash([12, 10]);
      const step = 230, o2 = (alt * GAP * 0.2) % step;
      for (let y = o2 - step; y < H + step; y += step) ln(c, 0, y, W, y);
      c.lineDashOffset = -(alt * GAP * 0.2) % 22;
      for (let e = -1; e <= 1; e += 2) ln(c, W / 2 + e * W * 0.4, -10, W / 2 + e * W * 0.4, H + 10);
      c.setLineDash([]);
    },
    item(c, kind, x, y, s, sd, t, P) {
      if (kind === 5) {                      // little wave squiggles
        c.beginPath(); for (let i = 0; i <= 12; i++) c.lineTo(x - 24 * s + i * 4 * s, y + Math.sin(i * 1.6 + t + sd) * 3 * s); c.stroke(); return;
      }
      if (kind === 0) {                      // compass "rose". N points down. it has been lying for centuries.
        const r = 34 * s;
        c.save(); c.translate(x, y); c.rotate(PI + Math.sin(t * 0.3 + sd) * 0.15);
        for (let i = 0; i < 4; i++) { c.rotate(PI / 2); INK.wpoly(c, [[0, -r], [6 * s, -6 * s], [-6 * s, -6 * s]], i ? P[0] : P[2], true, sd + i, 0.4); }
        tx(c, "N", 0, -r - 8 * s, 11 * s, P[1], INK.FONT);
        c.restore();
        for (let i = 0; i < 6; i++) { const a = i * 1.05 + sd; bl(c, x + Math.cos(a) * 7 * s, y + Math.sin(a) * 7 * s, 8 * s, 6 * s, P[2], sd + i, 0.1); }
        bl(c, x, y, 6 * s, 6 * s, P[2], sd + 9, 0.1);
        ln(c, x + 6 * s, y + 10 * s, x + 14 * s, y + 30 * s);
        return;
      }
      if (kind === 1) {                      // inky sea serpent doodle
        const ph = t * 1.2 + sd;
        for (let i = 0; i < 3; i++) {
          const hx = x - 36 * s + i * 26 * s, hh = (12 + 3 * Math.sin(ph + i)) * s;
          c.beginPath(); c.arc(hx, y, hh, PI, TAU); fs(c, P[3]);
          ln(c, hx - 4 * s, y - hh * 0.6, hx - 1 * s, y - hh * 0.9);
        }
        c.beginPath(); c.moveTo(x + 36 * s, y); c.quadraticCurveTo(x + 42 * s, y - 34 * s, x + 54 * s, y - 30 * s);
        c.quadraticCurveTo(x + 64 * s, y - 26 * s, x + 56 * s, y - 20 * s); c.quadraticCurveTo(x + 48 * s, y - 18 * s, x + 46 * s, y); c.closePath(); fs(c, P[3]);
        eye(c, x + 53 * s, y - 27 * s, 3 * s, P, sd, t, null);
        c.beginPath(); for (let i = 0; i <= 16; i++) c.lineTo(x - 54 * s + i * 7 * s, y + 2 * s + Math.sin(i * 1.4 + ph) * 2.5 * s); c.stroke();
        return;
      }
      if (kind === 2) {                      // a tiny ship, very lost
        c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.1 + sd) * 0.12);
        c.beginPath(); c.moveTo(-26 * s, 0); c.lineTo(26 * s, 0); c.lineTo(18 * s, 12 * s); c.lineTo(-18 * s, 12 * s); c.closePath(); fs(c, P[4]);
        ln(c, 0, 0, 0, -40 * s);
        INK.wpoly(c, [[2 * s, -38 * s], [20 * s, -22 * s], [2 * s, -6 * s]], P[5], true, sd, 0.5);
        INK.wpoly(c, [[-2 * s, -34 * s], [-18 * s, -12 * s], [-2 * s, -6 * s]], P[5], true, sd + 1, 0.5);
        c.restore(); return;
      }
      if (kind === 3) {
        const lw = c.lineWidth; c.strokeStyle = P[2]; c.lineWidth = lw * 2;
        ln(c, x - 12 * s, y - 12 * s, x + 12 * s, y + 12 * s); ln(c, x + 12 * s, y - 12 * s, x - 12 * s, y + 12 * s);
        c.lineWidth = lw; c.strokeStyle = P.i; return;
      }
      c.save(); c.translate(x, y); c.rotate((hr(sd, 2) - 0.5) * 0.3);
      tx(c, MAPL[sd % MAPL.length], 0, 0, 17 * s, P[1], INK.HAND, "center", "bold ");
      c.restore();
    },
  };
  /* ---- office: filing cabinets (something lives in the middle drawer), UP arrows, mugs, clipboards ---- */
  const MUG = ["#1 UP", "WORLD'S OKAYEST SKY", "I <3 UP", "MONDAYS"];
  D.office = {
    fog: 0.65, n: [8, 6, 5],
    pal: () => ["#a9b8c0", "#f4f7f8", "#3a7be0", "#c96a3a", "#b08a5a", "#ffd23f"],
    k: [[4, 4, 1], [0, 1, 2, 3], [0, 1, 3]],
    bg(c, z, W, H, alt, t, a, name) {        // ceiling-tile grid
      const P = PAL(name, z, 0), st = 120, oy = (alt * GAP * 0.15) % st;
      c.strokeStyle = P.i; c.lineWidth = 1; c.globalAlpha = a * 0.12;
      for (let y = oy - st; y < H + st; y += st) ln(c, 0, y, W, y);
      for (let x = (W / 2) % st; x < W; x += st) ln(c, x, 0, x, H);
    },
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.4 + sd) * 4;
      if (kind === 0) {
        const w = 44 * s, h = 92 * s, op = (0.5 + 0.5 * Math.sin(t * 0.5 + sd)) * 8 * s;
        rr(c, x - w / 2, y - h / 2, w, h, 3); fs(c, P[0]);
        for (let i = 0; i < 3; i++) {
          const dy = y - h / 2 + 6 * s + i * 28 * s, g = i === 1 ? op * 1.4 : 0;
          if (g > 1) { c.fillStyle = P.k; c.fillRect(x - w / 2 + 4 * s, dy, w - 8 * s, g + 2); }
          if (g > 6 * s) { eye(c, x - 6 * s, dy + g * 0.5, 2.6 * s, P, sd, t, null); eye(c, x + 5 * s, dy + g * 0.5, 2.6 * s, P, sd + 1, t, null); }
          rr(c, x - w / 2 + 3 * s, dy + g, w - 6 * s, 24 * s, 2); fs(c, P[0]);
          rr(c, x - 7 * s, dy + g + 4 * s, 14 * s, 5 * s, 1); fs(c, P[1]);
        }
        return;
      }
      if (kind === 1) {                      // UP (this way)
        c.save(); c.translate(x, y); c.rotate(Math.sin(t * 0.5 + sd) * 0.1);
        INK.wpoly(c, [[0, -44 * s], [32 * s, -10 * s], [14 * s, -10 * s], [14 * s, 34 * s], [-14 * s, 34 * s], [-14 * s, -10 * s], [-32 * s, -10 * s]], P[2], true, sd, 0.6);
        tx(c, "UP", 0, 10 * s, 15 * s, P.w, INK.FONT);
        c.restore(); return;
      }
      if (kind === 2) {
        const lw = c.lineWidth;
        for (let i = 0; i < 2; i++) { const p = (t * 0.4 + i / 2) % 1; c.beginPath(); c.moveTo(x - 6 * s + i * 10 * s, y - 24 * s - p * 20 * s); c.quadraticCurveTo(x - 1 * s + i * 10 * s, y - 30 * s - p * 20 * s, x - 6 * s + i * 10 * s, y - 36 * s - p * 20 * s); c.stroke(); }
        c.beginPath(); c.arc(x + 20 * s, y - 2 * s, 9 * s, -PI / 2, PI / 2); c.lineWidth = lw * 1.8; c.stroke(); c.lineWidth = lw;
        rr(c, x - 20 * s, y - 20 * s, 40 * s, 38 * s, 5 * s); fs(c, P[3]);
        const m = MUG[sd % MUG.length];
        tx(c, m, x, y, Math.min(9, 60 / m.length * 1.6) * s, P.w, INK.FONT); return;
      }
      if (kind === 3) {
        c.save(); c.translate(x, y); c.rotate((hr(sd, 1) - 0.5) * 0.4);
        rr(c, -24 * s, -32 * s, 48 * s, 64 * s, 4 * s); fs(c, P[4]);
        rr(c, -19 * s, -24 * s, 38 * s, 52 * s, 1); fs(c, P[1]);
        rr(c, -10 * s, -36 * s, 20 * s, 10 * s, 3 * s); fs(c, P[0]);
        for (let i = 0; i < 3; i++) {
          const yy = -12 * s + i * 13 * s; rr(c, -14 * s, yy - 4 * s, 8 * s, 8 * s, 1); fs(c, null);
          ln(c, -2 * s, yy, 14 * s, yy);
          if (i < 2) { ln(c, -13 * s, yy, -10 * s, yy + 3 * s); ln(c, -10 * s, yy + 3 * s, -5 * s, yy - 6 * s); }
        }
        c.restore(); return;
      }
      c.save(); c.translate(x, y); c.rotate(t * 0.2 + sd);     // drifting paperwork
      rr(c, -14 * s, -18 * s, 28 * s, 36 * s, 1); fs(c, P[1]);
      for (let i = 0; i < 3; i++) ln(c, -8 * s, -8 * s + i * 8 * s, 8 * s, -8 * s + i * 8 * s);
      c.restore();
    },
  };
  /* ---- backstage: cardboard, tape strips, price tags, stars stapled to strings ---- */
  function corrTile() {
    if (C.img.corr !== undefined) return C.img.corr;
    const cv = canvas(64, 64); if (!cv) return (C.img.corr = null);
    const g = cv.getContext("2d");
    for (let x = 0; x < 64; x += 8) { g.fillStyle = "rgba(90,60,30,0.10)"; g.fillRect(x, 0, 3, 64); g.fillStyle = "rgba(255,240,210,0.08)"; g.fillRect(x + 4, 0, 2, 64); }
    return (C.img.corr = cv);
  }
  function star5(c, x, y, r, fill, sd) {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -PI / 2 + (i * PI) / 5, rr2 = i % 2 ? r * 0.45 : r; pts.push([x + Math.cos(a) * rr2, y + Math.sin(a) * rr2]); }
    INK.wpoly(c, pts, fill, true, sd, 0.8);
  }
  const TAGS = ["$4.99", "SALE", "50% OFF SKY", "$0.99", "AS IS"];
  D.backstage = {
    fog: 0.6, n: [8, 6, 5],
    pal: () => ["#c9a06a", "#efe2b0", "#ffd23f", "#ffffff", "#8a6a45", "#e0503a"],
    k: [[5, 0, 5], [0, 1, 2, 3], [2, 1, 4, 2]],
    bg(c, z, W, H, alt, t, a, name) {
      const P = PAL(name, z, 0), tile = corrTile(), oy = (alt * GAP * 0.15) % 64;
      if (tile) {
        if (!C.pat.corr) C.pat.corr = c.createPattern(tile, "repeat");
        c.save(); c.translate(0, oy); c.fillStyle = C.pat.corr; c.fillRect(0, -oy, W, H); c.restore();
      }
      const st = 420, o2 = (alt * GAP * 0.15) % st;      // cardboard seams
      c.strokeStyle = P.i; c.lineWidth = 2; c.globalAlpha = a * 0.25;
      for (let y = o2 - st; y < H + st; y += st) ln(c, 0, y, W, y + 6);
    },
    item(c, kind, x, y, s, sd, t, P) {
      if (kind === 5) { const lw = c.lineWidth; c.lineWidth = lw * 1.4; ln(c, x - 6 * s, y, x + 6 * s, y); ln(c, x - 6 * s, y, x - 6 * s, y + 3 * s); ln(c, x + 6 * s, y, x + 6 * s, y + 3 * s); c.lineWidth = lw; return; }
      if (kind === 0) {                      // masking tape
        c.save(); c.translate(x, y); c.rotate((hr(sd, 1) - 0.5) * 1.2);
        const w = 70 * s, h = 16 * s;
        c.beginPath(); c.moveTo(-w / 2, -h / 2);
        for (let i = 0; i <= 4; i++) c.lineTo(-w / 2 + (i % 2 ? 3 : -3) * s, -h / 2 + (i * h) / 4);
        c.lineTo(w / 2, h / 2);
        for (let i = 4; i >= 0; i--) c.lineTo(w / 2 + (i % 2 ? 3 : -3) * s, -h / 2 + (i * h) / 4);
        c.closePath(); const ga = c.globalAlpha; c.globalAlpha = ga * 0.85; fs(c, P[1]); c.globalAlpha = ga;
        c.restore(); return;
      }
      if (kind === 1) {                      // a price tag. for the sky.
        const lab = TAGS[sd % TAGS.length];
        c.save(); c.translate(x, y); c.rotate(Math.sin(t * 0.6 + sd) * 0.2 - 0.2);
        ln(c, -36 * s, 0, -54 * s, -20 * s);
        c.beginPath(); c.moveTo(-36 * s, 0); c.lineTo(-24 * s, -14 * s); c.lineTo(34 * s, -14 * s); c.lineTo(34 * s, 14 * s); c.lineTo(-24 * s, 14 * s); c.closePath(); fs(c, P[3]);
        ov(c, -24 * s, 0, 3 * s, 3 * s, P[0], true);
        tx(c, lab, 6 * s, 1 * s, Math.min(14, 70 / lab.length * 1.5) * s, P[5], INK.FONT);
        c.restore(); return;
      }
      if (kind === 2) {                      // a star, stapled to a string. it's a prop.
        const sw = Math.sin(t * 0.9 + sd) * 0.12;
        c.save(); c.translate(x, y - 120 * s); c.rotate(sw);
        ln(c, 0, 0, 0, 120 * s - 26 * s);
        star5(c, 0, 120 * s, 26 * s, P[2], sd);
        const lw = c.lineWidth; c.lineWidth = lw * 1.3; c.strokeStyle = "#8a8a9a";
        ln(c, -6 * s, 112 * s, 4 * s, 110 * s); ln(c, -3 * s, 126 * s, 7 * s, 124 * s);
        c.lineWidth = lw; c.strokeStyle = P.i;
        c.restore(); return;
      }
      if (kind === 3) {                      // a sandbag on a rope
        ln(c, x, y - 140 * s, x, y - 18 * s);
        bl(c, x, y, 20 * s, 22 * s, P[4], sd, 0.08);
        tx(c, "SAND", x, y + 4 * s, 10 * s, P[1], INK.FONT); return;
      }
      c.save(); c.translate(x, y); c.rotate(-0.12 + (hr(sd, 3) - 0.5) * 0.1);
      const ga = c.globalAlpha; c.globalAlpha = ga * 0.7;
      tx(c, "THIS SIDE UP", 0, 0, 20 * s, P[5], INK.FONT);
      c.strokeStyle = P[5]; arrowUp(c, -82 * s, -2 * s, 1.3 * s, null); arrowUp(c, 82 * s, -2 * s, 1.3 * s, null);
      c.globalAlpha = ga; c.restore();
    },
  };
  /* ---- wall: a light grid, giant mouse cursors, window frames, a loading spinner, a scrollbar ---- */
  function cursor(c, x, y, s, fill) {
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 44 * s); c.lineTo(x + 11 * s, y + 34 * s); c.lineTo(x + 19 * s, y + 52 * s);
    c.lineTo(x + 27 * s, y + 48 * s); c.lineTo(x + 19 * s, y + 31 * s); c.lineTo(x + 33 * s, y + 31 * s); c.closePath(); fs(c, fill);
  }
  D.wall = {
    fog: 0.5, n: [8, 6, 5],
    pal: () => ["#ffffff", "#3a7be0", "#d6d6dc", "#1d0f2b", "#ff5a5a", "#ffd23f"],
    k: [[4, 4, 2], [0, 1, 2, 3], [0, 1, 2]],
    bg(c, z, W, H, alt, t, a, name) {
      const P = PAL(name, z, 0), st = 40, oy = (alt * GAP * 0.3) % (st * 5);
      c.strokeStyle = P[1]; c.lineWidth = 1;
      for (let i = -5; i * st < H + st * 5; i++) {
        const y = oy + i * st; c.globalAlpha = a * (i % 5 ? 0.07 : 0.16); ln(c, 0, y, W, y);
      }
      for (let i = 0; i * st < W; i++) { const x = (W / 2 + i * st) % W; c.globalAlpha = a * (i % 5 ? 0.07 : 0.16); ln(c, x, 0, x, H); }
      // the scrollbar of the universe. you are near the bottom.
      const n1 = ECON.zoneAt(z.k + 1), f = U.clamp((alt - z.at) / Math.max(1, n1 - z.at), 0, 1);
      const tx0 = W - 20, th = Math.max(50, H * 0.12), ty = 30 + (1 - f) * (H - 60 - th);
      c.globalAlpha = a * 0.75; c.strokeStyle = P.i; c.lineWidth = 2;
      rr(c, tx0 - 8, 8, 16, H - 16, 8); fs(c, P[2]);
      rr(c, tx0 - 6, ty, 12, th, 6); fs(c, P[0]);
      for (let i = -1; i <= 1; i++) ln(c, tx0 - 3, ty + th / 2 + i * 5, tx0 + 3, ty + th / 2 + i * 5);
    },
    item(c, kind, x, y, s, sd, t, P) {
      if (kind === 0 || kind === 4) {        // giant mouse cursor. it occasionally clicks on nothing.
        const ck = (t * 0.4 + hr(sd, 1)) % 1, pr = ck < 0.06 ? 0.9 : 1;
        if (kind === 0 && ck < 0.25) { const ga = c.globalAlpha; c.globalAlpha = ga * (1 - ck * 4); ov(c, x, y, 12 * s + ck * 120 * s, 12 * s + ck * 120 * s, null, true); c.globalAlpha = ga; }
        c.save(); c.translate(x, y); c.rotate(Math.sin(t * 0.3 + sd) * 0.15); c.scale(pr, pr);
        cursor(c, 0, 0, s * (kind === 4 ? 0.6 : 1.2), P[0]); c.restore(); return;
      }
      if (kind === 1) {                      // a window. it wants to know if you're sure.
        const w = 150 * s, h = 92 * s;
        c.save(); c.translate(x - w / 2, y - h / 2);
        rr(c, 0, 0, w, h, 5 * s); fs(c, P[0]);
        c.fillStyle = P[1]; c.fillRect(2, 2, w - 4, 18 * s);
        c.beginPath(); c.moveTo(0, 20 * s); c.lineTo(w, 20 * s); c.stroke();
        tx(c, "untitled_sky.png", 8 * s, 11 * s, 10 * s, P.w, INK.FONT, "left");
        rr(c, w - 18 * s, 4 * s, 14 * s, 12 * s, 2); fs(c, P[4]);
        tx(c, "Are you sure you", w / 2, 38 * s, 11 * s, P.k, INK.HAND, "center", "bold ");
        tx(c, "want to go up?", w / 2, 52 * s, 11 * s, P.k, INK.HAND, "center", "bold ");
        rr(c, w * 0.12, 64 * s, w * 0.34, 18 * s, 4 * s); fs(c, P[2]); tx(c, "UP", w * 0.29, 73 * s, 10 * s, P.k, INK.FONT);
        rr(c, w * 0.54, 64 * s, w * 0.34, 18 * s, 4 * s); fs(c, P[2]); tx(c, "ALSO UP", w * 0.71, 73 * s, 10 * s, P.k, INK.FONT);
        c.restore(); return;
      }
      if (kind === 2) {                      // loading... forever
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU, on = ((Math.floor(t * 10) - i) % 8 + 8) % 8, ga = c.globalAlpha;
          c.globalAlpha = ga * (1 - on / 9);
          ov(c, x + Math.cos(a) * 22 * s, y + Math.sin(a) * 22 * s, 5 * s, 5 * s, P[1], false);
          c.globalAlpha = ga;
        }
        return;
      }
      rr(c, x - 70 * s, y - 15 * s, 140 * s, 30 * s, 15 * s); fs(c, P[0]);       // search box with a blinking caret
      tx(c, "search the sky...", x - 56 * s, y, 12 * s, P[2], INK.HAND, "left", "bold ");
      if (Math.sin(t * 5 + sd) > 0) ln(c, x + 54 * s, y - 9 * s, x + 54 * s, y + 9 * s);
    },
  };
  /* =================== PROCEDURAL SETS (coloured from the zone hue) =================== */
  function procPal(o) {
    return z => {
      // items take hues from the far side of the colour wheel so they read against the zone's sky
      const h = (z.hue || 0) + 180, dk = (z.stars || 0) > 0.5, L = dk ? 66 : 52, S = dk ? 60 : 70, hh = d => (h + d + 720) % 360;
      return [INK.hsl(hh(o[0]), S, L), INK.hsl(hh(o[1]), S - 10, L + 12), INK.hsl(hh(o[2]), S, L - 12), "#ffffff",
        INK.hsl(hh(150), S - 15, L), "#ffd23f", "#ff9eb0", "#ff9a3c", "#b5763a"];
    };
  }
  /* ---- doors: free-standing doors. some are ajar. something is behind them. ---- */
  D.doors = {
    pal: procPal([30, 200, -40]),
    k: [[3, 3, 2], [0, 1, 2], [0, 1, 0]],
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.4 + sd) * 4;
      const w = (kind === 2 ? 26 : kind === 3 ? 30 : 46) * s, h = w * 1.9;
      c.save(); c.translate(x, y); c.rotate(kind === 1 ? (hr(sd, 1) - 0.5) * 0.9 : Math.sin(t * 0.3 + sd) * 0.05);
      rr(c, -w / 2 - 5 * s, -h / 2 - 5 * s, w + 10 * s, h + 5 * s, 3); fs(c, P[1]);
      if (kind === 0 && sd % 2 === 0) {
        c.fillStyle = P.k; c.fillRect(-w / 2, -h / 2, w, h);
        eye(c, w * 0.02, -h * 0.08, 3.6 * s, P, sd, t, null); eye(c, w * 0.26, -h * 0.08, 3.6 * s, P, sd + 1, t, null);
        const op = 0.32 + 0.08 * Math.sin(t * 0.5 + sd);
        c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(-w / 2 + w * op, -h / 2 - 7 * s); c.lineTo(-w / 2 + w * op, h / 2 + 7 * s); c.lineTo(-w / 2, h / 2); c.closePath(); fs(c, P[0]);
      } else {
        rr(c, -w / 2, -h / 2, w, h, 2); fs(c, P[0]);
        if (kind !== 3) { rr(c, -w * 0.32, -h * 0.4, w * 0.64, h * 0.3, 2); c.stroke(); rr(c, -w * 0.32, -h * 0.02, w * 0.64, h * 0.36, 2); c.stroke(); }
        ov(c, w * 0.3, h * 0.04, 3 * s, 3 * s, P[5], true);
        if (kind === 1) { rr(c, -w * 0.3, -h * 0.14, w * 0.6, 12 * s, 2); fs(c, P.w); tx(c, "PULL", 0, -h * 0.14 + 6 * s, 8 * s, P.k, INK.FONT); }
        if (kind === 2) {
          rr(c, -w * 0.3, -h * 0.12, w * 0.6, 6 * s, 1); fs(c, P.k);
          ov(c, -2.5 * s, -h * 0.12 + 3 * s, 1.5 * s, 1.5 * s, P.w, false); ov(c, 2.5 * s, -h * 0.12 + 3 * s, 1.5 * s, 1.5 * s, P.w, false);
        }
      }
      c.restore();
    },
  };
  /* ---- eyes: eyeballs. with lashes. watching. ---- */
  function bigEye(c, x, y, r, P, sd, t, iris) {
    const b = blink(sd, t * 0.8);
    const lw = c.lineWidth; c.lineWidth = lw * 0.8;
    for (let i = -2; i <= 2; i++) { const a = -PI / 2 + i * 0.35; ln(c, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.9, x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.35); }
    c.lineWidth = lw;
    if (b > 0.5) { ov(c, x, y, r * 1.15, r, P[0], true); c.beginPath(); c.arc(x, y - r * 0.4, r * 1.1, 0.2 * PI, 0.8 * PI); c.stroke(); return; }
    ov(c, x, y, r * 1.15, r, P.w, true);
    const lk = look(x, y, sd, t);
    ov(c, x + lk.x * r * 0.4, y + lk.y * r * 0.3, r * 0.55, r * 0.55, iris, true);
    ov(c, x + lk.x * r * 0.46, y + lk.y * r * 0.35, r * 0.25, r * 0.25, P.k, false);
    ov(c, x + lk.x * r * 0.46 - r * 0.12, y + lk.y * r * 0.35 - r * 0.12, r * 0.09, r * 0.09, P.w, false);
  }
  D.eyes = {
    pal: procPal([0, 120, 220]),
    k: [[3, 3, 0], [0, 1, 2], [0, 1, 2]],
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.5 + sd) * 5;
      if (kind === 0) { bigEye(c, x, y, 24 * s, P, sd, t, P[sd % 3]); return; }
      if (kind === 3) { bigEye(c, x, y, 10 * s, P, sd, t, P[2]); return; }
      if (kind === 1) {
        const br = Math.sin(t * 0.7 + sd) * 4 * s, lw = c.lineWidth;
        for (let e = -1; e <= 1; e += 2) {
          bigEye(c, x + e * 26 * s, y, 15 * s, P, sd, t, P[1]);
          c.lineWidth = lw * 2; ln(c, x + e * 14 * s, y - 26 * s - br * (e > 0 ? 1 : -0.5), x + e * 38 * s, y - 30 * s - br); c.lineWidth = lw;
        }
        return;
      }
      c.beginPath(); c.moveTo(x, y + 70 * s); c.quadraticCurveTo(x + Math.sin(t * 0.8 + sd) * 20 * s, y + 30 * s, x, y + 16 * s); c.stroke();
      bl(c, x + 8 * s, y + 44 * s, 10 * s, 5 * s, P[4], sd, 0.1);
      bigEye(c, x, y, 16 * s, P, sd, t, P[0]);
    },
  };
  /* ---- stairs: staircases to nowhere, a ladder, stairs up to a tiny door ---- */
  function steps(c, x, y, n, sw, sh, P, sd) {
    const x0 = x - (n * sw) / 2, y0 = y + (n * sh) / 2, d = sw * 0.35;
    const path = (ox, oy) => {
      c.beginPath(); c.moveTo(x0 + ox, y0 + oy);
      for (let i = 0; i < n; i++) { c.lineTo(x0 + ox + i * sw, y0 + oy - (i + 1) * sh); c.lineTo(x0 + ox + (i + 1) * sw, y0 + oy - (i + 1) * sh); }
      c.lineTo(x0 + ox + n * sw, y0 + oy); c.closePath();
    };
    path(d, -d); fs(c, P[2]);
    path(0, 0); fs(c, P[0]);
  }
  D.stairs = {
    pal: procPal([20, 60, -30]),
    k: [[3, 3, 2], [0, 1, 2], [0, 1, 0]],
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.35 + sd) * 5;
      if (kind === 0 || kind === 3) {
        c.save(); c.translate(x, y); c.rotate((hr(sd, 1) - 0.5) * 0.5); if (sd % 2) c.scale(-1, 1);
        steps(c, 0, 0, kind === 3 ? 3 : 5, 18 * s, 14 * s, P, sd); c.restore(); return;
      }
      if (kind === 1) {
        steps(c, x - 10 * s, y + 10 * s, 3, 18 * s, 14 * s, P, sd);
        const dx = x + 18 * s, dy = y - 11 * s;
        rr(c, dx - 10 * s, dy - 34 * s, 20 * s, 34 * s, 3 * s); fs(c, P[1]);
        ov(c, dx + 5 * s, dy - 16 * s, 2 * s, 2 * s, P[5], true);
        return;
      }
      c.save(); c.translate(x, y); c.rotate(0.25 + Math.sin(t * 0.4 + sd) * 0.08);
      const lw = c.lineWidth; c.lineWidth = lw * 1.4;
      ln(c, -12 * s, -50 * s, -12 * s, 50 * s); ln(c, 12 * s, -50 * s, 12 * s, 50 * s);
      c.lineWidth = lw; for (let i = -3; i <= 3; i++) ln(c, -12 * s, i * 14 * s, 12 * s, i * 14 * s);
      c.restore();
    },
  };
  /* ---- spirals: hypno discs, a snail, lollipops ---- */
  function spiral(c, x, y, r, rot) {
    c.beginPath();
    for (let a = 0; a < 15; a += 0.3) { const rr2 = (a / 15) * r; c.lineTo(x + Math.cos(a + rot) * rr2, y + Math.sin(a + rot) * rr2); }
    c.stroke();
  }
  D.spirals = {
    pal: procPal([0, 90, 200]),
    k: [[3, 3, 2], [0, 1, 2], [0, 1, 2]],
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.4 + sd) * 4;
      const rot = t * (0.6 + hr(sd, 2)) * (sd % 2 ? 1 : -1);
      if (kind === 3) { spiral(c, x, y, 16 * s, rot); return; }
      if (kind === 0) { ov(c, x, y, 28 * s, 28 * s, P[0], true); spiral(c, x, y, 26 * s, rot); return; }
      if (kind === 1) {                      // a snail. it is going up too. slower.
        rr(c, x - 30 * s, y + 4 * s, 62 * s, 14 * s, 7 * s); fs(c, P[2]);
        ln(c, x + 22 * s, y + 6 * s, x + 26 * s, y - 14 * s); ln(c, x + 28 * s, y + 6 * s, x + 36 * s, y - 12 * s);
        eye(c, x + 26 * s, y - 17 * s, 4 * s, P, sd, t, null); eye(c, x + 36 * s, y - 15 * s, 4 * s, P, sd + 1, t, null);
        ov(c, x - 4 * s, y - 8 * s, 22 * s, 20 * s, P[1], true); spiral(c, x - 4 * s, y - 8 * s, 18 * s, 0.5);
        return;
      }
      ln(c, x, y + 20 * s, x, y + 66 * s);
      ov(c, x, y, 24 * s, 24 * s, P[5], true);
      const lw = c.lineWidth; c.lineWidth = lw * 2.4; c.strokeStyle = P[6]; spiral(c, x, y, 22 * s, rot); c.lineWidth = lw; c.strokeStyle = P.i;
    },
  };
  /* ---- teeth: molars with legs, chattering dentures, toothbrushes ---- */
  function tooth(c, x, y, s, P, sd, t, legs) {
    if (legs) { const k = Math.sin(t * 6 + sd) * 5 * s; ln(c, x - 7 * s, y + 20 * s, x - 9 * s + k, y + 34 * s); ln(c, x + 7 * s, y + 20 * s, x + 9 * s - k, y + 34 * s); }
    c.beginPath(); c.moveTo(x - 16 * s, y - 6 * s);
    c.quadraticCurveTo(x - 18 * s, y - 22 * s, x - 8 * s, y - 20 * s); c.quadraticCurveTo(x, y - 16 * s, x + 8 * s, y - 20 * s);
    c.quadraticCurveTo(x + 18 * s, y - 22 * s, x + 16 * s, y - 6 * s); c.quadraticCurveTo(x + 14 * s, y + 10 * s, x + 10 * s, y + 22 * s);
    c.quadraticCurveTo(x + 6 * s, y + 26 * s, x + 4 * s, y + 14 * s); c.quadraticCurveTo(x, y + 8 * s, x - 4 * s, y + 14 * s);
    c.quadraticCurveTo(x - 6 * s, y + 26 * s, x - 10 * s, y + 22 * s); c.quadraticCurveTo(x - 14 * s, y + 10 * s, x - 16 * s, y - 6 * s);
    fs(c, P[3]);
    if (legs) face(c, x, y - 4 * s, 18 * s, P, sd, t, sd % 3 === 0 ? 2 : 0);
  }
  D.teeth = {
    pal: procPal([0, 40, -30]),
    k: [[3, 3, 0], [0, 1, 2], [0, 1, 0]],
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.45 + sd) * 4;
      if (kind === 0 || kind === 3) { tooth(c, x, y, s * (kind === 3 ? 0.8 : 1.2), P, sd, t, kind === 0); return; }
      if (kind === 1) {                      // dentures, chattering about you
        const o = Math.abs(Math.sin(t * 5 + sd)) * 9 * s;
        for (let e = -1; e <= 1; e += 2) {
          const yy = y + e * (o / 2 + 6 * s);
          c.beginPath(); c.ellipse(x, yy, 30 * s, 12 * s, 0, e < 0 ? PI : 0, e < 0 ? TAU : PI); c.closePath(); fs(c, P[6]);
          for (let i = -2; i <= 2; i++) { rr(c, x + i * 10 * s - 4 * s, e < 0 ? yy - 1 * s : yy - 9 * s, 8 * s, 10 * s, 2 * s); fs(c, P[3]); }
        }
        return;
      }
      c.save(); c.translate(x, y); c.rotate(-0.6 + Math.sin(t * 0.5 + sd) * 0.2);
      rr(c, -6 * s, -10 * s, 12 * s, 66 * s, 5 * s); fs(c, P[2]);
      rr(c, -8 * s, -34 * s, 16 * s, 26 * s, 3 * s); fs(c, P[3]);
      for (let i = -1; i <= 1; i++) ln(c, i * 4 * s, -32 * s, i * 4 * s, -10 * s);
      bl(c, -12 * s, -22 * s, 7 * s, 12 * s, P[1], sd, 0.1);
      c.restore();
    },
  };
  /* ---- clocks: wall clocks (some run backwards), melting clocks, pocket watches ---- */
  function hands(c, x, y, r, sd, t) {
    const sp = (hr(sd, 4) - 0.4) * 3, a1 = t * sp * 0.08 + sd, a2 = t * sp + sd * 2, lw = c.lineWidth;
    c.lineWidth = lw * 1.3; ln(c, x, y, x + Math.sin(a1) * r * 0.5, y - Math.cos(a1) * r * 0.5);
    c.lineWidth = lw; ln(c, x, y, x + Math.sin(a2) * r * 0.8, y - Math.cos(a2) * r * 0.8);
  }
  function ticks(c, x, y, r) { for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ln(c, x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9); } }
  D.clocks = {
    pal: procPal([40, 0, 200]),
    k: [[3, 3, 2], [0, 1, 2], [0, 1, 2]],
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.4 + sd) * 4;
      if (kind === 0 || kind === 3) {
        const r = (kind === 3 ? 18 : 30) * s;
        ov(c, x, y, r + 5 * s, r + 5 * s, P[0], true); ov(c, x, y, r, r, P[1], true);
        const lw = c.lineWidth; c.lineWidth = lw * 0.6; ticks(c, x, y, r); c.lineWidth = lw;
        if (kind === 0) { eye(c, x - r * 0.4, y - r * 0.35, r * 0.17, P, sd, t, null); eye(c, x + r * 0.4, y - r * 0.35, r * 0.17, P, sd + 1, t, null); }
        hands(c, x, y, r, sd, t); return;
      }
      if (kind === 1) {                      // melting. it's fine. time is fine.
        const r = 30 * s, d = 4 * s * Math.sin(t * 0.6 + sd);
        c.beginPath(); c.arc(x, y, r, PI, TAU);
        c.quadraticCurveTo(x + r, y + r * 0.7, x + r * 0.6, y + r * 0.8); c.quadraticCurveTo(x + r * 0.45, y + r * 1.5 + d, x + r * 0.3, y + r * 0.85);
        c.quadraticCurveTo(x - r * 0.1, y + r * 1.0, x - r * 0.3, y + r * 0.8); c.quadraticCurveTo(x - r * 0.5, y + r * 1.9 + d, x - r * 0.65, y + r * 0.75);
        c.quadraticCurveTo(x - r, y + r * 0.6, x - r, y); c.closePath(); fs(c, P[1]);
        hands(c, x, y + r * 0.1, r, sd, t); return;
      }
      const sw = Math.sin(t * 1.2 + sd) * 0.3, r = 22 * s;  // pocket watch on a swinging chain
      c.save(); c.translate(x, y - 70 * s); c.rotate(sw);
      c.setLineDash([3 * s, 3 * s]); ln(c, 0, 0, 0, 70 * s - r - 6 * s); c.setLineDash([]);
      rr(c, -4 * s, 70 * s - r - 8 * s, 8 * s, 6 * s, 2); fs(c, P[5]);
      ov(c, 0, 70 * s, r, r, P[5], true); ov(c, 0, 70 * s, r * 0.8, r * 0.8, P[3], true);
      hands(c, 0, 70 * s, r * 0.8, sd, t); c.restore();
    },
  };
  /* ---- ducks: rubber ducks (all facing the stalk), ducklings, bath bubbles ---- */
  function duck(c, x, y, s, P, sd, t, hat) {
    const d = x < VW / 2 ? 1 : -1;
    c.save(); c.translate(x, y); c.scale(d, 1);
    bl(c, 0, 0, 22 * s, 14 * s, P[5], sd, 0.05);
    INK.wpoly(c, [[-18 * s, -4 * s], [-28 * s, -14 * s], [-14 * s, -10 * s]], P[5], true, sd, 0.4);
    ov(c, 12 * s, -16 * s, 11 * s, 11 * s, P[5], true);
    rr(c, 20 * s, -17 * s, 12 * s, 6 * s, 3 * s); fs(c, P[7]);
    c.beginPath(); c.arc(-2 * s, 0, 9 * s, 0.1 * PI, 0.9 * PI); c.stroke();
    ov(c, 15 * s, -19 * s, 2.4 * s, 2.4 * s, P.k, false);
    if (hat) { rr(c, 4 * s, -36 * s, 14 * s, 10 * s, 1); fs(c, P.k); rr(c, 1 * s, -27 * s, 20 * s, 3 * s, 1); fs(c, P.k); }
    c.restore();
  }
  D.ducks = {
    pal: procPal([0, 180, 200]),
    k: [[3, 3, 2], [0, 1, 2], [0, 1, 0]],
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 1.1 + sd) * 4;
      if (kind === 0 || kind === 3) { duck(c, x, y, s * (kind === 3 ? 0.8 : 1.3), P, sd, t, kind === 0 && sd % 3 === 0); return; }
      if (kind === 1) {
        const d = x < VW / 2 ? 1 : -1;
        for (let i = 0; i < 3; i++) duck(c, x - d * i * 30 * s, y + Math.sin(t * 2 + i) * 2 * s, s * (i ? 0.6 : 0.9), P, sd + i, t, false);
        return;
      }
      for (let i = 0; i < 4; i++) {
        const bx = x + (hr(sd, i) - 0.5) * 50 * s, by = y + (hr(sd, i + 4) - 0.5) * 40 * s - ((t * 6 + i * 13) % 20) * s, r = (6 + 7 * hr(sd, i + 8)) * s;
        ov(c, bx, by, r, r, null, true); c.beginPath(); c.arc(bx, by, r * 0.6, 1.1 * PI, 1.4 * PI); c.stroke();
      }
    },
  };
  /* ---- chairs: armchairs (something lives in the cushions), wooden chairs, spinning stools ---- */
  D.chairs = {
    pal: procPal([0, 30, -40]),
    k: [[3, 3, 2], [0, 1, 2], [0, 1, 0]],
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.35 + sd) * 4;
      if (kind === 0 || kind === 3) {
        const k = kind === 3 ? 0.7 : 1;
        c.save(); c.translate(x, y); c.rotate(Math.sin(t * 0.25 + sd) * 0.1); c.scale(s * k, s * k);
        c.lineWidth = 2.5;
        rr(c, -26, -40, 52, 46, 12); fs(c, P[0]);
        rr(c, -36, -10, 16, 32, 7); fs(c, P[2]); rr(c, 20, -10, 16, 32, 7); fs(c, P[2]);
        if (kind === 0 && sd % 2) { c.fillStyle = P.k; c.fillRect(-20, -2, 40, 5); ov(c, -6, 0, 2.2, 2.2, P.w, false); ov(c, 4, 0, 2.2, 2.2, P.w, false); }
        rr(c, -22, 2, 44, 14, 6); fs(c, P[1]);
        ln(c, -28, 22, -30, 32); ln(c, 28, 22, 30, 32);
        if (kind === 0) { bl(c, 0, -30, 10, 6, P.w, sd, 0.15); }
        c.restore(); return;
      }
      if (kind === 1) {
        c.save(); c.translate(x, y); c.rotate((hr(sd, 1) - 0.5) * 1.2);
        for (let i = -1; i <= 1; i++) ln(c, i * 8 * s, -44 * s, i * 8 * s, -6 * s);
        rr(c, -16 * s, -50 * s, 32 * s, 8 * s, 2); fs(c, P[2]);
        rr(c, -18 * s, -6 * s, 36 * s, 8 * s, 2); fs(c, P[2]);
        ln(c, -15 * s, 2 * s, -16 * s, 30 * s); ln(c, 15 * s, 2 * s, 16 * s, 30 * s);
        c.restore(); return;
      }
      const sp = Math.cos(t * 2 + sd);         // spinning stool
      ln(c, x, y, x - 14 * s, y + 34 * s); ln(c, x, y, x + 14 * s, y + 34 * s); ln(c, x, y, x + sp * 6 * s, y + 36 * s);
      ov(c, x, y - 2 * s, 22 * s, 7 * s, P[0], true);
      ov(c, x + sp * 12 * s, y - 3 * s, 3 * s, 2 * s, P[5], false);
    },
  };
  /* ---- hands: waving hands, hands pointing UP, thumbs up. encouraging, in an unsettling way ---- */
  function hand(c, x, y, s, rot, pose, P) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.lineWidth = 2.5;
    if (pose === 0) {
      for (let i = 0; i < 4; i++) { rr(c, -12 + i * 6.2, -30 + Math.abs(i - 1.5) * 3, 6, 22, 3); fs(c, P[0]); }
      c.save(); c.translate(-12, -2); c.rotate(-0.7); rr(c, -3, -16, 6, 16, 3); fs(c, P[0]); c.restore();
    } else if (pose === 1) {
      rr(c, -10, -38, 7, 30, 3.5); fs(c, P[0]);
      for (let i = 1; i < 4; i++) { rr(c, -10 + i * 6.5, -16, 6.5, 10, 3); fs(c, P[0]); }
    } else {
      rr(c, -12, -34, 8, 24, 4); fs(c, P[0]);
      for (let i = 0; i < 4; i++) { rr(c, 6, -12 + i * 6.5, 12, 6.5, 3); fs(c, P[0]); }
    }
    rr(c, -13, -14, 26, 26, 9); fs(c, P[0]);
    rr(c, -12, 10, 24, 10, 2); fs(c, P[3]);
    c.restore();
  }
  D.hands = {
    pal: procPal([25, 0, 200]),
    k: [[3, 3, 1], [0, 1, 2], [0, 1, 2]],
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.4 + sd) * 4;
      if (kind === 0 || kind === 3) { hand(c, x, y, s * (kind === 3 ? 0.9 : 1.4), Math.sin(t * 3 + sd) * 0.35, 0, P); return; }
      if (kind === 1) { hand(c, x, y, s * 1.4, Math.sin(t * 0.8 + sd) * 0.08, 1, P); return; }
      hand(c, x, y, s * 1.4, Math.sin(t * 0.6 + sd) * 0.12, 2, P);
    },
  };
  /* ---- jellies: wobbling jelly moulds with faces, jellyfish, gummy bears ---- */
  D.jellies = {
    pal: procPal([0, 60, 300]),
    k: [[3, 3, 1], [0, 1, 2], [0, 1, 2]],
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.5 + sd) * 5;
      const ga = c.globalAlpha, wb = Math.sin(t * 5 + sd) * 0.07;
      if (kind === 0) {
        ov(c, x, y + 14 * s, 34 * s, 6 * s, P.w, true);
        c.save(); c.translate(x, y + 12 * s); c.scale(1 + wb, 1 - wb);
        c.globalAlpha = ga * 0.85; rr(c, -24 * s, -40 * s, 48 * s, 40 * s, 16 * s); fs(c, P[0]); c.globalAlpha = ga;
        for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 12 * s, -38 * s); c.quadraticCurveTo(i * 15 * s, -20 * s, i * 12 * s, -2 * s); c.stroke(); }
        ov(c, -14 * s, -30 * s, 4 * s, 7 * s, P.w, false);
        face(c, 0, -18 * s, 26 * s, P, sd, t, 4);
        c.restore(); return;
      }
      if (kind === 1) {                      // jellyfish
        const lw = c.lineWidth; c.lineWidth = lw * 0.8;
        for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * 7 * s, y); for (let k = 1; k <= 5; k++) c.lineTo(x + i * 7 * s + Math.sin(t * 2 + k + i + sd) * 4 * s, y + k * 9 * s); c.stroke(); }
        c.lineWidth = lw;
        c.globalAlpha = ga * 0.85;
        c.beginPath(); c.arc(x, y, 24 * s * (1 + wb), PI, TAU);
        for (let i = 0; i < 4; i++) c.quadraticCurveTo(x + (18 - i * 12) * s, y + 7 * s, x + (12 - i * 12) * s, y);
        c.closePath(); fs(c, P[1]); c.globalAlpha = ga;
        face(c, x, y - 9 * s, 22 * s, P, sd, t, 0); return;
      }
      c.globalAlpha = ga * 0.85;           // gummy bear (or the far little blobs)
      const k = kind === 3 ? 0.7 : 1, col = P[sd % 3];
      ov(c, x - 9 * k * s, y + 24 * k * s, 7 * k * s, 6 * k * s, col, true); ov(c, x + 9 * k * s, y + 24 * k * s, 7 * k * s, 6 * k * s, col, true);
      ov(c, x, y + 10 * k * s, 15 * k * s, 16 * k * s, col, true);
      ov(c, x - 9 * k * s, y - 14 * k * s, 5 * k * s, 5 * k * s, col, true); ov(c, x + 9 * k * s, y - 14 * k * s, 5 * k * s, 5 * k * s, col, true);
      ov(c, x, y - 5 * k * s, 12 * k * s, 11 * k * s, col, true);
      c.globalAlpha = ga;
      ov(c, x - 4 * k * s, y - 6 * k * s, 1.6 * k * s, 1.6 * k * s, P.k, false); ov(c, x + 4 * k * s, y - 6 * k * s, 1.6 * k * s, 1.6 * k * s, P.k, false);
    },
  };
  /* ---- keys: skeleton keys, keyholes with something looking through, jingly keyrings ---- */
  function key(c, x, y, s, rot, P) {
    c.save(); c.translate(x, y); c.rotate(rot);
    rr(c, 8 * s, -3 * s, 44 * s, 6 * s, 2 * s); fs(c, P[5]);
    rr(c, 40 * s, 2 * s, 5 * s, 9 * s, 1); fs(c, P[5]); rr(c, 47 * s, 2 * s, 5 * s, 6 * s, 1); fs(c, P[5]);
    ov(c, 0, 0, 13 * s, 13 * s, P[5], true); ov(c, 0, 0, 5.5 * s, 5.5 * s, P.fog, true);
    c.restore();
  }
  D.keys = {
    pal: procPal([0, 200, 30]),
    k: [[3, 3, 1], [0, 1, 2], [0, 1, 2]],
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.45 + sd) * 4;
      if (kind === 0 || kind === 3) { key(c, x - 20 * s, y, s * (kind === 3 ? 0.8 : 1.2), t * 0.25 * (sd % 2 ? 1 : -1) + sd, P); return; }
      if (kind === 1) {                      // keyhole. something on the other side is looking at the stalk.
        rr(c, x - 22 * s, y - 34 * s, 44 * s, 68 * s, 6 * s); fs(c, P[1]);
        ov(c, x - 15 * s, y - 27 * s, 2 * s, 2 * s, P.k, false); ov(c, x + 15 * s, y + 27 * s, 2 * s, 2 * s, P.k, false);
        c.beginPath(); c.arc(x, y - 8 * s, 11 * s, 0.75 * PI, 2.25 * PI); c.lineTo(x + 7 * s, y + 20 * s); c.lineTo(x - 7 * s, y + 20 * s); c.closePath(); fs(c, P.k);
        if (blink(sd, t) < 0.5) { const lk = look(x, y, sd, t); ov(c, x, y - 8 * s, 6 * s, 6 * s, P.w, false); ov(c, x + lk.x * 2.5 * s, y - 8 * s + lk.y * 2.5 * s, 3 * s, 3 * s, P.k, false); }
        return;
      }
      const sw = Math.sin(t * 1.5 + sd) * 0.25;
      c.lineWidth *= 1.3; ov(c, x, y, 14 * s, 14 * s, null, true); c.lineWidth /= 1.3;
      for (let i = -1; i <= 1; i++) key(c, x + Math.sin(i * 0.6 + sw) * 12 * s, y + Math.cos(i * 0.6 + sw) * 12 * s, s * 0.75, PI / 2 + i * 0.6 + sw, P);
    },
  };
  /* ---- teacups: cups with faces, a teapot pouring into nothing, nervous sugar cubes ---- */
  function cup(c, x, y, s, P, sd, t, fc) {
    const lw = c.lineWidth;
    for (let i = 0; i < 2; i++) { const p = (t * 0.4 + i / 2 + hr(sd, i)) % 1; c.beginPath(); c.moveTo(x - 5 * s + i * 10 * s, y - 14 * s - p * 16 * s); c.quadraticCurveTo(x + i * 10 * s, y - 20 * s - p * 16 * s, x - 5 * s + i * 10 * s, y - 26 * s - p * 16 * s); c.stroke(); }
    ov(c, x, y + 14 * s, 30 * s, 6 * s, P[1], true);
    c.beginPath(); c.arc(x + 20 * s, y, 7 * s, -PI / 2, PI / 2); c.lineWidth = lw * 1.8; c.stroke(); c.lineWidth = lw;
    c.beginPath(); c.moveTo(x - 20 * s, y - 10 * s); c.lineTo(x + 20 * s, y - 10 * s); c.quadraticCurveTo(x + 19 * s, y + 13 * s, x, y + 13 * s); c.quadraticCurveTo(x - 19 * s, y + 13 * s, x - 20 * s, y - 10 * s); fs(c, P[0]);
    ov(c, x, y - 10 * s, 20 * s, 4 * s, P[8], true);
    if (fc) face(c, x, y + 1 * s, 18 * s, P, sd, t, 3);
  }
  D.teacups = {
    pal: procPal([0, 160, 40]),
    k: [[3, 3, 2], [0, 1, 2], [0, 1, 2]],
    item(c, kind, x, y, s, sd, t, P) {
      y += Math.sin(t * 0.4 + sd) * 4;
      if (kind === 0 || kind === 3) { cup(c, x, y, s * (kind === 3 ? 0.9 : 1.3), P, sd, t, kind === 0); return; }
      if (kind === 1) {                      // teapot, pouring into nothing, very carefully
        const lw = c.lineWidth; c.strokeStyle = P[8]; c.lineWidth = lw * 1.6;
        c.beginPath(); c.moveTo(x + 36 * s, y - 6 * s); c.quadraticCurveTo(x + 48 * s, y + 10 * s, x + 46 * s, y + 60 * s); c.stroke();
        c.strokeStyle = P.i; c.lineWidth = lw;
        c.save(); c.translate(x, y); c.rotate(0.35);
        c.beginPath(); c.moveTo(18 * s, 0); c.quadraticCurveTo(32 * s, -4 * s, 38 * s, -18 * s); c.lineTo(32 * s, -20 * s); c.quadraticCurveTo(26 * s, -10 * s, 14 * s, -10 * s); c.closePath(); fs(c, P[2]);
        c.beginPath(); c.arc(-24 * s, -2 * s, 10 * s, 0.5 * PI, 1.5 * PI); c.lineWidth = lw * 1.8; c.stroke(); c.lineWidth = lw;
        bl(c, 0, 0, 26 * s, 20 * s, P[2], sd, 0.04);
        ov(c, 0, -20 * s, 12 * s, 4 * s, P[1], true); ov(c, 0, -26 * s, 3.5 * s, 3.5 * s, P[1], true);
        face(c, -2 * s, 0, 20 * s, P, sd, t, 0);
        c.restore(); return;
      }
      c.save(); c.translate(x, y); c.rotate(Math.sin(t * 0.7 + sd) * 0.2);   // sugar cube. it knows.
      rr(c, -15 * s, -15 * s, 30 * s, 30 * s, 4 * s); fs(c, P[3]);
      face(c, 0, -2 * s, 20 * s, P, sd, t, 4);
      c.restore();
      spark(c, x + 18 * s, y - 18 * s, (3 + 2 * Math.sin(t * 3 + sd)) * s, P[5]);
    },
  };
  /* every procedural layer gets one GIANT, faint, very slow version of its signature object far away
     (a huge eye that watches the stalk, a door the size of a building, a clock with hands like rivers) */
  function giant(c, z, W, H, alt, t, a, name) {
    const P = PAL(name, z, 0), s = Math.min(W, H) / 150, x = W * (z.k % 2 ? 0.8 : 0.2);
    const y = H * 0.32 + (alt - z.at) * GAP * 0.03;
    if (y > H + s * 80) return;
    c.globalAlpha = a * 0.3; c.lineWidth = 2.5 * s * 0.45; c.strokeStyle = P.i;
    D[name].item(c, 0, x, y, s, 4242 + z.k * 2, t * 0.6, P, 0, W, H);
  }
  for (const n of DATA.PROC.decor) if (D[n] && !D[n].bg) D[n].bg = (c, z, W, H, alt, t, a) => giant(c, z, W, H, alt, t, a, n);
  /* =================== API =================== */
  return {
    sky, ground, landmarks, overlay,
    sets: Object.keys(D),                    // every decor set name (story + procedural)
    hasSet: n => !!D[n],
    /* drop cached gradients/patterns/palettes (e.g. after a canvas context is recreated) */
    reset() { C.sky.clear(); C.pal.clear(); C.fog.clear(); C.str.clear(); C.pat = {}; C.grad = {}; },
  };
})();
