# Gerald Wants Up

A weird idle game about a beanstalk with a grievance. Gerald spits beans down a tower of strange
plants; every bonk pays. He is climbing to the Moon to file a complaint, and then, because the Moon
forwards it, past the Sun, off the edge of the map, behind the universe, and up forever.

## Play
- Shareable single file: `Gerald Wants Up.html` (double-click it). Build it with `node tools/build.js`.
- Dev version: `src/index.html` (served by the `gerald-wants-up` launch config on port 8777).

## Layout
- `src/js/econ.js` economy (log-space, never overflows), `data.js` all writing/content, `zones.js` story + endless zones
- `game.js` simulation + stalk rendering, `quests.js`, `tutorial.js`, `ui.js`, `main.js`, `state.js` (save/export)
- `draw.js` characters, `world.js` backgrounds, `audio.js` synth sound + music, `cutscene.js` cinematics
- `CONTRACT.md` the API every module follows

## Tools
- `node tools/sim.js [hours] [stagnationSeconds]` pure economy bot
- `node tools/test-core.js [minutes]` headless game-core playthrough (zone arrival times, composts)
- `node tools/make-stub.js` dev page with placeholder art for testing the core
