/* Gerald Wants Up — anti-cheat. Loaded after util.js, before state.js.
   - SEAL: saves and export codes are scrambled and signed, so editing them makes them refuse to load.
   - CLOCK: offline time comes from a server (this site's own HTTP Date header, or Steam's time servers in the
     Steam build), never from the computer's clock, so changing the date/time gives nothing.
   - protect(): the important numbers (money, socks, mulch, mountain, plants...) are kept scrambled in memory,
     so memory scanners (Cheat Engine etc.) can't find them by value.
   - one copy at a time: a second tab/window of the game refuses to start (it would double offline rewards).
   Note: anything that runs on the player's own computer can, with enough effort, be cracked. This makes it a
   lot of work instead of a one-line console command; the release build also hides and scrambles all code. */
const GUARD = (() => {
  const W = typeof window !== "undefined" ? window : globalThis;
  // the signing secret is assembled at runtime (and the release build obfuscates this file)
  const SECRET = [64, 98, 116, 102, 106, 98, 42, 113, 101, 104, 113, 117, 40, 112, 118]
    .map((c, i) => String.fromCharCode(c ^ ((i * 5 + 7) & 7))).join("") +
    [0x6b, 0x2f, 0x51, 0x7a, 0x33, 0x58, 0x21, 0x6d, 0x40, 0x39, 0x76, 0x26].map(c => String.fromCharCode(c)).reverse().join("");
  /* cyrb53: fast 53-bit string hash */
  const hash = (str, seed) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  };
  /* 4-lane keyed hash straight over the bytes (fast: a 100 KB save signs in about a millisecond) */
  const sign = (b, n) => {
    const k = hash(SECRET + n + SECRET, 0x2545f491) >>> 0;
    let a = 0x9e3779b9 ^ k, c = 0x85ebca6b ^ Math.imul(k, 31), d = 0xc2b2ae35 ^ (k >>> 3), e = 0x27d4eb2f ^ ~k;
    for (let i = 0; i < b.length; i++) {
      const x = b[i];
      a = Math.imul(a ^ x, 2654435761); c = Math.imul(c ^ x, 1597334677);
      d = Math.imul(d + x, 2246822507) ^ (d >>> 15); e = (Math.imul(e ^ (x << 3), 3266489909) + a) | 0;
    }
    const f = v => { v = Math.imul(v ^ (v >>> 16), 2246822507); v = Math.imul(v ^ (v >>> 13), 3266489909); return ((v ^ (v >>> 16)) >>> 0).toString(36); };
    return f(a ^ b.length) + f(c ^ e) + f(d) + f(e ^ k);
  };
  const scramble = (b, seed) => {          // xorshift keystream, symmetric
    let x = (seed >>> 0) || 0x1234567;
    for (let i = 0; i < b.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; b[i] ^= x & 255; }
    return b;
  };
  const toB64 = b => { let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const fromB64 = str => { const s = atob(str), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
  let TE = null, TD = null;
  const utf8 = str => (TE = TE || new TextEncoder()).encode(str), unutf8 = b => (TD = TD || new TextDecoder()).decode(b);

  const SEAL = {
    TAG: "GWU4",
    is: str => typeof str === "string" && str.trim().startsWith("GWU4."),
    seal(json) {
      const nonce = (Math.random() * 4294967296) >>> 0, n = nonce.toString(36);
      const b = scramble(utf8(json), hash(SECRET + n, 7));
      return "GWU4." + n + "." + sign(b, n) + "." + toB64(b);
    },
    /* returns the JSON text, or throws if the code was edited / isn't a Gerald save */
    open(str) {
      const p = String(str).trim().split(".");
      if (p.length !== 4 || p[0] !== "GWU4") throw new Error("not a sealed save");
      const [, n, sig, body] = p;
      let b; try { b = fromB64(body); } catch (e) { throw new Error("save was edited"); }
      if (sign(b, n) !== sig) throw new Error("save was edited");
      return unutf8(scramble(b, hash(SECRET + n, 7)));
    },
  };

  /* ---------- server time ----------
     anchor = a server timestamp and the performance.now() it belongs to; performance.now() can't be moved by
     changing the computer's clock, so server time keeps ticking correctly between syncs. */
  const perf = () => (typeof performance !== "undefined" ? performance.now() : 0);
  const CLOCK = {
    src: null,               // optional extra source, e.g. Steam's server time: () => seconds since 1970, or null
    anchor: null,
    bootP: perf(),
    base: 0, baseP: 0,       // last trusted save time (from the save) and when it was loaded
    now: () => (CLOCK.anchor ? CLOCK.anchor.t + (perf() - CLOCK.anchor.p) : null),
    async sync() {
      try {
        let t = null, p = perf();
        if (CLOCK.src) { const s = CLOCK.src(); if (s > 1e9) t = s * 1000; }
        if (t === null && W.location && /^https?:$/.test(W.location.protocol)) {
          const p0 = perf();
          const r = await fetch(W.location.pathname + "?t=" + Math.random().toString(36).slice(2), { method: "HEAD", cache: "no-store" });
          const d = Date.parse(r.headers.get("date") || "");
          if (d > 1e12) { t = d + 500; p = (p0 + perf()) / 2; }    // the Date header is whole seconds: aim for the middle
        }
        if (t !== null) CLOCK.anchor = { t, p };
      } catch (e) { /* offline: keep whatever anchor we had */ }
      return CLOCK.now();
    },
    /* the time written into a save: server time if we have it, otherwise the last trusted time plus the time
       this session has really been running (so playing offline can never be counted as "away" later) */
    stamp: () => CLOCK.now() || (CLOCK.base ? CLOCK.base + (perf() - CLOCK.baseP) : 0),
    loaded(t) { CLOCK.base = t > 0 ? t : 0; CLOCK.baseP = perf(); },
    /* seconds the player was away before this session (needs a server sync first); 0 if unknown */
    awayAtBoot() {
      if (!CLOCK.anchor || !CLOCK.base) return 0;
      const serverAtLoad = CLOCK.anchor.t - (CLOCK.anchor.p - CLOCK.baseP);
      return Math.max(0, (serverAtLoad - CLOCK.base) / 1000);
    },
  };

  /* ---------- numbers kept scrambled in memory ----------
     each value is stored as v * 2^e with a fresh random e on every write (multiplying by a power of two is exact,
     so the game sees precisely the same numbers), in a closure the console can't reach */
  const P2 = []; for (let i = 0; i <= 40; i++) P2[i] = Math.pow(2, i - 20);   // P2[i] = 2^(i-20)
  function protect(S, keys) {
    for (const k of keys) {
      const d = Object.getOwnPropertyDescriptor(S, k);
      if (d && d.get) continue;
      let x = 0, e = 20;
      const set = v => { v = +v || 0; e = (Math.random() * 41) | 0; x = v * P2[e]; };
      set(d ? d.value : 0);
      Object.defineProperty(S, k, { get: () => x * P2[40 - e], set, enumerable: true, configurable: true });
    }
    return S;
  }

  /* ---------- only one copy of the game at a time (per browser / per Steam install) ---------- */
  const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("gerald-wants-up") : null;
  let live = false;
  if (bc) bc.onmessage = e => { if (e.data === "anyone?" && live) bc.postMessage("here"); };
  const otherCopy = () => new Promise(res => {
    if (!bc) return res(false);
    let done = false;
    const fin = v => { if (done) return; done = true; bc.removeEventListener("message", h); res(v); };
    const h = e => { if (e.data === "here") fin(true); };
    bc.addEventListener("message", h);
    bc.postMessage("anyone?");
    setTimeout(() => fin(false), 400);
  });

  return { SEAL, CLOCK, protect, otherCopy, setLive: v => { live = !!v; }, hash };
})();
