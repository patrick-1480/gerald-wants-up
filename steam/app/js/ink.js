/* Gerald Wants Up — shared hand-drawn ink primitives.
   Everything is outlined in INK.C.ink. Shapes "boil" (re-jitter ~7 times a second)
   to look hand-drawn: call INK.setTime(t) once per frame (main.js / cutscene.js do). */
const INK = {
  C: {
    ink: "#1d0f2b", cream: "#fff3dc", or: "#ff9a3c", lil: "#c58bff", moss: "#7be07b", gold: "#ffd23f",
    pink: "#ff7eb6", sky: "#6ad1ff", red: "#ff5a5a", leaf: "#5fb85a", leafD: "#3f8f3f", soil: "#6b4226",
    bean: "#b5763a", white: "#ffffff",
  },
  FONT: '"Chewy", "Comic Sans MS", "Chalkboard SE", cursive',
  HAND: '"Gaegu", "Comic Sans MS", "Chalkboard SE", cursive',
  t: 0, boil: 0,
  setTime(t) { INK.t = t; INK.boil = Math.floor(t * 7); },

  /* noise: j() changes every boil frame, n() is static. Both return [-1, 1]. */
  _h(a, b) {
    let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 15;
    return ((h >>> 0) / 4294967295) * 2 - 1;
  },
  j(seed, k = 0) { return INK._h(seed * 97 + k, INK.boil * 131 + k); },
  n(seed, k = 0) { return INK._h(seed * 53 + k * 7919, k); },

  /* wobbly closed blob approximating an ellipse */
  blobPath(ctx, x, y, rx, ry, seed = 0, amt = 0.05, pts = 9) {
    const P = [];
    for (let k = 0; k < pts; k++) {
      const a = (k / pts) * Math.PI * 2, r = 1 + amt * (INK.j(seed, k) * 0.6 + INK.n(seed, k) * 0.4);
      P.push([x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r]);
    }
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    ctx.beginPath();
    const m0 = mid(P[0], P[1]);
    ctx.moveTo(m0[0], m0[1]);
    for (let k = 1; k <= pts; k++) {
      const c = P[k % pts], m = mid(P[k % pts], P[(k + 1) % pts]);
      ctx.quadraticCurveTo(c[0], c[1], m[0], m[1]);
    }
    ctx.closePath();
  },
  /* fill with `fill` (skip if falsy) and stroke with the CURRENT strokeStyle/lineWidth if stroke */
  blob(ctx, x, y, rx, ry, fill, stroke = true, seed = 0, amt = 0.05) {
    INK.blobPath(ctx, x, y, rx, ry, seed, amt);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) ctx.stroke();
  },
  oval(ctx, x, y, rx, ry, fill, stroke = false) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) ctx.stroke();
  },
  /* wobbly polygon / polyline: pts = [[x,y],...], jitter in px */
  wpoly(ctx, pts, fill, stroke = true, seed = 0, amt = 1.2) {
    ctx.beginPath();
    pts.forEach((p, k) => {
      const x = p[0] + INK.j(seed, k) * amt, y = p[1] + INK.j(seed + 5, k) * amt;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) ctx.stroke();
  },
  wline(ctx, pts, seed = 0, amt = 1.2) {
    ctx.beginPath();
    pts.forEach((p, k) => {
      const x = p[0] + INK.j(seed, k) * amt, y = p[1] + INK.j(seed + 5, k) * amt;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  },
  /* outlined text */
  label(ctx, text, x, y, size = 15, col = INK.C.cream, align = "center", font = INK.FONT, lw = 4) {
    ctx.font = size + "px " + font;
    ctx.textAlign = align; ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round"; ctx.lineWidth = lw; ctx.strokeStyle = INK.C.ink;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = col; ctx.fillText(text, x, y);
  },
  /* googly eye. look = {x,y} roughly unit vector toward what it looks at.
     o.blink 0..1 (1 = closed), o.style 'round'|'sleepy'|'wide'|'side'|'spiral', o.pupil (0..1 size), o.lid colour */
  eye(ctx, x, y, r, look = { x: 0, y: 0 }, o = {}) {
    const st = o.style || "round", lw = ctx.lineWidth;
    ctx.lineWidth = Math.max(1.5, r * 0.22);
    INK.blob(ctx, x, y, r, r * (st === "wide" ? 1.15 : 1), "#fff", true, (x * 13 + y * 7) | 0, 0.04);
    let lx = look.x || 0, ly = look.y || 0;
    if (st === "side") { lx = 1; ly = 0; }
    const m = Math.hypot(lx, ly) || 1, k = Math.min(1, m) * r * 0.42;
    const px = x + (lx / m) * k, py = y + (ly / m) * k, pr = r * (o.pupil || (st === "wide" ? 0.32 : 0.45));
    if (st === "spiral") {
      ctx.beginPath();
      for (let a = 0; a < 12; a += 0.4) ctx.lineTo(x + Math.cos(a + INK.t * 6) * a * r * 0.07, y + Math.sin(a + INK.t * 6) * a * r * 0.07);
      ctx.strokeStyle = INK.C.ink; ctx.stroke();
    } else {
      INK.oval(ctx, px, py, pr, pr, INK.C.ink);
      INK.oval(ctx, px - pr * 0.35, py - pr * 0.35, pr * 0.3, pr * 0.3, "#fff");
    }
    const lid = Math.max(o.blink || 0, st === "sleepy" ? 0.45 : 0);
    if (lid > 0.02) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, r, r, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = o.lid || "#8fd18f"; ctx.fillRect(x - r - 2, y - r - 2, r * 2 + 4, (r * 2 + 4) * lid);
      ctx.beginPath(); ctx.moveTo(x - r, y - r + r * 2 * lid); ctx.lineTo(x + r, y - r + r * 2 * lid);
      ctx.strokeStyle = INK.C.ink; ctx.stroke(); ctx.restore();
    }
    ctx.lineWidth = lw;
  },
  /* colour helpers (hex in, css out) */
  rgb(hex) {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  rgba(hex, a) { const c = INK.rgb(hex); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; },
  /* amt > 0 lightens toward white, amt < 0 darkens toward black; returns hex */
  shade(hex, amt) {
    const c = INK.rgb(hex).map(v => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)));
    return "#" + c.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
  },
  mix(a, b, t) {
    const A = INK.rgb(a), B = INK.rgb(b);
    return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
  },
  hsl(h, s, l) {   // -> hex
    s /= 100; l /= 100;
    const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return "#" + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
  },
};
