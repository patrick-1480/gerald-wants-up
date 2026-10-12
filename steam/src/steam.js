/* Gerald Wants Up — Steam build only. Talks to the Electron main process through window.steamBridge (preload.js):
   the Steam account you are signed in with, achievements, Steam Cloud saves, rich presence, fullscreen, quit.
   It hooks into the shared game code from the outside (wrapping STATE / UI functions) so every other file stays
   identical to the web version. Without Steam running (or in a plain browser) the game simply plays offline.
   Built into the same sealed closure as the rest of the game (tools/sync.js), so none of this is reachable. */
const STEAM = {
  B: window.steamBridge || null,
  info: { ok: false, name: "", why: "not running in the Steam app" },
  got: {},                 // achievement id -> 1 once unlocked
  cloudT: 0, quitting: false,
  CLOUD_EVERY: 120000,     // ms between Steam Cloud uploads (plus one on quit)
  /* achievements: [API name (must match Steamworks), title, description, icon, test(save)] */
  ACH: [
    ["ACH_FIRST_SPROUT", "Sprout", "Grow your second plant.", "sprouts", S => S.n >= 2 || S.stats.sprouts >= 1],
    ["ACH_RUDE", "Rude", "Poke Gerald 100 times.", "pokes", S => S.stats.pokes >= 100],
    ["ACH_CLOUDS", "Head in the Clouds", "Reach the Cloud Suburbs.", "tall", S => S.zone >= 1],
    ["ACH_PARLIAMENT", "Order! Order!", "Reach the Bird Parliament.", "tall", S => S.zone >= 2],
    ["ACH_ATTIC", "Up in the Attic", "Reach the Sky's Attic.", "tall", S => S.zone >= 4],
    ["ACH_MOON", "Complaint Filed", "Reach THE MOON.", "moon", S => S.zone >= 6],
    ["ACH_LAUNDROMAT", "Spin Cycle", "Reach the Cosmic Laundromat.", "socks", S => S.zone >= 8],
    ["ACH_SUN", "Please Take a Number", "Reach the Sun's Waiting Room.", "tall", S => S.zone >= 9],
    ["ACH_FOURTH_WALL", "Hello?", "Reach the Fourth Wall.", "tall", S => S.zone >= 14],
    ["ACH_ENDLESS", "Off Script", "Climb past the Fourth Wall into the endless layers.", "tall", S => S.zone >= 15],
    ["ACH_LAYER_10", "Still Going", "Reach Layer 10.", "tall", S => (S.best ? S.best.zone : S.zone) >= 24],
    ["ACH_LAYER_25", "Deep Space", "Reach Layer 25.", "tall", S => S.best.zone >= 39],
    ["ACH_LAYER_35", "Way Out There", "Reach Layer 35.", "tall", S => S.best.zone >= 49],
    ["ACH_LAYER_50", "Somewhere Near the Top?", "Reach Layer 50.", "tall", S => S.best.zone >= 64],
    ["ACH_COMPOST", "Feed the Worm", "Compost for the first time.", "compost", S => S.stats.composts >= 1],
    ["ACH_COMPOST_10", "Mountain Maker", "Compost 10 times.", "compost", S => S.stats.composts >= 10],
    ["ACH_COMPOST_50", "Mt. Compost", "Compost 50 times.", "compost", S => S.stats.composts >= 50],
    ["ACH_SOCKS_100", "Sock Catcher", "Catch 100 falling socks.", "socks", S => S.stats.socks >= 100],
    ["ACH_SOCKS_1000", "Sock Hoarder", "Catch 1,000 falling socks.", "socks", S => S.stats.socks >= 1000],
    ["ACH_BUTLER", "At Your Service", "Hire the Sock Butler.", "socks", S => !!S.sockAuto],
    ["ACH_VISITORS", "Weird Guests", "Click 25 weird visitors.", "visitors", S => S.stats.visitors >= 25],
    ["ACH_GOLDEN", "Golden Child", "Get 1,000 golden beans.", "golden", S => S.stats.golden >= 1000],
    ["ACH_QUESTS", "Errand Bean", "Finish 25 quests.", "unknown", S => S.stats.quests >= 25],
    ["ACH_UPGRADES", "Fertiliser Enthusiast", "Buy 1,000 plant upgrades.", "upgrades", S => S.stats.upgrades >= 1000],
    ["ACH_PLANTS_50", "Tall Order", "Have 50 plants on the stalk at once.", "level", S => S.n >= 50],
    ["ACH_MILLION", "Bean Millionaire", "Earn $1,000,000 in total.", "earn", S => S.stats.earnL >= 6],
    ["ACH_GOOGOL", "Googol Gardener", "Earn a googol dollars ($1e100) in total.", "earn", S => S.stats.earnL >= 100],
    ["ACH_HATS", "Hat Trick", "Collect 10 hats for Gerald.", "hat", S => Object.keys(S.hats || {}).length - 1 >= 10],
    ["ACH_RELICS", "Collector", "Find 10 relics.", "bubbles", S => Object.keys(S.relics || {}).length >= 10],
    ["ACH_GOLDEN_SOCK", "Midas Sock", "Catch a Golden Sock.", "gsock", S => (S.stats.gsocks || 0) >= 1],
    ["ACH_SUPER_FRENZY", "Bonkers", "Start a Super Frenzy.", "gsock", S => (S.stats.superF || 0) >= 1],
    ["ACH_TRANSPLANT", "New Pot", "Transplant Gerald to a new planet.", "planet", S => (S.stats.transplants || 0) >= 1],
    ["ACH_TRANSPLANT_10", "Frequent Flyer", "Transplant 10 times.", "planet", S => (S.stats.transplants || 0) >= 10],
    ["ACH_TRANSPLANT_50", "Planet Collector", "Transplant 50 times.", "planet", S => (S.stats.transplants || 0) >= 50],
    ["ACH_STARDUST", "Stargazer", "Earn 1,000 Stardust in total.", "star", S => (S.dustEver || 0) >= 1000],
    ["ACH_WEIRD", "Weird", "Finish a tier of a Weird Run.", "weird", S => Object.values(S.chalT || {}).some(t => t >= 1)],
    ["ACH_WEIRD_ALL", "Weirdest of All", "Finish all 5 tiers of every Weird Run.", "weird", S => ECON.CHALS.every(c => (S.chalT || {})[c.id] >= 5)],
    ["ACH_SHINY", "Shiny!", "Find a shiny plant.", "shiny", S => ECON.shinyCount(S) >= 1],
    ["ACH_SHINY_ALL", "Gotta Grow 'Em All", "Find a shiny of every plant species.", "shiny", S => ECON.shinyCount(S) >= DATA.SPECIES.length],
    ["ACH_PLANTDEX", "Plantdex Complete", "Find every plant variant.", "dex", S => ECON.dexCount(S) >= DATA.SPECIES.length * 10],
    ["ACH_TROPHIES_50", "Trophy Cabinet", "Earn 50 trophies.", "trophy", S => ECON.trophyCount(S) >= 50],
    ["ACH_TROPHIES_ALL", "Every Trophy", "Earn every trophy.", "trophy", S => TROPHY.LIST.length > 0 && ECON.trophyCount(S) >= TROPHY.LIST.length],
    ["ACH_LANDMARK", "Sightseer", "Reach a Cosmic Landmark.", "landmark", S => (S.marks || 0) >= 1],
    ["ACH_HUNDRED_HOURS", "Gerald's Best Friend", "Play for 100 hours.", "time", S => S.stats.time >= 360000],
  ],
  call(fn, ...a) { try { return STEAM.B && STEAM.B[fn] ? STEAM.B[fn](...a) : undefined; } catch (e) { console.warn("steam", fn, e); } },

  /* ---------- saves: local storage stays the main save; Steam Cloud (and a file copy) follow it ---------- */
  hookSaves() {
    const load0 = STATE.load, save0 = STATE.save, wipe0 = STATE.wipe;
    // on boot, use whichever copy is newest (this PC's, the file backup, or Steam Cloud from another PC)
    STATE.load = () => {
      const boot = STEAM.call("bootSaves") || {};
      let local = null; try { local = localStorage.getItem(STATE.KEY); } catch (e) {}
      let best = null, bestT = -1;
      for (const [src, raw] of [["local", local], ["file", boot.file], ["cloud", boot.cloud]]) {
        const d = STATE.decode(raw);      // sealed saves only: an edited copy (local, file or cloud) is ignored
        const t = d ? d.srvT || d.last || 0 : -1;
        if (d && t > bestT) { best = [src, raw]; bestT = t; }
      }
      if (best && best[0] !== "local") { try { localStorage.setItem(STATE.KEY, best[1]); } catch (e) {} STEAM.loadedFrom = best[0]; }
      return load0();
    };
    STATE.save = S => {
      save0(S);
      const now = Date.now(), sealed = () => { try { return localStorage.getItem(STATE.KEY); } catch (e) { return null; } };
      if (STEAM.quitting) STEAM.call("writeSaveSync", sealed());          // closing: wait until it's written
      else if (now - STEAM.cloudT > STEAM.CLOUD_EVERY) { STEAM.cloudT = now; STEAM.call("writeSave", sealed()); }
    };
    STATE.wipe = () => { wipe0(); STEAM.call("wipeSave"); };
    STEAM.cloudT = Date.now();       // first upload a couple of minutes in (a fresh boot is already in sync)
    addEventListener("beforeunload", () => { STEAM.quitting = true; });   // registered before main.js's save-on-close runs
  },

  /* ---------- achievements ---------- */
  checkAch() {
    const S = G.S; if (!S || !G.started) return;
    const fresh = [];
    for (const [id, name, , , test] of STEAM.ACH) {
      if (STEAM.got[id]) continue;
      let ok = false; try { ok = test(S); } catch (e) {}
      if (!ok) continue;
      STEAM.got[id] = 1; fresh.push(name);
      STEAM.call("unlock", id);
    }
    if (!fresh.length) return;
    try { localStorage.setItem("gwu_ach", JSON.stringify(STEAM.got)); } catch (e) {}
    // no in-game toast: Steam shows its own popup, and the game's Trophies already celebrate
    if (!STEAM.info.ok) UI.toast(fresh.length > 2 ? "🏆 " + fresh.length + " Steam achievements unlocked!" : fresh.map(n => "🏆 Steam achievement: " + n).join("  ·  "), "ach", 4.5);
    if (UI.tab === "settings") STEAM.drawAch();
  },
  presence() {
    const S = G.S; if (!S || !G.started || !STEAM.info.ok) return;
    const z = ZONES.get(ECON.zoneOf(ECON.alt(S)));
    STEAM.call("presence", "Gerald is at " + U.ft(ECON.alt(S)) + " (" + (z.short || z.name) + ")");
  },

  /* ---------- UI: title screen + Settings > Steam ---------- */
  title() {
    const ui = document.querySelector(".titleUi"); if (!ui || $("steamWho")) return;
    const i = STEAM.info, d = document.createElement("div");
    d.id = "steamWho"; d.className = i.ok ? "" : "off";
    d.innerHTML = i.ok ? '<span class="dot"></span>Playing as <b></b> on Steam' : '<span class="dot"></span>Steam not connected · playing offline';
    if (i.ok) d.querySelector("b").textContent = i.name;
    ui.appendChild(d);
    if (STEAM.B) {      // a desktop game needs a way out from the title screen too
      const q = document.createElement("button");
      q.id = "titleQuit"; q.className = "btn ghost"; q.textContent = "Quit";
      q.onclick = () => STEAM.call("quit");
      $("title").appendChild(q);
    }
    if (i.ok && G.S.flags.intro) $("titleFine").textContent = "Welcome back, " + i.name + ". " + $("titleFine").textContent;
  },
  settings() {
    const tab = $("tab-settings"), i = STEAM.info, box = document.createElement("div");
    const old = $("steamBox"); if (old) old.remove();
    box.id = "steamBox";
    box.innerHTML = "<h2>Steam</h2>" +
      '<div class="steamCard"><div class="av"></div><div class="m"><b id="stName"></b><div class="dim" id="stSub"></div></div></div>' +
      (i.ok ? '<button class="btn lil wide" id="stOverlay">Open Steam achievements</button>' : "") +
      "<div class='dim' id='stAchN'></div><div class='achGrid' id='achGrid'></div>" +
      (STEAM.B ? "<h2>Window</h2>" +
        '<div class="toggle">Fullscreen (F11) <input type="checkbox" id="setFull"></div>' +
        '<button class="btn ghost wide" id="stQuit">Save and quit</button>' : "");
    const save = [...tab.querySelectorAll("h2")].find(h => h.textContent === "Save");     // goes just above "Save"
    tab.insertBefore(box, save || null);
    box.querySelector(".av").textContent = i.ok ? (i.name || "?").trim().charAt(0).toUpperCase() : "!";
    $("stName").textContent = i.ok ? i.name : "Not connected to Steam";
    $("stSub").textContent = i.ok
      ? "Signed in" + (i.steamId ? " · Steam ID " + i.steamId : "") + (i.cloud ? " · Steam Cloud saves ON" : " · Steam Cloud off (saves stay on this PC)") + (i.deck ? " · Steam Deck" : "")
      : (STEAM.B ? "Start the game from Steam to link your account (" + i.why + "). Your progress still saves on this PC." : "This copy isn't running inside the Steam app.");
    if ($("stOverlay")) $("stOverlay").onclick = () => STEAM.call("overlay", "achievements");
    if ($("setFull")) {
      $("setFull").checked = !!STEAM.call("isFullscreen");
      $("setFull").onchange = e => STEAM.call("fullscreen", e.target.checked);
      $("stQuit").onclick = () => { STATE.save(G.S); STEAM.call("quit"); };
    }
    // the Save section talks about "this browser"
    tab.querySelectorAll(".dim").forEach(d => {
      if (/in this browser/.test(d.textContent)) d.textContent = i.ok && i.cloud
        ? "The game saves every few seconds, and backs up to Steam Cloud every couple of minutes and when you quit."
        : "The game saves itself every few seconds on this PC.";
    });
    STEAM.buildAch();
  },
  buildAch() {
    const g = $("achGrid"); if (!g) return;
    g.innerHTML = STEAM.ACH.map(() => '<div class="ach"><canvas width="68" height="68"></canvas><div><b></b><span></span></div></div>').join("");
    g.querySelectorAll(".ach").forEach((el, k) => { el.querySelector("b").textContent = STEAM.ACH[k][1]; el.querySelector("span").textContent = STEAM.ACH[k][2]; });
    STEAM.drawAch();
  },
  drawAch() {
    const g = $("achGrid"); if (!g) return;
    let n = 0;
    g.querySelectorAll(".ach").forEach((el, k) => {
      const [id, , , icon] = STEAM.ACH[k], on = !!STEAM.got[id]; n += on;
      el.classList.toggle("no", !on);
      const x = el.querySelector("canvas").getContext("2d");
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 68, 68); x.save(); x.translate(34, 34);
      GAME.safe("achIcon", () => STEAM.icon(x, icon, G.T));
      x.restore();
    });
    $("stAchN").textContent = n + " / " + STEAM.ACH.length + " achievements";
  },
  /* achievement pictures, from the game's own drawings (fits 64x64 around 0,0) */
  icon(x, type, t) {
    if (type === "moon") { x.strokeStyle = INK.C.ink; x.lineWidth = 2.5; DRAW.moonFace(x, 24, { t, mood: "smug", look: { x: -0.5, y: 0.5 } }); return; }
    const EMO = { gsock: "🧦", planet: "🪐", star: "⭐", weird: "🌀", shiny: "💎", dex: "📗", trophy: "🏆", landmark: "🗿", time: "⏳" };
    if (EMO[type]) { x.font = "36px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(EMO[type], 0, 2); return; }
    if (type === "hat") { x.scale(0.55, 0.55); x.translate(0, 18); DRAW.gerald(x, { t, spit: 0, look: { x: 0.4, y: -0.2 }, hat: "tophat", mood: "grump", blink: 0, neck: false }); return; }
    x.scale(1.2, 1.2); DRAW.questIcon(x, type, 50, t);
  },

  /* ---------- boot (runs before main.js) ---------- */
  init() {
    STEAM.info = STEAM.call("info") || STEAM.info;
    GUARD.CLOCK.src = () => STEAM.call("serverTime");     // offline time comes from Steam's servers, not the PC clock
    // developer bot (bot/bot.js, unpackaged copy only): it gets to SEE where things are on the canvas, nothing more.
    // Everything it does goes through the normal screen: tabs, buttons and clicks.
    if (STEAM.call("isBot")) window.__gwuSee = () => {
      const z = G.zoom, gy = GAME.toY(GAME.geraldWY()) * z, c = G.canvas.getBoundingClientRect();
      return {
        canvas: { left: c.left, top: c.top, w: c.width, h: c.height },
        bubbles: GAME.bubbleHit.map(b => ({ x: b.x * z, y: b.y * z, r: b.r * z })),
        socks: GAME.socks.map(k => ({ x: k.x, y: k.y, gold: !!k.gold })),
        visitors: GAME.visitors.map(o => { const p = GAME.visitorPos(o); return { x: p[0], y: p[1] }; }),
        gerald: { x: G.vW / 2 * z, y: gy, on: gy > 30 && gy < G.H - 30 },
        ghost: GAME.ghost && GAME.ghost.y * z > 0 && GAME.ghost.y * z < G.H ? { x: GAME.ghost.x * z, y: GAME.ghost.y * z } : null,
      };
    };
    if (STEAM.call("isSelftest")) window.__gwu = {   // npm run selftest only (devtools are off in release builds)
      get G() { return G; }, get MAIN() { return MAIN; }, get UI() { return UI; }, STATE, GUARD, STEAM };
    try { STEAM.got = JSON.parse(localStorage.getItem("gwu_ach") || "{}") || {}; } catch (e) { STEAM.got = {}; }
    const have = STEAM.info.ok ? STEAM.call("unlocked", STEAM.ACH.map(a => a[0])) : null;
    if (Array.isArray(have)) for (const id of have) STEAM.got[id] = 1;
    STEAM.hookSaves();
    const init0 = UI.init;
    UI.init = () => { init0(); STEAM.title(); STEAM.settings(); };
    const tab0 = UI.setTab;
    UI.setTab = (t, nav) => { tab0(t, nav); if (t === "settings") STEAM.drawAch(); };
    setInterval(STEAM.checkAch, 1000);
    setInterval(STEAM.presence, 30000); setTimeout(STEAM.presence, 3000);
    addEventListener("resize", () => { const f = $("setFull"); if (f) f.checked = !!STEAM.call("isFullscreen"); });   // F11 / Alt+Enter are handled by main.js
  },
};
STEAM.init();
