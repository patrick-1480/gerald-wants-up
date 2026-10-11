/* Gerald Wants Up — little animated pictures for quests (DRAW.questIcon), built from the
   game's own drawings so they match. Loaded after draw.js. */
const ICONS = {
  PLANT: { i: 0, type: "daisy", c1: "#ff7eb6", c2: "#ffd23f", hue: 330, eyes: 2, eyeStyle: "round", mouth: "smile", acc: "none", pt: 6, seed: 7 },
  SPROUT: { i: 0, type: "fern", c1: "#7be07b", c2: "#ffd23f", hue: 120, eyes: 2, eyeStyle: "round", mouth: "o", acc: "none", pt: 5, seed: 11 },
  ink(ctx, w) { ctx.strokeStyle = INK.C.ink; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round"; },
  cursor(ctx, x, y, s, press) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (press ? 0.88 : 1), s * (press ? 0.88 : 1)); ICONS.ink(ctx, 1.6);
    INK.wpoly(ctx, [[0, 0], [0, 15], [4, 11.5], [6.5, 17.5], [9.5, 16.3], [7, 10.5], [12, 10.5]], "#ffffff", true, 3, 0.4);
    ctx.restore();
  },
  arrow(ctx, x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ICONS.ink(ctx, 2);
    INK.wpoly(ctx, [[0, -12], [9, -1], [4, -1], [4, 10], [-4, 10], [-4, -1], [-9, -1]], col, true, 5, 0.5);
    ctx.restore();
  },
  star(ctx, x, y, r, col) {
    const p = [];
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.48 : r; p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    ICONS.ink(ctx, 2); INK.wpoly(ctx, p, col, true, 9, 0.5);
  },
  sparkle(ctx, x, y, r, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 2); ctx.globalAlpha *= 0.6 + 0.4 * Math.sin(t * 7);
    ctx.fillStyle = "#fff6c0"; ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * 0.3 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.fill(); ctx.restore();
  },
  dirt(ctx, y, w) { ICONS.ink(ctx, 2); INK.blob(ctx, 0, y, w, 6, "#7a4e2d", true, 21, 0.1); },
  /* size: the box the picture must fit in (about 50) */
  draw(ctx, type, size, t) {
    const s = (size || 50) / 50;
    ctx.save(); ctx.scale(s, s);
    const f = ICONS.T[type] || ICONS.T.unknown;
    try { f(ctx, t || 0); } catch (e) { /* a broken picture must never break the quest list */ }
    ctx.restore();
  },
};
ICONS.T = {
  bubbles(ctx, t) {            // a coin bubble popping up next to a little plant
    ctx.save(); ctx.translate(-10, -6); ctx.scale(0.5, 0.5); DRAW.plant(ctx, ICONS.PLANT, { t, look: { x: 1, y: -0.3 } }); ctx.restore();
    const ph = (t * 0.9) % 1, y = 12 - ph * 24, r = 8 + ph * 3;
    if (ph < 0.86) { ctx.save(); ctx.translate(15, y); DRAW.bubble(ctx, r, t); ctx.restore(); }
    else { ICONS.ink(ctx, 2); for (let k = 0; k < 6; k++) { const a = k * 1.05; INK.oval(ctx, 13 + Math.cos(a) * 11, y + Math.sin(a) * 11, 2, 2, "#bfe9ff"); } ctx.save(); ctx.translate(13, y); DRAW.coin(ctx, 6); ctx.restore(); }
  },
  pokes(ctx, t) {              // a cursor poking Gerald, who flinches
    const ph = (t * 1.3) % 1, hit = ph > 0.45 && ph < 0.65;
    ctx.save(); ctx.translate(-4, 2); ctx.scale(0.42, 0.42);
    DRAW.gerald(ctx, { t, mood: hit ? "shock" : "grump", look: { x: 1, y: 0.4 }, hat: "none", spit: hit ? 0.8 : 0, neck: false });
    ctx.restore();
    if (hit) { ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 2; INK.oval(ctx, 7, 4, 6 + (ph - 0.45) * 30, 6 + (ph - 0.45) * 30, null, true); }
    const k = ph < 0.45 ? ph / 0.45 : ph < 0.65 ? 1 : 1 - (ph - 0.65) / 0.35;
    ICONS.cursor(ctx, 20 - k * 12, 16 - k * 10, 1.25, hit);
  },
  sprouts(ctx, t) {            // a sprout popping out of the dirt, with a +
    const ph = (t * 0.7) % 1, g = U.easeOutBack(Math.min(1, ph * 1.6));
    ICONS.dirt(ctx, 17, 17);
    ctx.save(); ctx.translate(-3, -6); ctx.scale(0.5 * g, 0.5 * g); DRAW.plant(ctx, ICONS.SPROUT, { t, look: { x: 0, y: 0.3 } }); ctx.restore();
    INK.label(ctx, "+", 15, -6, 22, INK.C.moss);
  },
  socks(ctx, t) {              // a falling sock and a cursor catching it
    const ph = (t * 0.8) % 1, y = -20 + ph * 26;
    ctx.save(); ctx.translate(-4, y); ctx.rotate(Math.sin(t * 4) * 0.4); ctx.scale(0.55, 0.55); DRAW.sock(ctx, 1, t, 3); ctx.restore();
    ICONS.cursor(ctx, 6, 8, 1.2, ph > 0.85);
  },
  upgrades(ctx, t) {           // a plant with a bouncing green up arrow
    ctx.save(); ctx.translate(-8, -6); ctx.scale(0.5, 0.5); DRAW.plant(ctx, ICONS.PLANT, { t, look: { x: 1, y: -0.5 } }); ctx.restore();
    ICONS.arrow(ctx, 14, -2 - Math.abs(Math.sin(t * 4)) * 5, 0.95, INK.C.moss);
  },
  beans(ctx, t) {              // Gerald spitting beans
    const ph = (t * 1.1) % 1;
    ctx.save(); ctx.translate(-10, -6); ctx.scale(0.36, 0.36); DRAW.gerald(ctx, { t, spit: ph < 0.3 ? 1 : 0, look: { x: 1, y: 0.5 }, hat: "none", neck: false }); ctx.restore();
    for (let k = 0; k < 3; k++) {
      const q = (ph + k / 3) % 1, x = -4 + q * 24, y = 2 + q * q * 16;
      ctx.save(); ctx.translate(x, y); ctx.rotate(q * 8); ctx.scale(0.75, 0.75); DRAW.bean(ctx, false, t, k); ctx.restore();
    }
  },
  golden(ctx, t) {             // a sparkling golden bean
    ctx.save(); ctx.rotate(Math.sin(t * 2) * 0.3); ctx.scale(1.9, 1.9); DRAW.bean(ctx, true, t, 4); ctx.restore();
    ICONS.sparkle(ctx, -14, -12, 6, t); ICONS.sparkle(ctx, 15, -8, 5, t + 1); ICONS.sparkle(ctx, 10, 14, 4, t + 2);
  },
  visitors(ctx, t) {           // a weird winged eyeball with sparkles
    ctx.save(); ctx.translate(0, Math.sin(t * 3) * 3); ctx.scale(0.45, 0.45); DRAW.visitor(ctx, DATA.VISITORS.eyewing, t); ctx.restore();
    ICONS.sparkle(ctx, -17, -14, 5, t); ICONS.sparkle(ctx, 17, 12, 5, t + 1.5);
  },
  earn(ctx, t) {               // a bouncing stack of coins
    for (let k = 0; k < 3; k++) {
      const b = Math.max(0, Math.sin(t * 5 - k * 0.6)) * 4;
      ctx.save(); ctx.translate(-8 + k * 8, 12 - k * 9 - b); DRAW.coin(ctx, 9); ctx.restore();
    }
  },
  tall(ctx, t) {               // the stalk next to a measuring tape
    ICONS.ink(ctx, 8); ctx.beginPath(); ctx.moveTo(-6, 22); ctx.quadraticCurveTo(-10 + Math.sin(t * 2) * 2, 0, -6, -20); ctx.stroke();
    ctx.strokeStyle = "#5fb85a"; ctx.lineWidth = 4.5; ctx.stroke();
    ICONS.ink(ctx, 2); INK.wpoly(ctx, [[6, -22], [16, -22], [16, 22], [6, 22]], "#ffd23f", true, 6, 0.4);
    ctx.lineWidth = 1.5; for (let k = 0; k < 9; k++) { const y = -18 + k * 5; ctx.beginPath(); ctx.moveTo(6, y); ctx.lineTo(k % 2 ? 10 : 13, y); ctx.stroke(); }
    ctx.save(); ctx.translate(-6, -21); ctx.scale(0.22, 0.22); DRAW.gerald(ctx, { t, look: { x: 1, y: 0 }, hat: "none", neck: false }); ctx.restore();
  },
  level(ctx, t) {              // a plant with a gold "Lv" star badge
    ctx.save(); ctx.translate(-8, -5); ctx.scale(0.5, 0.5); DRAW.plant(ctx, ICONS.PLANT, { t, look: { x: 1, y: -0.2 } }); ctx.restore();
    const r = 11 + Math.sin(t * 4) * 1.2;
    ICONS.star(ctx, 13, -9, r, INK.C.gold);
    INK.label(ctx, "Lv", 13, -6, 9, INK.C.ink, "center", INK.FONT, 0);
  },
  compost(ctx, t) {            // Wormsley poking out of the dirt
    ctx.save(); ctx.translate(0, 18); DRAW.worm(ctx, { t, size: 11, rise: 0.75 + Math.sin(t * 2) * 0.08, mood: "smug" }); ctx.restore();
    ICONS.dirt(ctx, 19, 19);
  },
  unknown(ctx, t) {            // a little scroll with a question mark
    ICONS.ink(ctx, 2); INK.wpoly(ctx, [[-14, -16], [14, -16], [14, 16], [-14, 16]], "#fff3dc", true, 8, 0.6);
    INK.label(ctx, "?", 0, 8, 22, INK.C.lil);
  },
};
ICONS.T.visit = ICONS.T.visitors;
if (typeof DRAW !== "undefined" && !DRAW.questIcon) DRAW.questIcon = (ctx, type, size, t) => ICONS.draw(ctx, type, size, t);
