# Gerald Wants Up

A weird idle game about a beanstalk with a grievance. Gerald spits beans down a tower of strange
plants; every bonk pays. He is climbing to the Moon to file a complaint, and then, because the Moon
forwards it, past the Sun, off the edge of the map, behind the universe, and up forever.

## Play
- Website: `public/index.html` (Render's Publish Directory must be `public`). Shareable copy: `Gerald Wants Up.html`.
  Both are made by `npm install` (once) then `npm run build`: one protected file (all code in a closure, minified,
  save/anti-cheat code obfuscated). Never publish `src/` (it has the readable code).
- Dev version: `src/index.html` (served by the `gerald-wants-up` launch config on port 8777).
- Anti-cheat (`src/js/guard.js`): saves and export codes are scrambled + signed (edited ones won't load), money/socks/
  mulch/height are scrambled in memory, offline time comes from the server's clock (capped at 2 hours), and only
  one copy of the game can run at a time.
- Steam desktop version: `steam/` (Electron + Steam account, achievements, Steam Cloud). See `steam/README.md`.
  After changing `src/`, run `npm run sync` in `steam/` to copy the changes over.

## Layout
- `src/js/econ.js` economy (log-space, never overflows), `data.js` all writing/content, `zones.js` story + endless zones
- `game.js` simulation + stalk rendering, `quests.js`, `tutorial.js`, `ui.js`, `main.js`, `state.js` (save/export)
- `draw.js` characters, `world.js` backgrounds, `audio.js` synth sound + music, `cutscene.js` cinematics
- `CONTRACT.md` the API every module follows

## Tools
- `node tools/sim.js [hours] [stagnationSeconds]` pure economy bot
- `node tools/test-core.js [minutes]` headless game-core playthrough (zone arrival times, composts)
- `node tools/make-stub.js` dev page with placeholder art for testing the core
