/* Gerald Wants Up — DRAW: every character and prop, inked procedurally.
   Thick dark ink outlines, flat fills + one darker shade, boiling lines (INK.j), googly eyes that
   follow the cursor. Every function draws centred at the current origin. No gradients, no offscreen
   canvases, nothing rebuilt per frame except paths. Safe when G is undefined (previews, cutscenes). */
const DRAW = {
  _Z: { x: 0, y: 0 },
  _cs: {},
  _st: {},
  _eo: {},
  _eo2: {},
  _A: {},
  _G() { return typeof G !== "undefined" && G ? G : null; },
  _ink(ctx, lw) { ctx.strokeStyle = INK.C.ink; ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.lineCap = "round"; },
  /* cached colour strings */
  _sh(c, a) { const k = c + a; return DRAW._cs[k] || (DRAW._cs[k] = INK.shade(c, a)); },
  _ca(c, a) { const k = c + "@" + a; return DRAW._cs[k] || (DRAW._cs[k] = INK.rgba(c, a)); },
  _mx(a, b, t) { const k = a + b + t; return DRAW._cs[k] || (DRAW._cs[k] = INK.mix(a, b, t)); },
  _hs(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 9973; },
  _pop(t) { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  /* quick blink every few seconds, phase + period from seed */
  _blink(t, seed) {
    const s = Math.abs(seed | 0), per = 2.6 + (s % 17) * 0.19, ph = (t + (s % 101) * 0.61) % per;
    return ph < 0.18 ? Math.sin((ph / 0.18) * Math.PI) : 0;
  },
  /* unit-ish vector (local axes) from local point (x,y) toward the mouse */
  _look(ctx, x, y) {
    const g = DRAW._G();
    if (!g || !g.mouse || !ctx.getTransform) return DRAW._Z;
    const m = ctx.getTransform(), k = g.W ? ctx.canvas.width / g.W : 1;
    const dx = g.mouse.x * k - (m.a * x + m.c * y + m.e), dy = g.mouse.y * k - (m.b * x + m.d * y + m.f);
    const det = m.a * m.d - m.b * m.c || 1;
    const lx = (m.d * dx - m.c * dy) / det, ly = (m.a * dy - m.b * dx) / det, d = Math.hypot(lx, ly) || 1;
    const s = Math.min(1, d / 70) / d;
    return { x: lx * s, y: ly * s };
  },
  /* filled blob with a darker lower-right shade, outline and a little shine */
  _body(ctx, x, y, rx, ry, col, seed, amt, hi) {
    amt = amt == null ? 0.06 : amt;
    INK.blobPath(ctx, x, y, rx, ry, seed, amt); ctx.fillStyle = DRAW._sh(col, -0.24); ctx.fill();
    INK.blobPath(ctx, x - rx * 0.09, y - ry * 0.11, rx * 0.87, ry * 0.85, seed, amt); ctx.fillStyle = col; ctx.fill();
    INK.blobPath(ctx, x, y, rx, ry, seed, amt); ctx.stroke();
    if (hi !== false) INK.oval(ctx, x - rx * 0.42, y - ry * 0.52, rx * 0.17, ry * 0.11, "rgba(255,255,255,0.6)");
  },
  /* same idea for any path builder fn(ctx): shade, inset main colour, outline */
  _inset(ctx, fn, col, cx, cy, k) {
    k = k || 0.88;
    fn(ctx); ctx.fillStyle = DRAW._sh(col, -0.24); ctx.fill();
    ctx.save(); ctx.translate(cx * (1 - k) - 1.8, cy * (1 - k) - 2.2); ctx.scale(k, k);
    fn(ctx); ctx.fillStyle = col; ctx.fill(); ctx.restore();
    fn(ctx); ctx.stroke();
  },
  /* green stem: ink stroke under a coloured stroke */
  _stem(ctx, x0, y0, cx, cy, x1, y1, w, col) {
    w = w || 5;
    const lw = ctx.lineWidth;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.lineWidth = w + 5; ctx.stroke();
    ctx.strokeStyle = col || INK.C.leaf; ctx.lineWidth = w; ctx.stroke();
    ctx.strokeStyle = INK.C.ink; ctx.lineWidth = lw;
  },
  /* leaf from base (x,y) pointing at angle a, length L, two-tone */
  _leaf(ctx, x, y, a, L, col, seed) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    const w = L * 0.36, j1 = INK.j(seed, 1) * 0.8, j2 = INK.j(seed, 2) * 0.8;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * 0.4, -w + j1, L, 0); ctx.quadraticCurveTo(L * 0.45, w + j2, 0, 0);
    ctx.fillStyle = col || INK.C.leaf; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * 0.45, w + j2, L, 0); ctx.closePath();
    ctx.fillStyle = col ? DRAW._sh(col, -0.25) : INK.C.leafD; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * 0.4, -w + j1, L, 0); ctx.quadraticCurveTo(L * 0.45, w + j2, 0, 0);
    ctx.stroke();
    ctx.restore();
  },
  /* ---------- faces ---------- */
  _E1: [[0, 0, 1.3]],
  _E2: [[-6.6, 0, 1.06], [6.6, -0.6, 0.92]],
  _E3: [[-8.4, 1.2, 0.95], [8.4, 1, 0.88], [0, -6.4, 0.78]],
  /* plant face centred (x,y), scale s (1 = ~30 px wide); hw = head half width, top = head top y, lid = lid colour */
  _face(ctx, p, st, x, y, s, hw, top, lid) {
    const n = p.eyes === 1 || p.eyes === 3 ? p.eyes : 2, E = n === 1 ? DRAW._E1 : n === 3 ? DRAW._E3 : DRAW._E2;
    const shock = st.shock, sad = st.sad, lw = ctx.lineWidth;
    /* undo the plant's tall/squat aspect around the face so googly eyes stay round */
    const fxa = st.fax || 1, fya = st.fay || 1, fixA = fxa !== 1 || fya !== 1;
    if (fixA) { ctx.save(); ctx.translate(x, y); ctx.scale(fxa, fya); ctx.translate(-x, -y); }
    if (st.v && st.v.blush && !shock) { INK.oval(ctx, x - 9.6 * s, y + 4.4 * s, 3.7 * s, 2.1 * s, "rgba(255,105,160,0.42)"); INK.oval(ctx, x + 9.6 * s, y + 4.2 * s, 3.7 * s, 2.1 * s, "rgba(255,105,160,0.42)"); }
    let style = p.eyeStyle || "round";
    if (shock) style = "wide"; else if (sad && style !== "spiral") style = "sleepy";
    const eo = DRAW._eo; eo.blink = shock ? 0 : st.blink; eo.style = style; eo.lid = lid; eo.pupil = shock ? 0.22 : 0;
    const ey = y - 3 * s, er = 5.4 * s * (shock ? 1.18 : 1);
    for (let i = 0; i < n; i++) INK.eye(ctx, x + E[i][0] * s, ey + E[i][1] * s, er * E[i][2], st.look, eo);
    if ((shock || sad) && p.acc !== "unibrow") {
      ctx.lineWidth = Math.max(1.6, 2.2 * s); ctx.beginPath();
      for (let i = 0; i < Math.min(2, n); i++) {
        const ex = x + E[i][0] * s, by = ey + E[i][1] * s - er * E[i][2] - 2.2 * s, sg = i ? 1 : -1;
        if (shock) { ctx.moveTo(ex - 3.5 * s, by - 1.5 * s); ctx.quadraticCurveTo(ex, by - 5 * s, ex + 3.5 * s, by - 1.5 * s); }
        else { ctx.moveTo(ex + sg * 4 * s, by + 1.5 * s); ctx.lineTo(ex - sg * 3 * s, by - 2 * s); }
      }
      ctx.stroke(); ctx.lineWidth = lw;
    }
    let mk = p.mouth || "smile";
    if (shock) mk = "O"; else if (sad) mk = "sad";
    DRAW._mouth(ctx, x, y + 7.4 * s, s, mk, st.talk ? Math.abs(Math.sin(st.t * 15 + st.seed)) : 0);
    if (p.acc && p.acc !== "none") DRAW._acc(ctx, p.acc, x, y, s, hw, top, E, n, ey, er, shock);
    if (sad) {
      const ty = ey + er + ((st.t * 14) % 12) * s, tx = x + E[0][0] * s;
      INK.oval(ctx, tx, ty, 1.8 * s, 2.6 * s, "#8fd3ff", true);
    }
    if (fixA) ctx.restore();
  },
  _mouth(ctx, x, y, s, mk, open) {
    const lw = ctx.lineWidth, K = INK.C;
    ctx.lineWidth = Math.max(1.6, 2.4 * s);
    if (open > 0.15 && mk !== "O") {
      INK.oval(ctx, x, y, 3.8 * s, (1 + open * 3.4) * s, K.ink);
      INK.oval(ctx, x, y + open * 1.8 * s, 2.3 * s, open * 1.4 * s + 0.3, K.pink);
      ctx.lineWidth = lw; return;
    }
    ctx.beginPath();
    switch (mk) {
      case "flat": INK.wline(ctx, [[x - 5 * s, y], [x, y + 0.7 * s], [x + 5 * s, y - 0.5 * s]], 41, 0.5 * s); break;
      case "o": INK.oval(ctx, x, y + 0.5 * s, 2.5 * s, 3.1 * s, K.ink); break;
      case "O":
        INK.oval(ctx, x, y + s, 4.2 * s, 5.4 * s, K.ink);
        INK.oval(ctx, x, y + 3.8 * s, 2.7 * s, 1.8 * s, K.pink); break;
      case "teeth":
        ctx.moveTo(x - 6.5 * s, y - 1.5 * s); ctx.quadraticCurveTo(x, y + 10 * s, x + 6.5 * s, y - 1.5 * s); ctx.closePath();
        ctx.fillStyle = K.ink; ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillRect(x - 4.6 * s, y - 1.5 * s, 9.2 * s, 2.6 * s);
        ctx.beginPath(); ctx.moveTo(x - 6.5 * s, y - 1.5 * s); ctx.quadraticCurveTo(x, y + 10 * s, x + 6.5 * s, y - 1.5 * s); ctx.closePath();
        ctx.stroke(); break;
      case "tongue":
        INK.oval(ctx, x + 2 * s, y + 3.4 * s, 2.5 * s, 3.2 * s, K.pink, true);
        ctx.beginPath(); ctx.arc(x, y - 3 * s, 5.5 * s, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); break;
      case "wobbly":
        INK.wline(ctx, [[x - 6 * s, y], [x - 3 * s, y - 1.6 * s], [x, y + 0.8 * s], [x + 3 * s, y - 1.6 * s], [x + 6 * s, y]], 43, 0.4 * s); break;
      case "sad": ctx.arc(x, y + 4.5 * s, 5 * s, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke(); break;
      default: ctx.arc(x, y - 3 * s, 5.5 * s, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    }
    ctx.lineWidth = lw;
  },
  /* plant accessories */
  _acc(ctx, a, x, y, s, hw, top, E, n, ey, er, shock) {
    const K = INK.C, lw = ctx.lineWidth;
    ctx.lineWidth = Math.max(1.6, 2.3 * s);
    switch (a) {
      case "tophat": {
        ctx.save(); ctx.translate(x + hw * 0.22, top + 1 - (shock ? 7 * s : 0)); ctx.rotate(shock ? -0.35 : 0.22);
        INK.wpoly(ctx, [[-6 * s, 0], [-5.5 * s, -13 * s], [5.5 * s, -13 * s], [6 * s, 0]], "#2e2140", true, 4, 0.5);
        INK.wpoly(ctx, [[-6 * s, -4.5 * s], [6 * s, -4.5 * s], [6 * s, -1.5 * s], [-6 * s, -1.5 * s]], K.red, false, 5, 0.3);
        INK.oval(ctx, 0, 0, 10.5 * s, 2.6 * s, "#2e2140", true);
        ctx.restore(); break;
      }
      case "bow": {
        const bx = x + hw * 0.72, by = top + hw * 0.32;
        INK.wpoly(ctx, [[bx, by], [bx - 7 * s, by - 5 * s], [bx - 7 * s, by + 5 * s]], K.pink, true, 6, 0.5);
        INK.wpoly(ctx, [[bx, by], [bx + 7 * s, by - 5 * s], [bx + 7 * s, by + 5 * s]], K.pink, true, 7, 0.5);
        INK.oval(ctx, bx, by, 2.4 * s, 2.4 * s, "#ff4f9a", true); break;
      }
      case "glasses": case "monocle": {
        const m = a === "monocle";
        ctx.beginPath();
        for (let i = m ? n - 1 : 0; i < (m ? n : Math.min(2, n)); i++) {
          const ex = x + E[i][0] * s, eyy = ey + E[i][1] * s, rr = er * E[i][2] + 2 * s;
          ctx.moveTo(ex + rr, eyy); ctx.arc(ex, eyy, rr, 0, Math.PI * 2);
        }
        ctx.fillStyle = "rgba(200,240,255,0.18)"; ctx.fill(); ctx.stroke();
        if (m) {
          const i = n - 1, ex = x + E[i][0] * s + er * E[i][2] + 2 * s, eyy = ey + E[i][1] * s;
          ctx.strokeStyle = K.gold; ctx.lineWidth = Math.max(1, 1.2 * s); ctx.beginPath();
          ctx.moveTo(ex, eyy); ctx.quadraticCurveTo(ex + 3 * s, eyy + 8 * s, ex + 1 * s, eyy + 14 * s); ctx.stroke();
          ctx.strokeStyle = K.ink;
        } else if (n > 1) {
          ctx.beginPath(); ctx.moveTo(x + E[0][0] * s + er * E[0][2] + 2 * s, ey); ctx.lineTo(x + E[1][0] * s - er * E[1][2] - 2 * s, ey); ctx.stroke();
        }
        break;
      }
      case "mustache": {
        const my = y + 4.6 * s;
        ctx.beginPath();
        ctx.ellipse(x - 3.6 * s, my, 4.4 * s, 1.9 * s, -0.3, 0, Math.PI * 2);
        ctx.moveTo(x + 8 * s, my); ctx.ellipse(x + 3.6 * s, my, 4.4 * s, 1.9 * s, 0.3, 0, Math.PI * 2);
        ctx.fillStyle = "#4a2e1f"; ctx.fill(); ctx.stroke(); break;
      }
      case "unibrow": {
        const by = ey - er * 1.45 - (shock ? 4 * s : 0);
        ctx.lineWidth = 3.6 * s;
        INK.wline(ctx, [[x - hw * 0.62, by + 1.5 * s], [x - hw * 0.2, by - 1 * s], [x, by + 0.8 * s], [x + hw * 0.22, by - 1 * s], [x + hw * 0.62, by + 1.5 * s]], 51, 0.6 * s);
        break;
      }
      case "flower": {
        const fx = x - hw * 0.74, fy = top + hw * 0.24;
        for (let k = 0; k < 5; k++) { const q = k * 1.2566 + 0.3; INK.oval(ctx, fx + Math.cos(q) * 3.4 * s, fy + Math.sin(q) * 3.4 * s, 2.7 * s, 2.7 * s, "#fff", true); }
        INK.oval(ctx, fx, fy, 2.2 * s, 2.2 * s, K.gold, true); break;
      }
      case "bandaid": {
        ctx.save(); ctx.translate(x + hw * 0.5, y + 3.2 * s); ctx.rotate(-0.55);
        INK.wpoly(ctx, [[-6 * s, -2.2 * s], [6 * s, -2.2 * s], [6 * s, 2.2 * s], [-6 * s, 2.2 * s]], "#f2c79b", true, 9, 0.3);
        INK.oval(ctx, 0, 0, 2 * s, 1.6 * s, "#e0a878"); ctx.restore(); break;
      }
      case "earring": {
        const ex = x - hw * 0.96, eyy = y + 5 * s;
        ctx.lineWidth = 3.4 * s; ctx.beginPath(); ctx.arc(ex, eyy, 2.8 * s, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = K.gold; ctx.lineWidth = 1.6 * s; ctx.stroke(); ctx.strokeStyle = K.ink; break;
      }
    }
    ctx.lineWidth = lw;
  },
  /* giant eyeball with iris, veins and lid */
  _bigEye(ctx, x, y, r, look, blink, iris, lid, shock, style) {
    const lw = ctx.lineWidth, K = INK.C;
    ctx.lineWidth = Math.max(2, r * 0.13);
    INK.blob(ctx, x, y, r, r, "#fff", true, 77, 0.03);
    ctx.strokeStyle = "#ff8fa3"; ctx.lineWidth = Math.max(1, r * 0.05); ctx.beginPath();
    ctx.moveTo(x - r * 0.95, y + r * 0.1); ctx.quadraticCurveTo(x - r * 0.7, y + r * 0.32, x - r * 0.55, y + r * 0.12);
    ctx.moveTo(x + r * 0.9, y - r * 0.35); ctx.quadraticCurveTo(x + r * 0.7, y - r * 0.08, x + r * 0.6, y - r * 0.3);
    ctx.moveTo(x + r * 0.3, y + r * 0.93); ctx.quadraticCurveTo(x + r * 0.38, y + r * 0.72, x + r * 0.2, y + r * 0.62);
    ctx.stroke(); ctx.strokeStyle = K.ink;
    let lx = (look && look.x) || 0, ly = (look && look.y) || 0;
    if (style === "side") { lx = 1; ly = 0; }
    const m = Math.hypot(lx, ly) || 1, d = Math.min(1, m) * r * 0.4, px = x + (lx / m) * d, py = y + (ly / m) * d;
    const ir = r * (style === "wide" || shock ? 0.4 : 0.5);
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    INK.oval(ctx, px, py, ir, ir, iris, true);
    if (style === "spiral") {
      ctx.beginPath();
      for (let a = 0; a < 12; a += 0.4) ctx.lineTo(px + Math.cos(a + INK.t * 6) * a * ir * 0.08, py + Math.sin(a + INK.t * 6) * a * ir * 0.08);
      ctx.stroke();
    } else INK.oval(ctx, px, py, ir * (shock ? 0.32 : 0.5), ir * (shock ? 0.32 : 0.5), K.ink);
    INK.oval(ctx, px - ir * 0.42, py - ir * 0.42, ir * 0.26, ir * 0.26, "#fff");
    const lidA = Math.max(blink || 0, style === "sleepy" ? 0.45 : 0);
    if (lidA > 0.02) {
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = lid; ctx.fillRect(x - r - 2, y - r - 2, r * 2 + 4, (r * 2 + 4) * lidA);
      ctx.beginPath(); ctx.moveTo(x - r, y - r + r * 2 * lidA); ctx.lineTo(x + r, y - r + r * 2 * lidA); ctx.stroke(); ctx.restore();
    }
    ctx.lineWidth = Math.max(2, r * 0.13);
    INK.oval(ctx, x, y, r, r, null, true);
    ctx.lineWidth = lw;
  },
  /* little impact ticks around a plant that just got bonked */
  _zap(ctx, wob, t) {
    const lw = ctx.lineWidth; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = -2.6 + k * 0.72 + INK.j(k, 3) * 0.1, r0 = 30 + (1 - wob) * 8;
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 - 4); ctx.lineTo(Math.cos(a) * (r0 + 7), Math.sin(a) * (r0 + 7) - 4);
    }
    ctx.stroke(); ctx.lineWidth = lw;
  },

  /* ================= PLANTS ================= */
  plant(ctx, p, o) {
    if (!p) return;
    o = o || DRAW._Z;
    const t = o.t != null ? o.t : INK.t, grow = o.grow == null ? 1 : o.grow;
    if (grow <= 0.01) return;
    const seed = p.seed || 0, wob = Math.max(0, Math.min(1, o.wob || 0)), st = DRAW._st, v = DRAW._var(p);
    st.t = t; st.seed = seed; st.wob = wob; st.shock = wob > 0.12; st.sad = !!o.sad; st.talk = !!o.talk;
    st.dir = o.dir || 1; st.blink = DRAW._blink(t, seed);
    st.sway = Math.sin(t * 1.4 + seed * 0.9) * (st.sad ? 0.02 : 0.06);
    st.v = v; st.c1 = p.c1 || "#ffd23f"; st.c2 = p.c2 || "#ff9a3c"; st.ar = 0;
    const asp = Math.sqrt(v.ax * v.ay); st.fax = asp / v.ax; st.fay = asp / v.ay;
    ctx.save();
    st.look = o.look || DRAW._look(ctx, 0, 0);
    DRAW._ink(ctx, 3);
    const sq = wob > 0 ? Math.cos((1 - wob) * 18) * wob * 0.3 : 0, br = Math.sin(t * 2.3 + seed) * 0.025;
    const g = grow < 1 ? Math.max(0.01, DRAW._pop(grow)) : 1, droop = st.sad ? 0.08 : 0;
    ctx.translate(0, 40); ctx.scale(g * (1 + sq + br * 0.6), g * (1 - sq - br - droop)); ctx.rotate(st.sway * 0.5); ctx.translate(0, -40);
    /* per-plant silhouette: size, tall/squat aspect and lean all pivot on the branch point (0,44);
       potted plants sit lower and smaller so their base disappears into the pot */
    const pot = v.pot, by = pot ? 31 : 44, pk = pot ? 0.86 : 1;
    if (pot) DRAW._potB(ctx, p, st, pot);
    ctx.save();
    ctx.translate(0, by); ctx.rotate(v.lean); ctx.scale(v.sz * v.ax * pk, v.sz * v.ay * pk); ctx.translate(0, -44);
    (DRAW._P[p.type] || DRAW._P.daisy)(ctx, p, st);
    ctx.restore();
    DRAW._ink(ctx, 3);
    if (pot) DRAW._potF(ctx, p, st, pot);
    if (v.feat === "roots" || v.feat2 === "roots") DRAW._roots(ctx, st, pot);
    if (wob > 0.35) DRAW._zap(ctx, wob, t);
    ctx.restore();
  },
  /* ---------- per-plant variation: derived once from the seed (+type, pt), cached ---------- */
  _VM: new Map(),
  _VW: new WeakMap(),
  _FEAT: ["none", "none", "none", "antennae", "hair", "arms", "face2", "roots", "bandage", "bug", "fly", "sprout"],
  _LC: [null, null, null, "#86cf52", "#4fae7a", "#a8c94a", "#5aa89a", "#a982dc", "#6fbf3f"],
  _var(p) {
    const ty = p.type || "daisy", sd = p.seed | 0, pt = p.pt | 0;
    let v = DRAW._VW.get(p);
    if (v && v.sd === sd && v.ty === ty && v.pt === pt) return v;
    const key = ty + ":" + sd + ":" + pt;
    v = DRAW._VM.get(key);
    if (!v) {
      const r = U.rng((sd * 7919 + DRAW._hs(ty) * 104729 + pt * 31 + 17) | 0);
      const ri = (a, b) => a + Math.floor(r() * (b - a + 1)), rf = (a, b) => a + r() * (b - a);
      const sh = ri(0, 3), FE = DRAW._FEAT, LC = DRAW._LC;
      v = {
        ty, sd, pt,
        m: ri(0, 3),                                            // main per-type style
        sh,                                                     // 0 normal, 1 tall, 2 squat, 3 lopsided
        sz: rf(0.9, 1.01),
        ax: sh === 1 ? rf(0.86, 0.91) : sh === 2 ? rf(1.07, 1.12) : rf(0.96, 1.04),
        ay: sh === 1 ? rf(1.07, 1.12) : sh === 2 ? rf(0.86, 0.91) : rf(0.96, 1.04),
        lean: sh === 3 ? (r() < 0.5 ? -1 : 1) * rf(0.1, 0.17) : rf(-0.04, 0.04),
        bend: rf(-1, 1),
        pat: r() < 0.28 ? 0 : ri(1, 6),                         // 1 spots 2 stripes 3 polka 4 freckles 5 zigzag 6 patch
        pc: ri(0, 2),
        petal: ri(0, 5),
        blush: r() < 0.45,
        leaves: ri(0, 3),
        lc: LC[ri(0, LC.length - 1)],
        feat: FE[ri(0, FE.length - 1)],
        feat2: r() < 0.22 ? FE[ri(3, FE.length - 1)] : "none",
        pot: ty === "coat" ? 0 : ty === "cactus" ? ri(1, 4) : r() < 0.3 ? ri(1, 4) : 0,
        spin: r() < 0.3 ? 0 : (r() < 0.5 ? -1 : 1) * rf(0.15, 0.6),
        a: [],
      };
      for (let k = 0; k < 12; k++) v.a.push(r());
      if (v.feat2 === v.feat) v.feat2 = "none";
      if (v.pot && ty !== "cactus" && (v.feat === "roots" || v.feat2 === "roots") && r() < 0.5) v.pot = 0;
      if (DRAW._VM.size > 900) DRAW._VM.clear();
      DRAW._VM.set(key, v);
    }
    DRAW._VW.set(p, v);
    return v;
  },
  _has(v, f) { return v.feat === f || v.feat2 === f; },
  /* surface pattern marks in the box around (x,y) +-(rx,ry); the caller clips to the body */
  _pat(ctx, kind, x, y, rx, ry, col, seed) {
    const lw = ctx.lineWidth, mr = Math.min(rx, ry);
    ctx.fillStyle = col; ctx.strokeStyle = col;
    switch (kind) {
      case 1: {      // blotchy spots
        for (let k = 0; k < 6; k++) {
          const px = x + INK.n(seed, k) * rx * 0.85, py = y + INK.n(seed, k + 20) * ry * 0.85, pr = (0.13 + 0.09 * (INK.n(seed, k + 40) + 1)) * mr;
          INK.blobPath(ctx, px, py, pr, pr * 0.85, seed + k, 0.15); ctx.fill();
        }
        break;
      }
      case 2: {      // diagonal stripes
        ctx.lineWidth = Math.max(2, mr * 0.2); ctx.beginPath();
        for (let k = -4; k <= 4; k++) { const ox = x + k * mr * 0.55; ctx.moveTo(ox - ry, y + ry); ctx.lineTo(ox + ry, y - ry); }
        ctx.stroke(); break;
      }
      case 3: {      // polka dots
        const d = Math.max(5, mr * 0.45), pr = d * 0.2;
        ctx.beginPath();
        for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
          const px = x + i * d + (j & 1) * d * 0.5, py = y + j * d * 0.87;
          if (Math.abs(px - x) > rx + 1 || Math.abs(py - y) > ry + 1) continue;
          ctx.moveTo(px + pr, py); ctx.arc(px, py, pr, 0, 6.2832);
        }
        ctx.fill(); break;
      }
      case 4: {      // freckles on the cheeks
        ctx.fillStyle = "rgba(120,60,40,0.55)"; ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const sg = k < 3 ? -1 : 1, i = k % 3, px = x + sg * rx * (0.4 + 0.13 * i), py = y + ry * (0.18 + 0.13 * ((i * 2) % 3)), fr = Math.max(0.9, mr * 0.06);
          ctx.moveTo(px + fr, py); ctx.arc(px, py, fr, 0, 6.2832);
        }
        ctx.fill(); break;
      }
      case 5: {      // zigzag bands
        ctx.lineWidth = Math.max(1.8, mr * 0.13); ctx.beginPath();
        for (let b = 0; b < 2; b++) {
          const yy = y + ry * (b ? 0.58 : -0.5);
          for (let k = 0; k <= 8; k++) { const px = x - rx + (k * rx) / 4, py = yy + (k & 1 ? -1 : 1) * ry * 0.12; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        }
        ctx.stroke(); break;
      }
      case 6: {      // a sewn-on patch
        const px = x + rx * 0.38, py = y + ry * 0.42, w = rx * 0.5, h = ry * 0.42;
        ctx.save(); ctx.translate(px, py); ctx.rotate(0.25);
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const u = -w / 2 + (k + 0.5) * w / 4, q = -h / 2 + (k + 0.5) * h / 4;
          ctx.moveTo(u - 1, -h / 2 - 1.5); ctx.lineTo(u + 1, -h / 2 + 1.5); ctx.moveTo(u - 1, h / 2 - 1.5); ctx.lineTo(u + 1, h / 2 + 1.5);
          ctx.moveTo(-w / 2 - 1.5, q - 1); ctx.lineTo(-w / 2 + 1.5, q + 1); ctx.moveTo(w / 2 - 1.5, q - 1); ctx.lineTo(w / 2 + 1.5, q + 1);
        }
        ctx.stroke(); ctx.restore(); break;
      }
    }
    ctx.lineWidth = lw; ctx.strokeStyle = INK.C.ink;
  },
  /* pattern colour for a body of colour col (tone, tint or the accent colour) */
  _pcol(col, s) {
    const k = s.v.pc;
    return k === 0 ? DRAW._sh(col, -0.2) : k === 1 ? DRAW._sh(col, 0.45) : DRAW._ca(col === s.c2 ? s.c1 : s.c2, 0.8);
  },
  /* _body + the plant's surface pattern clipped inside it */
  _pbody(ctx, x, y, rx, ry, col, seed, amt, s) {
    const v = s && s.v;
    if (!v || !v.pat) { DRAW._body(ctx, x, y, rx, ry, col, seed, amt); return; }
    amt = amt == null ? 0.06 : amt;
    DRAW._body(ctx, x, y, rx, ry, col, seed, amt, false);
    ctx.save(); INK.blobPath(ctx, x, y, rx, ry, seed, amt); ctx.clip();
    DRAW._pat(ctx, v.pat, x, y, rx, ry, DRAW._pcol(col, s), s.seed);
    ctx.restore();
    INK.blobPath(ctx, x, y, rx, ry, seed, amt); ctx.stroke();
    INK.oval(ctx, x - rx * 0.42, y - ry * 0.52, rx * 0.17, ry * 0.11, "rgba(255,255,255,0.6)");
  },
  /* one petal from the origin along +x: 0 round, 1 pointy, 2 notched heart, 3 thin, 4 teardrop, 5 spoon */
  _petal(ctx, sh, L, W, col, seed) {
    const h = W / 2, j = INK.j(seed, 1) * 0.6;
    switch (sh) {
      case 1: INK.wpoly(ctx, [[0, -h * 0.45], [L * 0.5, -h], [L, j], [L * 0.5, h], [0, h * 0.45]], col, true, seed, 0.5); break;
      case 2:
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(L * 0.3, -h * 1.3, L * 1.05, -h * 1.25, L, -h * 0.12);
        ctx.lineTo(L * 0.8, j * 0.5); ctx.lineTo(L, h * 0.12); ctx.bezierCurveTo(L * 1.05, h * 1.25, L * 0.3, h * 1.3, 0, 0); ctx.closePath();
        ctx.fillStyle = col; ctx.fill(); ctx.stroke(); break;
      case 3: INK.oval(ctx, L * 0.52, j * 0.5, L * 0.52, h * 0.6, col, true); break;
      case 4:
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(L * 0.25, -h * 0.5, L * 0.7, -h * 1.35, L, -h * 0.3 + j);
        ctx.quadraticCurveTo(L * 1.12, h * 0.75, L * 0.6, h * 0.75); ctx.quadraticCurveTo(L * 0.25, h * 0.55, 0, 0); ctx.closePath();
        ctx.fillStyle = col; ctx.fill(); ctx.stroke(); break;
      case 5:
        INK.wpoly(ctx, [[0, -h * 0.28], [L * 0.5, -h * 0.28], [L * 0.5, h * 0.28], [0, h * 0.28]], col, true, seed, 0.3);
        INK.blob(ctx, L * 0.7, 0, L * 0.3, h, col, true, seed, 0.1); break;
      default: INK.blob(ctx, L * 0.5, 0, L * 0.5, h, col, true, seed, 0.09);
    }
  },
  /* n leaves along the stem quadratic (0,y0) -> (cx,cy) -> (0,44), sides and sizes from the variation */
  _sl(ctx, s, y0, cx, cy, n) {
    const v = s.v, a = v.a, t = s.t;
    for (let k = 0; k < n; k++) {
      const u = 0.45 + k * 0.17, w = 1 - u, x = 2 * u * w * cx, y = w * w * y0 + 2 * u * w * cy + u * u * 44;
      const right = ((k + (a[4] < 0.5 ? 0 : 1)) & 1) === 1, sw = Math.sin(t * 2 + k * 1.3) * 0.08;
      DRAW._leaf(ctx, x, y, right ? -0.45 - a[5] * 0.5 + sw : Math.PI + 0.45 + a[5] * 0.5 - sw, 15 - k * 2 - a[6] * 3, v.lc, s.seed + k);
    }
  },
  /* extra features drawn BEHIND the head: x,y,r = face body circle, top = top of the head */
  _fb(ctx, p, s, x, y, r, top) {
    const v = s.v;
    if (!v || (v.feat === "none" && v.feat2 === "none")) return;
    const t = s.t, a = v.a, K = INK.C;
    if (DRAW._has(v, "antennae")) {
      const w = Math.sin(t * 3 + s.seed) * 2.5, h = 13 + a[8] * 6;
      ctx.lineWidth = 2.2; ctx.beginPath();
      ctx.moveTo(x - 4, top + 5); ctx.quadraticCurveTo(x - 6, top - h * 0.6, x - 9 + w, top - h);
      ctx.moveTo(x + 4, top + 5); ctx.quadraticCurveTo(x + 6, top - h * 0.6, x + 9 - w, top - h); ctx.stroke();
      ctx.lineWidth = 2;
      INK.oval(ctx, x - 9 + w, top - h, 3.3, 3.3, s.c2, true); INK.oval(ctx, x + 9 - w, top - h, 3.3, 3.3, s.c2, true);
      ctx.lineWidth = 3;
    }
    if (DRAW._has(v, "hair")) {
      const n = 3 + ((a[9] * 3) | 0);
      for (let k = 0; k < n; k++) {
        const u = k / (n - 1) - 0.5;
        DRAW._leaf(ctx, x + u * 8, top + 5, -Math.PI / 2 + u * 1.7 + Math.sin(t * 2.5 + k) * 0.1, 10 + (1 - Math.abs(u) * 2) * 5, v.lc, s.seed + 40 + k);
      }
    }
    if (DRAW._has(v, "sprout")) {
      const sw = Math.sin(t * 2 + s.seed) * 0.15;
      DRAW._stem(ctx, x + 2, top + 5, x + 4, top - 3, x + 1, top - 9, 2.4, v.lc);
      DRAW._leaf(ctx, x + 1, top - 9, -2.5 + sw, 9, v.lc, s.seed + 50); DRAW._leaf(ctx, x + 1, top - 9, -0.6 + sw, 9, v.lc, s.seed + 51);
    }
    if (DRAW._has(v, "arms")) {
      const ac = DRAW._sh(p.c1, -0.12), hc = DRAW._mx(p.c1, "#fff3dc", 0.45);
      for (let sg = -1; sg <= 1; sg += 2) {
        const wv = sg > 0 ? Math.sin(t * 6 + s.seed) * 5 : Math.sin(t * 1.5) * 1.5;
        const ar = s.ar || 0, x0 = x + sg * r * 0.75, y0 = y + r * 0.35, x1 = x + sg * (r + 11 + ar), y1 = y0 + (sg > 0 ? -9 - ar * 0.3 + wv : 7 + wv);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + sg * (9 + ar * 0.6), y0 + 5, x1, y1);
        ctx.lineWidth = 5.6; ctx.stroke(); ctx.lineWidth = 2.6; ctx.strokeStyle = ac; ctx.stroke();
        ctx.strokeStyle = K.ink; ctx.lineWidth = 2;
        INK.oval(ctx, x1, y1, 3.4, 3.2, hc, true);
      }
      ctx.lineWidth = 3;
    }
  },
  /* extra features drawn IN FRONT, after the face */
  _ff(ctx, p, s, x, y, r, top) {
    const v = s.v;
    if (!v || (v.feat === "none" && v.feat2 === "none")) return;
    const t = s.t, a = v.a, K = INK.C, sg = a[11] < 0.5 ? -1 : 1;
    if (DRAW._has(v, "face2")) {        // a second, smaller face on a bud
      const fx = x + sg * (r + 5), fy = y + r * 0.75;
      DRAW._stem(ctx, x + sg * r * 0.4, y + r * 0.5, x + sg * r * 0.9, fy + 7, fx, fy, 2.4, v.lc);
      ctx.lineWidth = 2.2; DRAW._body(ctx, fx, fy, 7, 6.5, DRAW._mx(s.c2, "#fff3dc", 0.35), s.seed + 60, 0.08, false);
      const eo = DRAW._eo2; eo.blink = DRAW._blink(t, s.seed + 9); eo.style = s.shock ? "wide" : "round"; eo.lid = s.c2; eo.pupil = 0;
      INK.eye(ctx, fx - 2.5, fy - 1.3, 2.3, s.look, eo); INK.eye(ctx, fx + 2.6, fy - 1.5, 2.1, s.look, eo);
      ctx.lineWidth = 1.5; ctx.beginPath();
      if (s.shock) ctx.arc(fx, fy + 2.6, 1.3, 0, 6.2832); else ctx.arc(fx, fy + 1.2, 1.9, 0.3, 2.8);
      ctx.stroke(); ctx.lineWidth = 3;
    }
    if (DRAW._has(v, "bandage")) {      // crossed sticking plasters
      ctx.save(); ctx.translate(x - sg * r * 0.42, top + r * 0.42); ctx.lineWidth = 1.8;
      for (let k = 0; k < 2; k++) {
        ctx.rotate(k ? -1.4 : 0.7);
        INK.wpoly(ctx, [[-6.5, -2.2], [6.5, -2.2], [6.5, 2.2], [-6.5, 2.2]], "#f2c79b", true, s.seed + 70 + k, 0.3);
      }
      INK.oval(ctx, 0, 0, 2, 1.7, "#e0a878"); ctx.restore(); ctx.lineWidth = 3;
    }
    if (DRAW._has(v, "bug")) {          // a ladybird or a snail riding on the head
      const bx = x + sg * r * 0.3 + Math.sin(t * 0.8 + s.seed) * 3, by = top + 1;
      ctx.lineWidth = 1.8;
      if (a[10] < 0.5) {
        INK.oval(ctx, bx + 4.5, by - 1, 2.6, 2.4, K.ink);
        INK.oval(ctx, bx, by - 2, 5, 4, K.red, true);
        ctx.beginPath(); ctx.moveTo(bx, by - 6); ctx.lineTo(bx, by + 2); ctx.stroke();
        INK.oval(ctx, bx - 2.4, by - 2.6, 1, 1, K.ink); INK.oval(ctx, bx + 2.2, by - 1.4, 1, 1, K.ink);
        INK.oval(ctx, bx + 5.4, by - 1.8, 0.8, 0.8, "#fff");
      } else {
        ctx.beginPath(); ctx.moveTo(bx - 6, by + 1); ctx.lineTo(bx + 6, by + 1); ctx.quadraticCurveTo(bx + 8, by - 1, bx + 7, by - 5);
        ctx.lineWidth = 4.6; ctx.stroke(); ctx.lineWidth = 2.4; ctx.strokeStyle = "#cdb8a0"; ctx.stroke(); ctx.strokeStyle = K.ink; ctx.lineWidth = 1.6;
        INK.oval(ctx, bx - 1, by - 4, 4.8, 4.6, s.c2, true);
        ctx.beginPath(); ctx.arc(bx - 1, by - 4, 2.4, 0, 4.7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx + 7, by - 5); ctx.lineTo(bx + 8, by - 9); ctx.stroke(); INK.oval(ctx, bx + 8, by - 9.5, 1.1, 1.1, K.ink);
      }
      ctx.lineWidth = 3;
    }
    if (DRAW._has(v, "fly")) {          // a fly doing laps around the head
      const fa = t * 2.4 + s.seed, fx = x + Math.cos(fa) * (r + 11), fy = y - r * 0.4 + Math.sin(fa * 2) * 7, fl = Math.sin(t * 40) * 0.5;
      ctx.lineWidth = 1.3;
      INK.oval(ctx, fx - 1.5, fy - 3 - fl, 2.4, 1.6, "rgba(255,255,255,0.8)", true); INK.oval(ctx, fx + 1.5, fy - 3 + fl, 2.4, 1.6, "rgba(255,255,255,0.8)", true);
      INK.oval(ctx, fx, fy, 2.4, 1.9, K.ink);
      ctx.lineWidth = 3;
    }
  },
  /* little roots peeking out at the branch point (or out of the pot's drainage) */
  _roots(ctx, s, pot) {
    const RC = "#d8b48a", y0 = pot ? 41 : 39, x0 = pot ? 8 : 2;
    for (let sg = -1; sg <= 1; sg += 2) {
      DRAW._stem(ctx, sg * x0, y0, sg * (x0 + 6), y0 + 1, sg * (x0 + 9), y0 + 6, 2, RC);
      DRAW._stem(ctx, sg * x0 * 0.6, y0 + 2, sg * (x0 + 2), y0 + 5, sg * (x0 + 1), y0 + 8, 1.6, RC);
    }
  },
  /* pots (1 terracotta, 2 teacup, 3 boot, 4 tin can): rim at y ~27, bottom exactly at the branch point y = 44.
     _potB = the opening behind the plant, _potF = the pot body in front of it */
  _potB(ctx, p, s, kind) {
    const sd = s.seed;
    if (kind === 1) INK.blob(ctx, 0, 26.5, 14, 3.4, "#4a2c18", true, sd + 80, 0.05);
    else if (kind === 2) { INK.oval(ctx, 0, 27, 16, 4.2, "#efe3d2", true); INK.oval(ctx, 0, 27.8, 12.5, 2.8, "#6b4226"); }
    else if (kind === 3) INK.blob(ctx, -1, 25, 10.5, 3, "#3b2516", true, sd + 81, 0.05);
    else {
      ctx.save(); ctx.translate(-8, 27); ctx.rotate(-0.55 - Math.sin(s.t * 2 + sd) * 0.04);
      INK.wpoly(ctx, [[0, 0], [1, -8], [5, -13], [10, -14], [15, -11], [17, -6], [18, 0], [14, -2], [10, 1], [6, -2], [3, 1]], "#d5dde8", true, sd + 82, 0.4);
      ctx.restore();
      INK.oval(ctx, 0, 27, 13.5, 3.4, "#9aa6b8", true); INK.oval(ctx, 0, 27.6, 11, 2.3, "#4a2c18");
    }
  },
  _potF(ctx, p, s, kind) {
    const v = s.v, a = v.a, c2 = s.c2, K = INK.C, sd = s.seed;
    ctx.lineWidth = 3;
    if (kind === 1) {                                     // terracotta
      INK.wpoly(ctx, [[-13, 30], [13, 30], [10, 44], [-10, 44]], "#d9774a", true, sd + 83, 0.5);
      ctx.fillStyle = "#c2633a"; ctx.fillRect(4, 33, 6, 9);
      INK.wpoly(ctx, [[-16, 25], [16, 25], [16, 32], [-16, 32]], "#e8915f", true, sd + 84, 0.5);
      if (a[7] < 0.5) {
        ctx.lineWidth = 2; ctx.strokeStyle = c2; ctx.beginPath();
        for (let k = 0; k <= 6; k++) { const x = -9 + k * 3, y = 37 + (k & 1 ? -2 : 2); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke(); ctx.strokeStyle = K.ink;
      } else { INK.oval(ctx, -5, 37, 1.8, 1.8, c2); INK.oval(ctx, 0, 39, 1.8, 1.8, c2); INK.oval(ctx, 5, 37, 1.8, 1.8, c2); }
    } else if (kind === 2) {                              // teacup on a saucer
      const hs = s.dir < 0 ? -1 : 1;
      INK.oval(ctx, 0, 41.5, 19, 2.6, "#fdf6ec", true);
      ctx.beginPath(); ctx.ellipse(hs * 15, 32.5, 5, 4.5, 0, -1.6, 1.6, hs < 0); ctx.lineWidth = 6; ctx.stroke();
      ctx.lineWidth = 2.6; ctx.strokeStyle = "#fdf6ec"; ctx.stroke(); ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-16, 27); ctx.bezierCurveTo(-16, 37, -9, 41, 0, 41); ctx.bezierCurveTo(9, 41, 16, 37, 16, 27);
      ctx.quadraticCurveTo(0, 31.5, -16, 27); ctx.closePath(); ctx.fillStyle = "#fdf6ec"; ctx.fill(); ctx.stroke();
      ctx.strokeStyle = c2; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-14.5, 31); ctx.quadraticCurveTo(0, 35.5, 14.5, 31); ctx.stroke();
      INK.oval(ctx, -6, 36.5, 1.6, 1.6, c2); INK.oval(ctx, 5, 37, 1.6, 1.6, c2);
      ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
      INK.oval(ctx, 0, 43, 8, 1.3, K.ink);
    } else if (kind === 3) {                              // an old boot, toe pointing away from the stalk
      const g = s.dir < 0 ? -1 : 1, bc = "#8a5a3a";
      ctx.beginPath(); ctx.moveTo(-11 * g, 24); ctx.lineTo(9 * g, 24); ctx.lineTo(9 * g, 33);
      ctx.quadraticCurveTo(21 * g, 32, 22 * g, 39); ctx.lineTo(22 * g, 41); ctx.lineTo(-12 * g, 41); ctx.closePath();
      ctx.fillStyle = bc; ctx.fill(); ctx.stroke();
      INK.wpoly(ctx, [[-12 * g, 40], [23 * g, 40], [23 * g, 44], [-12 * g, 44]], "#3b2516", true, sd + 85, 0.3);
      ctx.lineWidth = 1.6; ctx.strokeStyle = "#fff3dc"; ctx.beginPath();
      for (let k = 0; k < 3; k++) { const y = 27 + k * 3; ctx.moveTo(-2 * g, y); ctx.lineTo(4 * g, y + 2.4); ctx.moveTo(4 * g, y); ctx.lineTo(-2 * g, y + 2.4); }
      ctx.stroke(); ctx.strokeStyle = K.ink;
      ctx.fillStyle = DRAW._sh(bc, 0.25); ctx.fillRect(-9.5 * g - (g < 0 ? 3 : 0), 26, 3, 11);
      ctx.lineWidth = 3;
    } else {                                              // tin can with a label
      ctx.beginPath(); ctx.moveTo(-13, 27); ctx.lineTo(-13, 42); ctx.quadraticCurveTo(0, 46, 13, 42); ctx.lineTo(13, 27);
      ctx.quadraticCurveTo(0, 30.5, -13, 27); ctx.closePath(); ctx.fillStyle = "#c4cedb"; ctx.fill();
      ctx.fillStyle = c2; ctx.fillRect(-13, 31, 26, 8);
      ctx.stroke();
      ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-13, 31); ctx.quadraticCurveTo(0, 34, 13, 31); ctx.moveTo(-13, 39); ctx.quadraticCurveTo(0, 42, 13, 39); ctx.stroke();
      ctx.save(); ctx.translate(0, 35.5); ctx.scale(0.55, 0.55); DRAW.bean(ctx, false, 0, 0); ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9, 29); ctx.lineTo(-9, 31); ctx.moveTo(-9, 40); ctx.lineTo(-9, 41.5); ctx.stroke();
      ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
    }
  },
  _P: {
    daisy(ctx, p, s) {
      const t = s.t, sd = s.seed, v = s.v, a = v.a, m = v.m, c1 = p.c1, dk = DRAW._sh(c1, -0.16), sp = v.petal;
      let n = Math.max(5, Math.min(9, p.pt || 6));
      if (sp === 3) n = n * 2 - 2; else if (m === 3) n += 4;
      const cr = m === 3 ? 17 + a[0] * 2 : 12.5 + a[0] * 5, L = (m === 3 ? 10 : 13) + a[1] * 7, W = (sp === 3 ? 6 : 10.5) + a[2] * 5;
      const bx = v.bend * 10;
      DRAW._stem(ctx, 0, cr - 3, bx, 27, 0, 44, 4 + a[3] * 2.5, v.lc);
      DRAW._sl(ctx, s, cr - 3, bx, 27, 1 + (v.leaves % 3));
      ctx.save(); ctx.rotate(s.sway * 1.5);
      const spin = v.spin ? t * v.spin + sd : sd + Math.sin(t * 1.3 + sd) * 0.08, fl = s.shock ? 4 : 0;
      if (m === 2) {          // double bloom: a second ring of longer petals behind
        const c3 = DRAW._mx(c1, p.c2, 0.45);
        for (let k = 0; k < n; k++) {
          ctx.save(); ctx.rotate(spin + ((k + 0.5) / n) * 6.2832); ctx.translate(cr - 3 + fl, 0);
          DRAW._petal(ctx, sp, L + 4, W * 0.85, c3, sd + k + 30); ctx.restore();
        }
      }
      for (let k = 0; k < n; k++) {
        ctx.save(); ctx.rotate(spin + (k / n) * 6.2832); ctx.translate(cr - 4 + fl + Math.sin(t * 3 + k * 1.7) * 1.2, 0);
        DRAW._petal(ctx, sp, L, W, k & 1 ? dk : c1, sd + k);
        ctx.restore();
      }
      s.ar = Math.min(16, L - 3);
      DRAW._fb(ctx, p, s, 0, 0, cr, -cr);
      DRAW._pbody(ctx, 0, 0, cr + 0.5, cr - 0.5, p.c2, sd + 3, 0.05, s);
      if (m === 3) {          // sunflower: ring of seeds around the face
        ctx.fillStyle = DRAW._ca(INK.C.ink, 0.35); ctx.beginPath();
        for (let k = 0; k < 18; k++) { const q = (k / 18) * 6.2832, px = Math.cos(q) * cr * 0.8, py = Math.sin(q) * cr * 0.8; ctx.moveTo(px + 1.2, py); ctx.arc(px, py, 1.2, 0, 6.2832); }
        ctx.fill();
      }
      DRAW._face(ctx, p, s, 0, 1, cr / 16, cr, -cr, p.c2);
      DRAW._ff(ctx, p, s, 0, 0, cr, -cr);
      ctx.restore();
    },
    shroom(ctx, p, s) {
      const t = s.t, sd = s.seed, v = s.v, a = v.a, m = v.m, c1 = p.c1, stemC = DRAW._mx(p.c2, "#fff3dc", a[5] < 0.5 ? 0.7 : 0.45);
      const sw = 11.5 + a[0] * 6, sh = 19 + a[1] * 5.5, sy = 45.5 - sh, capY = 45.5 - sh * 2 + 5;
      const W = m === 2 ? 30 + a[2] * 6 : m === 3 ? 21 + a[2] * 5 : 25 + a[2] * 7;
      const H = m === 1 ? 28 + a[3] * 9 : m === 2 ? 12 + a[3] * 5 : m === 3 ? 26 + a[3] * 7 : 22 + a[3] * 9;
      if (a[4] < 0.3) {       // a baby shroom at its foot
        const bx = (a[11] < 0.5 ? 1 : -1) * (sw + 10), by = 36;
        ctx.lineWidth = 2.4;
        INK.blob(ctx, bx, by + 2.5, 4.5, 5.5, stemC, true, sd + 70, 0.08);
        ctx.beginPath(); ctx.moveTo(bx - 9, by - 1); ctx.bezierCurveTo(bx - 8, by - 13, bx + 8, by - 13, bx + 9, by - 1);
        ctx.quadraticCurveTo(bx, by + 2, bx - 9, by - 1); ctx.closePath(); ctx.fillStyle = c1; ctx.fill(); ctx.stroke();
        INK.oval(ctx, bx - 3, by - 6, 1.6, 1.4, "#fff3dc");
        INK.oval(ctx, bx - 1.7, by + 2.5, 1, 1.3, INK.C.ink); INK.oval(ctx, bx + 1.7, by + 2.5, 1, 1.3, INK.C.ink);
        ctx.lineWidth = 3;
      }
      DRAW._fb(ctx, p, s, 0, sy, sw, capY - H);
      INK.oval(ctx, -sw * 0.6, 41.5, 5, 2.8, stemC, true); INK.oval(ctx, sw * 0.6, 41.5, 5, 2.8, stemC, true);
      DRAW._body(ctx, 0, sy, sw, sh, stemC, sd, 0.05);
      if (a[6] < 0.45) INK.blob(ctx, 0, capY + 8, sw + 3, 3.2, DRAW._sh(stemC, -0.1), true, sd + 7, 0.15);
      ctx.save(); ctx.translate(0, capY); ctx.rotate(s.sway * 2 + (a[7] - 0.5) * 0.35 + (s.shock ? Math.sin(t * 40) * 0.1 : 0));
      if (s.shock) ctx.translate(0, -5 * s.wob);
      const j1 = INK.j(sd, 1), j2 = INK.j(sd, 2), tipx = (a[8] - 0.5) * 18;
      const cap = m === 1 ? c => {
        c.beginPath(); c.moveTo(-W, 2); c.quadraticCurveTo(-W * 0.45, -H * 0.4 + j1, tipx, -H); c.quadraticCurveTo(W * 0.45, -H * 0.4 + j2, W, 2);
        c.quadraticCurveTo(0, 8, -W, 2); c.closePath();
      } : m === 2 ? c => {
        c.beginPath(); c.moveTo(-W, 0); c.bezierCurveTo(-W + 2, -H * 1.35 + j1, W - 2, -H * 1.35 + j2, W, 0);
        for (let k = 1; k <= 6; k++) { const x1 = W - (k / 6) * 2 * W; c.quadraticCurveTo(x1 + W / 6, 7, x1, 0); }
        c.closePath();
      } : m === 3 ? c => {
        c.beginPath(); c.moveTo(-W, 6); c.bezierCurveTo(-W * 1.1, -H * 1.25 + j1, W * 1.1, -H * 1.25 + j2, W, 6);
        for (let k = 1; k < 8; k++) c.lineTo(W - (k / 8) * 2 * W, k & 1 ? 11 : 5);
        c.closePath();
      } : c => {
        c.beginPath(); c.moveTo(-W, 0); c.bezierCurveTo(-W + 1 + j1, -H * 1.33, W, -H * 1.33 + j2, W, 0); c.quadraticCurveTo(0, 7, -W, 0); c.closePath();
      };
      DRAW._inset(ctx, cap, c1, 0, -H * 0.4, 0.9);
      if (m !== 3) {
        ctx.beginPath(); ctx.moveTo(-W + 5, 2); ctx.quadraticCurveTo(0, 9, W - 5, 2); ctx.quadraticCurveTo(0, 4, -W + 5, 2);
        ctx.fillStyle = DRAW._sh(c1, -0.42); ctx.fill();
      }
      ctx.save(); cap(ctx); ctx.clip();
      if (v.pat <= 1) {
        ctx.lineWidth = 2;
        const ns = 3 + ((a[9] * 5) | 0), spc = a[10] < 0.3 ? p.c2 : "#fff3dc";
        for (let k = 0; k < ns; k++) {
          const u = INK.n(sd, k + 9) * 0.5 + 0.5, py = -H * (0.15 + 0.62 * u), px = INK.n(sd, k) * W * 0.8 * (1 - u * 0.5) + (m === 1 ? tipx * u : 0), pr = 2.4 + (INK.n(sd, k + 17) * 0.5 + 0.5) * 3.4;
          INK.blob(ctx, px, py, pr, pr * 0.85, spc, true, sd + k, 0.12);
        }
      } else DRAW._pat(ctx, v.pat, 0, -H * 0.5, W, H * 0.62, DRAW._pcol(c1, s), sd);
      ctx.restore();
      ctx.lineWidth = 3; cap(ctx); ctx.stroke();
      ctx.restore();
      DRAW._face(ctx, p, s, 0, sy + 1, 0.9 * sw / 15, sw, capY - H, stemC);
      DRAW._ff(ctx, p, s, 0, sy, sw, capY - H);
    },
    cactus(ctx, p, s) {   // always potted (generic pot); the body runs down into it
      const t = s.t, sd = s.seed, v = s.v, a = v.a, m = v.m, c1 = p.c1, K = INK.C, rib = DRAW._sh(c1, -0.32);
      const arm = (pts, w) => {
        ctx.beginPath(); for (let i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]);
        const lw = ctx.lineWidth; ctx.lineWidth = w + 6; ctx.stroke(); ctx.lineWidth = w; ctx.strokeStyle = c1; ctx.stroke();
        ctx.lineWidth = lw; ctx.strokeStyle = K.ink;
      };
      const wv = Math.sin(t * 4 + sd) * 0.45 * (s.shock ? 2.2 : 1);
      const rx = m === 1 ? 20 + a[0] * 3 : m === 2 ? 17 + a[0] * 3 : m === 3 ? 10 + a[0] * 2 : 12 + a[0] * 3.5;
      const ry = m === 1 ? 26 : m === 2 ? 24 : m === 3 ? 38 : 35 + a[1] * 3, cy = 42 - ry, top = cy - ry;
      const nA = m === 3 ? 2 : m === 2 ? 0 : m === 1 ? (a[2] < 0.5 ? 0 : 1) : a[2] < 0.3 ? 0 : a[2] < 0.75 ? 1 : 2;
      const al = m === 1 ? 6 : 10 + a[5] * 9, ao = 8 + a[4] * 5, aw = m === 3 ? 6.5 : 7.5;
      if (nA === 2 || (nA === 1 && a[6] < 0.5)) { const hy = cy - ry * (0.05 + a[3] * 0.3); arm([[-rx + 4, hy], [-rx - ao, hy], [-rx - ao, hy - al]], aw); }
      if (nA === 2 || (nA === 1 && a[6] >= 0.5)) {
        const hy = cy - ry * (0.2 + a[7] * 0.3);
        ctx.save(); ctx.translate(rx - 4, hy); ctx.rotate(-0.25 + wv); arm([[0, 0], [ao + 2, 0], [ao + 2, -al - 2]], aw); ctx.restore();
      }
      if (m === 2) {          // prickly pear: two ear pads
        for (let sg = -1; sg <= 1; sg += 2) {
          ctx.save(); ctx.translate(sg * rx * 0.62, top + 2); ctx.rotate(sg * (0.45 + Math.sin(t * 2 + sg) * 0.05));
          DRAW._body(ctx, 0, -7, 8, 10.5, c1, sd + 4 + sg, 0.06, false);
          ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-2, -10); ctx.lineTo(-4, -12); ctx.moveTo(3, -5); ctx.lineTo(5, -7); ctx.stroke(); ctx.lineWidth = 3;
          ctx.restore();
        }
      }
      DRAW._fb(ctx, p, s, 0, cy, rx, top);
      DRAW._pbody(ctx, 0, cy, rx, ry, c1, sd, 0.04, s);
      ctx.strokeStyle = rib; ctx.lineWidth = 2; ctx.beginPath();
      const nr = m === 1 ? 2 : 1;
      for (let k = 1; k <= nr; k++) {
        const ox = (rx * k) / (nr + 1);
        ctx.moveTo(-ox, top + 5); ctx.quadraticCurveTo(-ox * 1.5, cy, -ox, cy + ry - 5); ctx.moveTo(ox, top + 5); ctx.quadraticCurveTo(ox * 1.5, cy, ox, cy + ry - 5);
      }
      ctx.stroke();
      const fy = m === 0 || m === 3 ? cy - ry * 0.3 : cy - 5, fs = m === 1 ? 1 : m === 2 ? 0.95 : m === 3 ? 0.75 : 0.85;
      ctx.strokeStyle = K.ink; ctx.lineWidth = 1.4; ctx.beginPath();
      const spn = a[8] < 0.4 ? 0 : a[8] < 0.7 ? 1 : 2;
      for (let k = 0; k < 11; k++) {
        const x = INK.n(sd, k) * rx * 0.8, y = top + 6 + (k / 11) * (ry * 2 - 12) + INK.n(sd, k + 9) * 2;
        if (Math.abs(x) < rx * 0.62 && Math.abs(y - fy) < 13 * fs) continue;
        if (spn === 0) { ctx.moveTo(x - 2, y - 2); ctx.lineTo(x + 2, y + 2); ctx.moveTo(x + 2, y - 2); ctx.lineTo(x - 2, y + 2); }
        else if (spn === 1) { const sg = x < 0 ? -1 : 1; ctx.moveTo(x, y); ctx.lineTo(x + sg * 3.5, y - 2); ctx.moveTo(x, y); ctx.lineTo(x + sg * 3.5, y + 1.5); }
        else { ctx.moveTo(x + 1.3, y); ctx.arc(x, y, 1.3, 0, 6.2832); }
      }
      ctx.stroke(); ctx.lineWidth = 3;
      if (a[9] < 0.65 && p.acc !== "tophat") {
        ctx.lineWidth = 2;
        const big = a[10] < 0.4, pr = big ? 4.4 : 3.2, pd = big ? 5 : 3.6;
        for (let k = 0; k < 5; k++) { const q = k * 1.2566 + t * (v.spin || 0.3); INK.oval(ctx, Math.cos(q) * pd, top - 1 + Math.sin(q) * pd, pr, pr, p.c2, true); }
        INK.oval(ctx, 0, top - 1, big ? 3 : 2.2, big ? 3 : 2.2, K.gold, true); ctx.lineWidth = 3;
      }
      DRAW._face(ctx, p, s, 0, fy, fs, rx, top, c1);
      DRAW._ff(ctx, p, s, 0, cy, rx, top);
    },
    fern(ctx, p, s) {
      const t = s.t, sd = s.seed, v = s.v, a = v.a, m = v.m, c1 = p.c1, dk = DRAW._sh(c1, -0.2);
      const n = Math.max(4, Math.min(10, (p.pt || 6) + (m === 2 ? 1 : m === 3 ? -2 : 0)));
      const by = 13 + a[0] * 6, br = 12 + a[1] * 5, Ls = 0.8 + a[2] * 0.25, fs = a[3] < 0.45 ? 0 : a[3] < 0.75 ? 1 : 2;
      DRAW._stem(ctx, 0, by + 6, v.bend * 6, 36, 0, 44, 6, v.lc);
      for (let k = 0; k < n; k++) {
        const u = k / (n - 1);
        let ang, L, dr;
        if (m === 1) { ang = -Math.PI * (0.86 - u * 0.72); L = (32 + Math.sin(u * Math.PI) * 8) * Ls; dr = 0.95; }
        else if (m === 2) { ang = -Math.PI * (0.76 - u * 0.52); L = (34 + Math.sin(u * Math.PI) * 16) * Ls; dr = 0.12; }
        else { ang = -Math.PI * (0.94 - u * 0.88); L = (30 + Math.sin(u * Math.PI) * 22) * Ls; dr = 0.25; }
        ang += Math.sin(t * 2 + k * 1.3) * 0.07 + s.sway * 2;
        DRAW._frondV(ctx, 0, by + 4, ang, L + (s.shock ? 5 : 0), k & 1 ? dk : c1, sd + k * 7, dr, fs);
      }
      const nc = m === 3 ? 3 : a[4] < 0.55 ? 1 : 0;
      ctx.lineWidth = 3;
      for (let k = 0; k < nc; k++) {
        const q = nc === 1 ? -1.1 : -2.3 + k * 0.8, R = 30 + (k & 1) * 6, fx = Math.cos(q) * R + Math.sin(t * 1.7 + k) * 2, fy = by + 4 + Math.sin(q) * R;
        ctx.beginPath(); ctx.moveTo(0, by); ctx.quadraticCurveTo(fx * 0.9, by - 6 + (fy - by) * 0.3, fx, fy);
        const sg = fx < 0 ? 1 : -1;
        for (let b = 0; b < 9; b += 0.6) ctx.lineTo(fx + sg * 4 - sg * Math.cos(b) * (4.5 - b * 0.45), fy + Math.sin(b) * (4.5 - b * 0.45));
        ctx.stroke();
      }
      DRAW._fb(ctx, p, s, 0, by, br, by - br);
      DRAW._pbody(ctx, 0, by, br + 1, br, p.c2, sd + 1, 0.06, s);
      DRAW._face(ctx, p, s, 0, by + 1, 0.85 * br / 14, br, by - br, p.c2);
      DRAW._ff(ctx, p, s, 0, by, br, by - br);
    },
    root(ctx, p, s) {     // 0 turnip, 1 carrot, 2 onion, 3 mandrake (with legs)
      const t = s.t, sd = s.seed, v = s.v, a = v.a, m = v.m, c1 = p.c1, K = INK.C, j1 = INK.j(sd, 1), j2 = INK.j(sd, 2);
      const W = m === 1 ? 16 + a[0] * 5 : m === 2 ? 21 + a[0] * 5 : m === 3 ? 18 + a[0] * 5 : 29 + a[0] * 5;
      const top = m === 1 ? -17 : m === 2 ? -21 : m === 3 ? -15 : -19;
      const bp = m === 1 ? c => {
        c.beginPath(); c.moveTo(-W, -12); c.quadraticCurveTo(-W * 0.85, 14 + j1, 0, 41); c.quadraticCurveTo(W * 0.85, 14 + j2, W, -12); c.quadraticCurveTo(0, -23, -W, -12); c.closePath();
      } : m === 2 ? c => {
        c.beginPath(); c.moveTo(0, -21); c.quadraticCurveTo(3, -9, W * 0.75, -1); c.bezierCurveTo(W * 1.3, 12 + j1, W * 0.7, 33, 0, 33);
        c.bezierCurveTo(-W * 0.7, 33, -W * 1.3, 12 + j2, -W * 0.75, -1); c.quadraticCurveTo(-3, -9, 0, -21); c.closePath();
      } : m === 3 ? c => {
        c.beginPath(); c.moveTo(0, -15); c.bezierCurveTo(W * 1.3, -14, W * 1.2 + j1, 26, 0, 27); c.bezierCurveTo(-W * 1.2, 26 + j2, -W * 1.3, -14, 0, -15); c.closePath();
      } : c => {
        c.beginPath(); c.moveTo(0, -19); c.bezierCurveTo(W + 3, -17, W + j1, 24, 0, 33); c.bezierCurveTo(-W, 24 + j2, -W - 3, -17, 0, -19); c.closePath();
      };
      const fy = m === 1 ? -2 : m === 2 ? 13 : m === 3 ? 6 : 9, fsz = m === 1 ? 0.85 : 0.95 + (m === 0 ? 0.05 : 0), hw = m === 0 ? 22 : W * 0.9;
      // leaves: broad, grassy blades or frilly carrot tops
      const nl = 2 + ((a[1] * 4) | 0), ls = m === 1 ? 2 : a[2] < 0.5 ? 0 : a[2] < 0.8 ? 1 : 2, lk = 0.85 + a[3] * 0.3;
      for (let k = 0; k < nl; k++) {
        const u = k / (nl - 1) - 0.5, ang = -Math.PI / 2 + u * 1.4 + Math.sin(t * 2.4 + k) * 0.12 + s.sway * 2, Lk = (19 + (1 - Math.abs(u) * 2) * 6) * lk;
        if (ls === 0) DRAW._leaf(ctx, u * 6, top + 4, ang, Lk, v.lc, sd + k);
        else if (ls === 1) {
          ctx.save(); ctx.translate(u * 6, top + 4); ctx.rotate(ang);
          ctx.beginPath(); ctx.moveTo(0, -2.6); ctx.quadraticCurveTo(Lk * 0.55, -3.4, Lk * 1.1, INK.j(sd, k) * 1.5); ctx.quadraticCurveTo(Lk * 0.55, 3.2, 0, 2.6); ctx.closePath();
          ctx.fillStyle = v.lc || K.leaf; ctx.fill(); ctx.lineWidth = 2.4; ctx.stroke(); ctx.lineWidth = 3; ctx.restore();
        } else DRAW._frondV(ctx, u * 6, top + 4, ang, Lk * 0.95, v.lc || K.leaf, sd + k, 0.05, 0);
      }
      // root tail (and legs) down to the branch point
      const rc = DRAW._sh(c1, -0.12), rsw = Math.sin(t * 2 + sd) * 2;
      ctx.lineWidth = 2.6; ctx.beginPath();
      if (m === 2) { ctx.moveTo(0, 32); ctx.lineTo(-7, 39); ctx.moveTo(0, 32); ctx.lineTo(7, 40); ctx.moveTo(-2, 33); ctx.lineTo(-4, 42); }
      else { ctx.moveTo(2, 38); ctx.lineTo(8, 39.5); ctx.moveTo(1, 41); ctx.lineTo(-5, 42.5); }
      ctx.stroke(); ctx.lineWidth = 3;
      DRAW._stem(ctx, 0, m === 2 ? 30 : m === 1 ? 36 : 25, 3 + rsw, 38, 0, 45, 2.6, rc);
      if (m === 3) {
        for (let sg = -1; sg <= 1; sg += 2) {
          const st = Math.sin(t * 5 + sd + (sg > 0 ? Math.PI : 0)) * 3;
          ctx.beginPath(); ctx.moveTo(sg * 7, 18); ctx.quadraticCurveTo(sg * 12, 30, sg * 10 + st, 41);
          ctx.lineWidth = 9; ctx.stroke(); ctx.lineWidth = 4.5; ctx.strokeStyle = c1; ctx.stroke(); ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
        }
      }
      DRAW._fb(ctx, p, s, 0, fy, hw, top);
      DRAW._inset(ctx, bp, c1, 0, 6, 0.9);
      ctx.save(); bp(ctx); ctx.clip();
      if (m === 0) {
        ctx.beginPath(); ctx.moveTo(-34, -24); ctx.lineTo(34, -24); ctx.lineTo(34, -5);
        ctx.quadraticCurveTo(15, -1, 0, -6); ctx.quadraticCurveTo(-15, -11, -34, -4); ctx.closePath();
        ctx.fillStyle = p.c2; ctx.fill(); ctx.stroke();
      } else if (m === 3) { INK.oval(ctx, 0, -14, W * 1.3, 8, p.c2); }
      if (v.pat) DRAW._pat(ctx, v.pat, 0, m === 1 ? 6 : 12, W, m === 1 ? 26 : 18, DRAW._pcol(c1, s), sd);
      ctx.strokeStyle = DRAW._sh(c1, -0.3); ctx.lineWidth = 1.8; ctx.beginPath();
      if (m === 1) { for (let k = 0; k < 5; k++) { const y = 2 + k * 7, hx = W * (1 - (y + 12) / 53) * 0.9; ctx.moveTo((k & 1 ? 1 : -1) * hx, y); ctx.lineTo((k & 1 ? 1 : -1) * hx * 0.35, y + 1); } }
      else if (m === 2) { ctx.moveTo(-W * 0.45, 2); ctx.quadraticCurveTo(-W * 0.7, 18, -W * 0.25, 31); ctx.moveTo(W * 0.45, 2); ctx.quadraticCurveTo(W * 0.7, 18, W * 0.25, 31); }
      else { ctx.moveTo(-18, 18); ctx.quadraticCurveTo(-8, 25, 2, 26); ctx.moveTo(14, 16); ctx.quadraticCurveTo(10, 22, 6, 24); }
      ctx.stroke(); ctx.restore();
      ctx.strokeStyle = K.ink; ctx.lineWidth = 3; bp(ctx); ctx.stroke();
      DRAW._face(ctx, p, s, 0, fy, fsz, hw, top, c1);
      DRAW._ff(ctx, p, s, 0, fy, hw * 0.8, top);
    },
    puff(ctx, p, s) {     // 0 round shrub, 1 poplar, 2 flat acacia, 3 topiary poodle-balls
      const t = s.t, sd = s.seed, v = s.v, a = v.a, m = v.m, c1 = p.c1, K = INK.C, Ly = DRAW._PCV[m], C = Ly.c, b = Math.sin(t * 2 + sd) * 1.2;
      const tc = DRAW._TRK[(a[0] * 3) | 0], bx = v.bend * (m === 3 ? 4 : 12);
      if (m === 3) DRAW._stem(ctx, 0, Ly.ty - 30, bx, 20, 0, 44, 5, tc);
      else {
        DRAW._stem(ctx, 0, Ly.ty, bx, 26, 0, 44, 8 + a[1] * 3, tc);
        if (a[2] < 0.45) { DRAW._stem(ctx, bx * 0.4, 18, bx * 0.4 - 8, 10, -13, Ly.ty - 4, 3.5, tc); DRAW._stem(ctx, bx * 0.4, 16, bx * 0.4 + 8, 8, 13, Ly.ty - 5, 3.5, tc); }
      }
      const cp = (o, sc, dx, dy) => {
        ctx.beginPath();
        for (let k = 0; k < C.length; k++) { const r = C[k][2] * sc + o + b * (k & 1 ? 1 : -1) * 0.5, x = C[k][0] - C[k][2] * dx, y = C[k][1] - C[k][2] * dy; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832); }
      };
      DRAW._fb(ctx, p, s, 0, Ly.fy, Ly.hw, Ly.top);
      cp(2.8, 1, 0, 0); ctx.fillStyle = K.ink; ctx.fill();
      cp(0, 1, 0, 0); ctx.fillStyle = DRAW._sh(c1, -0.22); ctx.fill();
      cp(0, 0.82, 0.14, 0.17); ctx.fillStyle = c1; ctx.fill();
      if (v.pat && v.pat !== 4) { ctx.save(); cp(0, 1, 0, 0); ctx.clip(); DRAW._pat(ctx, v.pat, Ly.bx, Ly.by, Ly.rx, Ly.ry, DRAW._pcol(c1, s), sd); ctx.restore(); }
      ctx.strokeStyle = DRAW._sh(c1, -0.3); ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k < C.length; k += 2) { const q = C[k]; ctx.moveTo(q[0] - q[2] * 0.3 + q[2] * 0.45 * Math.cos(3.6), q[1] + q[2] * 0.45 * Math.sin(3.6)); ctx.arc(q[0] - q[2] * 0.3, q[1], q[2] * 0.45, 3.6, 5.2); }
      ctx.stroke(); ctx.strokeStyle = K.ink; ctx.lineWidth = 2.2;
      // fruit: apples, cherries, tiny socks, tiny eyeballs, blossoms
      const fk = a[6] < 0.25 ? 0 : a[6] < 0.42 ? 1 : a[6] < 0.57 ? 2 : a[6] < 0.7 ? 3 : a[6] < 0.85 ? 4 : 5;
      if (fk) {
        const eo = DRAW._eo2; eo.blink = s.blink; eo.style = "round"; eo.lid = c1; eo.pupil = 0;
        for (let i = 0; i < 3; i++) {
          const q = C[Ly.f[i]], sg = q[0] < 0 || (q[0] === 0 && i === 0) ? -1 : 1, fx = q[0] + sg * q[2] * 0.45, fy = q[1] + q[2] * 0.42 + (m === 3 && i ? -q[2] * 0.9 : 0);
          if (fk === 1) { INK.oval(ctx, fx, fy, 3.4, 3.4, p.c2, true); INK.oval(ctx, fx - 1, fy - 1.2, 1, 0.8, "rgba(255,255,255,0.8)"); }
          else if (fk === 2) {
            const sw = Math.sin(t * 2 + i) * 1.5; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(fx, fy - 4); ctx.lineTo(fx - 3 + sw, fy + 3); ctx.moveTo(fx, fy - 4); ctx.lineTo(fx + 3 + sw, fy + 4); ctx.stroke(); ctx.lineWidth = 1.8;
            INK.oval(ctx, fx - 3 + sw, fy + 4, 2.6, 2.6, K.red, true); INK.oval(ctx, fx + 3 + sw, fy + 5, 2.6, 2.6, K.red, true); ctx.lineWidth = 2.2;
          } else if (fk === 3) {
            ctx.save(); ctx.translate(fx, fy - 2); ctx.rotate(Math.sin(t * 3 + i * 2) * 0.3); ctx.lineWidth = 1.4; DRAW._sockShape(ctx, 4.2, 5.5, i & 1 ? p.c2 : "#fff3dc", i & 1 ? "#fff3dc" : p.c2, 0); ctx.restore(); ctx.lineWidth = 2.2;
          } else if (fk === 4) INK.eye(ctx, fx, fy, 3.4, s.look, eo);
          else { for (let k = 0; k < 5; k++) { const q2 = k * 1.2566; INK.oval(ctx, fx + Math.cos(q2) * 2.2, fy + Math.sin(q2) * 2.2, 1.7, 1.7, "#fff", false); } INK.oval(ctx, fx, fy, 1.3, 1.3, K.gold); }
        }
      }
      ctx.lineWidth = 3;
      DRAW._face(ctx, p, s, 0, Ly.fy, Ly.fs, Ly.hw, Ly.top, c1);
      DRAW._ff(ctx, p, s, 0, Ly.fy, Ly.hw, Ly.top);
    },
    eye(ctx, p, s) {      // 0 spikes, 1 lashes, 2 round petals, 3 double ring with tiny eyes on the tips
      const t = s.t, sd = s.seed, v = s.v, a = v.a, m = v.m, c1 = p.c1, dk = DRAW._sh(c1, -0.2), K = INK.C;
      const n0 = Math.max(5, Math.min(9, p.pt || 7)), IR = DRAW._IRIS, iris = a[0] < 0.35 ? p.c2 : IR[(a[1] * IR.length) | 0];
      const bx = v.bend * 9 - 4;
      DRAW._stem(ctx, 0, 18, bx, 32, 0, 44, 5, v.lc);
      DRAW._sl(ctx, s, 18, bx, 32, 1 + (v.leaves % 2));
      ctx.save(); ctx.rotate(s.sway);
      const fl = s.shock ? 5 : 0, r = (s.shock ? 21 : 19) * (0.84 + a[2] * 0.18), ph = Math.sin(t * 1.2 + sd) * 0.15;
      if (m === 1) {
        INK.blob(ctx, 0, -2, r + 6, r + 6, c1, true, sd + 5, 0.06);
        ctx.lineWidth = 3.4; ctx.beginPath();
        for (let k = 0; k < n0 + 5; k++) {
          const q = (k / (n0 + 5)) * 6.2832 + ph, c = Math.cos(q), sn = Math.sin(q), L = r + 12 + fl + Math.sin(t * 3 + k) * 1.2;
          ctx.moveTo(c * (r + 5), -2 + sn * (r + 5)); ctx.quadraticCurveTo(c * (L - 2) - sn * 3, -2 + sn * (L - 2) + c * 3, c * L - sn * 5, -2 + sn * L + c * 5);
        }
        ctx.stroke(); ctx.lineWidth = 3;
      } else {
        const rings = m === 3 ? 2 : 1;
        for (let g = rings - 1; g >= 0; g--) {
          for (let k = 0; k < n0; k++) {
            ctx.save(); ctx.rotate(((k + g * 0.5) / n0) * 6.2832 + ph);
            const L = r + 14 + fl + Math.sin(t * 3 + k) * 1.5 - (m === 3 && g === 0 ? 4 : 0) + (g ? 3 : 0), col = g ? DRAW._mx(c1, p.c2, 0.4) : k & 1 ? dk : c1;
            if (m === 2) INK.blob(ctx, r + 4 + fl, 0, 9, 6.5, col, true, sd + k, 0.1);
            else INK.wpoly(ctx, [[r - 5, -7], [L, 0], [r - 5, 7]], col, true, sd + k, 0.8);
            ctx.restore();
          }
        }
      }
      if (m !== 1) {
        ctx.lineWidth = 2.4; ctx.beginPath();
        for (let k = 0; k < 5; k++) { const q = -2.5 + k * 0.42; ctx.moveTo(Math.cos(q) * r, -2 + Math.sin(q) * r); ctx.lineTo(Math.cos(q) * (r + 6), -2 + Math.sin(q) * (r + 6)); }
        ctx.stroke(); ctx.lineWidth = 3;
      }
      s.ar = 12;
      DRAW._fb(ctx, p, s, 0, -2, r, -2 - r);
      ctx.save(); ctx.translate(0, -2); ctx.scale(s.fax, s.fay);
      DRAW._bigEye(ctx, 0, 0, r, s.look, s.shock ? 0 : s.blink, iris, c1, s.shock, s.sad ? "sleepy" : p.eyeStyle);
      ctx.restore();
      if (m === 3) {
        const eo = DRAW._eo2; eo.blink = DRAW._blink(t, sd + 3); eo.style = s.shock ? "wide" : "round"; eo.lid = c1; eo.pupil = 0;
        for (let k = 0; k < n0; k++) { const q = (k / n0) * 6.2832 + ph, R = r + 9 + fl; INK.eye(ctx, Math.cos(q) * R, -2 + Math.sin(q) * R, 2.8, s.look, eo); }
      }
      if (a[3] < 0.3 && !s.sad) {
        ctx.lineWidth = 4.4; ctx.beginPath(); ctx.arc(0, -2 + (s.shock ? -4 : 2), r + 4, Math.PI * 1.22, Math.PI * 1.78); ctx.stroke(); ctx.lineWidth = 3;
      }
      DRAW._mouth(ctx, 0, 22, 0.6, s.shock ? "O" : s.sad ? "sad" : p.mouth, s.talk ? Math.abs(Math.sin(t * 15)) : 0);
      if (p.acc && p.acc !== "none") DRAW._acc(ctx, p.acc, 0, 12, 1, r, -2 - r, DRAW._E1, 1, -2, r / 1.3, s.shock);
      DRAW._ff(ctx, p, s, 0, -2, r, -2 - r);
      ctx.restore();
    },
    mouth(ctx, p, s) {    // flytrap: jaw size, teeth style (0 pointy 1 square 2 fangs 3 gappy + gold), bristles, stalk length
      const t = s.t, sd = s.seed, v = s.v, a = v.a, m = v.m, c1 = p.c1, K = INK.C, inner = DRAW._mx(p.c2, "#ff7eb6", 0.5);
      const JL = 21 + a[0] * 5, D = 21 + a[1] * 6, bris = a[2] < 0.45, stk = a[3] * 7, gold = m === 3 ? 1 + ((a[4] * 3) | 0) : -1;
      DRAW._stem(ctx, -10, 10, 2 + v.bend * 8, 30, 0, 44, 6, v.lc);
      DRAW._leaf(ctx, 0, 36, -2.7, 13 + a[5] * 5, v.lc, sd); DRAW._leaf(ctx, 0, 38, -0.4, 12 + a[6] * 5, v.lc, sd + 1);
      let open = 0.2 + 0.55 * Math.max(0, Math.sin(t * 1.7 + sd)) ** 8;
      if (s.talk) open = 0.15 + Math.abs(Math.sin(t * 14)) * 0.45;
      if (s.shock) open = 0.9; else if (s.sad) open = 0.06;
      ctx.save(); ctx.translate(2, -6); ctx.rotate(s.sway * 1.5);
      let L = s.look;
      if (s.dir < 0) { ctx.scale(-1, 1); L = { x: -L.x, y: L.y }; }
      INK.oval(ctx, 0, 0, JL - 2, 3 + open * 17, K.ink);
      const tw = Math.sin(t * 3 + sd) * 3, tl = (p.mouth === "tongue" ? 16 : 10) + a[7] * 6;
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(10, open * 10 + tw, 14 + tl, open * 14 + 4 + tw);
      ctx.lineWidth = 9; ctx.stroke(); ctx.lineWidth = 5.5; ctx.strokeStyle = K.pink; ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = K.ink;
      const jaw = (dn) => {
        const sg = dn ? 1 : -1, hc = c => { c.beginPath(); c.moveTo(-JL, 0); c.bezierCurveTo(-JL, D * sg, JL, D * sg, JL + 3, 0); c.closePath(); };
        ctx.save(); ctx.translate(-JL + 2, 0); ctx.rotate((dn ? 0.42 : -0.6) * open); ctx.translate(JL - 2, 0);
        if (bris) {
          ctx.lineWidth = 2; ctx.beginPath();
          for (let k = 1; k < 8; k++) {
            const u = k / 8, w = 1 - u, x = w * w * w * -JL + 3 * w * w * u * -JL + 3 * w * u * u * JL + u * u * u * (JL + 3), y = 3 * u * w * D * sg;
            const nx = x * 0.6, ny = y - D * 0.25 * sg, d = Math.hypot(nx, ny) || 1;
            ctx.moveTo(x, y); ctx.lineTo(x + (nx / d) * 6, y + (ny / d) * 6);
          }
          ctx.stroke(); ctx.lineWidth = 3;
        }
        if (!dn) DRAW._fb(ctx, p, s, 2, -12, 16, -D * 0.72);
        DRAW._inset(ctx, hc, c1, 0, 9 * sg, 0.9);
        ctx.beginPath(); ctx.moveTo(-JL + 2, 0); ctx.quadraticCurveTo(2, 9 * sg, JL + 2, 0); ctx.closePath();
        ctx.fillStyle = inner; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath();
        if (m === 1) { for (let x = -JL + 9; x < JL - 1; x += 7) ctx.rect(x - 2.6, 0, 5.2, -5 * sg); }
        else if (m === 2) { const fx = [-JL * 0.45, JL * 0.05, JL * 0.55]; for (let k = 0; k < 3; k++) { if (dn && k === 1) continue; ctx.moveTo(fx[k] - 3.4, 0); ctx.lineTo(fx[k], -11 * sg); ctx.lineTo(fx[k] + 3.4, 0); } }
        else { let i = 0; for (let x = -JL + 11; x < JL; x += 6.5, i++) { if (m === 3 && i === 2) continue; ctx.moveTo(x - 2.6, 0); ctx.lineTo(x, -6 * sg); ctx.lineTo(x + 2.6, 0); } }
        ctx.fillStyle = "#fffbea"; ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke();
        if (gold > 0 && !dn) { const gx = -JL + 11 + gold * 6.5 + 6.5; ctx.beginPath(); ctx.moveTo(gx - 2.6, 0); ctx.lineTo(gx, 6); ctx.lineTo(gx + 2.6, 0); ctx.fillStyle = K.gold; ctx.fill(); ctx.stroke(); }
        ctx.lineWidth = 3;
        if (v.pat === 2 || v.pat === 5) { ctx.strokeStyle = p.c2; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-JL * 0.7, 11 * sg); ctx.quadraticCurveTo(0, (D * 0.7) * sg, JL * 0.75, 11 * sg); ctx.stroke(); ctx.strokeStyle = K.ink; ctx.lineWidth = 3; }
        else { INK.oval(ctx, -8, 12 * sg, 3, 2.4, p.c2); INK.oval(ctx, 6, 15 * sg, 2.2, 1.8, p.c2); if (v.pat) INK.oval(ctx, 14, 9 * sg, 1.8, 1.5, p.c2); }
        if (!dn) {
          const ne = p.eyes === 1 || p.eyes === 3 ? p.eyes : 2, EX = DRAW._EM, eo = DRAW._eo;
          let style = p.eyeStyle || "round";
          if (s.shock) style = "wide"; else if (s.sad && style !== "spiral") style = "sleepy";
          eo.blink = s.shock ? 0 : s.blink; eo.style = style; eo.lid = c1; eo.pupil = s.shock ? 0.22 : 0;
          ctx.beginPath();
          for (let i = 0; i < ne; i++) { const e = EX[ne - 1][i]; ctx.moveTo(e[0], -15); ctx.lineTo(e[0] + Math.sin(t * 2 + i) * 1.5, e[1] - stk); }
          ctx.stroke();
          for (let i = 0; i < ne; i++) { const e = EX[ne - 1][i]; INK.eye(ctx, e[0] + Math.sin(t * 2 + i) * 1.5, e[1] - stk, e[2] * (s.shock ? 1.2 : 1), L, eo); }
          if (p.acc && p.acc !== "none" && p.acc !== "mustache") DRAW._acc(ctx, p.acc, 4, -14 - stk, 1, 18, -34 - stk, DRAW._EMa[ne - 1], ne, 0, 5.4, s.shock);
          if (p.acc === "mustache") DRAW._acc(ctx, "mustache", 18, -10, 1, 10, -20, DRAW._E1, 1, -20, 4, false);
          if (v.feat !== "none" || v.feat2 !== "none") DRAW._ff(ctx, p, s, 2, -18 - stk * 0.5, 14, -30 - stk);
        }
        ctx.restore();
      };
      jaw(true); jaw(false);
      ctx.restore();
    },
    blob(ctx, p, s) {     // 0 round, 1 drop, 2 puddle, 3 double blob; something different floats inside each
      const t = s.t, sd = s.seed, v = s.v, a = v.a, m = v.m, c1 = p.c1, K = INK.C, wv = Math.sin(t * (2.4 + a[0] * 1.6) + sd) * 0.06;
      INK.wpoly(ctx, [[-4.5, 26], [4.5, 26], [4, 44], [-4, 44]], DRAW._sh(c1, -0.15), true, sd + 3, 0.4);
      INK.oval(ctx, 0, 40, 25, 4.5, DRAW._ca(c1, 0.3));
      ctx.save(); ctx.translate(0, 36); ctx.scale(1 + wv, 1 - wv); ctx.translate(0, -36);
      const j1 = INK.j(sd, 1), j2 = INK.j(sd, 2), tip = (a[1] - 0.5) * 14;
      const bp = m === 1 ? c => {
        c.beginPath(); c.moveTo(tip, -27); c.bezierCurveTo(8, -12, 30 + j1, 2, 28, 18); c.bezierCurveTo(26, 37, -26, 37, -28, 18); c.bezierCurveTo(-30 + j2, 2, -8, -12, tip, -27); c.closePath();
      } : m === 2 ? c => INK.blobPath(c, 0, 16, 36, 20, sd, 0.08)
        : m === 3 ? c => {
          c.beginPath(); c.ellipse(-4, 15, 26 + j1 * 0.8, 21 + j2 * 0.6, 0, 0, 6.2832);
          c.moveTo(27.5 + j2 * 0.5, -13); c.ellipse(15, -13, 12.5 + j2 * 0.5, 11.5 + j1 * 0.4, 0, 0, 6.2832);
        }
        : c => INK.blobPath(c, 0, 8, 31, 28, sd, 0.1);
      const fx = m === 1 ? 0 : m === 2 ? 0 : m === 3 ? -4 : 1, fy = m === 1 ? 13 : m === 2 ? 13 : m === 3 ? 14 : 0, fs = m === 2 ? 1 : m === 3 ? 0.95 : 1.05;
      DRAW._fb(ctx, p, s, fx, fy, 20, fy - 22);
      bp(ctx); ctx.fillStyle = DRAW._ca(c1, 0.5); ctx.fill();
      ctx.save(); bp(ctx); ctx.clip();
      INK.oval(ctx, fx + 4, fy + 14, 25, 20, DRAW._ca(DRAW._sh(c1, -0.3), 0.35));
      ctx.globalAlpha = 0.65;
      const ci = (a[2] * 7) | 0, ix = fx - 13 + Math.sin(t * 0.9) * 3, iy = fy + 19 + Math.cos(t * 1.1) * 2;
      ctx.save(); ctx.translate(ix, iy); ctx.rotate(Math.sin(t * 0.7 + sd) * 0.4);
      if (ci === 0) DRAW.bean(ctx, false, t * 0.3, sd);
      else if (ci === 1) DRAW.coin(ctx, 6);
      else if (ci === 2) { ctx.lineWidth = 2; INK.wpoly(ctx, [[5, 0], [11, -5], [11, 5]], K.or, true, sd, 0.4); INK.oval(ctx, 0, 0, 7, 4.5, K.or, true); INK.oval(ctx, -3.5, -1, 1, 1, K.ink); }
      else if (ci === 3) { ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-5, 0, 3.5, 0, 6.2832); ctx.moveTo(-1.5, 0); ctx.lineTo(9, 0); ctx.lineTo(9, 3.5); ctx.moveTo(6, 0); ctx.lineTo(6, 3); ctx.strokeStyle = K.gold; ctx.lineWidth = 2.4; ctx.stroke(); ctx.strokeStyle = K.ink; }
      else if (ci === 4) { ctx.lineWidth = 1.6; DRAW._sockShape(ctx, 5, 6, K.red, "#fff3dc", 0); }
      else if (ci === 5) { ctx.lineWidth = 1.8; INK.oval(ctx, 0, 2, 7, 4.5, K.gold, true); INK.oval(ctx, -4, -3, 3.6, 3.4, K.gold, true); INK.wpoly(ctx, [[-7, -3], [-11, -2], [-7, -1]], K.or, true, sd, 0.2); INK.oval(ctx, -4.5, -4, 0.8, 0.8, K.ink); }
      ctx.restore();
      ctx.lineWidth = 1.6;
      INK.oval(ctx, fx + 14, fy + 22 - ((t * 6) % 12), 3, 3, "rgba(255,255,255,0.6)", true);
      INK.oval(ctx, fx + 19, fy + 14 - ((t * 5) % 10), 2, 2, "rgba(255,255,255,0.6)", true);
      if (v.pat === 3 || v.pat === 1) { ctx.globalAlpha = 0.35; DRAW._pat(ctx, v.pat, fx, fy + 6, 30, 24, "#ffffff", sd); }
      ctx.globalAlpha = 1; ctx.restore();
      ctx.lineWidth = 3; bp(ctx); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(fx, fy + 8, 22, 3.5, 4.3); ctx.stroke();
      INK.oval(ctx, fx - 12, fy - 12, 2.4, 2.4, "rgba(255,255,255,0.85)");
      ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
      const nd = (a[3] * 3) | 0;
      for (let k = 0; k < nd; k++) { const dy = (t * 0.6 + sd + k * 0.37) % 1, dx = k ? -20 : 22; INK.oval(ctx, fx + dx, fy + 26 + dy * 8, 2.4, 3 + dy * 1.5, DRAW._ca(c1, 0.7), true); }
      if (m === 3) {
        const eo = DRAW._eo2; eo.blink = DRAW._blink(t, sd + 4); eo.style = "round"; eo.lid = c1; eo.pupil = 0;
        INK.eye(ctx, 12, -15, 2.8, s.look, eo); INK.eye(ctx, 18.5, -15.5, 2.5, s.look, eo);
        ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(15, -10, 2.2, 0.3, 2.8); ctx.stroke(); ctx.lineWidth = 3;
      }
      DRAW._face(ctx, p, s, fx, fy, fs, 24, fy - 20, DRAW._mx(c1, "#ffffff", 0.3));
      DRAW._ff(ctx, p, s, fx, fy, 22, fy - 24);
      ctx.restore();
    },
    hand(ctx, p, s) {     // 3-6 arms of different lengths, gloves of different colours, gestures
      const t = s.t, sd = s.seed, v = s.v, a = v.a, m = v.m, c1 = p.c1;
      const gi = (a[0] * 5) | 0, hc = gi === 0 ? DRAW._mx(p.c2, "#fff3dc", 0.3) : gi === 1 ? "#ffffff" : gi === 2 ? "#f2c79b" : gi === 3 ? DRAW._sh(c1, 0.4) : DRAW._mx(p.c2, c1, 0.5);
      const n = 3 + ((a[1] * 4) | 0), spread = 0.6 + a[2] * 0.32, hs = 0.8 + a[3] * 0.28, by = 6 + a[4] * 4;
      DRAW._stem(ctx, 0, by + 12, 3 + v.bend * 6, 32, 0, 44, 6, v.lc);
      for (let k = 0; k < n; k++) {
        const u = n > 1 ? k / (n - 1) : 0.5, R = 21 + INK.n(sd, k + 3) * 4 + 4 + (m === 2 ? (k & 1) * 6 : 0);
        let ang = -Math.PI * (0.5 + spread * 0.5) + spread * Math.PI * u + Math.sin(t * 1.3 + k) * 0.06 + s.sway;
        const droop = m === 1 ? 9 * (1 - Math.abs(Math.sin(ang))) + 4 : 0;
        const ex = Math.cos(ang) * R, ey = by - 2 + Math.sin(ang) * R + droop;
        DRAW._stem(ctx, 0, by - 2, Math.cos(ang) * R * 0.5 + 3, by - 2 + Math.sin(ang) * R * 0.5 - (m === 1 ? 6 : -3), ex, ey, 3.5, v.lc);
        const wv = s.shock ? 0.6 : Math.sin(t * (4 + a[5] * 3) + k * 1.4) * 0.38;
        const g = m === 0 ? 31 : DRAW._GEST[((INK.n(sd, k + 30) * 0.5 + 0.5) * 6.99) | 0];
        DRAW._handG(ctx, ex, ey, Math.atan2(ey - by + 2, ex) + Math.PI / 2 + wv, hc, 0.95 * hs, g);
      }
      const rx = 15 + a[6] * 4, ry = 14 + a[7] * 4;
      DRAW._fb(ctx, p, s, 0, by, rx, by - ry);
      DRAW._pbody(ctx, 0, by, rx, ry, c1, sd, 0.06, s);
      DRAW._face(ctx, p, s, 0, by + 1, 0.95 * rx / 17, rx, by - ry, c1);
      DRAW._ff(ctx, p, s, 0, by, rx, by - ry);
    },
    sock(ctx, p, s) {     // 0 radial, 1 hanging like a jellyfish, 2 upward bouquet, 3 odd socks in every colour
      const t = s.t, sd = s.seed, v = s.v, a = v.a, m = v.m, c1 = p.c1, dk = DRAW._sh(c1, -0.15), SC = DRAW._SOCKC;
      const n = Math.max(4, Math.min(8, (p.pt || 6) + (a[0] < 0.3 ? -1 : a[0] > 0.75 ? 1 : 0)));
      const sw = 7 + a[1] * 2.5, sh = 10 + a[2] * 4.5, hr = 13 + a[3] * 4, pat0 = (a[4] * 3) | 0, bx = v.bend * 8 - 3;
      DRAW._stem(ctx, 0, 16, bx, 30, 0, 44, 5, v.lc);
      DRAW._sl(ctx, s, 16, bx, 30, (v.leaves % 2) + (m === 1 ? 0 : 1));
      ctx.save(); ctx.rotate(s.sway * 1.4);
      const lw = ctx.lineWidth; ctx.lineWidth = 2.4;
      for (let k = 0; k < n; k++) {
        let ang;
        if (m === 1) ang = (k / (n - 1) - 0.5) * 2.9 + Math.sin(t * 1.5 + k) * 0.08;
        else if (m === 2) ang = Math.PI + (k / (n - 1) - 0.5) * 2.5;
        else ang = (k / n) * 6.2832 + t * 0.2 * (v.spin < 0 ? -1 : 1) + sd;
        ctx.save(); ctx.rotate(ang); ctx.translate(0, hr - 3 + (s.shock ? 3 : 0));
        ctx.rotate(Math.sin(t * 3 + k) * 0.15); ctx.translate(-sw / 2, 0);
        if (m === 3) DRAW._sockShape(ctx, sw, sh, SC[(sd + k * 3) % SC.length], "#fff3dc", k % 3);
        else DRAW._sockShape(ctx, sw, sh, k & 1 ? dk : c1, p.c2, pat0);
        ctx.restore();
      }
      ctx.lineWidth = lw;
      const cc = DRAW._mx(p.c2, "#fff3dc", 0.55);
      s.ar = m === 2 ? 4 : sh;
      DRAW._fb(ctx, p, s, 0, 0, hr, -hr);
      DRAW._pbody(ctx, 0, 0, hr, hr - 0.5, cc, sd + 2, 0.05, s);
      DRAW._face(ctx, p, s, 0, 1, 0.95 * hr / 15, hr, -hr, cc);
      DRAW._ff(ctx, p, s, 0, 0, hr, -hr);
      ctx.restore();
    },
    coat(ctx, p, s) {     // coat colour, belt, buttons, boots, briefcase, fedora; top head 0 flower 1 shroom 2 cactus 3 fern
      const t = s.t, sd = s.seed, v = s.v, a = v.a, m = v.m, K = INK.C, sh = Math.sin(t * 5 + sd) * 1.5;
      const CC = DRAW._COATC, tan = CC[(a[0] * CC.length) | 0], tdk = DRAW._sh(tan, -0.2);
      DRAW._stem(ctx, 0, 33, 1, 40, 0, 44, 3.5, v.lc);
      if (a[3] < 0.4) { INK.blob(ctx, -9 + sh, 40.5, 6.5, 3.6, "#2e2140", true, sd, 0.08); INK.blob(ctx, 9 - sh, 40.5, 6.5, 3.6, "#2e2140", true, sd + 1, 0.08); }
      else { INK.blob(ctx, -9 + sh, 41, 6, 3.2, v.lc || K.leaf, true, sd, 0.1); INK.blob(ctx, 9 - sh, 41, 6, 3.2, v.lc || K.leaf, true, sd + 1, 0.1); }
      const sl = c => { c.beginPath(); c.moveTo(-14, -12); c.quadraticCurveTo(-25, -2, -22, 16); c.lineTo(-15, 16); c.lineTo(-11, 0); };
      sl(ctx); ctx.lineWidth = 3; ctx.fillStyle = tdk; ctx.fill(); ctx.stroke();
      ctx.save(); ctx.scale(-1, 1); sl(ctx); ctx.fill(); ctx.stroke(); ctx.restore();
      DRAW._leaf(ctx, -19, 16, 1.9 + Math.sin(t * 3) * 0.2, 9, v.lc, sd); DRAW._leaf(ctx, 19, 16, 1.2 - Math.sin(t * 3) * 0.2, 9, v.lc, sd + 1);
      const cp = c => { c.beginPath(); c.moveTo(-15, -15); c.lineTo(15, -15); c.lineTo(21 + INK.j(sd, 3), 37); c.lineTo(-21, 37 + INK.j(sd, 4)); c.closePath(); };
      DRAW._inset(ctx, cp, tan, 0, 11, 0.92);
      if (v.pat === 2 || v.pat === 3) { ctx.save(); cp(ctx); ctx.clip(); DRAW._pat(ctx, v.pat === 2 ? 2 : 3, 0, 12, 22, 26, DRAW._sh(tan, -0.12), sd); ctx.restore(); cp(ctx); ctx.stroke(); }
      INK.wpoly(ctx, [[0, 20], [5, 37], [-5, 37]], K.ink, false, sd, 0.5);
      const eo = DRAW._eo; eo.blink = s.blink; eo.style = s.shock ? "wide" : "round"; eo.lid = K.leaf; eo.pupil = 0;
      INK.eye(ctx, -1.6, 31, 2.2, s.look, eo); INK.eye(ctx, 1.8, 31.5, 2, s.look, eo);
      INK.wpoly(ctx, [[-9, -15], [9, -15], [0, 6]], DRAW._sh(p.c1, -0.1), true, sd + 5, 0.5);
      INK.eye(ctx, -2.8, -7, 3.2, s.look, eo); INK.eye(ctx, 3, -7.4, 2.9, s.look, eo);
      if (a[4] < 0.5) INK.eye(ctx, 0.2, -1.6, 2.2, s.look, eo);
      INK.wpoly(ctx, [[-15, -15], [-8, -15], [-1, 6], [-9, 2]], tdk, true, sd + 6, 0.5);
      INK.wpoly(ctx, [[15, -15], [8, -15], [1, 6], [9, 2]], tdk, true, sd + 7, 0.5);
      if (a[1] < 0.65) {
        INK.wpoly(ctx, [[-18, 10], [18, 10], [18.5, 15], [-18.5, 15]], DRAW._sh(tan, -0.35), true, sd + 8, 0.4);
        INK.wpoly(ctx, [[-3, 9.5], [3, 9.5], [3, 15.5], [-3, 15.5]], K.gold, true, sd + 9, 0.3);
      }
      ctx.lineWidth = 1.5;
      const nb = 2 + ((a[2] * 3) | 0);
      for (let k = 0; k < nb; k++) INK.oval(ctx, k & 1 ? 6 : -6, 19 + (k >> 1) * 7, 1.6, 1.6, "#5a4020", true);
      ctx.lineWidth = 3;
      const cu = a[5] < 0.45 ? 9 : 0;
      INK.wpoly(ctx, [[-15, -15], [-11 - cu * 0.4, -24 - cu], [-5, -15]], tan, true, sd + 10, 0.5);
      INK.wpoly(ctx, [[15, -15], [11 + cu * 0.4, -24 - cu], [5, -15]], tan, true, sd + 11, 0.5);
      if (a[6] < 0.3) {     // a tiny briefcase in one sleeve
        const bx = a[7] < 0.5 ? -21 : 21;
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, 19, 2.6, Math.PI, 0); ctx.stroke();
        INK.wpoly(ctx, [[bx - 6, 20], [bx + 6, 20], [bx + 6, 28], [bx - 6, 28]], "#7a4a2a", true, sd + 12, 0.3);
        INK.oval(ctx, bx, 22.5, 1.2, 1, K.gold); ctx.lineWidth = 3;
      }
      ctx.save(); ctx.translate(0, -27); ctx.rotate(s.sway * 2.5);
      const n = Math.max(5, Math.min(8, p.pt || 6)), hc = m === 2 ? p.c1 : p.c2;
      if (m === 0) {
        for (let k = 0; k < n; k++) { ctx.save(); ctx.rotate((k / n) * Math.PI * 2 + t * 0.4); ctx.translate(4, 0); DRAW._petal(ctx, v.petal, 13, 8, k & 1 ? DRAW._sh(p.c1, -0.16) : p.c1, sd + k); ctx.restore(); }
      } else if (m === 3) {
        for (let k = 0; k < 4; k++) DRAW._frondV(ctx, 0, -2, -2.5 + k * 0.62 + Math.sin(t * 2 + k) * 0.08, 19, k & 1 ? DRAW._sh(p.c1, -0.16) : p.c1, sd + k, 0.2, 0);
      }
      DRAW._fb(ctx, p, s, 0, 0, 10, m === 1 ? -17 : -10);
      DRAW._body(ctx, 0, 0, m === 2 ? 9 : 10, m === 2 ? 12 : 9.5, hc, sd + 12, 0.05);
      if (m === 1) {
        const cap = c => { c.beginPath(); c.moveTo(-16, -3); c.bezierCurveTo(-15, -22, 15, -22, 16, -3); c.quadraticCurveTo(0, 1, -16, -3); c.closePath(); };
        DRAW._inset(ctx, cap, p.c1, 0, -10, 0.9); ctx.lineWidth = 1.6;
        INK.oval(ctx, -7, -11, 2.6, 2.2, "#fff3dc", true); INK.oval(ctx, 5, -14, 2.2, 2, "#fff3dc", true); INK.oval(ctx, 10, -7, 1.8, 1.6, "#fff3dc", true); ctx.lineWidth = 3;
      } else if (m === 2) {
        ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-7, -6); ctx.lineTo(-10, -8); ctx.moveTo(7, -4); ctx.lineTo(10, -6); ctx.moveTo(-6, 6); ctx.lineTo(-9, 8); ctx.moveTo(7, 7); ctx.lineTo(10, 9); ctx.stroke(); ctx.lineWidth = 2;
        for (let k = 0; k < 5; k++) { const q = k * 1.2566; INK.oval(ctx, Math.cos(q) * 2.6, -13 + Math.sin(q) * 2.6, 2.4, 2.4, p.c2, true); } ctx.lineWidth = 3;
      }
      DRAW._face(ctx, p, s, 0, m === 1 ? 2 : 1, 0.62, 10, m === 1 ? -17 : -9.5, hc);
      if (a[8] < 0.3 && p.acc !== "tophat") {   // fedora
        ctx.save(); ctx.translate(0, m === 1 ? -16 : -8); ctx.rotate(-0.15);
        INK.wpoly(ctx, [[-7, 0], [-6, -8], [0, -6], [6, -8], [7, 0]], "#3a2c4a", true, sd + 13, 0.4);
        INK.wpoly(ctx, [[-7, -2.5], [7, -2.5], [7, 0], [-7, 0]], K.red, false, sd + 14, 0.2);
        INK.oval(ctx, 0, 0.5, 12, 2.4, "#3a2c4a", true); ctx.restore();
      }
      DRAW._ff(ctx, p, s, 0, 0, 10, m === 1 ? -17 : -10);
      ctx.restore();
    },
    neck(ctx, p, s) {     // 0 single, 1 with a ruff collar, 2 twin heads, 3 extra tall S-neck; neck spots/rings/zigzag
      const t = s.t, sd = s.seed, v = s.v, a = v.a, m = v.m, c1 = p.c1, c2 = p.c2, K = INK.C, ph = t * (1 + a[0] * 0.7) + sd;
      const amp = 9 + a[1] * 6, hy0 = m === 3 ? -21 : -12 - a[2] * 8, nw = 5.5 + a[3] * 3, hr = 11 + a[4] * 3, g = a[5] < 0.5 ? -1 : 1;
      const hx = Math.sin(ph) * amp + (s.shock ? Math.sin(t * 30) * 4 : 0), hy = hy0 + Math.abs(Math.sin(ph)) * 3 - (s.shock ? 4 : 0);
      const P0y = 44, c1x = m === 3 ? g * 22 : -hx * 0.9, c1y = m === 3 ? 26 : 10, c2x = m === 3 ? -g * 20 : 0, c2y = m === 3 ? 0 : 0;
      const bez = u => { const w = 1 - u; if (m === 3) { DRAW._A2.x = 3 * w * w * u * c1x + 3 * w * u * u * c2x + u * u * u * hx; DRAW._A2.y = w * w * w * P0y + 3 * w * w * u * c1y + 3 * w * u * u * c2y + u * u * u * hy; } else { DRAW._A2.x = 2 * u * w * c1x + u * u * hx; DRAW._A2.y = w * w * P0y + 2 * u * w * c1y + u * u * hy; } return DRAW._A2; };
      if (m === 2) {        // a second, smaller head on its own neck
        const h2x = Math.sin(ph + 2.1) * amp * 0.5 - g * 19, h2y = hy0 + 20 + Math.sin(ph * 1.3) * 2;
        ctx.beginPath(); ctx.moveTo(0, 44); ctx.quadraticCurveTo(h2x * 0.2, 30, h2x, h2y);
        ctx.lineWidth = nw + 3.5; ctx.stroke(); ctx.lineWidth = nw - 2; ctx.strokeStyle = c2; ctx.stroke(); ctx.strokeStyle = K.ink; ctx.lineWidth = 2.4;
        for (let k = 0; k < 5; k++) { ctx.save(); ctx.translate(h2x, h2y); ctx.rotate((k / 5) * 6.2832 - t * 0.6); INK.blob(ctx, 8, 0, 4.6, 3, k & 1 ? DRAW._sh(c1, -0.16) : c1, true, sd + k + 20, 0.1); ctx.restore(); }
        DRAW._body(ctx, h2x, h2y, 7.5, 7, DRAW._mx(c1, "#fff3dc", 0.45), sd + 21, 0.05, false);
        const eo = DRAW._eo2; eo.blink = DRAW._blink(t, sd + 7); eo.style = s.shock ? "wide" : "round"; eo.lid = c1; eo.pupil = 0;
        INK.eye(ctx, h2x - 2.6, h2y - 1, 2.3, s.look, eo); INK.eye(ctx, h2x + 2.6, h2y - 1.3, 2.1, s.look, eo);
        INK.oval(ctx, h2x, h2y + 3, 1.2, 1.5, K.ink); ctx.lineWidth = 3;
      }
      DRAW._leaf(ctx, 0, 41, -2.7, 14 + a[6] * 4, v.lc, sd); DRAW._leaf(ctx, 0, 41, -0.45, 14 + a[7] * 4, v.lc, sd + 1);
      ctx.beginPath(); ctx.moveTo(0, 44);
      if (m === 3) ctx.bezierCurveTo(c1x, c1y, c2x, c2y, hx, hy); else ctx.quadraticCurveTo(c1x, c1y, hx, hy);
      ctx.lineWidth = nw + 5.5; ctx.stroke(); ctx.lineWidth = nw; ctx.strokeStyle = c2; ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = K.ink;
      const spot = DRAW._sh(c2, -0.35), np = v.pat === 2 ? 2 : v.pat === 5 ? 5 : v.pat === 0 ? 0 : 1;
      if (np === 1) for (let k = 1; k < 6; k++) { const q = bez(k / 6); INK.oval(ctx, q.x + (k & 1 ? 1.2 : -1.2), q.y, nw * 0.3, nw * 0.38, spot); }
      else if (np) {
        ctx.strokeStyle = spot; ctx.lineWidth = 2; ctx.beginPath();
        for (let k = 1; k < 9; k++) { const u = k / 9, q = bez(u), x = q.x, y = q.y, q2 = bez(u + 0.02), dx = q2.x - x, dy = q2.y - y, d = Math.hypot(dx, dy) || 1, ox = (-dy / d) * nw * 0.45, oy = (dx / d) * nw * 0.45;
          if (np === 2) { ctx.moveTo(x - ox, y - oy); ctx.lineTo(x + ox, y + oy); } else { k === 1 ? ctx.moveTo(x + (k & 1 ? ox : -ox), y + (k & 1 ? oy : -oy)) : ctx.lineTo(x + (k & 1 ? ox : -ox), y + (k & 1 ? oy : -oy)); } }
        ctx.stroke(); ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
      }
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(hx * 0.025);
      if (m === 1) {        // Elizabethan ruff
        ctx.beginPath();
        for (let k = 0; k <= 16; k++) { const q = (k / 16) * 6.2832, rr = k & 1 ? hr + 3 : hr + 9; k ? ctx.lineTo(Math.cos(q) * rr, hr * 0.85 + Math.sin(q) * rr * 0.32) : ctx.moveTo(Math.cos(q) * rr, hr * 0.85 + Math.sin(q) * rr * 0.32); }
        ctx.closePath(); ctx.fillStyle = "#fffbea"; ctx.fill(); ctx.lineWidth = 2.2; ctx.stroke(); ctx.lineWidth = 3;
      }
      const n = Math.max(5, Math.min(9, p.pt || 6));
      for (let k = 0; k < n; k++) {
        ctx.save(); ctx.rotate((k / n) * Math.PI * 2 - t * 0.4 * (v.spin < 0 ? -1 : 1)); ctx.translate(hr - 4 + (s.shock ? 3 : 0), 0);
        DRAW._petal(ctx, v.petal, 10 + a[8] * 3.5, 8 + a[9] * 2, k & 1 ? DRAW._sh(c1, -0.16) : c1, sd + k); ctx.restore();
      }
      const hc = DRAW._mx(c1, "#fff3dc", 0.45);
      s.ar = 8;
      DRAW._fb(ctx, p, s, 0, 0, hr, -hr);
      DRAW._pbody(ctx, 0, 0, hr, hr - 0.5, hc, sd + 4, 0.05, s);
      DRAW._face(ctx, p, s, 0, 1, 0.78 * hr / 13, hr, -hr, hc);
      DRAW._ff(ctx, p, s, 0, 0, hr, -hr);
      ctx.restore();
    },
    tooth(ctx, p, s) {    // 0 molars, 1 fangs, 2 gold tooth + braces, 3 baby teeth; sometimes a toothbrush or a cavity
      const t = s.t, sd = s.seed, v = s.v, a = v.a, m = v.m, K = INK.C, gum = DRAW._mx(p.c1, "#ff8fa3", 0.55), iv = "#fffbea", sw = s.sway, TS = DRAW._TS;
      DRAW._stem(ctx, 0, 34, 0, 40, 0, 44, 5, v.lc);
      const nl = 2 + ((a[0] * 3) | 0);
      for (let k = 0; k < nl; k++) { const u = k / (nl - 1) - 0.5; DRAW._leaf(ctx, u * 8, 8, -1.57 + u * 1.5 + sw + Math.sin(t * 1.8 + k) * 0.05, 30 + (1 - Math.abs(u) * 2) * 4 - (nl > 3 ? 3 : 0), v.lc, sd + k); }
      const ns = 2 + ((a[1] * 4) | 0), s0 = (a[5] * 5) | 0, gi = m === 2 || a[2] < 0.2 ? (a[6] * ns) | 0 : -1;
      for (let k = 0; k < ns; k++) {
        const q = TS[(s0 + k) % 5], col = k === gi ? K.gold : iv;
        if (m === 1) DRAW._fang(ctx, q[0], q[1], q[2] * 0.95, col, sd + k + 1, q[3] + sw);
        else if (m === 3) { ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(q[3] + sw); DRAW._body(ctx, 0, 0, 6.5, 8, col, sd + k, 0.08); ctx.restore(); }
        else DRAW._molar(ctx, q[0], q[1], q[2], col, sd + k + 1, q[3] + sw);
        if (k === gi) DRAW._star(ctx, q[0] + 6, q[1] - 7, 3 + Math.abs(Math.sin(t * 3)) * 2, "#fff");
      }
      INK.blob(ctx, 0, 30, 33, 12, gum, true, sd, 0.06);
      const bob = s.shock ? -4 * s.wob : Math.sin(t * 2 + sd) * 0.8;
      DRAW._fb(ctx, p, s, 0, -1 + bob, 14, -14 + bob);
      if (m === 1) DRAW._fang(ctx, 0, 4 + bob, 1.1, iv, sd, sw * 1.5);
      else DRAW._molar(ctx, 0, 4 + bob, 1.12, iv, sd, sw * 1.5);
      if (m === 3) { ctx.lineWidth = 2; for (let k = -1; k <= 1; k += 2) { ctx.save(); ctx.translate(k * 13, 24); ctx.rotate(k * 0.3); DRAW._body(ctx, 0, 0, 4.5, 5.5, iv, sd + 30 + k, 0.08, false); ctx.restore(); } ctx.lineWidth = 3; }
      INK.blob(ctx, 0, 35, 24, 8, gum, true, sd + 5, 0.06);
      INK.oval(ctx, -9, 32, 4, 1.6, "rgba(255,255,255,0.45)");
      if (a[3] < 0.3) INK.blob(ctx, 8, -6 + bob, 2.6, 2.2, "#5a3a2a", false, sd + 6, 0.2);
      if (m === 2) {        // braces
        ctx.lineWidth = 1.6; ctx.strokeStyle = "#9aa6b8"; ctx.beginPath(); ctx.moveTo(-15, 13 + bob); ctx.quadraticCurveTo(0, 16 + bob, 15, 13 + bob); ctx.stroke(); ctx.strokeStyle = K.ink;
        for (let k = -1; k <= 1; k++) { INK.wpoly(ctx, [[k * 9 - 2, 12.5 + bob], [k * 9 + 2, 12.5 + bob], [k * 9 + 2, 16.5 + bob], [k * 9 - 2, 16.5 + bob]], "#c4cedb", true, sd + 40 + k, 0.2); }
        ctx.lineWidth = 3;
      }
      if (a[4] < 0.22) {    // a toothbrush stuck in the gums
        ctx.save(); ctx.translate(20, 26); ctx.rotate(0.55 + Math.sin(t * 2 + sd) * 0.05);
        INK.wpoly(ctx, [[-2.2, 0], [2.2, 0], [2.2, -24], [-2.2, -24]], p.c2, true, sd + 50, 0.3);
        ctx.lineWidth = 1.4; ctx.beginPath(); for (let k = 0; k < 4; k++) { ctx.moveTo(-2, -23 + k * 2.5); ctx.lineTo(-6, -23 + k * 2.5); } ctx.stroke(); ctx.lineWidth = 3;
        ctx.restore();
      }
      const tw = Math.max(0, Math.sin(t * 2.5 + sd));
      if (tw > 0.2) DRAW._star(ctx, 22, -30, 5 * tw, "#fff");
      DRAW._face(ctx, p, s, 0, -1 + bob, 0.85, 14, -14 + bob, iv);
      DRAW._ff(ctx, p, s, 0, -1 + bob, 14, -14 + bob);
    },
  },
  _PC: [[-19, -8, 13], [19, -9, 13], [-10, -24, 14], [11, -25, 13.5], [0, -12, 18], [-8, 2, 11], [9, 2, 11]],
  _EM: [[[2, -24, 6.6]], [[-6, -22, 5.8], [9, -24, 5.2]], [[-9, -21, 5], [3, -27, 4.4], [13, -21, 4.6]]],
  _EMa: [[[-2, -2, 1.22]], [[-10, 0, 1.07], [5, -2, 0.96]], [[-13, 1, 0.93], [-1, -5, 0.81], [9, 1, 0.85]]],
  /* frond variants from (x,y) at angle a: st 0 serrated, 1 ladder of leaflets, 2 smooth blade; droop bends it down */
  _frondV(ctx, x, y, a, L, col, seed, droop, st) {
    const ca = Math.cos(a), sa = Math.sin(a), dr = L * droop * Math.abs(ca), M = 9, lw = ctx.lineWidth;
    if (st === 1) {
      ctx.beginPath();
      for (let i = 1; i < 8; i++) {
        const u = i / 8, w = (1 - u * 0.75) * L * 0.13 + 1.5, px = x + ca * L * u, py = y + sa * L * u + dr * u * u;
        const ta = Math.atan2(sa * L + 2 * dr * u, ca * L);
        ctx.moveTo(px + Math.cos(ta - 1.1) * w * 2, py + Math.sin(ta - 1.1) * w * 2);
        ctx.ellipse(px + Math.cos(ta - 1.1) * w, py + Math.sin(ta - 1.1) * w, w, w * 0.55, ta - 1.1, 0, 6.2832);
        ctx.moveTo(px + Math.cos(ta + 1.1) * w * 2, py + Math.sin(ta + 1.1) * w * 2);
        ctx.ellipse(px + Math.cos(ta + 1.1) * w, py + Math.sin(ta + 1.1) * w, w, w * 0.55, ta + 1.1, 0, 6.2832);
      }
      ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.8; ctx.stroke();
      ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + ca * L * 0.5, y + sa * L * 0.5, x + ca * L, y + sa * L + dr); ctx.stroke();
      ctx.lineWidth = lw; return;
    }
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = 1; i <= M; i++) {
      const u = i / M, w = Math.sin(Math.PI * Math.min(1, u * 1.05)) * L * (st === 2 ? 0.13 : 0.2) * (1 - u * 0.3) * (st === 2 || i & 1 ? 1 : 0.5);
      const px = x + ca * L * u, py = y + sa * L * u + dr * u * u;
      ctx.lineTo(px - sa * w, py + ca * w);
    }
    for (let i = M - 1; i >= 1; i--) {
      const u = i / M, w = Math.sin(Math.PI * Math.min(1, u * 1.05)) * L * (st === 2 ? 0.13 : 0.2) * (1 - u * 0.3) * (st === 2 || i & 1 ? 1 : 0.5);
      const px = x + ca * L * u, py = y + sa * L * u + dr * u * u;
      ctx.lineTo(px + sa * w, py - ca * w);
    }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 2.4; ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + ca * L * 0.5, y + sa * L * 0.5 + dr * 0.15, x + ca * L * 0.92, y + sa * L * 0.92 + dr * 0.85); ctx.stroke();
    ctx.lineWidth = lw;
  },
  /* cartoon hand with a gesture: mask bit i = finger i of _HF extended (31 = open hand) */
  _GEST: [31, 31, 6, 2, 16, 9, 0],
  _handG(ctx, x, y, a, col, sz, mask) {
    if (mask === 31) { DRAW._hand(ctx, x, y, a, col, sz); return; }
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(sz, sz);
    const F = DRAW._HF, lw = ctx.lineWidth;
    const fp = () => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) { const f = F[i], k = (mask >> i) & 1 ? 1 : 0.3; ctx.moveTo(f[0], f[1]); ctx.lineTo(f[0] + (f[2] - f[0]) * k, f[1] + (f[3] - f[1]) * k); }
    };
    fp(); ctx.lineWidth = 6.6; ctx.stroke();
    INK.oval(ctx, 0, -0.5, 7.4, 7.2, INK.C.ink);
    fp(); ctx.lineWidth = 3.4; ctx.strokeStyle = col; ctx.stroke();
    INK.oval(ctx, 0, -0.5, 5.8, 5.6, col);
    ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-3.5, -3.2); ctx.lineTo(2.5, -3.6); ctx.stroke();
    ctx.lineWidth = lw; ctx.restore();
  },
  /* fang / canine tooth pointing up (-y), roots down */
  _fang(ctx, x, y, k, col, seed, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(k, k);
    const lw = ctx.lineWidth; ctx.lineWidth = lw / k;
    const j = INK.j(seed, 1) * 0.8;
    const fp = c => { c.beginPath(); c.moveTo(-10, 14); c.quadraticCurveTo(-12, -2, -2, -17 + j); c.quadraticCurveTo(0, -20, 2, -17 - j); c.quadraticCurveTo(12, -2, 10, 14); c.quadraticCurveTo(0, 18, -10, 14); c.closePath(); };
    DRAW._inset(ctx, fp, col, 0, 0, 0.86);
    INK.oval(ctx, -4.5, -4, 1.8, 4, "rgba(255,255,255,0.9)");
    ctx.lineWidth = lw; ctx.restore();
  },
  _PCV: [
    { c: [[-19, -8, 13], [19, -9, 13], [-10, -24, 14], [11, -25, 13.5], [0, -12, 18], [-8, 2, 11], [9, 2, 11]], fy: -10, fs: 1.05, hw: 22, top: -36, ty: 4, f: [0, 1, 3], bx: 0, by: -11, rx: 32, ry: 26 },
    { c: [[0, -33, 9.5], [-8, -23, 11], [8, -24, 11], [-10, -9, 12.5], [10, -9, 12.5], [0, -15, 15], [-6, 4, 10.5], [6, 4, 10.5]], fy: -13, fs: 0.92, hw: 16, top: -40, ty: 8, f: [1, 3, 7], bx: 0, by: -13, rx: 22, ry: 30 },
    { c: [[-27, -12, 10], [-15, -19, 12.5], [0, -21, 13.5], [15, -19, 12.5], [27, -12, 10], [-12, -6, 12], [12, -6, 12], [0, -9, 15]], fy: -11, fs: 0.95, hw: 20, top: -33, ty: -2, f: [0, 4, 5], bx: 0, by: -14, rx: 37, ry: 20 },
    { c: [[0, 14, 9.5], [0, -14, 17], [0, -36, 6.5]], fy: -14, fs: 1, hw: 17, top: -31, ty: 14, f: [0, 0, 2], bx: 0, by: -14, rx: 17, ry: 17 },
  ],
  _IRIS: ["#6ad1ff", "#7be07b", "#b5763a", "#c58bff", "#ff9a3c", "#ff5a5a", "#3fbfa8"],
  _COATC: ["#c9a26b", "#9aa3b5", "#6a7fb5", "#9b72b0", "#8a9a5b", "#c96b5b", "#e0c070"],
  _TS: [[-14, -20, 0.6, -0.25], [14, -22, 0.58, 0.3], [-24, 2, 0.58, -0.45], [24, 1, 0.56, 0.45], [0, -31, 0.46, 0.02]],
  _SOCKC: ["#ff5a5a", "#6ad1ff", "#7be07b", "#c58bff", "#ffd23f", "#ff9a3c", "#ff7eb6"],
  _TRK: ["#9a6a44", "#7a5236", "#b08a5e"],
  _A2: { x: 0, y: 0 },
  /* serrated fern frond from (x,y) at angle a */
  _frond(ctx, x, y, a, L, col, seed) {
    const ca = Math.cos(a), sa = Math.sin(a), dr = L * 0.25 * Math.abs(ca), M = 9;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = 1; i <= M; i++) {
      const u = i / M, w = Math.sin(Math.PI * Math.min(1, u * 1.05)) * L * 0.2 * (1 - u * 0.3) * (i & 1 ? 1 : 0.5);
      const px = x + ca * L * u, py = y + sa * L * u + dr * u * u;
      ctx.lineTo(px - sa * w, py + ca * w);
    }
    for (let i = M - 1; i >= 1; i--) {
      const u = i / M, w = Math.sin(Math.PI * Math.min(1, u * 1.05)) * L * 0.2 * (1 - u * 0.3) * (i & 1 ? 1 : 0.5);
      const px = x + ca * L * u, py = y + sa * L * u + dr * u * u;
      ctx.lineTo(px + sa * w, py - ca * w);
    }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    const lw = ctx.lineWidth; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + ca * L * 0.5, y + sa * L * 0.5 + dr * 0.15, x + ca * L * 0.92, y + sa * L * 0.92 + dr * 0.85); ctx.stroke();
    ctx.lineWidth = lw;
  },
  /* cartoon hand at (x,y), fingers pointing along local -y after rotation a */
  _HF: [[-4.5, -3, -7.5, -9], [-1.5, -4, -2.4, -11.5], [1.6, -4, 2.4, -12], [4.5, -3, 7, -9.5], [5, 1.5, 10, -1]],
  _hand(ctx, x, y, a, col, sz) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(sz, sz);
    const F = DRAW._HF, lw = ctx.lineWidth, fp = () => { ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(F[i][0], F[i][1]); ctx.lineTo(F[i][2], F[i][3]); } };
    fp(); ctx.lineWidth = 6.6; ctx.stroke();
    INK.oval(ctx, 0, 0, 7.4, 6.8, INK.C.ink);
    fp(); ctx.lineWidth = 3.4; ctx.strokeStyle = col; ctx.stroke();
    INK.oval(ctx, 0, 0, 5.8, 5.2, col);
    ctx.strokeStyle = INK.C.ink; ctx.lineWidth = lw; ctx.restore();
  },
  /* sock outline: origin = top centre of cuff, leg goes +y, foot points +x */
  _sockPath(ctx, w, h) {
    const hw = w / 2; ctx.beginPath(); ctx.moveTo(-hw, 0); ctx.lineTo(-hw, h);
    ctx.quadraticCurveTo(-hw, h + w * 0.95, hw * 0.5, h + w * 0.95);
    ctx.lineTo(w * 1.05, h + w * 0.95);
    ctx.quadraticCurveTo(w * 1.62, h + w * 0.95, w * 1.52, h + w * 0.42);
    ctx.quadraticCurveTo(w * 1.42, h - w * 0.05, hw, h - w * 0.05);
    ctx.lineTo(hw, 0); ctx.closePath();
  },
  _sockShape(ctx, w, h, col, stripe, pat) {
    const hw = w / 2;
    DRAW._sockPath(ctx, w, h); ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = stripe;
    if (pat === 0) { for (let y = h * 0.3; y < h - 1; y += h * 0.3) ctx.fillRect(-hw + 0.5, y, w - 1, h * 0.12); }
    else if (pat === 1) { ctx.beginPath(); for (let k = 0; k < 4; k++) { const dx = k & 1 ? hw * 0.4 : -hw * 0.4, dy = h * (0.3 + k * 0.2); ctx.moveTo(dx + w * 0.12, dy); ctx.arc(dx, dy, w * 0.12, 0, 6.2832); } ctx.fill(); }
    else { ctx.beginPath(); for (let k = 0; k < 2; k++) { const dy = h * (0.42 + k * 0.32); ctx.moveTo(0, dy - h * 0.15); ctx.lineTo(hw * 0.7, dy); ctx.lineTo(0, dy + h * 0.15); ctx.lineTo(-hw * 0.7, dy); ctx.closePath(); } ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(w * 1.05, h + w * 0.95); ctx.quadraticCurveTo(w * 1.62, h + w * 0.95, w * 1.52, h + w * 0.42);
    ctx.quadraticCurveTo(w * 1.45, h + w * 0.12, w * 1.12, h + w * 0.02); ctx.quadraticCurveTo(w * 0.92, h + w * 0.5, w * 1.05, h + w * 0.95); ctx.fill();
    ctx.fillStyle = DRAW._sh(col, -0.22); ctx.fillRect(-hw + 0.5, 0.5, w - 1, h * 0.17);
    DRAW._sockPath(ctx, w, h); ctx.stroke();
  },
  /* a molar with two cusps and two roots */
  _molar(ctx, x, y, k, col, seed, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(k, k);
    const lw = ctx.lineWidth; ctx.lineWidth = lw / k;
    const j = INK.j(seed, 1) * 0.8;
    const mp = c => {
      c.beginPath(); c.moveTo(-14, -2); c.quadraticCurveTo(-15, -16 + j, -8, -16); c.quadraticCurveTo(-3, -16, 0, -12);
      c.quadraticCurveTo(3, -16, 8, -16); c.quadraticCurveTo(15, -16 - j, 14, -2); c.quadraticCurveTo(13, 10, 9, 16);
      c.quadraticCurveTo(5, 16, 4, 6); c.quadraticCurveTo(0, 3, -4, 6); c.quadraticCurveTo(-5, 16, -9, 16);
      c.quadraticCurveTo(-13, 10, -14, -2); c.closePath();
    };
    DRAW._inset(ctx, mp, col, 0, 0, 0.86);
    INK.oval(ctx, -7, -9, 2.4, 3.4, "rgba(255,255,255,0.9)");
    ctx.lineWidth = lw; ctx.restore();
  },
  /* four-point sparkle */
  _star(ctx, x, y, r, col) {
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    const lw = ctx.lineWidth; ctx.lineWidth = Math.max(1, r * 0.25); ctx.stroke(); ctx.lineWidth = lw;
  },

  /* ================= GERALD ================= */
  _GC: "#6bd36b",
  _geraldHead(c) {
    const j = INK.j;
    c.beginPath(); c.moveTo(-35, 2);
    c.bezierCurveTo(-37, -31 + j(5, 1), -10, -36, 3, -28);
    c.bezierCurveTo(14, -36 + j(5, 2), 39, -31, 35, 1);
    c.bezierCurveTo(33 + j(5, 3), 35, -33, 36, -35, 2); c.closePath();
  },
  gerald(ctx, o) {
    o = o || DRAW._Z;
    const t = o.t != null ? o.t : INK.t, sc = o.scale || 1, mood = o.mood || "grump", K = INK.C, GC = DRAW._GC;
    const sp = Math.max(0, Math.min(1, o.spit || 0));
    ctx.save(); ctx.scale(sc, sc); DRAW._ink(ctx, 3.5);
    const look = o.look || DRAW._look(ctx, 0, -6);
    const bl = mood === "shock" ? 0 : Math.max(o.blink || 0, DRAW._blink(t, 11));
    const br = Math.sin(t * 2.2) * 0.022, pf = sp * 0.09, w = Math.sin(t * 6);
    if (o.neck !== false) DRAW._stem(ctx, 0, 14, 2, 30, 0, 46, 12, K.leaf);
    let aL, aR;
    switch (mood) {
      case "happy": aL = Math.PI + 0.7 + w * 0.3; aR = -0.7 - w * 0.3; break;
      case "shock": aL = Math.PI + 1.1 + Math.sin(t * 40) * 0.1; aR = -1.1 - Math.sin(t * 40) * 0.1; break;
      case "sad": aL = Math.PI - 1.25; aR = 1.25; break;
      case "talk": aL = Math.PI - 0.35 + Math.sin(t * 3) * 0.3; aR = 0.1 - Math.abs(Math.sin(t * 4.5)) * 0.9; break;
      default: aL = Math.PI - 0.55 - sp * 0.4 + Math.sin(t * 1.6) * 0.06; aR = 0.55 + sp * 0.4 - Math.sin(t * 1.6) * 0.06;
    }
    DRAW._leaf(ctx, -30, 12, aL, 22, GC, 3); DRAW._leaf(ctx, 30, 12, aR, 22, GC, 4);
    DRAW._leaf(ctx, -5, -24, -1.95 + Math.sin(t * 2.1) * 0.15, 17, GC, 5);
    DRAW._leaf(ctx, 5, -25, -1.15 + Math.sin(t * 2.1 + 1) * 0.15, 14, GC, 6);
    ctx.save(); ctx.scale(1 + br + pf, 1 - br + pf * 0.35);
    DRAW._inset(ctx, DRAW._geraldHead, GC, 0, 0, 0.9);
    const dk = DRAW._sh(GC, -0.24);
    INK.oval(ctx, -6, -21, 1.6, 1.6, dk); INK.oval(ctx, 2, -23, 1.3, 1.3, dk); INK.oval(ctx, 9, -20, 1.5, 1.5, dk);
    if (sp > 0.15) {
      ctx.lineWidth = 2.4;
      INK.oval(ctx, -23, 10, 7 * sp + 3, 6 * sp + 3, GC, true); INK.oval(ctx, 24, 9, 7 * sp + 3, 6 * sp + 3, GC, true);
      ctx.lineWidth = 3.5;
    }
    INK.oval(ctx, -21, 11, 6 + sp * 2, 3.4 + sp, "rgba(255,126,182,0.45)"); INK.oval(ctx, 22, 10, 6 + sp * 2, 3.4 + sp, "rgba(255,126,182,0.45)");
    const eo = DRAW._eo2; eo.blink = bl; eo.style = mood === "shock" ? "wide" : "round"; eo.lid = GC;
    eo.pupil = mood === "shock" ? 0.24 : mood === "happy" ? 0.5 : 0.42;
    INK.eye(ctx, -13, -6, 11.5, look, eo); INK.eye(ctx, 14, -7, 10.5, look, eo);
    ctx.lineWidth = 4.4; ctx.beginPath();
    switch (mood) {
      case "happy": ctx.arc(-13, -13, 10, 1.2 * Math.PI, 1.8 * Math.PI); ctx.moveTo(23, -19); ctx.arc(14, -14, 9.5, 1.2 * Math.PI, 1.8 * Math.PI); break;
      case "shock": ctx.arc(-13, -18, 9, 1.15 * Math.PI, 1.85 * Math.PI); ctx.moveTo(22, -26); ctx.arc(14, -19, 8.5, 1.15 * Math.PI, 1.85 * Math.PI); break;
      case "sad": ctx.moveTo(-24, -15); ctx.lineTo(-6, -21); ctx.moveTo(24, -16); ctx.lineTo(6, -22); break;
      default: {
        const lift = mood === "talk" ? Math.abs(Math.sin(t * 5)) * 2.5 : 0;
        ctx.moveTo(-25, -21 - lift); ctx.lineTo(-5, -14.5 + INK.j(8, 1) * 0.6); ctx.moveTo(25, -22 - lift); ctx.lineTo(6, -15.5 + INK.j(8, 2) * 0.6);
      }
    }
    ctx.stroke(); ctx.lineWidth = 3.5;
    DRAW._gMouth(ctx, mood, sp, t);
    if (mood === "sad") INK.oval(ctx, -17, 6 + ((t * 12) % 14), 2.4, 3.4, "#8fd3ff", true);
    if (o.hat && o.hat !== "none") { ctx.save(); ctx.translate(0, -28); DRAW.hat(ctx, o.hat, 70); ctx.restore(); }
    ctx.restore();
    ctx.restore();
  },
  _gMouth(ctx, mood, sp, t) {
    const K = INK.C;
    if (sp > 0.05) {
      INK.oval(ctx, 2, 14, 3 + sp * 3.5, 3 + sp * 4.5, K.ink);
      ctx.lineWidth = 2.5; ctx.strokeStyle = "#e0608f"; ctx.beginPath(); ctx.ellipse(2, 14, 4 + sp * 3.5, 4 + sp * 4.5, 0, 0, 6.2832); ctx.stroke();
      ctx.strokeStyle = K.ink; ctx.lineWidth = 3.5; return;
    }
    ctx.beginPath();
    switch (mood) {
      case "happy":
        ctx.moveTo(-11, 9); ctx.quadraticCurveTo(1, 30, 13, 9); ctx.closePath(); ctx.fillStyle = K.ink; ctx.fill();
        INK.oval(ctx, 1, 17, 5, 2.6, K.pink);
        ctx.beginPath(); ctx.moveTo(-11, 9); ctx.quadraticCurveTo(1, 30, 13, 9); ctx.closePath(); ctx.stroke(); break;
      case "shock": INK.oval(ctx, 1, 15, 6, 8, K.ink); INK.oval(ctx, 1, 19.5, 3.6, 2.4, K.pink); break;
      case "talk": {
        const op = Math.abs(Math.sin(t * 14)) * 7 + 1.5;
        INK.oval(ctx, 1, 14, 7, op, K.ink); if (op > 4) INK.oval(ctx, 1, 14 + op * 0.45, 4, op * 0.3, K.pink); break;
      }
      case "sad": INK.wline(ctx, [[-9, 18], [-4, 13], [1, 12], [6, 13.5], [11, 18]], 61, 0.6); break;
      default: INK.wline(ctx, [[-10, 17], [-5, 13.5], [2, 12.5], [7, 13], [11, 16]], 62, 0.6);
    }
  },

  /* ================= HATS ================= origin = top-centre of head, designed for w = 70 */
  hat(ctx, id, w) {
    const f = DRAW._H[id]; if (!f) return;
    w = w || 70;
    ctx.save(); ctx.scale(w / 70, w / 70); DRAW._ink(ctx, 3); f(ctx, INK.t); ctx.restore();
  },
  _WIG: [[-26, 6, 9], [-14, -2, 10], [0, -5, 10], [14, -2, 10], [26, 6, 9], [-35, 17, 8.5], [35, 17, 8.5], [-37, 30, 8], [37, 30, 8], [-36, 42, 7.5], [36, 42, 7.5]],
  _CUR: [[0, 0], [0, 16], [4, 12.5], [6.8, 19], [9.4, 17.8], [6.6, 11.5], [11.5, 11.5]],
  _H: {
    party(ctx, t) {
      ctx.save(); ctx.translate(4, 3); ctx.rotate(0.18);
      INK.wpoly(ctx, [[-15, 1], [1, -38], [15, 1]], "#ff7eb6", true, 11, 0.7);
      for (let k = 0; k < 4; k++) INK.oval(ctx, [-5, 4, -1, 6][k], [-6, -14, -25, -3][k], 2.6, 2.6, "#ffd23f");
      INK.blob(ctx, 1, -40, 5.5, 5.5, "#6ad1ff", true, 3, 0.25);
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.quadraticCurveTo(-22, 14, -18, 30); ctx.stroke();
      ctx.restore();
    },
    tophat(ctx, t) {
      ctx.save(); ctx.translate(8, 1); ctx.rotate(0.2);
      INK.wpoly(ctx, [[-10, -1], [-9, -27], [9, -27], [10, -1]], "#2e2140", true, 4, 0.6);
      INK.wpoly(ctx, [[-10, -8], [10, -8], [10, -2], [-10, -2]], "#ff5a5a", true, 5, 0.4);
      INK.blob(ctx, 0, 0, 17, 3.6, "#2e2140", true, 6, 0.05);
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.moveTo(-5, -23); ctx.lineTo(-5, -12); ctx.stroke();
      ctx.restore();
    },
    beanie(ctx, t) {
      ctx.beginPath(); ctx.moveTo(-31, 10); ctx.bezierCurveTo(-31, -25, 31, -25, 31, 10); ctx.closePath();
      ctx.fillStyle = "#eaf6ff"; ctx.fill(); ctx.stroke();
      INK.wpoly(ctx, [[-32, 4], [32, 4], [32, 13], [-32, 13]], "#8fd3ff", true, 12, 0.6);
      ctx.lineWidth = 1.5; ctx.beginPath(); for (let x = -26; x < 30; x += 6) { ctx.moveTo(x, 6); ctx.lineTo(x, 11); } ctx.stroke(); ctx.lineWidth = 3;
      const C = [[-8, -18, 7], [6, -20, 8], [0, -26, 7]], b = Math.sin(t * 2) * 0.8;
      ctx.fillStyle = INK.C.ink; ctx.beginPath(); for (const c of C) { ctx.moveTo(c[0] + c[2] + 2.6, c[1]); ctx.arc(c[0], c[1], c[2] + 2.6 + b, 0, 6.2832); } ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); for (const c of C) { ctx.moveTo(c[0] + c[2], c[1]); ctx.arc(c[0], c[1], c[2] + b, 0, 6.2832); } ctx.fill();
      ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(-4, -21, 2, 0.2, 2.9); ctx.moveTo(6.5, -21); ctx.arc(4.5, -21, 2, 0.2, 2.9); ctx.stroke();
      INK.oval(ctx, 0.5, -17, 1, 1.2, INK.C.ink);
    },
    wig(ctx, t) {
      const C = DRAW._WIG;
      ctx.fillStyle = INK.C.ink; ctx.beginPath(); for (const c of C) { ctx.moveTo(c[0] + c[2] + 2.8, c[1]); ctx.arc(c[0], c[1], c[2] + 2.8, 0, 6.2832); } ctx.fill();
      ctx.fillStyle = "#f7f3ea"; ctx.beginPath(); for (const c of C) { ctx.moveTo(c[0] + c[2], c[1]); ctx.arc(c[0], c[1], c[2], 0, 6.2832); } ctx.fill();
      ctx.strokeStyle = "#c9bfa5"; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k < C.length; k++) { const c = C[k], a = k * 1.3; ctx.moveTo(c[0] + Math.cos(a) * c[2] * 0.5, c[1] + Math.sin(a) * c[2] * 0.5); ctx.arc(c[0], c[1], c[2] * 0.5, a, a + 4); }
      ctx.stroke(); ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 3;
    },
    pilot(ctx, t) {
      ctx.beginPath(); ctx.moveTo(-28, 8); ctx.bezierCurveTo(-31, -16, 31, -16, 28, 8); ctx.closePath();
      ctx.fillStyle = "#2b3a67"; ctx.fill(); ctx.stroke();
      INK.wpoly(ctx, [[-28, 3], [28, 3], [28, 10], [-28, 10]], "#1d2647", true, 13, 0.5);
      ctx.beginPath(); ctx.moveTo(-24, 9); ctx.quadraticCurveTo(0, 22, 24, 9); ctx.quadraticCurveTo(0, 13, -24, 9);
      ctx.fillStyle = "#15151f"; ctx.fill(); ctx.stroke();
      ctx.lineWidth = 2;
      INK.wpoly(ctx, [[-2, -3], [-13, -6], [-10, -1]], "#ffd23f", true, 14, 0.4); INK.wpoly(ctx, [[2, -3], [13, -6], [10, -1]], "#ffd23f", true, 15, 0.4);
      INK.oval(ctx, 0, -3, 3.6, 3.6, "#ffd23f", true); ctx.lineWidth = 3;
    },
    lampshade(ctx, t) {
      ctx.save(); ctx.translate(-3, 2); ctx.rotate(-0.16 + Math.sin(t * 2) * 0.03);
      INK.wpoly(ctx, [[-27, 4], [-15, -30], [15, -30], [27, 4]], "#ffe08a", true, 7, 0.8);
      ctx.strokeStyle = "#d9b44f"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, -29); ctx.lineTo(-10, 3); ctx.moveTo(6, -29); ctx.lineTo(10, 3); ctx.stroke();
      ctx.strokeStyle = INK.C.ink; ctx.beginPath();
      for (let x = -24; x <= 24; x += 6) { ctx.moveTo(x, 4); ctx.lineTo(x + Math.sin(t * 3 + x) * 1.5, 10); } ctx.stroke();
      for (let x = -24; x <= 24; x += 6) INK.oval(ctx, x + Math.sin(t * 3 + x) * 1.5, 11, 1.8, 1.8, "#ff7eb6");
      ctx.lineWidth = 3; INK.oval(ctx, 0, -32, 3, 3, "#d9b44f", true);
      ctx.restore();
    },
    antenna(ctx, t) {
      ctx.beginPath(); ctx.ellipse(0, 16, 34, 18, 0, Math.PI * 1.05, Math.PI * 1.95);
      ctx.lineWidth = 8; ctx.stroke(); ctx.lineWidth = 4.5; ctx.strokeStyle = "#ff7eb6"; ctx.stroke();
      ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 2.2;
      for (let sg = -1; sg <= 1; sg += 2) {
        const bx = sg * 15, wob = Math.sin(t * 5 + sg) * 4, tx = sg * 22 + wob, ty = -30;
        ctx.beginPath(); ctx.moveTo(bx, -1);
        for (let k = 1; k <= 8; k++) { const u = k / 8; ctx.lineTo(bx + (tx - bx) * u + (k & 1 ? 3 : -3), -1 + (ty + 1) * u); }
        ctx.stroke();
        ctx.lineWidth = 2.5; INK.eye(ctx, tx, ty - 3, 5, { x: Math.sin(t * 1.3 + sg), y: 0.3 }, { lid: "#ff7eb6" }); ctx.lineWidth = 2.2;
      }
      ctx.lineWidth = 3;
    },
    helmet(ctx, t) {
      INK.oval(ctx, 0, 26, 45, 45, "rgba(170,225,255,0.16)", true);
      const fx = Math.sin(t * 0.9) * 18, dir = Math.cos(t * 0.9) >= 0 ? 1 : -1;
      ctx.save(); ctx.translate(fx, -6 + Math.sin(t * 2) * 2); ctx.scale(dir, 1);
      ctx.lineWidth = 2; INK.oval(ctx, 0, 0, 6, 3.6, "#ff9a3c", true);
      INK.wpoly(ctx, [[-5, 0], [-10, -4], [-10, 4]], "#ff9a3c", true, 16, 0.3);
      INK.oval(ctx, 3, -0.8, 1, 1, INK.C.ink); ctx.restore();
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) { const y = 40 - ((t * 18 + k * 17) % 50); INK.oval(ctx, 24 + Math.sin(t * 3 + k) * 3, y, 2 + k * 0.4, 2 + k * 0.4, null, true); }
      ctx.lineWidth = 3;
      INK.wpoly(ctx, [[-31, 58], [31, 58], [28, 68], [-28, 68]], "#b8c4d6", true, 17, 0.6);
      ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(0, 26, 37, 3.6, 4.4); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 26, 37, 4.6, 4.75); ctx.stroke();
      ctx.strokeStyle = INK.C.ink;
    },
    sock(ctx, t) {
      ctx.save(); ctx.translate(-4, 4); ctx.rotate(Math.sin(t * 2) * 0.08); ctx.scale(1, -1);
      DRAW._sockShape(ctx, 24, 15, "#ff5a5a", "#fff3dc", 0);
      ctx.restore();
    },
    towel(ctx, t) {
      const C = "#9fd8ff", D = "#7cc0ec";
      INK.blob(ctx, 0, 3, 34, 11, C, true, 18, 0.05);
      INK.blob(ctx, 3, -8, 28, 11, D, true, 19, 0.06);
      INK.blob(ctx, -2, -18, 21, 10, C, true, 20, 0.06);
      INK.blob(ctx, 5, -27, 9, 7, D, true, 21, 0.1);
      ctx.strokeStyle = "#ff9ad5"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-30, 7); ctx.quadraticCurveTo(0, 15, 31, 6); ctx.stroke();
      ctx.strokeStyle = "rgba(29,15,43,0.45)"; ctx.lineWidth = 1.6; ctx.beginPath();
      ctx.moveTo(-20, -4); ctx.quadraticCurveTo(0, -12, 20, -14); ctx.moveTo(-14, -14); ctx.quadraticCurveTo(0, -22, 14, -22); ctx.stroke();
      ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 3;
    },
    shades(ctx, t) {
      const y = 24.5;
      INK.blob(ctx, -14, y, 12.5, 9, "#1d0f2b", true, 22, 0.04); INK.blob(ctx, 14, y, 12.5, 9, "#1d0f2b", true, 23, 0.04);
      ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(-3, y - 3); ctx.quadraticCurveTo(0, y - 6, 3, y - 3);
      ctx.moveTo(-26, y - 4); ctx.lineTo(-35, y - 7); ctx.moveTo(26, y - 4); ctx.lineTo(35, y - 7); ctx.stroke();
      const g = (t * 0.7) % 3;
      ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 2.4; ctx.beginPath();
      ctx.moveTo(-20, y - 3); ctx.lineTo(-15, y - 6); ctx.moveTo(8, y - 3); ctx.lineTo(13, y - 6);
      if (g < 1) { const gx = -24 + g * 48; ctx.moveTo(gx, y + 4); ctx.lineTo(gx + 5, y - 4); }
      ctx.stroke(); ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 3;
    },
    cheese(ctx, t) {
      ctx.save(); ctx.translate(2, 2); ctx.rotate(0.06);
      INK.wpoly(ctx, [[-28, 1], [-22, -5], [28, -24], [26, -18]], "#ffe680", true, 24, 0.5);
      INK.wpoly(ctx, [[-28, 1], [26, -18], [26, 4]], "#ffd23f", true, 25, 0.6);
      INK.oval(ctx, 8, -4, 4, 3.2, "#e0a91f"); INK.oval(ctx, 19, -8, 2.6, 2.2, "#e0a91f"); INK.oval(ctx, 18, 0, 2, 1.8, "#e0a91f");
      INK.oval(ctx, -8, -1, 1.6, 1.4, "#e0a91f");
      ctx.restore();
    },
    pirate(ctx, t) {
      ctx.beginPath(); ctx.moveTo(-37, 7); ctx.quadraticCurveTo(-30, -24, 0, -25); ctx.quadraticCurveTo(30, -24, 37, 7);
      ctx.quadraticCurveTo(0, -5, -37, 7); ctx.closePath(); ctx.fillStyle = "#2a1d36"; ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-33, 3); ctx.quadraticCurveTo(0, -7, 33, 3); ctx.stroke();
      ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(-8, -18); ctx.lineTo(8, -4); ctx.moveTo(8, -18); ctx.lineTo(-8, -4); ctx.stroke();
      ctx.strokeStyle = "#fff3dc"; ctx.lineWidth = 2.2; ctx.stroke(); ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 2;
      INK.oval(ctx, 0, -13, 6, 5.4, "#fff3dc", true);
      INK.oval(ctx, -2.2, -13.5, 1.5, 1.6, INK.C.ink); INK.oval(ctx, 2.2, -13.5, 1.5, 1.6, INK.C.ink);
      ctx.lineWidth = 3;
    },
    headset(ctx, t) {
      ctx.beginPath(); ctx.ellipse(0, 22, 37, 27, 0, Math.PI * 1.06, Math.PI * 1.94);
      ctx.lineWidth = 8; ctx.stroke(); ctx.lineWidth = 4.5; ctx.strokeStyle = "#5b5f73"; ctx.stroke(); ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-34, 30); ctx.quadraticCurveTo(-30, 50, -10, 47);
      ctx.lineWidth = 5; ctx.stroke(); ctx.lineWidth = 2.4; ctx.strokeStyle = "#5b5f73"; ctx.stroke(); ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 3;
      INK.blob(ctx, -36, 24, 6.5, 10, "#3a3d4d", true, 26, 0.05); INK.blob(ctx, 36, 24, 6.5, 10, "#3a3d4d", true, 27, 0.05);
      INK.oval(ctx, -9, 47, 4.2, 3.6, "#1d0f2b", true);
      if (Math.sin(t * 4) > 0) INK.oval(ctx, -36, 19, 1.8, 1.8, "#ff5a5a");
    },
    bag(ctx, t) {
      ctx.beginPath(); ctx.moveTo(-37, 46); ctx.lineTo(-38, -6);
      for (let k = 1; k <= 8; k++) ctx.lineTo(-38 + k * 9.5, k & 1 ? -12 + INK.j(28, k) : -6);
      ctx.lineTo(37, 46); ctx.closePath();
      ctx.moveTo(-4, 21); ctx.ellipse(-13, 21, 9, 8, 0, 0, 6.2832);
      ctx.moveTo(22.5, 20); ctx.ellipse(14, 20, 8.5, 7.5, 0, 0, 6.2832);
      ctx.fillStyle = "#d7b98a"; ctx.fill("evenodd"); ctx.stroke();
      ctx.strokeStyle = "#a8875a"; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(-30, -2); ctx.lineTo(-29, 42); ctx.moveTo(30, -4); ctx.lineTo(29, 42); ctx.moveTo(-36, 34); ctx.lineTo(36, 34); ctx.stroke();
      ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 2.4;
      INK.wline(ctx, [[-9, 37], [-4, 41], [4, 41], [10, 36]], 29, 0.6);
      ctx.lineWidth = 3;
    },
    crown(ctx, t) {
      const P = DRAW._CUR;
      for (let k = 0; k < 5; k++) {
        ctx.save(); ctx.translate(-18 + k * 9, 2); ctx.rotate(-0.55 + k * 0.27 + Math.sin(t * 2 + k) * 0.05); ctx.scale(k === 2 ? 1.25 : 1, k === 2 ? 1.25 : 1);
        ctx.translate(-3.5, -21);
        ctx.lineWidth = 2; INK.wpoly(ctx, P, "#ffffff", true, 30 + k, 0.3); ctx.restore();
      }
      ctx.lineWidth = 3;
      INK.wpoly(ctx, [[-25, 8], [25, 8], [23, -1], [-23, -1]], "#ffd23f", true, 31, 0.5);
      INK.oval(ctx, -12, 3.5, 2.4, 2.4, "#ff5a5a", true); INK.oval(ctx, 0, 3.5, 2.4, 2.4, "#6ad1ff", true); INK.oval(ctx, 12, 3.5, 2.4, 2.4, "#7be07b", true);
    },
    cone(ctx, t) {
      ctx.save(); ctx.rotate(-0.08);
      INK.wpoly(ctx, [[-15, 1], [-4, -40], [4, -40], [15, 1]], "#ff9a3c", true, 32, 0.6);
      INK.wpoly(ctx, [[-11.5, -12], [11.5, -12], [9.6, -19], [-9.6, -19]], "#ffffff", true, 33, 0.4);
      INK.wpoly(ctx, [[-7.4, -27], [7.4, -27], [5.6, -33], [-5.6, -33]], "#ffffff", true, 34, 0.4);
      INK.wpoly(ctx, [[-23, 6], [23, 6], [23, 0], [-23, 0]], "#e8742a", true, 35, 0.5);
      ctx.restore();
    },
    fish(ctx, t) {
      const f = Math.sin(t * 9);
      ctx.save(); ctx.translate(0, -6); ctx.rotate(0.12 + f * 0.06);
      ctx.save(); ctx.translate(-24, 0); ctx.rotate(f * 0.35);
      INK.wpoly(ctx, [[2, 0], [-13, -11], [-9, 0], [-13, 11]], "#5f9ae8", true, 36, 0.5); ctx.restore();
      INK.wpoly(ctx, [[-8, -8], [3, -16], [9, -8]], "#5f9ae8", true, 37, 0.5);
      DRAW._body(ctx, 0, 0, 27, 10, "#7fb8ff", 38, 0.04);
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(10, 0, 7, -1.2, 1.2); ctx.stroke();
      INK.eye(ctx, 17, -2, 4.6, { x: 0.3, y: -1 }, {});
      INK.oval(ctx, 26, 3, 1.6, 2, INK.C.ink);
      ctx.restore(); ctx.lineWidth = 3;
    },
    halo(ctx, t) {
      const y = -16 + Math.sin(t * 2.5) * 2.5;
      INK.oval(ctx, 0, y, 31, 11, "rgba(255,230,120,0.2)");
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const a = (k / 24) * 6.2832, d = a - 0.9, r = 1 - 0.28 * Math.exp(-d * d * 18);
        const x = Math.cos(a) * 24 * r, yy = y + Math.sin(a) * 6.5 * r + x * 0.12;
        k ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
      }
      ctx.closePath(); ctx.lineWidth = 7.5; ctx.stroke(); ctx.lineWidth = 3.6; ctx.strokeStyle = "#ffe58a"; ctx.stroke();
      ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 3;
    },
    propeller(ctx, t) {
      ctx.beginPath(); ctx.moveTo(-26, 8); ctx.bezierCurveTo(-26, -19, 26, -19, 26, 8); ctx.closePath();
      ctx.fillStyle = "#ff5a5a"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, 8); ctx.quadraticCurveTo(-8, -12, 0, -12); ctx.quadraticCurveTo(8, -12, 9, 8); ctx.closePath();
      ctx.fillStyle = "#ffd23f"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, 7); ctx.quadraticCurveTo(26, 14, 35, 6); ctx.quadraticCurveTo(20, 3, 4, 7);
      ctx.fillStyle = "#4a7fe8"; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -22); ctx.stroke();
      const L = Math.cos(t * 16) * 20, ar = Math.max(1, Math.abs(L) / 2);
      ctx.lineWidth = 2.4;
      INK.oval(ctx, L / 2, -23, ar, 3.6, "#6ad1ff", true); INK.oval(ctx, -L / 2, -23, ar, 3.6, "#7be07b", true);
      INK.oval(ctx, 0, -23, 2.8, 2.8, "#ffd23f", true); ctx.lineWidth = 3;
    },
    gnome(ctx, t) {
      const fl = Math.sin(t * 2) * 3;
      const gp = c => {
        c.beginPath(); c.moveTo(-28, 8); c.quadraticCurveTo(-20, -28, 4, -46); c.quadraticCurveTo(16 + fl, -50, 25 + fl, -37);
        c.quadraticCurveTo(15, -35, 12, -25); c.quadraticCurveTo(22, -6, 28, 8); c.quadraticCurveTo(0, 14, -28, 8); c.closePath();
      };
      DRAW._inset(ctx, gp, "#ff5a5a", 0, -10, 0.9);
      INK.wpoly(ctx, [[-29, 2], [29, 2], [29, 10], [-29, 10]], "#d43d3d", true, 39, 0.6);
      INK.oval(ctx, 25 + fl, -37, 3.4, 3.4, "#fff3dc", true);
    },
  },

  /* ================= PROPS ================= */
  bean(ctx, gold, t, seed) {
    t = t != null ? t : INK.t; seed = seed || 0;
    const K = INK.C, col = gold ? K.gold : K.bean;
    ctx.save(); ctx.rotate(t * 5 + seed); DRAW._ink(ctx, 2);
    ctx.beginPath(); ctx.moveTo(-7, -1); ctx.bezierCurveTo(-8, -7, -1, -7, 0, -4); ctx.bezierCurveTo(1, -7, 8, -7, 7.5, 0);
    ctx.bezierCurveTo(7, 6, -7, 7, -7, -1); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.stroke();
    INK.oval(ctx, -3.5, -3.6, 1.6, 1, "rgba(255,255,255,0.65)");
    ctx.lineWidth = 1;
    INK.oval(ctx, -2.4, -0.6, 1.7, 1.7, "#fff", true); INK.oval(ctx, 2.4, -0.9, 1.5, 1.5, "#fff", true);
    INK.oval(ctx, -2.4, -0.3, 0.75, 0.75, K.ink); INK.oval(ctx, 2.4, -0.6, 0.7, 0.7, K.ink);
    INK.oval(ctx, 0, 2.9, 1.3, 1.8 + Math.abs(Math.sin(t * 20 + seed)) * 0.5, K.ink);
    ctx.restore();
    if (gold) {
      const tw = Math.abs(Math.sin(t * 8 + seed));
      ctx.lineWidth = 1; ctx.strokeStyle = K.ink;
      DRAW._star(ctx, 7, -7, 3 + tw * 3, "#fffbea");
      if (tw > 0.6) DRAW._star(ctx, -8, 6, 2.5, "#fffbea");
    }
  },
  _SOCK: [["#ff5a5a", "#fff3dc", 0], ["#6ad1ff", "#ffffff", 1], ["#7be07b", "#ffd23f", 2], ["#c58bff", "#ffd23f", 0]],
  sock(ctx, kind, t, seed) {
    t = t != null ? t : INK.t; seed = seed || 0;
    const S = DRAW._SOCK[((kind | 0) % 4 + 4) % 4];
    ctx.save(); DRAW._ink(ctx, 2.6);
    ctx.rotate(Math.sin(t * 3 + seed) * 0.5);
    ctx.translate(-7, -15);
    DRAW._sockShape(ctx, 13, 17, S[0], S[1], S[2]);
    if (kind === 1 || kind === 3) {
      const eo = DRAW._eo2; eo.blink = DRAW._blink(t, seed + 5); eo.style = kind === 3 ? "spiral" : "round"; eo.lid = S[0]; eo.pupil = 0;
      const L = DRAW._look(ctx, 0, 8);
      INK.eye(ctx, -2.5, 8, 3.6, L, eo); INK.eye(ctx, 3.4, 7.4, 3.1, L, eo);
      if (kind === 1) { ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0.5, 13, 2.6, 0.2, 2.9); ctx.stroke(); }
      else INK.oval(ctx, 0.5, 14, 1.4, 1.9, INK.C.ink);
    }
    ctx.restore();
  },
  bubble(ctx, r, t) {
    t = t != null ? t : INK.t; r = r || 20;
    const wv = Math.sin(t * 5) * 0.045;
    ctx.save(); DRAW._ink(ctx, 2.4);
    INK.oval(ctx, 0, 0, r * (1 + wv), r * (1 - wv), "rgba(190,235,255,0.22)");
    ctx.save(); ctx.translate(0, Math.sin(t * 2) * r * 0.08);
    ctx.scale(Math.max(0.18, Math.abs(Math.cos(t * 2.5))), 1);
    DRAW.coin(ctx, r * 0.45); ctx.restore();
    ctx.strokeStyle = "rgba(29,15,43,0.85)"; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(0, 0, r * (1 + wv), r * (1 - wv), 0, 0, 6.2832); ctx.stroke();
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.strokeStyle = "rgba(255,126,182,0.55)"; ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0.2, 1.4); ctx.stroke();
    ctx.strokeStyle = "rgba(106,209,255,0.6)"; ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 1.5, 2.5); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 3.5, 4.4); ctx.stroke();
    INK.oval(ctx, r * 0.42, -r * 0.5, r * 0.08, r * 0.08, "rgba(255,255,255,0.9)");
    ctx.restore();
  },
  coin(ctx, r) {
    r = r || 10;
    const lw = ctx.lineWidth, ss = ctx.strokeStyle;
    ctx.strokeStyle = INK.C.ink; ctx.lineWidth = Math.max(1.4, r * 0.16);
    INK.oval(ctx, 0, 0, r, r, "#e0a91f", true);
    INK.oval(ctx, -r * 0.07, -r * 0.07, r * 0.8, r * 0.8, "#ffd23f");
    ctx.lineWidth = Math.max(1, r * 0.08); ctx.strokeStyle = "#c48a12";
    ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, 6.2832); ctx.stroke();
    if (r > 4) {
      ctx.font = "bold " + Math.round(r * 1.15) + "px " + INK.FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#b07d0e"; ctx.fillText("$", r * 0.04, r * 0.08);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 3.7, 4.5); ctx.stroke();
    ctx.lineWidth = lw; ctx.strokeStyle = ss;
  },

  /* ================= VISITORS ================= */
  visitor(ctx, v, t) {
    if (!v) return;
    t = t != null ? t : INK.t;
    const f = DRAW._V[v.body] || DRAW._V.rock, A = DRAW._A, sd = DRAW._hs(v.body || "x");
    A.x = 0; A.y = -14; A.w = 26; A.nx = 0; A.ny = 2; A.sd = sd;
    ctx.save(); DRAW._ink(ctx, 3);
    const L = DRAW._look(ctx, 0, -8), eo = DRAW._eo2;
    eo.blink = DRAW._blink(t, sd); eo.style = "round"; eo.lid = v.col || "#fff"; eo.pupil = 0;
    f(ctx, v, t, L, A, eo);
    if (v.acc === "tie") DRAW._tie(ctx, A.nx, A.ny, A.w / 26);
    else if (v.acc === "wig") { ctx.save(); ctx.translate(A.x, A.y - A.w * 0.48); DRAW.hat(ctx, "wig", A.w * 1.05); ctx.restore(); }
    ctx.restore();
  },
  _tie(ctx, x, y, k) {
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.lineWidth = 2 / Math.max(0.5, k);
    INK.wpoly(ctx, [[-2, 2], [2, 2], [4, 14], [0, 19], [-4, 14]], "#ff5a5a", true, 2, 0.4);
    INK.wpoly(ctx, [[-3.4, -1], [3.4, -1], [2.2, 3.2], [-2.2, 3.2]], "#d43d3d", true, 3, 0.3);
    ctx.restore();
  },
  _BEES: [[-6, -25], [1, -29], [7, -24], [-7, -18], [7, -17], [0, -14], [-11, -8], [0, -6], [11, -8], [-5, 1], [5, 1], [0, 8], [-6, 13],
    [6, 13], [-18, -3], [-23, 5], [18, -12], [22, -20], [-6, 21], [-8, 29], [6, 21], [9, 29]],
  _V: {
    bird(ctx, v, t, L, A, eo) {
      const c = v.col, fl = Math.sin(t * 14), bob = Math.sin(t * 3) * 3;
      ctx.translate(0, bob);
      ctx.strokeStyle = "#e8742a"; ctx.lineWidth = 2.4; ctx.beginPath();
      ctx.moveTo(-5, 18); ctx.lineTo(-6, 27); ctx.lineTo(-9, 29); ctx.moveTo(-6, 27); ctx.lineTo(-3, 29);
      ctx.moveTo(4, 18); ctx.lineTo(5, 27); ctx.lineTo(2, 29); ctx.moveTo(5, 27); ctx.lineTo(8, 29); ctx.stroke();
      ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 3;
      INK.wpoly(ctx, [[-16, 4], [-31, -1], [-30, 11], [-16, 14]], DRAW._sh(c, -0.25), true, 41, 0.6);
      DRAW._body(ctx, -2, 8, 19, 14, c, 42, 0.05);
      INK.oval(ctx, 3, 13, 10, 6, DRAW._sh(c, 0.3));
      ctx.save(); ctx.translate(-6, 4); ctx.rotate(-0.3 + fl * 0.55);
      INK.blob(ctx, -9, 0, 13, 6, DRAW._sh(c, -0.18), true, 43, 0.08);
      ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-16, -1); ctx.lineTo(-6, 0); ctx.moveTo(-15, 2); ctx.lineTo(-7, 2.5); ctx.stroke(); ctx.lineWidth = 3;
      ctx.restore();
      INK.oval(ctx, 7, -2, 9, 6, "#7fc8a9"); INK.oval(ctx, 7, 1, 8, 3, "#b07fc8");
      DRAW._body(ctx, 8, -12, 11, 10.5, c, 44, 0.05);
      INK.wpoly(ctx, [[17, -14], [28, -10], [17, -7]], "#ffb347", true, 45, 0.4);
      INK.oval(ctx, 18, -13, 2.4, 1.8, "#f2f2f2");
      INK.eye(ctx, 4, -15, 4.8, L, eo); INK.eye(ctx, 12.5, -16, 4.2, L, eo);
      A.x = 8 ; A.y = -12 + bob; A.w = 22; A.nx = 7; A.ny = -2 + bob;
    },
    bees(ctx, v, t, L, A, eo) {
      const B = DRAW._BEES, K = INK.C;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < B.length; i++) {
        let x = B[i][0] + Math.sin(t * 9 + i * 2.1) * 1.6 + INK.j(i, 1) * 0.8, y = B[i][1] + Math.cos(t * 7 + i * 1.3) * 1.6;
        if (i === 17) { x += Math.sin(t * 6) * 5; y += Math.cos(t * 6) * 3; }
        INK.oval(ctx, x - 1, y - 3, 2.2, 1.4 + Math.abs(Math.sin(t * 40 + i)) * 0.9, "rgba(255,255,255,0.85)", true);
        INK.oval(ctx, x, y, 3.6, 2.7, K.gold, true);
        ctx.beginPath(); ctx.moveTo(x - 0.5, y - 2.6); ctx.lineTo(x - 0.5, y + 2.6); ctx.stroke();
      }
      ctx.setLineDash([2, 3]); INK.oval(ctx, 16, 5, 3.6, 2.7, null, true); ctx.setLineDash([]);
      ctx.lineWidth = 2;
      INK.eye(ctx, -4, -21, 4.2, L, eo); INK.eye(ctx, 4.5, -21.5, 3.8, L, eo);
      ctx.lineWidth = 3;
      A.x = 0; A.y = -22; A.w = 20; A.nx = 0; A.ny = -12;
    },
    mailbox(ctx, v, t, L, A, eo) {
      const c = v.col, st = Math.sin(t * 8), K = INK.C;
      ctx.translate(0, -Math.abs(st) * 2);
      ctx.beginPath(); ctx.moveTo(-7, 12); ctx.lineTo(-8 + st * 4, 28); ctx.moveTo(7, 12); ctx.lineTo(8 - st * 4, 28); ctx.stroke();
      INK.oval(ctx, -9 + st * 4, 29, 4.5, 2.6, K.red, true); INK.oval(ctx, 9 - st * 4, 29, 4.5, 2.6, K.red, true);
      const fa = Math.sin(t * 1.5) > 0 ? -1.5 : -0.1;
      ctx.save(); ctx.translate(17, -2); ctx.rotate(fa);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(13, 0); ctx.stroke();
      INK.wpoly(ctx, [[8, -1], [15, -1], [15, -7], [8, -7]], K.red, true, 46, 0.4); ctx.restore();
      const mb = q => { q.beginPath(); q.moveTo(-17, 14); q.lineTo(-17, -10); q.bezierCurveTo(-17, -30, 17, -30, 17, -10); q.lineTo(17, 14); q.closePath(); };
      DRAW._inset(ctx, mb, c, 0, -4, 0.9);
      INK.wpoly(ctx, [[-10, 1], [10, 1], [10, 6], [-10, 6]], K.ink, false, 47, 0.3);
      ctx.save(); ctx.translate(2, 3); ctx.rotate(0.15 + Math.sin(t * 3) * 0.12); ctx.lineWidth = 2;
      DRAW._sockShape(ctx, 6, 7, "#fff3dc", K.red, 0); ctx.restore();
      INK.eye(ctx, -6, -11, 5.2, L, eo); INK.eye(ctx, 7, -12, 4.6, L, eo);
      A.x = 0; A.y = -14; A.w = 32; A.nx = 0; A.ny = 8;
    },
    gnome(ctx, v, t, L, A, eo) {
      const K = INK.C, jump = Math.floor(t * 1.3) % 5 === 0 ? INK.j(3, 1) * 3 : 0;
      ctx.translate(jump, 0);
      INK.oval(ctx, -7, 29, 6, 3.2, "#5a3a22", true); INK.oval(ctx, 7, 29, 6, 3.2, "#5a3a22", true);
      DRAW._body(ctx, 0, 17, 15, 13, "#4a7fe8", 48, 0.05);
      INK.blob(ctx, 0, -5, 12, 9.5, "#ffcfa8", true, 49, 0.05);
      INK.wpoly(ctx, [[-14, -3], [14, -3], [11, 10], [0, 23], [-11, 10]], "#f4f1ea", true, 50, 1);
      INK.oval(ctx, 0, -2, 4, 3.4, "#ff9a8a", true);
      const e2 = DRAW._eo; e2.blink = 0; e2.style = "round"; e2.lid = "#ffcfa8"; e2.pupil = 0.22;
      INK.eye(ctx, -5.5, -8, 3.8, L, e2); INK.eye(ctx, 5.5, -8, 3.8, L, e2);
      const hp = q => { q.beginPath(); q.moveTo(-14, -9); q.quadraticCurveTo(-8, -26, -1, -40); q.quadraticCurveTo(6, -24, 14, -9); q.quadraticCurveTo(0, -5, -14, -9); q.closePath(); };
      DRAW._inset(ctx, hp, v.col, 0, -18, 0.9);
      A.x = 0; A.y = -6; A.w = 24; A.nx = 0; A.ny = 6;
    },
    cloud(ctx, v, t, L, A, eo) {
      const b = Math.sin(t * 2) * 1.2, C = DRAW._CL, K = INK.C;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const y = 14 + ((t * 30 + i * 9) % 24), x = -15 + i * 10;
        if (i === 2) { ctx.save(); ctx.translate(x, y); ctx.rotate(0.4); DRAW._sockShape(ctx, 4, 5, K.pink, "#fff", 0); ctx.restore(); }
        else INK.oval(ctx, x, y, 1.8, 2.8, "#8fd3ff", true);
      }
      ctx.lineWidth = 3;
      ctx.fillStyle = K.ink; ctx.beginPath(); for (const c of C) { ctx.moveTo(c[0] + c[2] + 2.8, c[1]); ctx.arc(c[0], c[1], c[2] + 2.8 + b, 0, 6.2832); } ctx.fill();
      ctx.fillStyle = "#d4e4f2"; ctx.beginPath(); for (const c of C) { ctx.moveTo(c[0] + c[2], c[1]); ctx.arc(c[0], c[1], c[2] + b, 0, 6.2832); } ctx.fill();
      ctx.fillStyle = v.col || "#fff"; ctx.beginPath(); for (const c of C) { const r = c[2] * 0.84; ctx.moveTo(c[0] - 1 + r, c[1] - 2); ctx.arc(c[0] - 1, c[1] - 2, r + b, 0, 6.2832); } ctx.fill();
      eo.style = "sleepy"; eo.lid = "#e8f2fa";
      INK.eye(ctx, -7, -3, 5, L, eo); INK.eye(ctx, 7, -4, 4.6, L, eo);
      ctx.lineWidth = 1.8; ctx.beginPath();
      ctx.moveTo(-11, -7); ctx.lineTo(-14, -10); ctx.moveTo(-9, -8.5); ctx.lineTo(-10.5, -12); ctx.moveTo(11, -8); ctx.lineTo(14, -11); ctx.moveTo(9, -9.5); ctx.lineTo(10, -13);
      ctx.stroke(); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 2, 3.5, 0.3, 2.8); ctx.stroke(); ctx.lineWidth = 3;
      INK.oval(ctx, -13, 3, 3.6, 2, "rgba(255,126,182,0.5)"); INK.oval(ctx, 13, 2, 3.6, 2, "rgba(255,126,182,0.5)");
      A.x = 0; A.y = -6; A.w = 34; A.nx = 0; A.ny = 8;
    },
    kite(ctx, v, t, L, A, eo) {
      const c = v.col, K = INK.C;
      ctx.rotate(Math.sin(t * 2.2) * 0.2);
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 26);
      for (let i = 1; i <= 5; i++) ctx.lineTo(Math.sin(t * 4 - i) * 6, 26 + i * 7);
      ctx.stroke();
      for (let i = 2; i <= 4; i += 2) { const x = Math.sin(t * 4 - i) * 6, y = 26 + i * 7; INK.wpoly(ctx, [[x, y], [x - 5, y - 3], [x - 5, y + 3], [x, y], [x + 5, y - 3], [x + 5, y + 3]], i === 2 ? K.gold : K.sky, true, 51 + i, 0.3); }
      ctx.lineWidth = 3;
      INK.wpoly(ctx, [[0, -28], [21, -4], [0, 26], [-21, -4]], c, true, 52, 0.7);
      INK.wpoly(ctx, [[0, -28], [0, -4], [-21, -4]], DRAW._sh(c, 0.3), false, 53, 0.4);
      INK.wpoly(ctx, [[0, -4], [21, -4], [0, 26]], DRAW._sh(c, -0.22), false, 54, 0.4);
      INK.wpoly(ctx, [[0, -28], [21, -4], [0, 26], [-21, -4]], null, true, 52, 0.7);
      ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -27); ctx.lineTo(0, 25); ctx.moveTo(-20, -4); ctx.lineTo(20, -4); ctx.stroke();
      ctx.lineWidth = 2.5;
      INK.eye(ctx, -7, -9, 5, L, eo); INK.eye(ctx, 7, -9, 4.6, L, eo);
      ctx.beginPath(); ctx.moveTo(-11, -17); ctx.lineTo(-3, -16); ctx.moveTo(3, -19); ctx.lineTo(11, -15); ctx.stroke();
      INK.wline(ctx, [[-5, 4], [0, 2], [5, 5]], 55, 0.5);
      ctx.lineWidth = 3;
      INK.label(ctx, "!?", 22, -20, 13, K.cream, "center", INK.FONT, 3);
      A.x = 0; A.y = -8; A.w = 30; A.nx = 0; A.ny = 8;
    },
    owl(ctx, v, t, L, A, eo) {
      const c = v.col, fl = Math.sin(t * 5) * 0.25, K = INK.C;
      INK.wpoly(ctx, [[-18, 26], [18, 26], [18, 32], [-18, 32]], "#fff3dc", true, 56, 0.5);
      ctx.strokeStyle = "#e8742a"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-6, 24); ctx.lineTo(-6, 29); ctx.moveTo(6, 24); ctx.lineTo(6, 29); ctx.stroke();
      ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
      ctx.save(); ctx.translate(-16, 2); ctx.rotate(0.3 + fl); INK.blob(ctx, -3, 8, 7, 13, DRAW._sh(c, -0.2), true, 57, 0.1); ctx.restore();
      ctx.save(); ctx.translate(16, 2); ctx.rotate(-0.3 - fl); INK.blob(ctx, 3, 8, 7, 13, DRAW._sh(c, -0.2), true, 58, 0.1); ctx.restore();
      INK.wpoly(ctx, [[-16, -12], [-19, -26], [-7, -17]], c, true, 59, 0.5); INK.wpoly(ctx, [[16, -12], [19, -26], [7, -17]], c, true, 60, 0.5);
      DRAW._body(ctx, 0, 4, 18, 23, c, 61, 0.05);
      INK.oval(ctx, 0, 12, 10, 11, DRAW._sh(c, 0.35));
      ctx.lineWidth = 1.6; ctx.beginPath();
      for (let k = 0; k < 5; k++) { const x = -6 + (k % 3) * 6, y = 6 + Math.floor(k / 3) * 6 + (k % 3 === 1 ? 2 : 0); ctx.moveTo(x - 2, y); ctx.lineTo(x, y + 2); ctx.lineTo(x + 2, y); }
      ctx.stroke(); ctx.lineWidth = 3;
      INK.oval(ctx, -8, -8, 9, 9, "#f3e3c8", true); INK.oval(ctx, 8, -8, 9, 9, "#f3e3c8", true);
      INK.eye(ctx, -8, -8, 6.6, L, eo); INK.eye(ctx, 8, -8, 6.6, L, eo);
      INK.wpoly(ctx, [[-2.5, -2], [2.5, -2], [0, 3]], "#ffb347", true, 62, 0.3);
      ctx.save(); ctx.translate(0, -18); DRAW.hat(ctx, "wig", 30); ctx.restore();
      A.x = 0; A.y = -8; A.w = 34; A.nx = 0; A.ny = 4;
    },
    paperplane(ctx, v, t, L, A, eo) {
      const K = INK.C;
      ctx.translate(0, Math.sin(t * 2.5) * 3); ctx.rotate(Math.sin(t * 2.5 + 1) * 0.08);
      ctx.lineWidth = 6;
      INK.wline(ctx, [[-8, -12], [-15, -14 + Math.sin(t * 9) * 2], [-22, -12 + Math.sin(t * 9 + 1) * 3], [-29, -14 + Math.sin(t * 9 + 2) * 3]], 63, 0.4);
      ctx.lineWidth = 3; ctx.strokeStyle = K.red; ctx.stroke(); ctx.strokeStyle = K.ink;
      INK.blob(ctx, -6, -9, 6.5, 6.5, "#ffd2b0", true, 64, 0.05);
      INK.wpoly(ctx, [[-12, -12], [0, -12], [0, -16], [-12, -16]], "#8a5a3b", true, 65, 0.3);
      eo.pupil = 0.5; INK.eye(ctx, -8, -9, 2.8, L, eo); INK.eye(ctx, -3.5, -9.5, 2.6, L, eo);
      INK.wpoly(ctx, [[31, 0], [-28, -14], [-18, 0]], v.col || "#fff", true, 66, 0.6);
      INK.wpoly(ctx, [[31, 0], [-18, 0], [-27, 13]], "#e6e6f0", true, 67, 0.6);
      INK.wpoly(ctx, [[31, 0], [-22, 6], [-18, 0]], "#cfd0e0", true, 68, 0.5);
      A.x = -6; A.y = -10; A.w = 14; A.nx = -6; A.ny = -3;
    },
    suitcase(ctx, v, t, L, A, eo) {
      const c = v.col, f = Math.sin(t * 12) * 0.5, K = INK.C;
      for (let sg = -1; sg <= 1; sg += 2) {
        ctx.save(); ctx.translate(sg * 16, -10); ctx.rotate(sg * (-0.5 + f)); ctx.scale(sg, 1);
        INK.blob(ctx, 10, -2, 11, 5, "#fff", true, 69, 0.1); INK.blob(ctx, 8, 4, 8, 4, "#fff", true, 70, 0.1); ctx.restore();
      }
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-7, -15); ctx.quadraticCurveTo(0, -24, 7, -15); ctx.stroke(); ctx.lineWidth = 3;
      ctx.save(); ctx.translate(20, 4); ctx.rotate(-0.6 + Math.sin(t * 3) * 0.15); ctx.lineWidth = 2; DRAW._sockShape(ctx, 6, 8, K.gold, K.red, 0); ctx.restore();
      const sp = q => { q.beginPath(); q.moveTo(-22, -10); q.quadraticCurveTo(-22, -15, -17, -15); q.lineTo(17, -15); q.quadraticCurveTo(22, -15, 22, -10); q.lineTo(22, 14); q.quadraticCurveTo(22, 19, 17, 19); q.lineTo(-17, 19); q.quadraticCurveTo(-22, 19, -22, 14); q.closePath(); };
      DRAW._inset(ctx, sp, c, 0, 2, 0.92);
      INK.wpoly(ctx, [[-13, -15], [-9, -15], [-9, 19], [-13, 19]], DRAW._sh(c, -0.3), true, 71, 0.3);
      INK.wpoly(ctx, [[9, -15], [13, -15], [13, 19], [9, 19]], DRAW._sh(c, -0.3), true, 72, 0.3);
      ctx.lineWidth = 2; INK.oval(ctx, 16, 11, 4, 4, K.gold, true); INK.wpoly(ctx, [[-20, 8], [-14, 8], [-14, 15], [-20, 15]], K.sky, true, 73, 0.3);
      INK.eye(ctx, -4, -4, 4.6, L, eo); INK.eye(ctx, 5, -5, 4.2, L, eo);
      INK.oval(ctx, 0.5, 6, 2, 2.6, K.ink); ctx.lineWidth = 3;
      A.x = 0; A.y = -4; A.w = 30; A.nx = 0; A.ny = 3;
    },
    moth(ctx, v, t, L, A, eo) {
      const c = v.col, f = 0.72 + Math.abs(Math.sin(t * 6)) * 0.32, K = INK.C, wd = DRAW._sh(c, -0.25);
      ctx.save(); ctx.scale(f, 1);
      for (let sg = -1; sg <= 1; sg += 2) {
        INK.blob(ctx, sg * 13, 12, 12, 9, wd, true, 74 + sg, 0.08);
        INK.blob(ctx, sg * 18, -4, 17, 13, c, true, 76 + sg, 0.07);
        INK.oval(ctx, sg * 21, -4, 5, 5, "#8a6a4a", true); INK.oval(ctx, sg * 21, -4, 2, 2, K.ink);
      }
      ctx.restore();
      ctx.lineWidth = 1.6; ctx.beginPath();
      for (let sg = -1; sg <= 1; sg += 2) {
        ctx.moveTo(sg * 3, -19); ctx.quadraticCurveTo(sg * 6, -30, sg * 14, -33);
        for (let k = 1; k < 5; k++) { const x = sg * (3 + k * 2.6), y = -19 - k * 3.4; ctx.moveTo(x, y); ctx.lineTo(x + sg * 3, y + 1); ctx.moveTo(x, y); ctx.lineTo(x - sg * 1, y - 3); }
      }
      ctx.stroke(); ctx.lineWidth = 3;
      DRAW._body(ctx, 0, 6, 7.5, 16, "#f3e9d2", 78, 0.08);
      ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(6, 6); ctx.moveTo(-6, 12); ctx.lineTo(6, 12); ctx.stroke(); ctx.lineWidth = 3;
      INK.blob(ctx, 0, -12, 9.5, 8.5, "#f3e9d2", true, 79, 0.1);
      INK.eye(ctx, -3.8, -13, 3.9, L, eo); INK.eye(ctx, 3.8, -13.5, 3.7, L, eo);
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 7; k++) { const a = 0.5 + k * 0.36; INK.oval(ctx, Math.cos(a) * 8, -12 + Math.sin(a) * 6, 1.6, 1.6, "#fff", true); }
      ctx.lineWidth = 3;
      A.x = 0; A.y = -13; A.w = 19; A.nx = 0; A.ny = -4;
    },
    lamp(ctx, v, t, L, A, eo) {
      const K = INK.C, on = !(Math.sin(t * 23) > 0.7 || Math.sin(t * 3.1) > 0.9);
      ctx.translate(0, Math.sin(t * 1.8) * 3);
      if (on) { INK.oval(ctx, 0, 4, 34, 32, "rgba(255,224,138,0.18)"); INK.oval(ctx, 0, 6, 22, 20, "rgba(255,224,138,0.22)"); }
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 24); ctx.quadraticCurveTo(10, 34, 16 + Math.sin(t * 2) * 4, 30); ctx.stroke();
      INK.wpoly(ctx, [[14 + Math.sin(t * 2) * 4, 27], [20 + Math.sin(t * 2) * 4, 27], [20 + Math.sin(t * 2) * 4, 33], [14 + Math.sin(t * 2) * 4, 33]], "#9aa3b5", true, 80, 0.3);
      ctx.lineWidth = 3;
      const tp = q => { q.beginPath(); q.moveTo(-12, 8); q.quadraticCurveTo(-15, 20, -10, 26); q.quadraticCurveTo(-6, 22, -3, 27); q.quadraticCurveTo(0, 22, 3, 27); q.quadraticCurveTo(6, 22, 10, 26); q.quadraticCurveTo(15, 20, 12, 8); q.closePath(); };
      tp(ctx); ctx.fillStyle = "rgba(242,233,255,0.8)"; ctx.fill(); ctx.stroke();
      INK.wpoly(ctx, [[-4, 4], [4, 4], [5, 10], [-5, 10]], "#c9a24b", true, 81, 0.3);
      INK.oval(ctx, 0, 6, 5.5, 4, on ? "#fff6b0" : "#bdb38a", true);
      INK.wpoly(ctx, [[-21, 5], [-12, -22], [12, -22], [21, 5]], on ? v.col : DRAW._sh(v.col, -0.3), true, 82, 0.7);
      ctx.lineWidth = 2; ctx.beginPath(); for (let x = -18; x <= 18; x += 6) { ctx.moveTo(x, 5); ctx.lineTo(x, 9); } ctx.stroke(); ctx.lineWidth = 3;
      eo.lid = v.col; INK.eye(ctx, -6, -10, 4.6, L, eo); INK.eye(ctx, 6, -10, 4.4, L, eo);
      INK.oval(ctx, 0, -1, 2.6, 3.4, K.ink);
      A.x = 0; A.y = -10; A.w = 30; A.nx = 0; A.ny = 4;
    },
    satellite(ctx, v, t, L, A, eo) {
      const K = INK.C;
      ctx.rotate(Math.sin(t * 0.9) * 0.15);
      ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.stroke();
      for (let sg = -1; sg <= 1; sg += 2) {
        INK.wpoly(ctx, [[sg * 16, -8], [sg * 37, -8], [sg * 37, 8], [sg * 16, 8]], "#3b5bdb", true, 83 + sg, 0.5);
        ctx.strokeStyle = "#8fb0ff"; ctx.lineWidth = 1.4; ctx.beginPath();
        for (let k = 1; k < 3; k++) { ctx.moveTo(sg * (16 + k * 7), -7); ctx.lineTo(sg * (16 + k * 7), 7); }
        ctx.moveTo(sg * 17, 0); ctx.lineTo(sg * 36, 0); ctx.stroke(); ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
      }
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(2, -21); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, -22); ctx.quadraticCurveTo(2, -14, 12, -23); ctx.quadraticCurveTo(2, -27, -9, -22);
      ctx.fillStyle = "#e8eef6"; ctx.fill(); ctx.stroke();
      INK.oval(ctx, 3, -28, 2, 2, Math.sin(t * 4) > 0 ? K.red : "#7a2a2a", true);
      DRAW._body(ctx, 0, 0, 14, 14, v.col, 85, 0.05);
      INK.eye(ctx, -5.5, -3, 4.6, L, eo); INK.eye(ctx, 5.5, -3.5, 4.3, L, eo);
      ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 4, 3.6, 0.3, 2.8); ctx.stroke();
      ctx.lineWidth = 1.5; INK.oval(ctx, -10, -10, 1.2, 1.2, K.ink); INK.oval(ctx, 10, -10, 1.2, 1.2, K.ink); INK.oval(ctx, -10, 10, 1.2, 1.2, K.ink); INK.oval(ctx, 10, 10, 1.2, 1.2, K.ink);
      ctx.lineWidth = 3;
      A.x = 0; A.y = -4; A.w = 26; A.nx = 0; A.ny = 8;
    },
    ufo(ctx, v, t, L, A, eo) {
      const K = INK.C;
      ctx.translate(0, Math.sin(t * 2) * 3); ctx.rotate(Math.sin(t * 1.3) * 0.08);
      if (Math.sin(t * 1.1) > -0.3) INK.wpoly(ctx, [[-9, 10], [9, 10], [22, 38], [-22, 38]], "rgba(255,255,170,0.28)", false, 86, 1);
      INK.oval(ctx, 0, -5, 15, 14, "rgba(190,240,255,0.35)");
      INK.blob(ctx, 0, 0, 10, 7, v.col, true, 87, 0.08);
      eo.lid = v.col; INK.eye(ctx, -5, -8, 4, L, eo); INK.eye(ctx, 5, -8.5, 3.8, L, eo);
      ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, -1, 5, 0.4, 2.7); ctx.stroke(); ctx.lineWidth = 3;
      INK.oval(ctx, 0, -5, 15, 14, null, true);
      ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.beginPath(); ctx.arc(0, -5, 11, 3.6, 4.4); ctx.stroke(); ctx.strokeStyle = K.ink;
      DRAW._body(ctx, 0, 6, 30, 8.5, "#b8c4d6", 88, 0.04, false);
      INK.wpoly(ctx, [[-29, 7], [29, 7], [27, 10], [-27, 10]], "#8d99ad", false, 89, 0.3);
      const LC = ["#ff5a5a", "#ffd23f", "#7be07b", "#6ad1ff", "#c58bff"];
      ctx.lineWidth = 1.6;
      for (let k = 0; k < 5; k++) INK.oval(ctx, -20 + k * 10, 7, 2.4, 2, LC[(k + Math.floor(t * 6)) % 5], true);
      ctx.lineWidth = 3;
      A.x = 0; A.y = -6; A.w = 18; A.nx = 0; A.ny = 2;
    },
    rock(ctx, v, t, L, A, eo) {
      const run = t * 10, sw = Math.sin(run), bob = -Math.abs(Math.cos(run)) * 3, K = INK.C;
      ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(-6 + sw * 7, 25); ctx.moveTo(6, 10); ctx.lineTo(6 - sw * 7, 25);
      ctx.moveTo(-19, 0 + bob); ctx.lineTo(-25, 8 - sw * 5 + bob); ctx.moveTo(19, 0 + bob); ctx.lineTo(25, 8 + sw * 5 + bob); ctx.stroke();
      INK.oval(ctx, -7 + sw * 7, 27, 5, 2.8, "#fff", true); INK.oval(ctx, 7 - sw * 7, 27, 5, 2.8, "#fff", true);
      ctx.translate(0, bob);
      DRAW._body(ctx, 0, -2, 21, 17, v.col, 90, 0.14);
      ctx.lineWidth = 2;
      INK.oval(ctx, -11, 6, 4, 3, DRAW._sh(v.col, -0.25), true); INK.oval(ctx, 12, 4, 3, 2.4, DRAW._sh(v.col, -0.25), true); INK.oval(ctx, 6, -13, 2.6, 2, DRAW._sh(v.col, -0.25), true);
      ctx.lineWidth = 3;
      INK.eye(ctx, -6, -5, 4.6, L, eo); INK.eye(ctx, 6, -6, 4.2, L, eo);
      ctx.beginPath(); ctx.moveTo(-11, -12); ctx.lineTo(-2, -9); ctx.moveTo(11, -13); ctx.lineTo(2, -10); ctx.stroke();
      ctx.lineWidth = 2.4; INK.wline(ctx, [[-3, 4], [3, 4.5]], 91, 0.4); ctx.lineWidth = 3;
      A.x = 0; A.y = -6; A.w = 32; A.nx = 0; A.ny = 8;
    },
    sockghost(ctx, v, t, L, A, eo) {
      const K = INK.C;
      ctx.translate(0, Math.sin(t * 2) * 4); ctx.rotate(Math.sin(t * 1.5) * 0.1);
      ctx.strokeStyle = "rgba(29,15,43,0.35)"; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k < 3; k++) { const x = -6 + k * 8; ctx.moveTo(x, 26); ctx.quadraticCurveTo(x + Math.sin(t * 3 + k) * 4, 32, x, 38); }
      ctx.stroke(); ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
      ctx.save(); ctx.translate(-8, -26); ctx.globalAlpha = 0.92;
      DRAW._sockShape(ctx, 24, 26, v.col, "#d8c9f2", 0); ctx.globalAlpha = 1; ctx.restore();
      INK.blob(ctx, -12, -12, 4.6, 5.4, K.ink, false, 92, 0.15); INK.blob(ctx, -2, -13, 4, 5, K.ink, false, 93, 0.15);
      const lx = (L.x || 0) * 1.6, ly = (L.y || 0) * 1.6;
      INK.oval(ctx, -12 + lx, -12 + ly, 1.5, 1.5, "#fff"); INK.oval(ctx, -2 + lx, -13 + ly, 1.4, 1.4, "#fff");
      INK.oval(ctx, -7, -1, 3, 4, K.ink);
      INK.blob(ctx, 22, 14, 3, 2.4, K.ink, false, 94, 0.2);
      A.x = -7; A.y = -12; A.w = 22; A.nx = -7; A.ny = 4;
    },
    washer(ctx, v, t, L, A, eo) {
      const K = INK.C, sh = Math.sin(t * 30) * 1.2, run = Math.sin(t * 9);
      ctx.translate(sh, 0);
      ctx.beginPath(); ctx.moveTo(-10, 22); ctx.lineTo(-11 + run * 4, 30); ctx.moveTo(10, 22); ctx.lineTo(11 - run * 4, 30); ctx.stroke();
      INK.oval(ctx, -12 + run * 4, 31, 4.5, 2.4, K.ink); INK.oval(ctx, 12 - run * 4, 31, 4.5, 2.4, K.ink);
      const bx = q => { q.beginPath(); q.moveTo(-21, -25); q.lineTo(21, -25); q.lineTo(21, 23); q.lineTo(-21, 23); q.closePath(); };
      DRAW._inset(ctx, bx, v.col, 0, 0, 0.93);
      INK.wpoly(ctx, [[-21, -25], [21, -25], [21, -13], [-21, -13]], DRAW._sh(v.col, -0.12), true, 95, 0.4);
      ctx.lineWidth = 2; INK.oval(ctx, 15, -19, 2.6, 2.6, K.red, true); ctx.lineWidth = 3;
      eo.lid = v.col; INK.eye(ctx, -9, -19, 4.4, L, eo); INK.eye(ctx, 1, -19.5, 4, L, eo);
      INK.oval(ctx, 0, 5, 14, 14, "#c9d6e3", true);
      INK.oval(ctx, 0, 5, 10.5, 10.5, "#2a1850", true);
      ctx.strokeStyle = "#c58bff"; ctx.lineWidth = 2; ctx.beginPath();
      for (let a = 0; a < 9; a += 0.5) ctx.lineTo(Math.cos(a + t * 4) * a * 1.05, 5 + Math.sin(a + t * 4) * a * 1.05);
      ctx.stroke(); ctx.strokeStyle = K.ink;
      ctx.save(); ctx.translate(Math.cos(-t * 5) * 5, 5 + Math.sin(-t * 5) * 5); ctx.rotate(-t * 5); ctx.lineWidth = 1.2; DRAW._sockShape(ctx, 3, 4, K.pink, "#fff", 0); ctx.restore();
      INK.oval(ctx, -5, 1, 1, 1, "#fff"); INK.oval(ctx, 6, 9, 0.8, 0.8, "#fff");
      ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 5, 8, 3.7, 4.5); ctx.stroke();
      ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
      A.x = -4; A.y = -19; A.w = 30; A.nx = -4; A.ny = -13;
    },
    lint(ctx, v, t, L, A, eo) {
      const K = INK.C, hop = -Math.abs(Math.sin(t * 3)) * 6, c = v.col;
      ctx.translate(0, hop);
      ctx.save(); ctx.translate(-6, -14); ctx.rotate(-0.25 + Math.sin(t * 3) * 0.1); INK.blob(ctx, 0, -9, 4.5, 11, c, true, 96, 0.1); INK.oval(ctx, 0, -9, 2, 7, "#ffc2d6"); ctx.restore();
      ctx.save(); ctx.translate(6, -14); ctx.rotate(0.3 - Math.sin(t * 3) * 0.1); INK.blob(ctx, 0, -9, 4.5, 11, c, true, 97, 0.1); INK.oval(ctx, 0, -9, 2, 7, "#ffc2d6"); ctx.restore();
      DRAW._body(ctx, 0, 4, 18, 16, c, 98, 0.16);
      ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = 0; k < 16; k++) { const a = k * 0.3927, r1 = 17 + INK.j(k, 4), r2 = 21 + INK.j(k, 5) * 2; ctx.moveTo(Math.cos(a) * r1, 4 + Math.sin(a) * r1 * 0.9); ctx.lineTo(Math.cos(a + 0.1) * r2, 4 + Math.sin(a + 0.1) * r2 * 0.9); }
      ctx.stroke(); ctx.lineWidth = 3;
      eo.pupil = 0.6; INK.eye(ctx, -6, 0, 3.4, L, eo); INK.eye(ctx, 6, 0, 3.4, L, eo);
      INK.wpoly(ctx, [[-1.6, 5], [1.6, 5], [0, 7]], "#ff7eb6", true, 99, 0.2);
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-3, 7); ctx.lineTo(-12, 6); ctx.moveTo(-3, 8); ctx.lineTo(-12, 10); ctx.moveTo(3, 7); ctx.lineTo(12, 6); ctx.moveTo(3, 8); ctx.lineTo(12, 10); ctx.stroke();
      if (t % 4 < 0.7) for (let k = 0; k < 6; k++) INK.oval(ctx, (k - 2.5) * 4 + INK.j(k, 6) * 2, 12 + (t % 4) * 14 + k, 1.4, 1.4, K.gold, true);
      ctx.lineWidth = 3;
      A.x = 0; A.y = 0; A.w = 30; A.nx = 0; A.ny = 12;
    },
    flare(ctx, v, t, L, A, eo) {
      const K = INK.C, P = [], Q = [];
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * 6.2832, r = (k & 1 ? 18 : 27 + Math.sin(t * 12 + k) * 4);
        P.push([Math.cos(a) * r, Math.sin(a) * r * 1.05 - 2]); Q.push([Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.75 - 1]);
      }
      INK.wpoly(ctx, P, v.col, true, 100, 1.2); INK.wpoly(ctx, Q, K.gold, false, 101, 1);
      ctx.beginPath(); ctx.moveTo(-13, 6); ctx.lineTo(-24, -8 + Math.sin(t * 10) * 3); ctx.moveTo(13, 6); ctx.lineTo(24, -8 - Math.sin(t * 10) * 3); ctx.stroke();
      INK.blob(ctx, 0, 2, 15, 14, "#ffe08a", true, 102, 0.06);
      eo.pupil = 0.28; eo.blink = 0; INK.eye(ctx, -6, -3, 5.8, L, eo); INK.eye(ctx, 6, -4, 5.4, L, eo);
      ctx.beginPath(); ctx.moveTo(-8, 4); ctx.quadraticCurveTo(0, 18, 8, 4); ctx.closePath(); ctx.fillStyle = K.ink; ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillRect(-5, 4, 10, 2.4); ctx.stroke();
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) { const a = t * 3 + k * 1.57, r = 30 + ((t * 20 + k * 7) % 10); INK.oval(ctx, Math.cos(a) * r, Math.sin(a) * r, 1.6, 1.6, K.gold, true); }
      ctx.lineWidth = 3;
      A.x = 0; A.y = -4; A.w = 28; A.nx = 0; A.ny = 12;
    },
    comet(ctx, v, t, L, A, eo) {
      const K = INK.C, TC = [v.col, "#ffffff", K.lil];
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(0, -2 + i * 3);
        ctx.quadraticCurveTo(-18, -8 + i * 4 + Math.sin(t * 5 + i) * 2, -40 + i * 3, -20 + i * 10 + Math.sin(t * 4 + i) * 3);
        ctx.lineWidth = 13 - i * 3; ctx.strokeStyle = K.ink; ctx.stroke(); ctx.lineWidth = 8 - i * 2.4; ctx.strokeStyle = TC[i]; ctx.stroke();
      }
      ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
      DRAW._body(ctx, 4, 0, 15, 14, v.col, 103, 0.12);
      eo.style = "sleepy"; eo.lid = v.col;
      INK.eye(ctx, -1, -3, 4.4, L, eo); INK.eye(ctx, 9, -3.5, 4, L, eo);
      ctx.lineWidth = 2.2; INK.wline(ctx, [[0, 6], [4, 7], [8, 6]], 104, 0.3);
      INK.wpoly(ctx, [[14, 8], [23, 8], [22, 18], [15, 18]], "#fff", true, 105, 0.3);
      ctx.beginPath(); ctx.arc(23, 12, 3, -1.3, 1.3); ctx.stroke();
      INK.wpoly(ctx, [[14.5, 9], [22.5, 9], [22.3, 11], [14.7, 11]], "#8a5a3b", false, 106, 0.2);
      ctx.strokeStyle = "rgba(29,15,43,0.5)"; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = 0; k < 2; k++) { const x = 17 + k * 3.5; ctx.moveTo(x, 6); ctx.quadraticCurveTo(x + Math.sin(t * 4 + k) * 2.5, 2, x, -2); }
      ctx.stroke(); ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
      A.x = 4; A.y = -3; A.w = 26; A.nx = 4; A.ny = 10;
    },
    cow(ctx, v, t, L, A, eo) {
      const K = INK.C, sp = "#2e2140";
      ctx.translate(0, Math.sin(t * 1.4) * 4); ctx.rotate(Math.sin(t * 0.7) * 0.18);
      ctx.beginPath();
      for (let k = 0; k < 4; k++) { const x = -15 + k * 9.5, sw = Math.sin(t * 2 + k) * 3; ctx.moveTo(x, 8); ctx.lineTo(x + sw, 22); }
      ctx.lineWidth = 7; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = "#fff"; ctx.stroke(); ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
      for (let k = 0; k < 4; k++) INK.oval(ctx, -15 + k * 9.5 + Math.sin(t * 2 + k) * 3, 23, 3, 2, sp);
      ctx.beginPath(); ctx.moveTo(-24, -2); ctx.quadraticCurveTo(-32, 2 + Math.sin(t * 3) * 4, -30, 12); ctx.stroke();
      INK.blob(ctx, -30, 13, 2.4, 3, sp, false, 107, 0.2);
      DRAW._body(ctx, -2, 0, 24, 13, "#ffffff", 108, 0.05);
      INK.blob(ctx, -10, -3, 6, 4.5, sp, false, 109, 0.15); INK.blob(ctx, 6, 3, 5, 3.6, sp, false, 110, 0.15); INK.blob(ctx, -16, 6, 3, 2.4, sp, false, 111, 0.2);
      INK.oval(ctx, 4, 13, 6, 3.4, "#ffb3c7", true);
      INK.wpoly(ctx, [[15, -18], [13, -26], [19, -19]], "#fff3dc", true, 112, 0.3); INK.wpoly(ctx, [[25, -19], [28, -27], [29, -18]], "#fff3dc", true, 113, 0.3);
      INK.blob(ctx, 22, -9, 11, 10, "#ffffff", true, 114, 0.06);
      INK.blob(ctx, 14, -14, 3, 5, sp, false, 115, 0.2);
      INK.oval(ctx, 27, -3, 7.5, 5, "#ffb3c7", true);
      INK.oval(ctx, 25, -3, 1.2, 1.6, K.ink); INK.oval(ctx, 29.5, -3, 1.2, 1.6, K.ink);
      INK.eye(ctx, 18, -12, 3.8, L, eo); INK.eye(ctx, 25, -13, 3.6, L, eo);
      A.x = 22; A.y = -11; A.w = 22; A.nx = 18; A.ny = 1;
    },
    cheese(ctx, v, t, L, A, eo) {
      const K = INK.C, a = t * 1.5, cx = Math.cos(a) * 32, cy = Math.sin(a) * 9 - 4, front = Math.sin(a) > 0;
      const crumb = () => { ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.lineWidth = 2; INK.wpoly(ctx, [[-4, 3], [4, 3], [4, -3]], v.col, true, 116, 0.3); ctx.restore(); ctx.lineWidth = 3; };
      if (!front) crumb();
      ctx.rotate(Math.sin(t * 0.8) * 0.1);
      DRAW._body(ctx, 0, 0, 24, 24, v.col, 117, 0.04);
      const H = [[-12, -12, 5], [10, -14, 3.5], [14, 8, 4.5], [-14, 10, 3.5], [2, 17, 3]];
      ctx.lineWidth = 2;
      for (const h of H) { INK.oval(ctx, h[0], h[1], h[2], h[2] * 0.85, "#d9a514", true); INK.oval(ctx, h[0] + h[2] * 0.25, h[1] + h[2] * 0.2, h[2] * 0.55, h[2] * 0.45, "#c48f0c"); }
      ctx.lineWidth = 3;
      eo.style = "sleepy"; INK.eye(ctx, -7, -2, 4.8, L, eo); INK.eye(ctx, 7, -3, 4.4, L, eo);
      ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-4, 7); ctx.quadraticCurveTo(2, 10, 7, 5); ctx.stroke(); ctx.lineWidth = 3;
      if (front) crumb();
      A.x = 0; A.y = -3; A.w = 38; A.nx = 0; A.ny = 10;
    },
    serpent(ctx, v, t, L, A, eo) {
      const K = INK.C, c = v.col;
      for (let i = 0; i < 3; i++) {
        const x0 = -30 + i * 14 + Math.sin(t * 2 + i) * 2;
        ctx.beginPath(); ctx.arc(x0, 14, 6.5 - i * 0.6, Math.PI, 0);
        ctx.lineWidth = 10; ctx.strokeStyle = K.ink; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = c; ctx.stroke();
      }
      const hx = 17 + Math.sin(t * 1.5) * 2;
      ctx.beginPath(); ctx.moveTo(10, 15); ctx.quadraticCurveTo(22, 2, hx, -12);
      ctx.lineWidth = 11; ctx.strokeStyle = K.ink; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = c; ctx.stroke();
      ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
      INK.wpoly(ctx, [[hx - 8, -18], [hx - 15, -26], [hx - 6, -23], [hx - 6, -30], [hx, -24], [hx + 4, -30], [hx + 4, -21]], DRAW._sh(c, 0.25), true, 118, 1);
      INK.blob(ctx, hx + 2, -16, 12, 8, c, true, 119, 0.12);
      ctx.lineWidth = 2.4; INK.wline(ctx, [[hx + 2, -12], [hx + 9, -11], [hx + 13, -13]], 120, 0.6);
      INK.wpoly(ctx, [[hx + 6, -11.5], [hx + 8, -11.5], [hx + 7, -8.5]], "#fff", true, 121, 0.2);
      eo.lid = c; INK.eye(ctx, hx - 3, -19, 3.4, L, eo); INK.eye(ctx, hx + 5, -18, 4.6, L, eo);
      ctx.lineWidth = 1.4; ctx.beginPath();
      for (let k = 0; k < 6; k++) { const x = -34 + k * 7 + INK.j(k, 7) * 2; ctx.moveTo(x, 9); ctx.lineTo(x + 3, 4); }
      ctx.stroke();
      ctx.strokeStyle = "#4a8fd8"; ctx.lineWidth = 2.6;
      INK.wline(ctx, [[-38, 15], [-30, 17], [-22, 14], [-14, 17], [-6, 14], [2, 17], [10, 14], [18, 17], [26, 14], [34, 16]], 122, 0.8);
      ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
      A.x = hx + 2; A.y = -17; A.w = 22; A.nx = hx - 1; A.ny = -8;
    },
    fish(ctx, v, t, L, A, eo) {
      const K = INK.C, f = Math.sin(t * 7), c = v.col;
      ctx.translate(0, Math.sin(t * 2) * 2);
      ctx.save(); ctx.translate(-22, 0); ctx.rotate(f * 0.3); INK.wpoly(ctx, [[2, 0], [-12, -12], [-8, 0], [-12, 12]], DRAW._sh(c, -0.15), true, 123, 0.5); ctx.restore();
      INK.wpoly(ctx, [[-8, -13], [2, -21], [8, -13]], DRAW._sh(c, -0.15), true, 124, 0.5);
      DRAW._body(ctx, 0, 0, 24, 15, c, 125, 0.05);
      INK.wpoly(ctx, [[-5, -14], [12, -13], [14, 13], [-7, 14]], "#3a3d4d", true, 126, 0.5);
      INK.wpoly(ctx, [[1, -14], [8, -13.5], [4.5, -3]], "#ffffff", true, 127, 0.3);
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1, -13); ctx.lineTo(4, 0); ctx.moveTo(8, -13); ctx.lineTo(5, 0); ctx.stroke();
      INK.oval(ctx, 6, 5, 1, 1, "#ddd"); INK.oval(ctx, 6, 9, 1, 1, "#ddd");
      ctx.beginPath(); ctx.moveTo(2, 12); ctx.lineTo(0, 22); ctx.stroke();
      INK.wpoly(ctx, [[-7, 21], [7, 21], [7, 30], [-7, 30]], "#8a5a3b", true, 128, 0.4);
      ctx.beginPath(); ctx.moveTo(-2, 21); ctx.lineTo(-2, 18); ctx.lineTo(2, 18); ctx.lineTo(2, 21); ctx.stroke();
      ctx.lineWidth = 3;
      INK.eye(ctx, 15, -5, 5.2, L, eo);
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(21, 4, 2.6, 0.3, 2.6); ctx.stroke(); ctx.lineWidth = 3;
      A.x = 14; A.y = -5; A.w = 20; A.nx = 4.5; A.ny = -10;
    },
    stapler(ctx, v, t, L, A, eo) {
      const K = INK.C, op = 0.08 + 0.4 * Math.max(0, Math.sin(t * 3)) ** 2, f = Math.sin(t * 13) * 0.5;
      ctx.translate(0, Math.sin(t * 2.4) * 3);
      for (let sg = -1; sg <= 1; sg += 2) {
        ctx.save(); ctx.translate(sg * 6, -10); ctx.rotate(sg * (-0.6 + f)); ctx.scale(sg, 1);
        INK.blob(ctx, 10, -3, 11, 5, "#fff", true, 129, 0.1); INK.blob(ctx, 8, 3, 8, 4, "#fff", true, 130, 0.1); ctx.restore();
      }
      INK.wpoly(ctx, [[-27, 8], [25, 8], [27, 15], [-27, 15]], "#3a3d4d", true, 131, 0.4);
      ctx.save(); ctx.translate(-24, 6); ctx.rotate(-op);
      const ar = q => { q.beginPath(); q.moveTo(0, 2); q.lineTo(0, -6); q.quadraticCurveTo(0, -11, 8, -11); q.lineTo(46, -9); q.quadraticCurveTo(52, -8, 52, -2); q.lineTo(52, 2); q.closePath(); };
      DRAW._inset(ctx, ar, v.col, 26, -4, 0.9);
      INK.eye(ctx, 32, -6, 4.4, L, eo); INK.eye(ctx, 42, -5.5, 4, L, eo);
      ctx.restore();
      if (op < 0.12) { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(22, 4); ctx.lineTo(22, 1); ctx.lineTo(28, 1); ctx.lineTo(28, 4); ctx.strokeStyle = "#aaa"; ctx.stroke(); ctx.strokeStyle = K.ink; ctx.lineWidth = 3; }
      A.x = 12; A.y = -8; A.w = 24; A.nx = 0; A.ny = 4;
    },
    intern(ctx, v, t, L, A, eo) {
      const K = INK.C;
      ctx.translate(Math.sin(t * 25) * 0.6, 0);
      ctx.beginPath(); ctx.moveTo(-5, 16); ctx.lineTo(-6, 29); ctx.moveTo(5, 16); ctx.lineTo(6, 29); ctx.stroke();
      INK.oval(ctx, -7, 30, 4.4, 2.4, K.ink); INK.oval(ctx, 7, 30, 4.4, 2.4, K.ink);
      INK.wpoly(ctx, [[-11, -6], [11, -6], [13, 18], [-13, 18]], v.col, true, 132, 0.5);
      ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-3, 5); ctx.moveTo(4, -6); ctx.lineTo(-1, 5); ctx.stroke();
      INK.wpoly(ctx, [[-7, 5], [2, 5], [2, 11], [-7, 11]], "#fff", true, 133, 0.2);
      INK.oval(ctx, -5, 8, 1.2, 1.2, K.sky); ctx.lineWidth = 3;
      INK.wpoly(ctx, [[8, -1], [22, -2], [23, 17], [9, 18]], "#a8794a", true, 134, 0.4);
      INK.wpoly(ctx, [[10, 1], [21, 0], [21.5, 16], [10.5, 17]], "#fff", false, 135, 0.3);
      ctx.lineWidth = 1.2; ctx.beginPath(); for (let k = 0; k < 4; k++) { ctx.moveTo(12, 5 + k * 3); ctx.lineTo(19, 5 + k * 3); } ctx.stroke();
      ctx.lineWidth = 2; INK.wpoly(ctx, [[13, -3], [18, -3], [18, 1], [13, 1]], "#9aa3b5", true, 136, 0.2); ctx.lineWidth = 3;
      INK.blob(ctx, 0, -18, 11, 11, "#ffd2b0", true, 137, 0.05);
      INK.wpoly(ctx, [[-10, -22], [-8, -31], [-3, -26], [1, -33], [4, -26], [9, -30], [10, -21], [0, -25]], "#6b4226", true, 138, 0.8);
      eo.pupil = 0.3; INK.eye(ctx, -4, -18, 4.2, L, eo); INK.eye(ctx, 4.5, -18, 4, L, eo);
      ctx.lineWidth = 2; INK.wline(ctx, [[-4, -10], [-1.5, -11], [1, -10], [3.5, -11]], 139, 0.3); ctx.lineWidth = 3;
      INK.oval(ctx, 12, -22 + ((t * 5) % 4), 1.8, 2.6, "#8fd3ff", true);
      A.x = 0; A.y = -18; A.w = 22; A.nx = 0; A.ny = -6;
    },
    cursor(ctx, v, t, L, A, eo) {
      const K = INK.C, ph = t % 2.2, clk = ph < 0.18;
      if (ph < 0.6) { ctx.lineWidth = 2; INK.oval(ctx, -14, -26, 4 + ph * 30, 4 + ph * 30, null, true); ctx.lineWidth = 3; }
      ctx.save(); ctx.translate(-14, -26); const k = clk ? 2.4 : 2.6; ctx.scale(k, k); ctx.lineWidth = 3 / k;
      INK.wpoly(ctx, DRAW._CUR, v.col || "#fff", true, 140, 0.15); ctx.restore();
      INK.eye(ctx, -7, 1, 4.2, L, eo); INK.eye(ctx, 1.6, -4, 3.8, L, eo);
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-4, 8, 2.6, 0.3, 2.8); ctx.stroke(); ctx.lineWidth = 3;
      A.x = -3; A.y = -2; A.w = 20; A.nx = -4; A.ny = 12;
    },
    spinner(ctx, v, t, L, A, eo) {
      const st = Math.floor(t * 10) / 10 * 5;
      ctx.lineWidth = 2;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * 6.2832 + st; ctx.globalAlpha = 0.2 + (0.8 * k) / 7;
        INK.oval(ctx, Math.cos(a) * 23, Math.sin(a) * 23, 4.8, 4.8, v.col, true);
      }
      ctx.globalAlpha = 1; ctx.lineWidth = 3;
      DRAW._body(ctx, 0, 0, 13, 13, "#ffffff", 141, 0.05);
      eo.style = "spiral"; INK.eye(ctx, -5, -2, 4, L, eo); INK.eye(ctx, 5, -2, 4, L, eo);
      ctx.lineWidth = 2; INK.wline(ctx, [[-4, 6], [-2, 5], [0, 6.5], [2, 5], [4, 6]], 142, 0.3); ctx.lineWidth = 3;
      A.x = 0; A.y = -3; A.w = 24; A.nx = 0; A.ny = 10;
    },
    eyewing(ctx, v, t, L, A, eo) {
      const f = Math.sin(t * 10);
      ctx.translate(0, Math.sin(t * 2.5) * 3);
      for (let sg = -1; sg <= 1; sg += 2) {
        ctx.save(); ctx.translate(sg * 14, -2); ctx.rotate(sg * (-0.3 + f * 0.5)); ctx.scale(sg, 1);
        INK.blob(ctx, 14, -5, 13, 6, "#fff", true, 143, 0.1); INK.blob(ctx, 12, 3, 11, 5, "#f2eaff", true, 144, 0.1); INK.blob(ctx, 9, 10, 8, 4.5, "#e6dcff", true, 145, 0.1);
        ctx.restore();
      }
      ctx.strokeStyle = "#e8742a"; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-4, 16); ctx.lineTo(-5, 24); ctx.moveTo(4, 16); ctx.lineTo(5, 24); ctx.stroke();
      ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 3;
      DRAW._bigEye(ctx, 0, 0, 17, L, eo.blink, "#6ad1ff", "#ffd2e0", false, "round");
      ctx.lineWidth = 2.2; ctx.beginPath();
      for (let k = 0; k < 5; k++) { const a = -2.5 + k * 0.42; ctx.moveTo(Math.cos(a) * 17, Math.sin(a) * 17); ctx.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); }
      ctx.stroke(); ctx.lineWidth = 3;
      A.x = 0; A.y = 0; A.w = 32; A.nx = 0; A.ny = 17;
    },
  },
  _CL: [[-18, 4, 11], [18, 4, 11], [-8, -6, 14], [9, -8, 13], [0, 6, 13]],

  /* ================= WORMSLEY ================= origin = ground point where he emerges */
  worm(ctx, o) {
    o = o || DRAW._Z;
    const t = o.t != null ? o.t : INK.t, R = o.size || 40, rise = Math.max(0, Math.min(1, o.rise == null ? 1 : o.rise));
    const mood = o.mood || "smug", mo = Math.max(0, Math.min(1, o.mouth || 0)), K = INK.C, PK = "#e8907e";
    ctx.save(); DRAW._ink(ctx, Math.max(2, R * 0.08));
    const hy = R * 2 - rise * R * 5, sw = Math.sin(t * 1.5) * R * 0.22 * rise, hx = sw;
    ctx.save(); ctx.beginPath(); ctx.rect(-R * 4, -R * 8, R * 8, R * 8 + R * 0.1); ctx.clip();
    if (hy < R * 1.2) {
      const N = 8; ctx.beginPath();
      for (let i = 0; i <= N; i++) { const u = i / N, y = R * 1.2 + (hy - R * 1.2) * u, x = hx * u * u, w = R * (0.82 + 0.06 * Math.sin(u * 9 + t * 3)); i ? ctx.lineTo(x - w, y) : ctx.moveTo(x - w, y); }
      for (let i = N; i >= 0; i--) { const u = i / N, y = R * 1.2 + (hy - R * 1.2) * u, x = hx * u * u, w = R * (0.82 + 0.06 * Math.sin(u * 9 + t * 3)); ctx.lineTo(x + w, y); }
      ctx.closePath(); ctx.fillStyle = PK; ctx.fill(); ctx.stroke();
      ctx.strokeStyle = DRAW._sh(PK, -0.3); ctx.lineWidth = Math.max(1.5, R * 0.05); ctx.beginPath();
      for (let k = 1; k < 9; k++) { const y = hy + R * 0.9 + k * R * 0.42; if (y > R * 1.2) break; const u = (y - R * 1.2) / (hy - R * 1.2), x = hx * u * u; ctx.moveTo(x - R * 0.78, y); ctx.quadraticCurveTo(x, y + R * 0.18, x + R * 0.78, y); }
      ctx.stroke();
      { const y = hy + R * 1.5, u = (y - R * 1.2) / (hy - R * 1.2 || 1), x = hx * u * u; INK.oval(ctx, x, y, R * 0.84, R * 0.2, "#d97a72"); }
      ctx.strokeStyle = K.ink; ctx.lineWidth = Math.max(2, R * 0.08);
    }
    DRAW._wormHead(ctx, hx, hy, R, t, mood, mo, o.look);
    ctx.restore();
    INK.blob(ctx, 0, R * 0.12, R * 1.5, R * 0.32, "#6b4226", true, 146, 0.08);
    INK.blob(ctx, -R * 0.9, -R * 0.08, R * 0.22, R * 0.15, "#7d5236", true, 147, 0.2);
    INK.blob(ctx, R * 1.05, -R * 0.02, R * 0.18, R * 0.13, "#7d5236", true, 148, 0.2);
    INK.oval(ctx, R * 0.4, -R * 0.12, R * 0.1, R * 0.08, "#5a3a22");
    ctx.restore();
  },
  _wormHead(ctx, x, y, R, t, mood, mo, look) {
    const K = INK.C, PK = "#e8907e", lw = ctx.lineWidth;
    DRAW._body(ctx, x, y, R * 0.95, R * 0.9, PK, 149, 0.04);
    INK.oval(ctx, x - R * 0.55, y + R * 0.28, R * 0.17, R * 0.1, "rgba(255,90,120,0.4)");
    INK.oval(ctx, x + R * 0.58, y + R * 0.26, R * 0.17, R * 0.1, "rgba(255,90,120,0.4)");
    ctx.save(); ctx.translate(x, y);
    const L = look || DRAW._look(ctx, 0, -R * 0.1), eo = DRAW._eo2;
    eo.blink = DRAW._blink(t, 21); eo.style = mood === "smug" ? "sleepy" : "round"; eo.lid = PK; eo.pupil = 0;
    if (mood === "chew") eo.blink = Math.max(eo.blink, 0.3);
    INK.eye(ctx, -R * 0.32, -R * 0.12, R * 0.2, L, eo); INK.eye(ctx, R * 0.33, -R * 0.14, R * 0.23, L, eo);
    ctx.lineWidth = Math.max(2, R * 0.07);
    INK.oval(ctx, R * 0.33, -R * 0.14, R * 0.29, R * 0.29, "rgba(200,240,255,0.15)", false);
    ctx.beginPath(); ctx.arc(R * 0.33, -R * 0.14, R * 0.29, 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = K.gold; ctx.lineWidth = Math.max(1.2, R * 0.035); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R * 0.6, -R * 0.08); ctx.quadraticCurveTo(R * 0.85, R * 0.4, R * 0.62, R * 0.95); ctx.stroke();
    ctx.strokeStyle = K.ink; ctx.lineWidth = Math.max(2, R * 0.07);
    const my = R * 0.4;
    let op = mo;
    if (mood === "chew" && mo < 0.05) op = Math.abs(Math.sin(t * 7)) * 0.35;
    if (op > 0.05) {
      INK.oval(ctx, 0, my, R * 0.26, R * (0.05 + op * 0.28), K.ink);
      if (op > 0.2) INK.oval(ctx, 0, my + R * op * 0.16, R * 0.16, R * op * 0.1, K.pink);
      if (mood === "chew") { ctx.lineWidth = Math.max(1.5, R * 0.05); INK.oval(ctx, -R * 0.42, my - R * 0.02, R * 0.14 + op * R * 0.1, R * 0.12 + op * R * 0.08, PK, true); INK.oval(ctx, R * 0.42, my - R * 0.02, R * 0.14 + op * R * 0.1, R * 0.12 + op * R * 0.08, PK, true); }
    } else if (mood === "happy") {
      ctx.beginPath(); ctx.moveTo(-R * 0.3, my - R * 0.06); ctx.quadraticCurveTo(0, my + R * 0.42, R * 0.3, my - R * 0.06); ctx.closePath();
      ctx.fillStyle = K.ink; ctx.fill(); INK.oval(ctx, 0, my + R * 0.12, R * 0.12, R * 0.06, K.pink);
    } else {
      ctx.beginPath(); ctx.moveTo(-R * 0.22, my + R * 0.04); ctx.quadraticCurveTo(R * 0.05, my + R * 0.14, R * 0.26, my - R * 0.08); ctx.stroke();
    }
    ctx.lineWidth = Math.max(2, R * 0.08);
    ctx.save(); ctx.translate(-R * 0.05, -R * 0.78); ctx.rotate(-0.12 + Math.sin(t * 1.2) * 0.03);
    const hp = q => { q.beginPath(); q.moveTo(-R * 0.42, 0); q.bezierCurveTo(-R * 0.44, -R * 0.62, R * 0.44, -R * 0.62, R * 0.42, 0); q.closePath(); };
    DRAW._inset(ctx, hp, "#2e2140", 0, -R * 0.25, 0.9);
    INK.wpoly(ctx, [[-R * 0.42, -R * 0.14], [R * 0.42, -R * 0.14], [R * 0.42, -R * 0.02], [-R * 0.42, -R * 0.02]], "#7a4a8a", true, 150, R * 0.01);
    INK.blob(ctx, 0, 0, R * 0.68, R * 0.12, "#2e2140", true, 151, 0.04);
    ctx.restore();
    ctx.restore();
    ctx.lineWidth = lw;
  },

  /* ================= THE MOON ================= */
  _CR: [[-0.55, -0.45, 0.15], [0.48, -0.55, 0.1], [0.63, 0.22, 0.12], [-0.7, 0.2, 0.09], [0.12, -0.76, 0.07], [-0.32, 0.66, 0.09], [0.38, 0.62, 0.06]],
  moonFace(ctx, r, o) {
    o = o || DRAW._Z; r = r || 60;
    const t = o.t != null ? o.t : INK.t, mood = o.mood || "smug", K = INK.C, MC = "#fff3c4", MD = "#e3d39a";
    ctx.save(); DRAW._ink(ctx, Math.max(2.5, r * 0.035));
    INK.oval(ctx, 0, 0, r * 1.22, r * 1.22, "rgba(255,243,196,0.08)"); INK.oval(ctx, 0, 0, r * 1.09, r * 1.09, "rgba(255,243,196,0.14)");
    const b = mood === "nervous" ? Math.sin(t * 30) * r * 0.01 : 0;
    ctx.translate(b, 0);
    DRAW._body(ctx, 0, 0, r, r, MC, 152, 0.025, false);
    const lw = ctx.lineWidth; ctx.lineWidth = Math.max(1.5, r * 0.022);
    for (let k = 0; k < DRAW._CR.length; k++) {
      const c = DRAW._CR[k];
      INK.blob(ctx, c[0] * r, c[1] * r, c[2] * r, c[2] * r * 0.85, MD, true, 153 + k, 0.08);
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.arc(c[0] * r + c[2] * r * 0.15, c[1] * r + c[2] * r * 0.1, c[2] * r * 0.6, 0.3, 1.6); ctx.stroke(); ctx.strokeStyle = K.ink;
    }
    ctx.lineWidth = lw;
    INK.oval(ctx, -r * 0.48, r * 0.18, r * 0.13, r * 0.07, "rgba(255,126,182,0.35)"); INK.oval(ctx, r * 0.48, r * 0.16, r * 0.13, r * 0.07, "rgba(255,126,182,0.35)");
    DRAW._moonFeatures(ctx, r, t, mood, o.look || DRAW._look(ctx, 0, 0));
    ctx.restore();
  },
  _moonFeatures(ctx, r, t, mood, look) {
    const K = INK.C, ex = r * 0.28, ey = -r * 0.08, er = r * 0.15, eo = DRAW._eo2, lw = ctx.lineWidth;
    eo.lid = "#fff3c4"; eo.pupil = 0; eo.blink = DRAW._blink(t, 31);
    ctx.lineWidth = Math.max(2.5, r * 0.04);
    if (mood === "sleep" || mood === "bye") {
      ctx.beginPath();
      if (mood === "sleep") { ctx.arc(-ex, ey, er * 0.8, 0.2, 2.9); ctx.moveTo(ex + er * 0.8, ey); ctx.arc(ex, ey, er * 0.8, 0.2, 2.9); }
      else ctx.arc(-ex, ey + er * 0.3, er * 0.8, 3.5, 5.9);
      ctx.stroke();
      if (mood === "bye") { eo.style = "round"; eo.blink = 0; INK.eye(ctx, ex, ey, er * 1.1, look, eo); }
    } else {
      eo.style = mood === "nervous" ? "wide" : "sleepy";
      if (mood === "nervous") { eo.pupil = 0.22; eo.blink = 0; }
      const L = mood === "nervous" ? { x: Math.sin(t * 5) > 0 ? 1 : -1, y: 0.2 } : look;
      INK.eye(ctx, -ex, ey, er, L, eo); INK.eye(ctx, ex, ey - r * 0.01, er * 1.05, L, eo);
    }
    ctx.lineWidth = Math.max(2.5, r * 0.045); ctx.beginPath();
    if (mood === "smug") { ctx.moveTo(-ex - er, ey - er * 1.5); ctx.lineTo(-ex + er, ey - er * 1.25); ctx.moveTo(ex - er, ey - er * 1.7); ctx.quadraticCurveTo(ex, ey - er * 2.4, ex + er * 1.1, ey - er * 1.8); }
    else if (mood === "nervous") { ctx.moveTo(-ex - er, ey - er * 1.3); ctx.lineTo(-ex + er, ey - er * 1.8); ctx.moveTo(ex + er, ey - er * 1.3); ctx.lineTo(ex - er, ey - er * 1.8); }
    ctx.stroke();
    const my = r * 0.3;
    ctx.lineWidth = Math.max(2.5, r * 0.04); ctx.beginPath();
    switch (mood) {
      case "nervous":
        INK.wline(ctx, [[-r * 0.2, my], [-r * 0.1, my - r * 0.04], [0, my + r * 0.02], [r * 0.1, my - r * 0.04], [r * 0.2, my]], 160, r * 0.01);
        { const sy = -r * 0.3 + ((t * 0.8) % 1) * r * 0.3; INK.oval(ctx, r * 0.62, sy, r * 0.05, r * 0.08, "#8fd3ff", true); } break;
      case "bye":
        ctx.moveTo(-r * 0.24, my - r * 0.06); ctx.quadraticCurveTo(0, my + r * 0.36, r * 0.24, my - r * 0.06); ctx.closePath();
        ctx.fillStyle = K.ink; ctx.fill(); INK.oval(ctx, 0, my + r * 0.1, r * 0.1, r * 0.05, K.pink); break;
      case "sleep":
        INK.oval(ctx, 0, my, r * 0.05, r * 0.06 + Math.sin(t * 2) * r * 0.015, K.ink);
        for (let k = 0; k < 3; k++) { const ph = (t * 0.5 + k / 3) % 1; ctx.globalAlpha = 1 - ph; INK.label(ctx, "z", r * (0.5 + ph * 0.5), -r * (0.4 + ph * 0.6), Math.round(r * (0.18 + k * 0.05)), K.cream, "center", INK.FONT, 3); }
        ctx.globalAlpha = 1; break;
      default: ctx.moveTo(-r * 0.18, my + r * 0.02); ctx.quadraticCurveTo(r * 0.04, my + r * 0.12, r * 0.22, my - r * 0.07); ctx.stroke();
    }
    ctx.lineWidth = lw;
  },

  /* ================= PORTRAITS ================= */
  _PV: {
    barbara: { body: "cloud", col: "#ffffff" }, pigeon: { body: "bird", col: "#c7cbe0", acc: "wig" }, linda: { body: "moth", col: "#e6d7b8" },
    greg: { body: "satellite", col: "#b8f0ff" }, comet: { body: "comet", col: "#a8f5ff" }, cow: { body: "cow", col: "#ffffff" },
    serpent: { body: "serpent", col: "#3b7f70" }, gnome: { body: "gnome", col: "#ff6b6b" },
  },
  _PSC: { barbara: 1.35, pigeon: 1.25, linda: 1.3, greg: 1.05, comet: 1.2, cow: 1.25, serpent: 1.15, gnome: 1.2 },
  _PP: { i: 0, name: "A Plant", type: "daisy", c1: "#ffd23f", c2: "#ff9a3c", hue: 50, eyes: 2, eyeStyle: "round", mouth: "smile", acc: "none", pt: 7, seed: 5 },
  portrait(ctx, key, size, t) {
    if (!key || key === "narr" || key === "you") return;
    t = t != null ? t : INK.t; size = size || 80;
    ctx.save(); ctx.scale(size / 80, size / 80); DRAW._ink(ctx, 3);
    const pv = DRAW._PV[key];
    if (pv) { const k = DRAW._PSC[key] || 1; ctx.scale(k, k); DRAW.visitor(ctx, pv, t); }
    else switch (key) {
      case "gerald": ctx.translate(0, 8); DRAW.gerald(ctx, { t, scale: 0.86 }); break;
      case "worm": ctx.translate(0, 40); DRAW.worm(ctx, { t, size: 15, rise: 1, mood: "smug" }); break;
      case "moon": DRAW.moonFace(ctx, 33, { t, mood: "smug" }); break;
      case "plant": DRAW.plant(ctx, DRAW._PP, { t }); break;
      case "captain": DRAW._captain(ctx, t); break;
      case "queen": DRAW._queen(ctx, t); break;
      case "saturn": DRAW._saturn(ctx, t); break;
      case "sun": DRAW._sun(ctx, t); break;
      case "margaret": DRAW._margaret(ctx, t); break;
      case "stagehand": DRAW._stagehand(ctx, t); break;
      default: {
        const g = DRAW._G();
        DRAW._local(ctx, t, key === "local" ? ((g && g.S && g.S.zone) || 0) : DRAW._hs(key));
      }
    }
    ctx.restore();
  },
  _captain(ctx, t) {
    const K = INK.C;
    ctx.translate(-2, Math.sin(t * 2) * 2); ctx.rotate(Math.sin(t * 1.4) * 0.04);
    const L = DRAW._look(ctx, 24, -4), eo = DRAW._eo2; eo.blink = DRAW._blink(t, 41); eo.style = "round"; eo.lid = "#f4f8ff"; eo.pupil = 0;
    INK.wpoly(ctx, [[-28, -6], [-37, -28], [-27, -28], [-16, -8]], "#9fd0ff", true, 161, 0.5);
    INK.wpoly(ctx, [[-2, -2], [-14, -18], [-6, -18], [8, -4]], "#bcd0e8", true, 162, 0.5);
    DRAW._body(ctx, 0, 0, 36, 14, "#f4f8ff", 163, 0.03);
    ctx.strokeStyle = "#4a7fe8"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-32, 5); ctx.quadraticCurveTo(0, 9, 33, 4); ctx.stroke(); ctx.strokeStyle = K.ink;
    ctx.lineWidth = 1.8; for (let k = 0; k < 5; k++) INK.oval(ctx, -24 + k * 6.5, -3, 2, 2.2, "#9fd0ff", true);
    ctx.lineWidth = 3;
    INK.wpoly(ctx, [[-6, 5], [14, 5], [-2, 24], [-13, 24]], "#dfe8f5", true, 164, 0.5);
    INK.eye(ctx, 20, -4, 5, L, eo); INK.eye(ctx, 29, -3.5, 4.4, L, eo);
    DRAW._acc(ctx, "mustache", 25, 0, 1.1, 10, -10, DRAW._E1, 1, -4, 4, false);
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(25, 5, 3.4, 0.4, 2.7); ctx.stroke(); ctx.lineWidth = 3;
    ctx.save(); ctx.translate(23, -11); ctx.rotate(0.15); DRAW.hat(ctx, "pilot", 26); ctx.restore();
  },
  _queen(ctx, t) {
    const K = INK.C;
    ctx.translate(0, Math.sin(t * 1.6) * 2);
    INK.wpoly(ctx, [[-26, -8], [14, -8], [24, 36], [-34, 36]], "#8a3fbf", true, 165, 0.8);
    ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k < 6; k++) { const x = -30 + k * 10; INK.oval(ctx, x, 34, 2, 2, "#fff", true); } ctx.lineWidth = 3;
    ctx.save(); ctx.translate(-8, -16); DRAW._sockShape(ctx, 22, 26, "#ff9ad5", "#ffffff", 0); ctx.restore();
    const L = DRAW._look(ctx, -8, -4), eo = DRAW._eo2; eo.blink = DRAW._blink(t, 43); eo.style = "sleepy"; eo.lid = "#ff9ad5"; eo.pupil = 0;
    INK.eye(ctx, -13, -2, 4.8, L, eo); INK.eye(ctx, -3, -2.5, 4.4, L, eo);
    ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-17, -5); ctx.lineTo(-20, -8); ctx.moveTo(1, -6); ctx.lineTo(4, -9); ctx.stroke();
    ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-12, 8); ctx.quadraticCurveTo(-8, 10, -4, 7); ctx.stroke(); ctx.lineWidth = 3;
    INK.wpoly(ctx, [[-20, -15], [-20, -29], [-14, -21], [-8, -33], [-2, -21], [4, -29], [4, -15]], K.gold, true, 166, 0.5);
    INK.oval(ctx, -8, -19, 2.2, 2.2, K.red, true); INK.oval(ctx, -16, -19, 1.6, 1.6, K.sky, true); INK.oval(ctx, 0, -19, 1.6, 1.6, K.sky, true);
  },
  _saturn(ctx, t) {
    const K = INK.C, rot = -0.2;
    ctx.translate(0, 6);
    ctx.beginPath(); ctx.ellipse(0, 4, 44, 11, rot, Math.PI, 2 * Math.PI); ctx.lineWidth = 7; ctx.stroke(); ctx.lineWidth = 3.6; ctx.strokeStyle = "#e8c37a"; ctx.stroke();
    ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
    DRAW._body(ctx, 0, 0, 26, 26, "#ffd27f", 167, 0.03);
    ctx.strokeStyle = "#e0a95a"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-24, 10); ctx.quadraticCurveTo(0, 16, 24, 8); ctx.moveTo(-20, 17); ctx.quadraticCurveTo(0, 22, 19, 16); ctx.stroke();
    ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
    const L = DRAW._look(ctx, 0, -2), eo = DRAW._eo2; eo.blink = DRAW._blink(t, 47); eo.style = "sleepy"; eo.lid = "#ffd27f"; eo.pupil = 0;
    INK.eye(ctx, -9, -2, 5, L, eo); INK.eye(ctx, 9, -2.5, 4.8, L, eo);
    ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 4, 5, 0.3, 2.8); ctx.stroke(); ctx.lineWidth = 3;
    INK.oval(ctx, -16, 5, 3.6, 2, "rgba(255,126,182,0.5)"); INK.oval(ctx, 16, 4, 3.6, 2, "rgba(255,126,182,0.5)");
    ctx.save(); ctx.translate(0, -24); DRAW.hat(ctx, "towel", 50); ctx.restore();
    ctx.beginPath(); ctx.ellipse(0, 4, 44, 11, rot, 0, Math.PI); ctx.lineWidth = 7; ctx.stroke(); ctx.lineWidth = 3.6; ctx.strokeStyle = "#e8c37a"; ctx.stroke();
    ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
  },
  _sun(ctx, t) {
    const K = INK.C;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * 6.2832 + t * 0.3, r2 = 38 + Math.sin(t * 3 + k) * 2;
      INK.wpoly(ctx, [[Math.cos(a - 0.14) * 25, Math.sin(a - 0.14) * 25], [Math.cos(a) * r2, Math.sin(a) * r2], [Math.cos(a + 0.14) * 25, Math.sin(a + 0.14) * 25]], k & 1 ? "#ffb347" : "#ff9a3c", true, 168 + k, 0.5);
    }
    DRAW._body(ctx, 0, 0, 27, 27, "#ffd23f", 181, 0.03);
    ctx.save(); ctx.translate(0, -24); DRAW.hat(ctx, "shades", 54); ctx.restore();
    ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-8, 11); ctx.quadraticCurveTo(2, 17, 11, 8); ctx.stroke(); ctx.lineWidth = 3;
    INK.oval(ctx, -17, 8, 4, 2.2, "rgba(255,90,90,0.4)"); INK.oval(ctx, 17, 7, 4, 2.2, "rgba(255,90,90,0.4)");
  },
  _margaret(ctx, t) {
    const K = INK.C, C = "#d9e6a8";
    ctx.translate(0, Math.sin(t * 1.2) * 1);
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) { ctx.save(); ctx.translate(-12 + k * 8, -34); ctx.rotate(-0.5 + k * 0.33 + Math.sin(t * 2 + k) * 0.04); INK.wpoly(ctx, [[-5, 0], [5, 0], [5, -12], [-5, -12]], "#ffffff", true, 182 + k, 0.4); ctx.restore(); }
    ctx.lineWidth = 3;
    const cp = q => { q.beginPath(); q.moveTo(-24, -33); q.lineTo(24, -33); q.lineTo(24, 38); q.lineTo(-24, 38); q.closePath(); };
    DRAW._inset(ctx, cp, C, 0, 0, 0.94);
    const dr = [[-30, -8], [-5, 15], [18, 35]];
    ctx.lineWidth = 2.4;
    for (let k = 0; k < 3; k++) {
      INK.wpoly(ctx, [[-21, dr[k][0]], [21, dr[k][0]], [21, dr[k][1]], [-21, dr[k][1]]], DRAW._sh(C, 0.25), true, 186 + k, 0.4);
      if (k) { INK.wpoly(ctx, [[-6, dr[k][0] + 4], [6, dr[k][0] + 4], [6, dr[k][0] + 8], [-6, dr[k][0] + 8]], "#fff", true, 189 + k, 0.2); INK.wpoly(ctx, [[-5, dr[k][1] - 6], [5, dr[k][1] - 6], [5, dr[k][1] - 3], [-5, dr[k][1] - 3]], "#9aa3b5", true, 192 + k, 0.2); }
    }
    const L = DRAW._look(ctx, 0, -20), eo = DRAW._eo2; eo.blink = DRAW._blink(t, 53); eo.style = "round"; eo.lid = C; eo.pupil = 0;
    INK.eye(ctx, -8, -20, 4.6, L, eo); INK.eye(ctx, 8, -20, 4.4, L, eo);
    ctx.strokeStyle = "#d43d8a"; ctx.lineWidth = 2.4;
    for (let sg = -1; sg <= 1; sg += 2) {
      const x = sg * 8, y = -20;
      ctx.beginPath(); ctx.moveTo(x - sg * 2, y + 6.5); ctx.quadraticCurveTo(x + sg * 8, y + 6, x + sg * 8, y - 1); ctx.lineTo(x + sg * 10, y - 8);
      ctx.quadraticCurveTo(x, y - 7, x - sg * 6.5, y - 4); ctx.quadraticCurveTo(x - sg * 7.5, y + 5, x - sg * 2, y + 6.5); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-1.5, -22); ctx.lineTo(1.5, -22); ctx.stroke();
    ctx.strokeStyle = K.ink; ctx.lineWidth = 2;
    INK.oval(ctx, 0, -12, 5, 2.6, "#e0304f", true);
    ctx.beginPath(); ctx.moveTo(-4.5, -12); ctx.quadraticCurveTo(0, -10.5, 4.5, -12); ctx.stroke();
    ctx.save(); ctx.translate(19, -37); ctx.rotate(0.6);
    INK.wpoly(ctx, [[-2.4, -10], [2.4, -10], [2.4, 8], [-2.4, 8]], K.gold, true, 195, 0.2);
    INK.wpoly(ctx, [[-2.4, -13], [2.4, -13], [2.4, -10], [-2.4, -10]], K.pink, true, 196, 0.2);
    INK.wpoly(ctx, [[-2.4, 8], [2.4, 8], [0, 13]], "#f2c79b", true, 197, 0.2);
    ctx.restore(); ctx.lineWidth = 3;
  },
  _stagehand(ctx, t) {
    const K = INK.C, D = "#2a2a33";
    INK.wpoly(ctx, [[-32, 40], [-28, 12], [-12, 3], [12, 3], [28, 12], [32, 40]], D, true, 198, 0.6);
    ctx.beginPath(); ctx.moveTo(24, 16); ctx.quadraticCurveTo(32, 6, 30, -6 + Math.sin(t * 4) * 2);
    ctx.lineWidth = 10; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = D; ctx.stroke(); ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
    INK.blob(ctx, 31, -10 + Math.sin(t * 4) * 2, 5, 5.5, "#ffd2b0", true, 199, 0.1);
    INK.blob(ctx, 0, -10, 15, 17, "#ffd2b0", true, 200, 0.04);
    ctx.beginPath(); ctx.moveTo(-16, -15); ctx.bezierCurveTo(-17, -38, 17, -38, 16, -15); ctx.quadraticCurveTo(0, -20, -16, -15); ctx.closePath();
    ctx.fillStyle = D; ctx.fill(); ctx.stroke();
    const eo = DRAW._eo2; eo.blink = DRAW._blink(t, 59); eo.style = "round"; eo.lid = "#ffd2b0"; eo.pupil = 0;
    const L = { x: -1, y: 0.3 };
    INK.eye(ctx, -5, -9, 4.2, L, eo); INK.eye(ctx, 5.5, -9.5, 4, L, eo);
    INK.oval(ctx, -9, -1, 4.2, 2.4, "rgba(255,90,120,0.45)"); INK.oval(ctx, 9, -1.5, 4.2, 2.4, "rgba(255,90,120,0.45)");
    ctx.lineWidth = 2; INK.wline(ctx, [[-4, 3], [-1.5, 2], [1, 3.2], [3.5, 2]], 201, 0.3);
    INK.oval(ctx, 15, -18 + ((t * 4) % 5), 1.8, 2.6, "#8fd3ff", true); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, -14, 18, 18, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.lineWidth = 5; ctx.stroke(); ctx.lineWidth = 2.6; ctx.strokeStyle = "#5b5f73"; ctx.stroke();
    ctx.strokeStyle = K.ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-16, -6); ctx.quadraticCurveTo(-14, 4, -5, 4); ctx.stroke();
    INK.blob(ctx, -17, -11, 4, 6.5, "#3a3d4d", true, 202, 0.1); INK.oval(ctx, -4, 4, 2.4, 2, K.ink);
  },
  /* a random weird resident for procedural zones */
  _local(ctx, t, seed) {
    const r = U.rng((seed | 0) * 7919 + 13), K = INK.C;
    const hue = Math.floor(r() * 360), col = INK.hsl(hue, 70, 66), c2 = INK.hsl((hue + 140) % 360, 75, 60);
    const shape = Math.floor(r() * 3), ne = 1 + Math.floor(r() * 5), ext = Math.floor(r() * 4);
    const mk = ["smile", "flat", "o", "teeth", "tongue", "wobbly"][Math.floor(r() * 6)];
    const hats = ["none", "party", "tophat", "beanie", "pilot", "lampshade", "cone", "fish", "halo", "gnome", "propeller", "cheese"];
    const hat = hats[Math.floor(r() * hats.length)], E = [];
    for (let i = 0; i < ne; i++) E.push([(r() - 0.5) * 26, -8 + (r() - 0.5) * 14, 3.6 + r() * 3.4]);
    ctx.translate(0, Math.sin(t * 2 + seed) * 2);
    const top = shape === 0 ? -26 : shape === 1 ? -14 : -24;
    if (ext === 0) { ctx.beginPath(); ctx.moveTo(-6, top + 4); ctx.quadraticCurveTo(-10, top - 8, -14 + Math.sin(t * 3) * 2, top - 12); ctx.moveTo(6, top + 4); ctx.quadraticCurveTo(10, top - 8, 14 - Math.sin(t * 3) * 2, top - 12); ctx.stroke(); INK.oval(ctx, -14 + Math.sin(t * 3) * 2, top - 13, 3.4, 3.4, c2, true); INK.oval(ctx, 14 - Math.sin(t * 3) * 2, top - 13, 3.4, 3.4, c2, true); }
    if (ext === 2) for (let sg = -1; sg <= 1; sg += 2) { ctx.beginPath(); ctx.moveTo(sg * 16, 10); ctx.quadraticCurveTo(sg * 30, 8 + Math.sin(t * 3 + sg) * 6, sg * 32, 24); ctx.lineWidth = 8; ctx.stroke(); ctx.lineWidth = 4.5; ctx.strokeStyle = col; ctx.stroke(); ctx.strokeStyle = K.ink; ctx.lineWidth = 3; }
    if (shape === 0) DRAW._body(ctx, 0, 6, 18, 32, col, seed, 0.08);
    else if (shape === 1) DRAW._body(ctx, 0, 10, 31, 24, col, seed, 0.1);
    else { const tp = q => { q.beginPath(); q.moveTo(0, -24); q.quadraticCurveTo(12, -22, 26, 30); q.quadraticCurveTo(0, 38, -26, 30); q.quadraticCurveTo(-12, -22, 0, -24); q.closePath(); }; DRAW._inset(ctx, tp, col, 0, 8, 0.9); }
    if (ext === 1) { INK.wpoly(ctx, [[-10, top + 3], [-15, top - 10], [-4, top + 1]], "#fff3dc", true, seed + 1, 0.4); INK.wpoly(ctx, [[10, top + 3], [15, top - 10], [4, top + 1]], "#fff3dc", true, seed + 2, 0.4); }
    if (ext === 3) for (let k = 0; k < 4; k++) INK.oval(ctx, (r() - 0.5) * 24, 12 + r() * 14, 2 + r() * 2, 2 + r() * 2, c2);
    const L = DRAW._look(ctx, 0, -6), eo = DRAW._eo2; eo.blink = DRAW._blink(t, seed); eo.style = "round"; eo.lid = col; eo.pupil = 0;
    for (let i = 0; i < ne; i++) INK.eye(ctx, E[i][0], E[i][1], E[i][2], L, eo);
    DRAW._mouth(ctx, 0, 10, 1.2, mk, 0);
    if (hat !== "none") { ctx.save(); ctx.translate(0, top + 2); DRAW.hat(ctx, hat, 34); ctx.restore(); }
  },
};
