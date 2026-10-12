/* Gerald Wants Up — Trophies: 105 achievements for everything you can do, from your first sprout to hundreds of
   hours in. Every trophy makes all payouts x1.02, forever (ECON.lnCollect). Loaded after quests.js. */
const TROPHY = {
  LIST: [],
  build() {
    const L = TROPHY.LIST;
    const tier = (key, ic, names, vals, desc, get) => vals.forEach((v, i) => L.push({ id: key + i, ic, name: names[i], desc: desc(v), test: S => get(S) >= v }));
    const zoneName = v => (v <= 14 ? ZONES.get(v).short || ZONES.get(v).name : "endless layer " + (v - 14));
    tier("pl", "🌱", ["Sprouting", "Leafy", "Bushy", "Towering", "Skyscraping", "Absurdly Tall"], [10, 25, 50, 75, 100, 150],
      v => "Have " + v + " plants on the stalk at once", S => S.best.n);
    tier("zn", "🗺️", ["Head in the Clouds", "Order in the Court", "Up in the Attic", "Moonwalker", "Please Take a Number", "Department Head",
      "Fourth Wall Breaker", "Off the Map", "Deep Layers", "Way Up There", "Still Climbing", "Layer Cake", "Forty Floors Up", "Fifty Layers Deep"],
      [1, 2, 4, 6, 9, 12, 14].concat([1, 5, 10, 20, 30, 40, 50].map(l => 14 + l)), v => "Reach " + zoneName(v), S => S.best.zone);   // then endless layers 1..50 (layer 50 is roughly 700 hours in)
    tier("cp", "🪱", ["Worm Food", "Regular Customer", "Mulch Mogul", "Compost Connoisseur", "Wormsley's Favourite", "Soil Scientist", "One Thousand Snacks"],
      [1, 10, 50, 100, 250, 500, 1000], v => "Compost " + U.num(v) + " time" + (v > 1 ? "s" : ""), S => S.stats.composts);
    tier("tp", "🪐", ["New Pot", "Pot Hopper", "Frequent Flyer", "Interplanetary", "Planet Collector", "Everywhere at Once"],
      [1, 3, 10, 25, 50, 100], v => "Transplant " + v + " time" + (v > 1 ? "s" : ""), S => S.stats.transplants || 0);
    tier("sk", "🧦", ["Sock It", "Sock Drawer", "Sock Mountain", "Sock Empire", "The Sock Singularity"], [10, 100, 1000, 5000, 25000],
      v => "Catch " + U.num(v) + " falling socks", S => S.stats.socks);
    tier("gs", "✨", ["Midas Sock", "Golden Toes", "Fort Socks"], [1, 5, 25], v => "Catch " + v + " Golden Sock" + (v > 1 ? "s" : ""), S => S.stats.gsocks || 0);
    tier("sf", "🌟", ["Bonkers", "Absolutely Bonkers"], [1, 10], v => "Start " + v + " Super Frenz" + (v > 1 ? "ies" : "y"), S => S.stats.superF || 0);
    tier("vi", "👽", ["Hospitable", "Weirdo Magnet", "Guest Book Full", "Everybody's Friend"], [10, 50, 250, 1000],
      v => "Click " + U.num(v) + " weird visitors", S => S.stats.visitors);
    tier("gb", "🥇", ["Shiny Spit", "Gold Rush", "Bean Bullion", "Midas Mouth"], [100, 1000, 10000, 100000],
      v => "Spit " + U.num(v) + " golden beans", S => S.stats.golden);
    tier("pk", "👉", ["Poker", "Professional Poker", "Gerald Needs a Break"], [100, 1000, 10000], v => "Poke Gerald " + U.num(v) + " times", S => S.stats.pokes);
    tier("qs", "📜", ["Errand Bean", "Odd Jobber", "Quest Machine", "Everybody's Assistant"], [10, 50, 200, 500], v => "Finish " + v + " quests", S => S.stats.quests);
    tier("up", "⬆️", ["Fertiliser Fan", "Upgrade Addict", "Maximum Level Energy"], [1000, 10000, 100000], v => "Buy " + U.num(v) + " plant upgrades", S => S.stats.upgrades);
    tier("mn", "💰", ["Bean Millionaire", "Bean Trillionaire", "Septillionaire", "Fifty Zeros", "Googol Gardener", "Two Hundred Zeros", "Five Hundred Zeros", "A Thousand Zeros"],
      [6, 12, 24, 50, 100, 200, 500, 1000], v => "Earn $1e" + v + " in total", S => S.stats.earnL);
    tier("rl", "🏺", ["Collector", "Curator", "Museum Quality"], [10, 20, DATA.RELICS.length], v => "Find " + v + " relics", S => Object.keys(S.relics).length);
    tier("ht", "🎩", ["Hat Rack", "Hat Trick", "Every Hat"], [5, 10, DATA.HATS.length - 1], v => "Collect " + v + " hats", S => Object.keys(S.hats).length - 1);
    tier("sp", "🔬", ["Botanist"], [DATA.SPECIES.length], v => "Grow every species of plant (" + v + ")", S => new Set(Object.keys(S.dex.seen).map(k => k.split("|")[0])).size);
    tier("dx", "📗", ["Plant Spotter", "Plant Nerd", "Plantdex Complete"], [25, 70, TROPHY.DEX_ALL()], v => "Find " + v + " plant variants for the Plantdex", S => ECON.dexCount(S));
    tier("sh", "💎", ["Shiny!", "Sparkle Garden", "Glitter Grower", "Gotta Grow 'Em All"], [1, 5, 10, DATA.SPECIES.length], v => "Find " + v + " shiny plant species", S => ECON.shinyCount(S));
    tier("ch", "🌀", ["Weird", "Weirder", "Very Weird", "Extremely Weird", "Weirdness Expert", "Weirdest of All"], [1, 5, 10, 20, 30, 40],
      v => "Complete " + v + " Weird Run tier" + (v > 1 ? "s" : ""), S => TROPHY.chalSum(S));
    tier("sd", "⭐", ["Stargazer", "Star Collector", "Dust Devil", "Galactic", "Cosmic"], [10, 100, 1000, 1e5, 1e8], v => "Earn " + U.num(v) + " Stardust in total", S => S.dustEver || 0);
    tier("lm", "🗿", ["Sightseer", "Tour Guide", "Seen It All (Not All)"], [1, 5, 10], v => "Reach " + v + " Cosmic Landmark" + (v > 1 ? "s" : ""), S => S.marks || 0);
    tier("tm", "⏳", ["Getting Started", "Committed", "Dedicated", "Gerald's Best Friend", "Up Forever", "Truly, Madly, Up"], [1, 10, 50, 100, 250, 500],
      v => "Play for " + v + " hour" + (v > 1 ? "s" : ""), S => S.stats.time / 3600);
    L.push({ id: "metric", ic: "📏", name: "Very Precise", desc: "Switch to metric units", test: S => !!S.settings.metric });
    L.push({ id: "fashion", ic: "👒", name: "Dressed to Grow", desc: "Put a hat on Gerald", test: S => S.hat && S.hat !== "none" });
  },
  DEX_ALL: () => DATA.SPECIES.length * 10,        // every species x (no accessory + 9 accessories)
  chalSum: S => { let n = 0; for (const k in S.chalT || {}) n += S.chalT[k]; return n; },
  check() {
    const S = G.S; if (!S || !G.started) return;
    if (!TROPHY.LIST.length) TROPHY.build();
    const fresh = [];
    for (const t of TROPHY.LIST) {
      if (S.troph[t.id]) continue;
      let ok = false; try { ok = t.test(S); } catch (e) {}
      if (ok) { S.troph[t.id] = 1; fresh.push(t); }
    }
    if (!fresh.length) return;
    GAME.refreshPay(); UI.sig.stuff = "";
    UI.toast(fresh.length > 2 ? "🏆 " + fresh.length + " trophies! All payouts x" + (1.02 ** fresh.length).toFixed(2)
      : fresh.map(t => "🏆 " + t.name + " (" + t.desc + ")").join("  ·  "), "claim", 4);
    SFX.play("quest");
  },
};
