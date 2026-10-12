/* Gerald Wants Up — SFX: every sound and all music synthesized live with the Web Audio API (no files).
   Public API (CONTRACT.md): init, setVolume, play, music, setMusicOn, duck, cue.
   Every call is a silent no-op before init() or when Web Audio is unavailable.
   Graph: sfx bus ─┐                         ┌─> reverb (shared convolver)
          players -> musIn -> hp -> lp -> wow delay -> mus (vol/duck) ─┤
          cue bus ──┴──────────────────────────────> master -> soft compressor -> out
   Music: one lookahead scheduler (setInterval 25 ms, ~0.12 s ahead) drives 1-2 Players (crossfade).
   Each finished voice disconnects all of its nodes (see ve()). Extras for tools: _stats, _render, names. */
const SFX = (() => {
  "use strict";
  let ac = null, B = null, NB = null, timer = 0, unlockBound = false;
  let sfxVol = 0.7, musVol = 0.5, musicOn = true, ducked = false, cueDuckUntil = 0;
  const MUS_BASE = 0.6, SFX_BASE = 0.9, players = [];
  let want = null;                                   // last zone asked for by music()
  let key = { hb: 60, pent: [0, 2, 4, 7, 9] };       // hits/jingles follow the current music key
  const stats = { steps: 0, notes: 0, live: 0, maxLive: 0, sfx: 0, dropped: 0, hitDrop: 0, players: 0, zone: -1, bar: 0, loop: 0, state: "none" };

  const SC = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10], penta: [0, 2, 4, 7, 9],
    phryg: [0, 1, 3, 5, 7, 8, 10], whole: [0, 2, 4, 6, 8, 10] };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const pk = (a, r) => a[Math.floor(r() * a.length)];
  const norm = (m, lo) => { while (m < lo) m += 12; while (m >= lo + 12) m -= 12; return m; };
  function rng(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(a, b) {
    let h = (a ^ Math.imul((b + 0x9e3779b9) | 0, 0x85ebca6b)) | 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) | 0;
  }
  const wallNow = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;

  /* ---------- voice helpers: vb() opens a voice, osc/noise/gn/flt/pan add nodes, ve(t0,t1) starts every
     source at its own start time, stops all at t1 and disconnects every node when the last one ends ---------- */
  let VN = null, VS = null;
  function vb() { VN = []; VS = []; }
  function osc(type, f, t) {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o._t = t;
    VN.push(o); VS.push(o); return o;
  }
  function noise(rate, t) {
    const s = ac.createBufferSource(); s.buffer = NB; s.loop = true; s.playbackRate.value = rate || 1;
    s._t = t; s._o = Math.random() * 1.5; VN.push(s); VS.push(s); return s;
  }
  function gn(v) { const g = ac.createGain(); g.gain.value = v; VN.push(g); return g; }
  function flt(type, f, q) {
    const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q;
    VN.push(b); return b;
  }
  function pan(p) {
    if (!ac.createStereoPanner) return gn(1);
    const s = ac.createStereoPanner(); s.pan.value = p; VN.push(s); return s;
  }
  /* attack/decay and attack/sustain/release envelopes on a gain node (returns the node) */
  function ad(g, t, a, peak, d) {
    const p = g.gain; p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(peak, t + a);
    p.exponentialRampToValueAtTime(0.0001, t + a + d); return g;
  }
  function asr(g, t, a, peak, hold, r) {
    const p = g.gain; hold = Math.max(0, hold);
    p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(peak, t + a); p.setValueAtTime(peak, t + a + hold);
    p.exponentialRampToValueAtTime(0.0001, t + a + hold + r); return g;
  }
  function sweep(param, t, a, b, d) { param.setValueAtTime(a, t); param.exponentialRampToValueAtTime(b, t + d); }
  function ve(t0, t1) {
    const nodes = VN, srcs = VS; VN = VS = null;
    if (!srcs || !srcs.length) return;
    let left = srcs.length;
    stats.live++; if (stats.live > stats.maxLive) stats.maxLive = stats.live;
    const done = () => {
      if (--left > 0) return;
      for (let i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) { /* already gone */ } }
      stats.live--;
    };
    for (const s of srcs) {
      s.onended = done;
      const st = Math.max(s._t || 0, 0);
      if (s.buffer) s.start(st, s._o || 0); else s.start(st);
      s.stop(Math.max(t1, st + 0.01));
    }
  }

  /* ---------- the shared graph (built once per context) ---------- */
  function musGain() {
    if (!musicOn) return 0;
    return musVol * MUS_BASE * (ducked ? 0.3 : 1) * (ac && ac.currentTime < cueDuckUntil ? 0.45 : 1);
  }
  const cueGain = () => (musicOn ? Math.min(1, musVol * MUS_BASE * 1.7) : 0);
  function setP(param, v, tau) {
    const t = ac.currentTime;
    param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.setTargetAtTime(v, t, tau);
  }
  function build() {
    const c = ac, sr = c.sampleRate;
    NB = c.createBuffer(1, sr * 2, sr);
    const nd = NB.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    /* small dark room: decaying noise, smoothed harder toward the tail */
    const il = Math.floor(sr * 1.6), ir = c.createBuffer(2, il, sr);
    for (let ch = 0; ch < 2; ch++) {
      const x = ir.getChannelData(ch); let lp = 0;
      for (let i = 0; i < il; i++) {
        const u = i / il; lp += (Math.random() * 2 - 1 - lp) * (0.55 - 0.45 * u);
        x[i] = lp * Math.pow(1 - u, 2.4) * (i < 90 ? i / 90 : 1);
      }
    }
    const verb = c.createConvolver(); verb.buffer = ir;
    const master = c.createGain(); master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    master.connect(comp); comp.connect(c.destination);
    const vOut = c.createGain(); vOut.gain.value = 0.8; verb.connect(vOut); vOut.connect(master);
    const sfx = c.createGain(); sfx.gain.value = sfxVol * SFX_BASE; sfx.connect(master);
    const sSend = c.createGain(); sSend.gain.value = 0.12; sfx.connect(sSend); sSend.connect(verb);
    const musIn = c.createGain();
    const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 38; hp.Q.value = 0.5;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3400; lp.Q.value = 0.4;
    /* tape wow + flutter: a slowly modulated short delay bends the whole mix a few cents */
    const wow = c.createDelay(0.1); wow.delayTime.value = 0.014;
    const l1 = c.createOscillator(), l1g = c.createGain(); l1.frequency.value = 0.31; l1g.gain.value = 0.0012;
    const l2 = c.createOscillator(), l2g = c.createGain(); l2.frequency.value = 5.3; l2g.gain.value = 0.00005;
    l1.connect(l1g); l1g.connect(wow.delayTime); l2.connect(l2g); l2g.connect(wow.delayTime); l1.start(); l2.start();
    const mus = c.createGain(); mus.gain.value = musGain();
    musIn.connect(hp); hp.connect(lp); lp.connect(wow); wow.connect(mus); mus.connect(master);
    const mSend = c.createGain(); mSend.gain.value = 0.32; mus.connect(mSend); mSend.connect(verb);
    const cue = c.createGain(); cue.gain.value = cueGain();
    const cLp = c.createBiquadFilter(); cLp.type = "lowpass"; cLp.frequency.value = 4200; cLp.Q.value = 0.4;
    cue.connect(cLp); cLp.connect(master);
    const cSend = c.createGain(); cSend.gain.value = 0.35; cLp.connect(cSend); cSend.connect(verb);
    B = { master, comp, sfx, musIn, lp, mus, cue, verb };
  }
  function applyMus(tau) {
    if (!ac || !B) return;
    setP(B.mus.gain, musGain(), tau || 0.3);
    setP(B.cue.gain, cueGain(), 0.1);
  }

  /* ---------- throttles: [per second, burst] ---------- */
  const THR = { hit: [14, 3], spit: [9, 3], pop: [12, 4], coin: [12, 4], sock: [8, 3], blip: [26, 3],
    click: [20, 4], tick: [16, 3], golden: [6, 2], chew: [6, 2], gulp: [6, 2], grow: [10, 3], poke: [8, 3],
    visitor: [3, 2], whoosh: [6, 2], error: [6, 2], upgrade: [10, 3], shop: [8, 3], buff: [6, 2],
    reward: [4, 2], quest: [4, 2], claim: [6, 2], zone: [2, 1], compost: [1, 1], stamp: [4, 2] };
  const CHEAP = { hit: 1, spit: 1, pop: 1, coin: 1, sock: 1, blip: 1, click: 1, tick: 1, golden: 1, chew: 1 };
  const bucket = {};
  function allow(name) {
    const th = THR[name]; if (!th) return true;
    const tm = wallNow(); let bk = bucket[name];
    if (!bk) bk = bucket[name] = { tok: th[1], t: tm };
    bk.tok = Math.min(th[1], bk.tok + (tm - bk.t) * th[0]); bk.t = tm;
    if (bk.tok < 1) return false;
    bk.tok -= 1; return true;
  }
  /* pitch helpers for jingles: i-th note of the current pentatonic above key.hb */
  const pn = i => key.hb + 12 * Math.floor(i / key.pent.length) + key.pent[((i % key.pent.length) + key.pent.length) % key.pent.length];
  function pling(o, t, f, v, d, type) {
    const a = osc(type || "sine", f, t); a.connect(ad(gn(0), t, 0.004, v, d)).connect(o); return a;
  }
  function mallet(o, t, f, v, d) { pling(o, t, f, v, d); pling(o, t, f * 3.98, v * 0.16, 0.05); }
  function sparkle(o, t, n, v) {
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.045 + Math.random() * 0.015, f = mtof(pn(10 + Math.floor(Math.random() * 6)));
      pling(o, tt, f, v || 0.03, 0.16 + Math.random() * 0.1);
    }
  }
  function brass(o, t, f, d, v) {
    const a = osc("sawtooth", f, t), lp = flt("lowpass", 500, 1.1);
    lp.frequency.setValueAtTime(450, t); lp.frequency.linearRampToValueAtTime(Math.min(2400, f * 5), t + 0.04);
    lp.frequency.exponentialRampToValueAtTime(Math.min(1400, f * 2.4), t + 0.05 + d);
    a.connect(lp).connect(asr(gn(0), t, 0.025, v, d - 0.025, 0.12)).connect(o);
  }

  /* ---------- sound effects: SND[name](t, out, opts) builds one voice and returns its end time ---------- */
  const SND = {
    spit(t, o) {   // wet 'ptoo'
      const k = 0.9 + Math.random() * 0.2, n = noise(1, t), bp = flt("bandpass", 1800, 1.3);
      sweep(bp.frequency, t, 2300 * k, 500, 0.08);
      n.connect(bp).connect(ad(gn(0), t, 0.004, 0.16, 0.07)).connect(o);
      const a = osc("sine", 280 * k, t); sweep(a.frequency, t, 280 * k, 95, 0.1);
      a.connect(ad(gn(0), t, 0.005, 0.15, 0.09)).connect(o);
      return t + 0.16;
    },
    hit(t, o, op) {   // soft marimba boop on the current pentatonic; consecutive plants walk up and down
      const i = (op.i | 0), z = ((i % 14) + 14) % 14, idx = z < 8 ? z : 14 - z;
      const f = mtof(pn(idx)) * (1 + (Math.random() - 0.5) * 0.006);
      const v = 0.13 * (op.v != null ? op.v : 1) * (0.85 + Math.random() * 0.3);
      const p = pan(i % 2 ? 0.22 : -0.22); p.connect(o);
      const a = osc("sine", f * 1.025, t); a.frequency.exponentialRampToValueAtTime(f, t + 0.03);
      a.connect(ad(gn(0), t, 0.004, v, 0.24)).connect(p);
      pling(p, t, f * 4.01, v * 0.16, 0.035);
      return t + 0.3;
    },
    pop(t, o) {
      const k = 0.85 + Math.random() * 0.3, a = osc("sine", 450 * k, t); sweep(a.frequency, t, 450 * k, 1500 * k, 0.04);
      a.connect(ad(gn(0), t, 0.002, 0.15, 0.06)).connect(o);
      const n = noise(1, t), hp = flt("highpass", 2500, 0.7); n.connect(hp).connect(ad(gn(0), t, 0.001, 0.05, 0.012)).connect(o);
      return t + 0.1;
    },
    coin(t, o) {
      const lp = flt("lowpass", 3200, 0.5), a = osc("triangle", 988, t), g = gn(0); lp.connect(o);
      a.frequency.setValueAtTime(1319, t + 0.075);
      asr(g, t, 0.004, 0.1, 0.07, 0.3); a.connect(g).connect(lp);
      return t + 0.4;
    },
    sock(t, o) {   // rubber squeak 'squee-eek'
      const k = 0.9 + Math.random() * 0.25, a = osc("square", 620 * k, t), bp = flt("bandpass", 1300, 3), fr = a.frequency;
      fr.exponentialRampToValueAtTime(980 * k, t + 0.05); fr.exponentialRampToValueAtTime(760 * k, t + 0.11);
      fr.exponentialRampToValueAtTime(1050 * k, t + 0.17);
      a.connect(bp).connect(asr(gn(0), t, 0.015, 0.2, 0.12, 0.07)).connect(o);
      return t + 0.24;
    },
    grow(t, o) {   // rising bloop
      const a = osc("sine", 200, t); sweep(a.frequency, t, 200, 640, 0.22); a.connect(ad(gn(0), t, 0.02, 0.15, 0.26)).connect(o);
      const b = osc("sine", 330, t + 0.08); sweep(b.frequency, t + 0.08, 330, 990, 0.16);
      b.connect(ad(gn(0), t + 0.08, 0.01, 0.06, 0.18)).connect(o);
      return t + 0.4;
    },
    upgrade(t, o, op) {   // quick pentatonic run; bigger n = longer, higher, sparkles
      const n = Math.max(1, op.n | 0), cnt = Math.min(8, 3 + Math.floor(Math.log2(n)));
      for (let i = 0; i < cnt; i++) mallet(o, t + i * 0.045, mtof(pn(i)), 0.09, i === cnt - 1 ? 0.4 : 0.18);
      if (n >= 10) sparkle(o, t + cnt * 0.045, Math.min(6, 2 + Math.floor(Math.log10(n) * 2)));
      return t + cnt * 0.045 + 0.6;
    },
    shop(t, o) {   // little shop-door bell
      for (let i = 0; i < 2; i++) {
        const tt = t + i * 0.11, f = mtof(pn(i ? 8 : 7));
        pling(o, tt, f, 0.07, 0.5); pling(o, tt, f * 2.76, 0.01, 0.2);
      }
      const n = noise(1, t), hp = flt("highpass", 3000, 0.7); n.connect(hp).connect(ad(gn(0), t, 0.001, 0.03, 0.02)).connect(o);
      return t + 0.75;
    },
    quest(t, o) {   // happy jingle
      const mel = [0, 2, 4, 2, 5, 7], tm = [0, 0.09, 0.18, 0.27, 0.38, 0.5];
      for (let i = 0; i < mel.length; i++) mallet(o, t + tm[i], mtof(pn(mel[i])), 0.09, i === 5 ? 0.7 : 0.2);
      pling(o, t + 0.5, mtof(pn(0) - 12), 0.06, 0.8); pling(o, t + 0.5, mtof(pn(2) - 12), 0.04, 0.8);
      return t + 1.35;
    },
    claim(t, o) {   // 'ta-da'
      for (const i of [2, 4, 5]) mallet(o, t, mtof(pn(i)), 0.06, 0.12);
      for (const i of [5, 7, 9]) mallet(o, t + 0.13, mtof(pn(i)), 0.06, 0.5);
      sparkle(o, t + 0.2, 3, 0.025);
      return t + 0.8;
    },
    zone(t, o) {   // kazoo-brass fanfare: da-da-da DAAA
      const tm = [0, 0.11, 0.22, 0.36], top = [3, 3, 3, 5], low = [1, 1, 1, 2];
      for (let i = 0; i < 4; i++) {
        const d = i === 3 ? 0.75 : 0.08;
        brass(o, t + tm[i], mtof(pn(top[i])), d, 0.1); brass(o, t + tm[i], mtof(pn(low[i])), d, 0.07);
      }
      brass(o, t + 0.36, mtof(pn(0) - 12), 0.75, 0.08);
      const n = noise(1, t + 0.3), hp = flt("highpass", 5000, 0.6), g = gn(0);
      asr(g, t + 0.3, 0.3, 0.03, 0.2, 0.5); n.connect(hp).connect(g).connect(o);
      sparkle(o, t + 0.45, 4, 0.025);
      return t + 1.5;
    },
    compost(t, o) {   // low rumble from underground
      const n = noise(0.5, t), lp = flt("lowpass", 170, 1.2), g = gn(0);
      asr(g, t, 0.5, 0.55, 0.8, 1.1); n.connect(lp).connect(g).connect(o);
      const a = osc("sine", 46, t), l = osc("sine", 6, t), lg = gn(5); l.connect(lg).connect(a.frequency);
      a.connect(asr(gn(0), t, 0.4, 0.2, 1.0, 0.9)).connect(o);
      const b = osc("triangle", 70, t), bl = flt("lowpass", 300, 1);
      for (let i = 1; i < 7; i++) b.frequency.setValueAtTime(55 + Math.random() * 40, t + i * 0.28);
      b.connect(bl).connect(asr(gn(0), t, 0.3, 0.1, 1.2, 0.8)).connect(o);
      return t + 2.5;
    },
    gulp(t, o) {
      const a = osc("sine", 520, t); sweep(a.frequency, t, 520, 120, 0.17); a.connect(ad(gn(0), t, 0.01, 0.18, 0.17)).connect(o);
      const b = osc("sine", 340, t + 0.16); sweep(b.frequency, t + 0.16, 340, 160, 0.07);
      b.connect(ad(gn(0), t + 0.16, 0.005, 0.15, 0.08)).connect(o);
      return t + 0.3;
    },
    chew(t, o) {   // polite 'nom nom'
      for (let i = 0; i < 2; i++) {
        const tt = t + i * 0.17, n = noise(0.7, tt), lp = flt("lowpass", 650 + Math.random() * 200, 1);
        n.connect(lp).connect(ad(gn(0), tt, 0.008, 0.32, 0.07)).connect(o);
        const a = osc("sine", 190, tt); sweep(a.frequency, tt, 190, 120, 0.06); a.connect(ad(gn(0), tt, 0.004, 0.11, 0.06)).connect(o);
      }
      return t + 0.3;
    },
    visitor(t, o) {   // weird theremin warble
      const a = osc("sine", 380, t), l = osc("sine", 7, t), lg = gn(30), fr = a.frequency;
      l.frequency.linearRampToValueAtTime(11, t + 0.6); l.connect(lg).connect(fr);
      fr.exponentialRampToValueAtTime(720, t + 0.25); fr.exponentialRampToValueAtTime(520, t + 0.62);
      a.connect(asr(gn(0), t, 0.06, 0.11, 0.42, 0.15)).connect(o);
      const b = osc("triangle", 570, t + 0.1), fb = b.frequency; fb.exponentialRampToValueAtTime(1080, t + 0.35);
      fb.exponentialRampToValueAtTime(780, t + 0.7); lg.connect(fb);
      b.connect(asr(gn(0), t + 0.1, 0.06, 0.035, 0.38, 0.15)).connect(o);
      return t + 0.85;
    },
    reward(t, o) {   // sparkly climb + chord
      for (let i = 0; i < 6; i++) mallet(o, t + i * 0.06, mtof(pn(i + 2)), 0.07, 0.25);
      for (const i of [5, 7, 9]) pling(o, t + 0.38, mtof(pn(i)), 0.045, 1.0);
      sparkle(o, t + 0.4, 5, 0.025);
      return t + 1.5;
    },
    buff(t, o) {   // shimmering power-up swell
      const a = osc("triangle", 300, t), tr = gn(0.6), l = osc("sine", 14, t), lg = gn(0.4);
      sweep(a.frequency, t, 300, 900, 0.4); l.connect(lg).connect(tr.gain);
      a.connect(asr(gn(0), t, 0.08, 0.11, 0.25, 0.15)).connect(tr).connect(o);
      const b = osc("sine", 600, t); sweep(b.frequency, t, 600, 1800, 0.4); b.connect(asr(gn(0), t, 0.1, 0.035, 0.2, 0.15)).connect(tr);
      return t + 0.55;
    },
    click(t, o) { pling(o, t, 1100, 0.05, 0.025); pling(o, t, 320, 0.05, 0.03); return t + 0.06; },
    error(t, o) {   // 'bwomp bwomp'
      const lp = flt("lowpass", 900, 0.7); lp.connect(o);
      for (const [f, d] of [[247, 0], [196, 0.13]]) { const a = osc("square", f, t + d); a.connect(asr(gn(0), t + d, 0.008, 0.09, 0.07, 0.05)).connect(lp); }
      return t + 0.3;
    },
    blip(t, o, op) {   // dialogue voice; pitch 0 (narrator) = soft typewriter tick
      const p = +op.pitch || 0;
      if (p <= 0) {
        const n = noise(1, t), bp = flt("bandpass", 2600, 1.5); n.connect(bp).connect(ad(gn(0), t, 0.001, 0.06, 0.015)).connect(o);
        return t + 0.03;
      }
      const f = p * (0.94 + Math.random() * 0.12), a = osc("square", f, t), lp = flt("lowpass", Math.max(900, Math.min(2400, f * 4)), 1);
      a.connect(lp).connect(ad(gn(0), t, 0.004, 0.055, 0.05)).connect(o);
      return t + 0.07;
    },
    stamp(t, o) {   // big thunk
      const a = osc("sine", 160, t); sweep(a.frequency, t, 160, 38, 0.25); a.connect(ad(gn(0), t, 0.002, 0.55, 0.45)).connect(o);
      const n = noise(1, t), lp = flt("lowpass", 1100, 0.8); n.connect(lp).connect(ad(gn(0), t, 0.001, 0.32, 0.1)).connect(o);
      const w = osc("triangle", 230, t); w.connect(ad(gn(0), t, 0.001, 0.22, 0.07)).connect(o);
      return t + 0.5;
    },
    whoosh(t, o) {
      const n = noise(1, t), bp = flt("bandpass", 300, 1.1), p = pan(-0.6), g = gn(0);
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2000, t + 0.25); bp.frequency.exponentialRampToValueAtTime(600, t + 0.55);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.22); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      if (p.pan) { p.pan.setValueAtTime(-0.6, t); p.pan.linearRampToValueAtTime(0.6, t + 0.55); }
      n.connect(bp).connect(g).connect(p).connect(o);
      return t + 0.62;
    },
    golden(t, o) { sparkle(o, t, 5, 0.035); pling(o, t, mtof(pn(5)), 0.03, 0.4); return t + 0.6; },
    poke(t, o) {   // squishy grumpy 'hnk'
      const k = 0.92 + Math.random() * 0.16, a = osc("sawtooth", 230 * k, t), bp = flt("bandpass", 850, 2.5);
      sweep(a.frequency, t, 230 * k, 160 * k, 0.13);
      a.connect(bp).connect(asr(gn(0), t, 0.01, 0.34, 0.06, 0.06)).connect(o);
      const n = noise(0.6, t), lp = flt("lowpass", 500, 1); n.connect(lp).connect(ad(gn(0), t, 0.005, 0.15, 0.06)).connect(o);
      return t + 0.17;
    },
    tick(t, o) { pling(o, t, 1900, 0.04, 0.012); pling(o, t, 950, 0.03, 0.02, "triangle"); return t + 0.04; },
  };

  /* ---------- music instruments: INST[k](out, t, freq, dur, vel) -> [pitched oscs, end time] ---------- */
  const INST = {
    toy(o, t, f, d, v) {   // toy piano: sine + inharmonic tine
      const e = Math.min(1.3, 0.3 + d), a = osc("sine", f, t), b = osc("sine", f * 3.98, t);
      a.connect(ad(gn(0), t, 0.004, v, e)).connect(o); b.connect(ad(gn(0), t, 0.002, v * 0.2, 0.12)).connect(o);
      return [[a, b], t + e + 0.05];
    },
    box(o, t, f, d, v) {   // music box
      const a = osc("sine", f, t), b = osc("sine", f * 2, t), c = osc("sine", f * 5.95, t);
      a.connect(ad(gn(0), t, 0.003, v, 1.5)).connect(o); b.connect(ad(gn(0), t, 0.003, v * 0.16, 0.6)).connect(o);
      c.connect(ad(gn(0), t, 0.001, v * 0.045, 0.07)).connect(o);
      return [[a, b, c], t + 1.56];
    },
    marimba(o, t, f, d, v) {
      const e = Math.min(0.7, 0.25 + d * 0.5), a = osc("sine", f, t), b = osc("sine", f * 4, t);
      a.connect(ad(gn(0), t, 0.003, v, e)).connect(o); b.connect(ad(gn(0), t, 0.001, v * 0.22, 0.05)).connect(o);
      return [[a, b], t + e + 0.05];
    },
    glass(o, t, f, d, v) {   // soft glassy bell with slow beating
      const e = 1.1 + d * 0.3, a = osc("sine", f, t), b = osc("sine", f * 2.005, t);
      a.connect(ad(gn(0), t, 0.012, v, e)).connect(o); b.connect(ad(gn(0), t, 0.012, v * 0.25, e * 0.6)).connect(o);
      return [[a, b], t + e + 0.05];
    },
    bell(o, t, f, d, v) {   // long inharmonic bell (Moon)
      const a = osc("sine", f, t), b = osc("sine", f * 2.76, t), c = osc("sine", f * 5.4, t);
      a.connect(ad(gn(0), t, 0.008, v, 3)).connect(o); b.connect(ad(gn(0), t, 0.005, v * 0.25, 1.4)).connect(o);
      c.connect(ad(gn(0), t, 0.002, v * 0.06, 0.5)).connect(o);
      return [[a, b, c], t + 3.06];
    },
    whistle(o, t, f, d, v) {   // breathy slide whistle with vibrato
      const a = osc("sine", f * 0.95, t), l = osc("sine", 5.2, t), lg = gn(f * 0.009);
      l.connect(lg).connect(a.frequency); a.frequency.exponentialRampToValueAtTime(f, t + 0.07);
      a.connect(asr(gn(0), t, 0.05, v, d - 0.05, 0.12)).connect(o);
      return [[a], t + Math.max(d, 0.05) + 0.2];
    },
    kazoo(o, t, f, d, v) {
      const a = osc("sawtooth", f * 0.96, t), l = osc("sine", 5.6, t), lg = gn(f * 0.012), lp = flt("lowpass", Math.min(2000, f * 3.2), 2.2);
      l.connect(lg).connect(a.frequency); a.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      a.connect(lp).connect(asr(gn(0), t, 0.03, v, d - 0.03, 0.08)).connect(o);
      return [[a], t + Math.max(d, 0.03) + 0.15];
    },
    reed(o, t, f, d, v) {   // wheezy accordion (two detuned saws)
      const a = osc("sawtooth", f, t), b = osc("sawtooth", f * 1.006, t), lp = flt("lowpass", Math.min(1700, f * 2.6), 0.8), g = gn(0);
      a.connect(lp); b.connect(lp); lp.connect(asr(g, t, 0.05, v, d - 0.05, 0.1)).connect(o);
      return [[a, b], t + Math.max(d, 0.05) + 0.18];
    },
    organ(o, t, f, d, v) {
      const a = osc("triangle", f, t), b = osc("sine", f * 2, t), lp = flt("lowpass", 1800, 0.6), bg = gn(0.35);
      a.connect(lp); b.connect(bg).connect(lp); lp.connect(asr(gn(0), t, 0.03, v, d - 0.03, 0.14)).connect(o);
      return [[a, b], t + Math.max(d, 0.03) + 0.2];
    },
    vibes(o, t, f, d, v) {   // vibraphone with tremolo
      const a = osc("sine", f, t), b = osc("sine", f * 4, t), l = osc("sine", 4.6, t), lg = gn(0.3), tr = gn(0.7);
      l.connect(lg).connect(tr.gain);
      a.connect(ad(gn(0), t, 0.004, v, 1.2)).connect(tr); b.connect(ad(gn(0), t, 0.002, v * 0.1, 0.08)).connect(tr); tr.connect(o);
      return [[a, b], t + 1.26];
    },
    pluck(o, t, f, d, v) {   // muted pizzicato
      const a = osc("triangle", f, t), lp = flt("lowpass", 2400, 1.5);
      sweep(lp.frequency, t, Math.min(3000, f * 6), Math.max(200, f * 1.2), 0.25);
      a.connect(lp).connect(ad(gn(0), t, 0.003, v, 0.35)).connect(o);
      return [[a], t + 0.42];
    },
    bleep(o, t, f, d, v) {   // soft filtered square blip
      const a = osc("square", f, t), lp = flt("lowpass", Math.min(1600, f * 2.5), 0.7), e = Math.min(0.3, 0.08 + d * 0.4);
      a.connect(lp).connect(ad(gn(0), t, 0.004, v, e)).connect(o);
      return [[a], t + e + 0.05];
    },
  };
  /* relative loudness per instrument so every zone sits at a similar level */
  const LV = { toy: 0.16, box: 0.13, marimba: 0.17, glass: 0.12, bell: 0.11, whistle: 0.075, kazoo: 0.075, reed: 0.06,
    organ: 0.085, vibes: 0.15, pluck: 0.24, bleep: 0.06 };
  function inote(kind, o, t, m, d, v, bend, bt) {
    vb();
    const r = INST[kind](o, t, mtof(m), d, v), md = (Math.random() - 0.5) * 8;   // lo-fi micro detune
    for (const x of r[0]) {
      if (bend) { x.detune.setValueAtTime(md + bend, t); x.detune.linearRampToValueAtTime(md, t + (bt || 0.09)); }
      else x.detune.setValueAtTime(md, t);
    }
    ve(t, r[1]); stats.notes++;
  }
  function pad(o, t, mids, dur, kind, v) {
    vb();
    const lp = flt("lowpass", kind === "saw" ? 750 : 1150, 0.4), g = gn(0), a = Math.min(0.6, dur * 0.4), r = 0.9;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setValueAtTime(v, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);
    const ty = kind === "saw" ? "sawtooth" : kind === "sine" ? "sine" : "triangle";
    for (const m of mids) { const f = mtof(m); osc(ty, f, t).connect(lp); osc(ty, f * 1.004, t).connect(lp); }
    lp.connect(g).connect(o);
    ve(t, t + dur + r + 0.05); stats.notes++;
  }
  function bass(o, t, m, dur, kind, v) {
    vb();
    const f = mtof(m), a = osc(kind === "sine" ? "sine" : "triangle", f, t), g = gn(0), lp = flt("lowpass", 650, 0.6), e = Math.max(0.06, dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.012);
    g.gain.exponentialRampToValueAtTime(v * 0.5, t + e); g.gain.exponentialRampToValueAtTime(0.0001, t + e + 0.09);
    if (kind === "sine") osc("sine", f * 2, t).connect(gn(0.22)).connect(g);   // octave so small speakers hear it
    a.connect(lp).connect(g).connect(o);
    ve(t, t + e + 0.12); stats.notes++;
  }
  /* drums: kick, snare (brush), hat, shk (shaker), tock (woodblock), tick (clock) */
  const DV = { kick: 0.32, snare: 0.07, hat: 0.03, shk: 0.045, tock: 0.06, tick: 0.035 };
  function drum(o, t, k, v) {
    vb(); let end;
    if (k === "kick") {
      const a = osc("sine", 110, t); a.frequency.exponentialRampToValueAtTime(44, t + 0.12);
      a.connect(ad(gn(0), t, 0.003, v, 0.26)).connect(o); end = t + 0.3;
    } else if (k === "snare") {
      const n = noise(1, t), bp = flt("bandpass", 1900, 0.7); n.connect(bp).connect(ad(gn(0), t, 0.002, v, 0.13)).connect(o); end = t + 0.16;
    } else if (k === "hat") {
      const n = noise(1, t), hp = flt("highpass", 5200, 0.7); n.connect(hp).connect(ad(gn(0), t, 0.001, v, 0.035)).connect(o); end = t + 0.05;
    } else if (k === "shk") {
      const n = noise(1, t), bp = flt("bandpass", 4200, 1.4); n.connect(bp).connect(ad(gn(0), t, 0.012, v, 0.06)).connect(o); end = t + 0.09;
    } else {
      const a = osc("sine", k === "tock" ? 820 : 1250, t); a.connect(ad(gn(0), t, 0.001, v, 0.045)).connect(o); end = t + 0.06;
    }
    ve(t, end); stats.notes++;
  }
  /* grooves: one string per drum, one char per 16th ('x' accent, 'o' soft, '.' rest) */
  const GR = {
    lofi: { kick: "x......o..x.....", snare: "....x.......x...", hat: "o.o.o.o.o.o.o.o." },
    brush: { kick: "o...............", shk: "..o...o...o...o.", snare: "............o..." },
    march: { kick: "x.......x.......", snare: "....o.......o.oo", hat: "o...o...o...o..." },
    waltz: { kick: "x...........", tock: "....o...o...", shk: "..o...o...o." },
    bossa: { kick: "x.....o.x.....o.", tock: "x..o..o...o..o..", hat: "o.o.o.o.o.o.o.o." },
    tick: { kick: "o.......o.......", tick: "x...o...x...o...", shk: "..o...o...o...o." },
    spin: { kick: "o...o...o...o...", hat: "oo.ooo.ooo.ooo.o", snare: "....o.......o..." },
    sparse: { kick: "x...............", tock: "....o.........o." },
    none: {},
  };

  /* ---------- per-zone character ---------- */
  const STY = [
    /* 0 garden     */ { lead: "toy", lead2: "whistle", pad: "tri", bp: "bounce", dr: "lofi", swing: 0.12, dens: 0.5, wonk: 0.09 },
    /* 1 clouds     */ { lead: "whistle", lead2: "box", pad: "sine", padV: 0.024, bass: "sine", bp: "long", dr: "brush", dens: 0.35, wonk: 0.05, cut: 3000 },
    /* 2 parliament */ { lead: "kazoo", lead2: "toy", padV: 0.018, bp: "march", dr: "march", dens: 0.6, wonk: 0.16 },
    /* 3 planes     */ { lead: "marimba", lead2: "whistle", bp: "walk", dr: "lofi", swing: 0.2, dens: 0.6, wonk: 0.08 },
    /* 4 attic      */ { lead: "box", lead2: "glass", bp: "waltz", dr: "waltz", beats: 3, dens: 0.45, wonk: 0.15, cut: 2400 },
    /* 5 satellites */ { lead: "bleep", lead2: "glass", pad: "sine", bass: "sine", bp: "pulse", dr: "tick", dens: 0.4, wonk: 0.06, arp: "bleep" },
    /* 6 moon       */ { lead: "bell", lead2: "whistle", pad: "sine", padV: 0.024, bass: "sine", bp: "drone", dr: "none", dens: 0.16, wonk: 0.3, bt: 0.35, rest: 0.4, cut: 1900, prog: [[0, 1, 0, 6], [5, 1, 0, 0]] },
    /* 7 socks      */ { lead: "toy", lead2: "whistle", bp: "bounce", dr: "lofi", swing: 0.1, dens: 0.5, wonk: 0.1, arp: "box" },
    /* 8 laundry    */ { lead: "organ", lead2: "kazoo", padV: 0.018, bp: "ostinato", dr: "spin", swing: 0.14, dens: 0.45, wonk: 0.08 },
    /* 9 sun        */ { lead: "vibes", lead2: "organ", pad: "sine", padV: 0.02, bass: "sine", bp: "bossa", dr: "bossa", dens: 0.45, wonk: 0.05, sev: true },
    /* 10 dairy     */ { lead: "glass", lead2: "box", pad: "sine", padV: 0.022, bass: "sine", bp: "long", dr: "brush", dens: 0.4, wonk: 0.06, sev: true },
    /* 11 map       */ { lead: "reed", lead2: "whistle", bp: "waltz", dr: "waltz", beats: 3, dens: 0.6, wonk: 0.1 },
    /* 12 office    */ { lead: "organ", lead2: "vibes", pad: "sine", padV: 0.02, bp: "walk", dr: "tick", swing: 0.16, dens: 0.5, wonk: 0.05, sev: true },
    /* 13 backstage */ { lead: "pluck", lead2: "kazoo", padV: 0.022, bp: "pluck", dr: "sparse", dens: 0.4, wonk: 0.13, rest: 0.2, cut: 2300 },
    /* 14 wall      */ { lead: "box", lead2: "glass", pad: "sine", padV: 0.025, bass: "sine", bp: "long", dr: "none", dens: 0.3, wonk: 0.03, rest: 0.15, sev: true, cut: 2800 },
  ];
  function procStyle(r) {
    const beats = r() < 0.22 ? 3 : 4;
    const lead = pk(["toy", "box", "whistle", "marimba", "kazoo", "vibes", "organ", "pluck", "glass", "bleep", "reed"], r);
    let lead2 = pk(["toy", "box", "whistle", "marimba", "glass", "vibes"], r);
    if (lead2 === lead) lead2 = lead === "glass" ? "toy" : "glass";
    const dr = beats === 3 ? (r() < 0.75 ? "waltz" : "none") : pk(["lofi", "lofi", "brush", "bossa", "tick", "sparse", "spin", "march", "none"], r);
    const bp = beats === 3 ? "waltz" : dr === "bossa" ? "bossa" : dr === "spin" ? "ostinato" : dr === "march" ? "march"
      : pk(["bounce", "walk", "long", "pulse", "roots", "pluck"], r);
    return { lead, lead2, beats, dr, bp, pad: pk(["tri", "sine", "sine", null], r), padV: 0.018 + r() * 0.016,
      bass: r() < 0.5 ? "tri" : "sine", swing: r() < 0.5 ? r() * 0.2 : 0, dens: 0.3 + r() * 0.35, wonk: 0.04 + r() * 0.16,
      rest: r() * 0.25, arp: r() < 0.3 ? pk(["bleep", "box", "marimba"], r) : null, sev: r() < 0.4, cut: 2400 + r() * 1300 };
  }

  /* ---------- composer: a 16-bar song per zone (A A' B A''), fully deterministic from the zone ---------- */
  const PR_A = [[0, 5, 3, 4], [0, 3, 4, 0], [0, 4, 5, 3], [0, 3, 0, 4], [0, 2, 3, 4], [0, 3, 5, 4], [0, 5, 1, 4], [0, 1, 3, 0], [0, 6, 5, 4], [0, 4, 3, 3]];
  const PR_B = [[3, 4, 0, 0], [5, 3, 1, 4], [3, 0, 4, 4], [5, 4, 3, 4], [3, 5, 4, 0], [1, 4, 0, 5], [5, 5, 3, 4]];
  function compose(z) {
    const mus = z.mus || [60, "major", 90], sc = SC[mus[1]] || SC.major, n = sc.length;
    const seed = hash((z.k | 0) * 7919 + 1, (mus[0] | 0) * 131 + (mus[2] | 0)), r = rng(seed);
    const st = Object.assign({ lead: "toy", lead2: null, pad: "tri", padV: 0.026, bass: "tri", bp: "roots", dr: "lofi", beats: 4,
      swing: 0, dens: 0.5, wonk: 0.08, bt: 0.09, rest: 0.08, arp: null, sev: false, cut: 3400, prog: null },
      z.proc || !STY[z.k] ? procStyle(r) : STY[z.k]);
    const S = st.beats * 4, sd = 60 / Math.max(40, mus[2] || 90) / 4, root = mus[0] || 60;
    const tones = n === 6 ? [0, 2, 5] : st.sev && n === 7 ? [0, 2, 4, 6] : [0, 2, 4];
    const fifth = n === 7 ? 4 : n === 5 ? 3 : n, hi = n + 5, lo = -2;
    const pA = (st.prog && st.prog[0]) || pk(PR_A, r), pB = (st.prog && st.prog[1]) || pk(PR_B, r);
    const fit = d => { while (d > hi) d -= n; while (d < lo) d += n; return d; };
    const bendOf = () => (r() < st.wonk ? (r() < 0.65 ? -(40 + r() * 50) : 30 + r() * 30) : 0);
    function motif(dens) {   // one bar of rhythm + melodic contour (intervals), reused across chords
      let ev = [];
      for (let s = 0; s < S; s += 2) {
        const p = s === 0 ? 0.75 : s % 4 === 0 ? dens + 0.2 : dens * 0.65;
        if (r() < p) ev.push({ s, iv: 0, len: 2 });
      }
      if (ev.length < 2) ev = [{ s: 0, iv: 0, len: 2 }, { s: S / 2, iv: 0, len: 2 }];
      let d = 0;
      for (let i = 0; i < ev.length; i++) {
        const nx = i + 1 < ev.length ? ev[i + 1].s : S;
        ev[i].len = Math.min(nx - ev[i].s, r() < 0.3 ? 2 : 6); ev[i].iv = d;
        const x = r(); d += x < 0.35 ? -1 : x < 0.7 ? 1 : x < 0.8 ? 2 : x < 0.9 ? -2 : x < 0.95 ? 3 : 0;
        if (d > 4) d -= 2; if (d < -3) d += 2;
      }
      return ev;
    }
    let prev = 2;
    function realize(mo, c, shift) {   // start on the chord tone nearest the previous note
      let best = c, bd = 99;
      for (let o = -1; o <= 1; o++) for (let j = 0; j < 3; j++) {
        const dd = c + tones[j] + o * n, dist = Math.abs(dd - prev);
        if (dist < bd && dd >= lo && dd <= hi) { bd = dist; best = dd; }
      }
      return mo.map(e => { const d = fit(best + e.iv + shift); prev = d; return { s: e.s, len: e.len, d, bend: bendOf() }; });
    }
    function cadence(c, closed) {
      let d = closed ? c : c + (r() < 0.5 ? tones[1] : tones[2]);
      while (d - prev > n / 2) d -= n; while (prev - d > n / 2) d += n; d = fit(d);
      const ev = r() < 0.5 ? [{ s: 0, len: 2, d: fit(d + (r() < 0.5 ? 1 : -1)), bend: 0 }, { s: 2, len: S - 6, d, bend: bendOf() }]
        : [{ s: 0, len: S - 4, d, bend: bendOf() }];
      prev = d; return ev;
    }
    const m1 = motif(st.dens), m2 = motif(st.dens), m3 = motif(Math.min(0.8, st.dens + 0.1)), m4 = motif(st.dens);
    const bars = [];
    for (let b = 0; b < 16; b++) {
      const ph = b >> 2, i = b & 3, c = ph === 2 ? pB[i] : pA[i];
      const lead = ph === 2 ? (i < 2 ? realize(m3, c, 1) : i === 2 ? realize(m4, c, 0) : cadence(c, false))
        : (i < 2 ? realize(m1, c, 0) : i === 2 ? realize(m2, c, 0) : cadence(c, ph !== 0));
      const at = new Array(S).fill(null);
      for (const e of lead) at[e.s] = e;
      bars.push({ c, at, nc: 0 });
    }
    for (let b = 0; b < 16; b++) bars[b].nc = bars[(b + 1) % 16].c;
    const deg = (bm, d) => bm + 12 * Math.floor(d / n) + sc[((d % n) + n) % n];
    const hiLead = st.lead === "box" || st.lead === "bell" || st.lead === "glass";
    return { st, S, sd, n, seed, tones, fifth, bars, deg, root, leadBase: norm(root, hiLead ? 67 : 62),
      padBase: norm(root, 50), bassBase: norm(root, 36) };
  }
  function bassAt(bp, s, S, c, nc, so, barN) {
    const f = so.fifth, n = so.n;
    switch (bp) {
      case "roots": return s === 0 || s === 8 ? [c, 6] : null;
      case "bounce": return s === 0 ? [c, 6] : s === 8 ? [c + f, 4] : s === 14 && barN % 2 ? [c + n, 2, 0.7] : null;
      case "walk": {
        if (s % 4) return null;
        const q = s >> 2;
        return [q === 0 ? c : q === 1 ? c + so.tones[1] : q === 2 ? c + f : nc + (nc > c ? -1 : 1), 3.5, q ? 0.8 : 1];
      }
      case "long": return s === 0 ? [c, S - 1] : null;
      case "march": return s % 4 === 0 ? [(s >> 2) % 2 ? c + f : c, 1.6, 0.85] : null;
      case "waltz": return s === 0 ? [c, 4] : s === 8 && barN % 2 ? [c + f, 2, 0.7] : null;
      case "pulse": return s % 2 === 0 ? [c, 1.2, s % 8 === 0 ? 0.9 : 0.5] : null;
      case "ostinato": {
        const P = [0, -1, -1, n, -1, -1, 0, -1, f, -1, 0, -1, -1, -1, n, -1];
        return P[s] >= 0 ? [c + P[s], 1.6, s % 4 ? 0.7 : 1] : null;
      }
      case "bossa": return s === 0 ? [c, 5.5] : s === 6 ? [c, 1.8, 0.7] : s === 8 ? [c + f, 5.5] : s === 14 ? [c + f, 1.8, 0.7] : null;
      case "drone": return s === 0 && barN % 2 === 0 ? [c, S * 2 - 1, 0.8] : null;
      case "pluck": return s === 0 ? [c, 1.5] : s === 10 ? [c + f, 1.5, 0.7] : null;
    }
    return s === 0 ? [c, S / 2] : null;
  }

  /* ---------- player: walks the song; each loop is varied by a seeded rng so it never repeats exactly.
     Every 4th loop is a quiet one (melody only in the B section, on the second instrument). ---------- */
  function mkPlayer(z) {
    const song = compose(z), out = ac.createGain();
    out.gain.value = 0.0001; out.connect(B.musIn);
    return { z, k: z.k, song, st: song.st, out, s: 0, bar: 0, next: ac.currentTime + 0.12, dieAt: 0, pl: null };
  }
  function plan(p, L, b) {
    const st = p.st, ph = b >> 2, pr = rng(hash(p.song.seed, L * 16 + ph * 4 + 7));
    const sparse = L % 4 === 3, intro = L === 0 && b < 2, restP = pr() < st.rest, alt = pr() < 0.5;
    return {
      lead: intro || restP || (sparse && ph !== 2) ? null : sparse ? st.lead2 || st.lead : st.lead,
      harm: !sparse && !restP && ph === 3 && L % 2 === 0 && st.lead2 ? st.lead2 : null,
      drums: st.dr !== "none" && !intro && !(sparse && ph < 2),
      arp: st.arp && !sparse && ph >= 2 && (L % 2 === 1 || ph === 2) ? st.arp : null,
      fill: b === 15 && !sparse && alt,
      mut: L > 0,
    };
  }
  function pStep(p, t) {
    const so = p.song, st = p.st, S = so.S, s = p.s, b = p.bar % 16, L = Math.floor(p.bar / 16), bar = so.bars[b], o = p.out;
    if (s === 0) {
      p.pl = plan(p, L, b); stats.bar = b; stats.loop = L;
      if (st.pad) {
        const mids = [];
        for (const tt of so.tones) {
          let m = so.deg(so.padBase, bar.c + tt);
          while (m > so.padBase + 14) m -= 12;
          if (mids.indexOf(m) < 0) mids.push(m);
        }
        pad(o, t, mids, S * so.sd, st.pad, st.padV);
      }
    }
    const pl = p.pl, tt = t + (s % 4 === 2 ? 2 : s % 2) * st.swing * so.sd;
    const bn = bassAt(st.bp, s, S, bar.c, bar.nc, so, p.bar);
    if (bn) bass(o, tt, so.deg(so.bassBase, bn[0]), bn[1] * so.sd * 0.92, st.bass, 0.2 * (bn[2] || 1));
    if (pl.drums) {
      const g = GR[st.dr] || GR.none;
      for (const k in g) {
        const ch = g[k][s];
        if (ch === "x" || ch === "o") drum(o, tt + (Math.random() - 0.5) * 0.006, k, DV[k] * (ch === "x" ? 1 : 0.6) * (0.85 + Math.random() * 0.3));
      }
      if (pl.fill && g.snare && s >= S - 3) drum(o, tt, "snare", DV.snare * (0.5 + 0.2 * (s - S + 3)));
    }
    const e = bar.at[s];
    if (e && (pl.lead || pl.harm)) {
      let d = e.d, bend = e.bend, skip = false;
      if (pl.mut) {   // gentle per-loop mutations: skip, neighbour note, octave sparkle, extra wonk
        const mr = rng(hash(so.seed ^ 0x5bd1, L * 4096 + b * 64 + s)), x = mr();
        if (x < 0.07 && s > 0) skip = true;
        else if (x < 0.2) d += mr() < 0.5 ? 1 : -1;
        else if (x < 0.23 && d < so.n) d += so.n;
        if (!bend && mr() < st.wonk * 0.5) bend = -50;
      }
      if (!skip) {
        const dur = e.len * so.sd, acc = s % 4 === 0 ? 1 : 0.85, hum = (Math.random() - 0.5) * 0.012;
        if (pl.lead) inote(pl.lead, o, tt + hum, so.deg(so.leadBase, d), dur, LV[pl.lead] * acc * (0.88 + Math.random() * 0.24), bend, st.bt);
        if (pl.harm) inote(pl.harm, o, tt + hum + 0.012, so.deg(so.leadBase, d - 2), dur, LV[pl.harm] * 0.5 * acc, 0, st.bt);
      }
    }
    if (pl.arp && s % 2 === 0) {
      const nt = so.tones.length, cyc = nt * 2 - 2, j = (s / 2) % cyc, idx = j < nt ? j : cyc - j;
      inote(pl.arp, o, tt, so.deg(so.leadBase + (pl.arp === "bleep" ? 0 : 12), bar.c + so.tones[idx]), so.sd * 1.5, LV[pl.arp] * 0.35, 0);
    }
  }
  function adv(p) { p.next += p.song.sd; if (++p.s >= p.song.S) { p.s = 0; p.bar++; } }

  /* ---------- lookahead scheduler ---------- */
  function tick() {
    if (!ac) return;
    stats.state = ac.state;
    if (ac.state !== "running") return;
    const tn = ac.currentTime, ahead = tn + (typeof document !== "undefined" && document.hidden ? 1.2 : 0.12);
    for (let i = players.length - 1; i >= 0; i--) {
      const p = players[i];
      if (p.dieAt && tn > p.dieAt) { try { p.out.disconnect(); } catch (e) { /* gone */ } players.splice(i, 1); continue; }
      if (!musicOn) continue;
      if (p.next < tn - 0.25) p.next = tn + 0.05;   // after a stall (hidden tab, breakpoint): resync, never burst
      let guard = 0;
      while (p.next < ahead && guard++ < 48) {
        try { pStep(p, p.next); } catch (e) { /* never let one bad note kill the music */ }
        adv(p); stats.steps++;
      }
    }
    stats.players = players.length;
  }
  function keyFor(z) {
    const mus = z.mus || [60, "major"], nm = mus[1];
    const pent = nm === "whole" ? [0, 2, 4, 6, 8, 10] : nm === "minor" || nm === "dorian" || nm === "phryg" ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
    return { hb: norm(mus[0] || 60, 57), pent };
  }
  function startWanted() {
    const z = want;
    if (!z || !ac || !B) return;
    const cur = players.find(p => !p.dieAt);
    if (cur && cur.k === z.k) return;
    const t = ac.currentTime;
    for (const p of players) if (!p.dieAt) { setP(p.out.gain, 0.0001, 0.9); p.dieAt = t + 5; }
    while (players.length > 1) { const old = players.shift(); try { old.out.disconnect(); } catch (e) { /* gone */ } }
    const p = mkPlayer(z);
    p.out.gain.setValueAtTime(0.0001, t); p.out.gain.setTargetAtTime(1, t + 0.2, 1.1);
    players.push(p);
    key = keyFor(z); setP(B.lp.frequency, p.st.cut, 1.5);
    stats.zone = z.k; stats.players = players.length;
  }

  /* ---------- cutscene stings (cue bus: follows music volume / on, ignores duck; briefly ducks the music) ---------- */
  const CUE = {
    intro(t, o) {   // music box 'once upon a time'
      pad(o, t, [48, 55, 59, 64], 3.2, "sine", 0.045); bass(o, t, 36, 3.0, "sine", 0.16);
      [72, 76, 79, 83, 84, 88].forEach((m, i) => inote("box", o, t + 0.15 + i * 0.28, m, 0.3, 0.12, 0));
      inote("glass", o, t + 1.8, 91, 1, 0.045, 0);
      return 3.4;
    },
    compost(t, o) {   // comic doom: dun dun dun duuun ... boing?
      [40, 39, 38, 34].forEach((m, i) => {
        const tt = t + i * 0.42, d = i === 3 ? 1.0 : 0.3;
        vb(); brass(o, tt, mtof(m), d, 0.16); brass(o, tt, mtof(m + 12), d, 0.045); ve(tt, tt + d + 0.2);
        drum(o, tt, "kick", 0.35);
      });
      pad(o, t + 1.26, [40, 46, 52], 1.2, "saw", 0.03);
      inote("whistle", o, t + 2.4, 79, 0.25, 0.06, -300, 0.2);
      return 2.9;
    },
    moon(t, o) {   // eerie bells + theremin
      pad(o, t, [47, 54, 59, 62], 4, "sine", 0.04); bass(o, t, 35, 3.8, "sine", 0.13);
      [[71, 0], [72, 0.6], [78, 1.2], [77, 1.9]].forEach(([m, d]) => inote("bell", o, t + d, m, 1, 0.1, 0));
      inote("whistle", o, t + 0.8, 83, 2.6, 0.05, -200, 1.2);
      return 4.2;
    },
    finale(t, o) {   // tender I - vi - IV - V - I with a music-box line
      const ch = [[48, 52, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [48, 52, 55, 64]], bs = [36, 45, 41, 43, 36];
      ch.forEach((c, i) => { pad(o, t + i * 1.2, c, i === 4 ? 2.2 : 1.2, "sine", 0.045); bass(o, t + i * 1.2, bs[i], i === 4 ? 2 : 1.1, "sine", 0.15); });
      [[76, 0], [74, 0.6], [72, 1.2], [69, 1.8], [67, 2.4], [71, 3.0], [74, 3.6], [72, 4.8]]
        .forEach(([m, d]) => inote("box", o, t + 0.1 + d, m, 0.5, 0.12, 0));
      inote("glass", o, t + 4.9, 84, 1.5, 0.045, 0);
      return 6.6;
    },
  };

  /* ---------- public API ---------- */
  function init() {
    try {
      if (ac) { if (ac.state === "suspended" || ac.state === "interrupted") ac.resume(); return; }
      const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return;
      ac = new AC();
      build();
      if (ac.state !== "running") ac.resume();
      timer = setInterval(tick, 25);
      if (!unlockBound && typeof document !== "undefined") {   // browsers may re-suspend; any input resumes
        unlockBound = true;
        const un = () => { if (ac && ac.state !== "running" && ac.state !== "closed") ac.resume(); };
        document.addEventListener("pointerdown", un, true); document.addEventListener("keydown", un, true);
      }
      startWanted();
    } catch (e) {
      try { if (ac) ac.close(); } catch (e2) { /* ignore */ }
      if (timer) clearInterval(timer);
      ac = null; B = null; timer = 0;
    }
  }
  function setVolume(s, m) {
    if (typeof s === "number" && isFinite(s)) sfxVol = clamp01(s);
    if (typeof m === "number" && isFinite(m)) musVol = clamp01(m);
    if (!ac || !B) return;
    setP(B.sfx.gain, sfxVol * SFX_BASE, 0.05); applyMus(0.1);
  }
  function play(name, opts) {
    if (!ac || !B || ac.state !== "running" || sfxVol <= 0) return;
    const f = SND[name];
    if (!f) return;
    if (!allow(name)) { stats.dropped++; if (name === "hit") stats.hitDrop++; return; }
    if (CHEAP[name] && stats.live > 150) { stats.dropped++; return; }
    try {
      vb(); const t = ac.currentTime + 0.005;
      ve(t, f(t, B.sfx, opts || {})); stats.sfx++;
    } catch (e) { VN = VS = null; }
  }
  function music(zone) {
    if (typeof zone === "number") zone = typeof ZONES !== "undefined" ? ZONES.get(zone) : null;
    if (!zone || typeof zone !== "object") return;
    want = zone;   // remembered before init so the first click starts the right tune
    if (ac) startWanted();
  }
  function setMusicOn(on) { musicOn = !!on; if (!ac || !B) return; applyMus(0.3); if (musicOn) startWanted(); }
  function duck(on) { ducked = !!on; if (ac && B) applyMus(on ? 0.25 : 0.7); }
  function cue(name) {
    if (!ac || !B || ac.state !== "running" || !musicOn || !CUE[name]) return;
    try {
      const t = ac.currentTime + 0.05, len = CUE[name](t, B.cue);
      cueDuckUntil = t + len; applyMus(0.2);
      setTimeout(() => applyMus(0.8), len * 1000 + 80);
    } catch (e) { VN = VS = null; }
  }
  /* offline render for tooling: what = zone k / zone object (music), sound name, or 'cue:<name>' -> {peak, rms, hi} */
  async function render(what, secs) {
    const OAC = typeof window !== "undefined" && (window.OfflineAudioContext || window.webkitOfflineAudioContext);
    if (!OAC) return null;
    secs = secs || 8;
    const sr = 22050, off = new OAC(2, Math.ceil(sr * (secs + 0.4)), sr), sv = [ac, B, NB, key];
    ac = off; build();
    try {
      if (typeof what === "number" || (what && typeof what === "object")) {
        const z = typeof what === "number" ? ZONES.get(what) : what, p = mkPlayer(z);
        p.out.gain.value = 1; p.next = 0.4; B.lp.frequency.value = p.st.cut; key = keyFor(z);
        while (p.next < secs + 0.4) { pStep(p, p.next); adv(p); }
      } else if (String(what).indexOf("cue:") === 0) CUE[what.slice(4)](0.4, B.cue);   // 0.4 s: let the compressor settle
      else { vb(); ve(0.4, SND[what](0.4, B.sfx, { i: 3, n: 25, pitch: 200 })); }
    } finally { ac = sv[0]; B = sv[1]; NB = sv[2]; key = sv[3]; }
    const buf = await off.startRendering(), x = buf.getChannelData(0), y = buf.getChannelData(1);
    const a = 1 - Math.exp(-2 * Math.PI * 2500 / sr), i0 = Math.floor(sr * 0.4);
    const W = Math.floor(sr * 0.05);
    let peak = 0, ss = 0, hs = 0, lp = 0, ws = 0, wn = 0, lmax = 0;
    for (let i = i0; i < x.length; i++) {
      const v = (x[i] + y[i]) * 0.5, av = Math.abs(v);
      if (av > peak) peak = av;
      ss += v * v; ws += v * v;
      if (++wn >= W) { lmax = Math.max(lmax, Math.sqrt(ws / W)); ws = 0; wn = 0; }
      lp += (v - lp) * a; hs += (v - lp) * (v - lp);
    }
    return { peak: +peak.toFixed(3), rms: +Math.sqrt(ss / (x.length - i0)).toFixed(4), hi: +(hs / (ss || 1)).toFixed(3), lmax: +lmax.toFixed(4) };
  }

  return {
    init, setVolume, play, music, setMusicOn, duck, cue,
    get ready() { return !!ac; },
    names: Object.keys(SND), cues: Object.keys(CUE),
    _stats: stats, _render: render,
  };
})();
