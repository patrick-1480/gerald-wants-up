# Gerald Wants Up — build contract (read fully before writing code)

Weird, hand-drawn idle game (vibe: Tingus Goose). Gerald is a grumpy beanstalk with a face who spits
beans down through a tower of weird plants with faces; beans hitting plants make money. He is climbing
to the Moon to file a complaint, then (after the Moon forwards the complaint) through ever-weirder zones
forever. Tone: absurd, deadpan, cute-but-off. Never gory or mean. Googly eyes everywhere, and eyes
FOLLOW THE CURSOR. Thick dark-purple ink outlines, flat bright fills, slight wobble ("line boil").

## Environment rules (important)
- Project root: `D:\Claude\GeraldWantsUp` (Git Bash path `/d/Claude/GeraldWantsUp`). Source in `src/`.
- The Write tool is NOT available in this session. Write files with Bash heredocs, in chunks of at most
  ~5 KB each: first chunk `cat > file <<'JSEOF'`, then `cat >> file <<'JSEOF'` for the rest.
  Larger single commands get cut off by the shell. Use the Edit tool or small python patches for edits.
- Never type a backslash followed by `u` or `b` in code you send through tools (they get mangled into
  control characters). Use literal characters (emoji, symbols) instead of unicode escapes.
- Plain classic scripts, no modules, no build step needed for dev, no external assets, no libraries.
  Everything is drawn procedurally on canvas 2D. Each file defines ONE global object (`const NAME = {...}`).
- Check syntax with `node --check src/js/yourfile.js`. For logic tests in node:
  `const c = require('./tools/load.js')(['econ','data','ink','util','zones','yourfile']); c.run('...')`
  (no DOM/canvas in node).
- A static server serves the project at http://localhost:8777/ (e.g. http://localhost:8777/src/index.html).
  For visual checks, make your own preview page `tools/preview-<module>.html` that loads the needed
  scripts with `<script src="../src/js/....js">` and draws everything you made in a grid, animated.
  If you use the built-in browser to look at it, open YOUR OWN new tab (tabs_create) - other agents share
  the browser - and close it when done.
- Only edit files you own. If you need something from another module, code against this contract.
- Performance: these draw calls run every frame at 60fps for ~10-20 objects. No per-frame allocations of
  canvases/gradients you could cache; keep paths simple.

## Load order (src/index.html)
econ.js, data.js, ink.js, util.js, guard.js (GUARD: sealed saves, server clock, scrambled numbers), zones.js, audio.js, draw.js, icons.js (DRAW.questIcon), world.js, state.js, quests.js, game.js,
cutscene.js, tutorial.js, ui.js, main.js

## Already written (read them, do not edit)
- `econ.js` -> `ECON`: economy formulas. `ECON.GAP` = 92 px between plants. `ECON.zoneAt(k)` = altitude
  (in slots) where zone k starts. `ECON.zoneOf(slots)`. One slot = 100 ft.
- `data.js` -> `DATA`: SPECIES, ZONES (story zones 0-14 with `arrive` cutscene lines), SPEAKERS, RELICS,
  HATS, VISITORS, QUESTS, PROC.
- `ink.js` -> `INK`: palette `INK.C`, fonts `INK.FONT` (Chewy, display) / `INK.HAND` (Gaegu, handwriting),
  `INK.setTime(t)`, `INK.j(seed,k)` boiling noise, `INK.n(seed,k)` static noise, `INK.blob(ctx,x,y,rx,ry,fill,stroke,seed,amt)`
  wobbly ellipse, `INK.oval`, `INK.wpoly(ctx,pts,fill,stroke,seed,amt)`, `INK.wline`, `INK.label(ctx,text,x,y,size,col,align,font,lw)`
  outlined text, `INK.eye(ctx,x,y,r,look,{blink,style,pupil,lid})` googly eye, `INK.shade(hex,amt)`,
  `INK.mix(a,b,t)`, `INK.rgba(hex,a)`, `INK.hsl(h,s,l)->hex`.
  Stroke convention: set `ctx.strokeStyle = INK.C.ink; ctx.lineWidth = 3` (2-4 depending on size) before blob/oval.
- `util.js` -> `U`: clamp, lerp, smooth, easeOutBack, easeOutElastic, easeInOut, rng(seed), pick, num, money, ft, time.
- `zones.js` -> `ZONES.get(k)`: zone object for ANY k >= 0 (story or procedural). Fields: k, at (slots), name,
  short, sub, sky [topHex, bottomHex], stars 0..1, decor (string), mus [rootMidi, scaleName, bpm], who (speaker key),
  whoName (procedural only, display name for speaker 'local'), arrive [[speaker,text],...] (missing for zone 0),
  proc (bool), big/finale flags on zones 6/14.

## Runtime globals (owned by main.js / game.js; read-only for you)
`G` = { S (save state), T (seconds since start), W, H (game canvas css px), cam, mouse {x,y,in} (screen px) }.
World space: y is UP, in px, 0 = original garden ground. Screen: `sy = H - 70 - (wy - G.cam)`. Stalk at screen x = W/2.
Mountain top (current run ground) is at `wy = G.S.mtn * ECON.GAP`. Plant i sits at `wy = mtnTop + 140 + i*GAP`,
alternating sides. Altitude in slots of a world y = `wy / ECON.GAP`.
`G.S.strata` = [{ h: slots of mountain added by that compost, name: plant name, n: plants composted, hue: 0-360 }, ...]
oldest first; they stack from wy = 0 up to the mountain top. `G.S.flags.moonGone` true after the Moon cutscene.

## Plant descriptor (from GAME.plantInfo(i); DRAW must handle every combination)
{ i, name, type, c1, c2, hue, eyes, eyeStyle, mouth, acc, pt, seed }
- type: daisy | shroom | cactus | fern | root | puff | eye | mouth | blob | hand | sock | coat | neck | tooth
- c1 main colour (hex), c2 accent colour (hex), hue 0-360, pt petal/leaf count 5-9, seed int
- eyes: 1 | 2 | 3; eyeStyle: round | sleepy | wide | side | spiral
- mouth: smile | flat | o | teeth | tongue | wobbly
- acc: none | tophat | bow | glasses | monocle | mustache | unibrow | flower | bandaid | earring

## draw.js -> `DRAW` (characters and props). All functions draw centred at the current origin.
- `DRAW.plant(ctx, p, o)` p = plant descriptor; o = { t, wob (0..1, just got hit: squash/stretch + shocked
  face), grow (0..1 sprout pop-in, 1 = done), look {x,y} (unit-ish vector toward cursor, in screen axes),
  talk (bool, mouth flaps), sad (bool, used when being composted), dir (-1 left side, 1 right side of stalk) }.
  Must fit inside a ~44 px radius circle (centre ~ plant body). 14 body types, each clearly different and weird:
  daisy (petals around a face), shroom (cap + face on stem), cactus (arms, maybe tiny hat), fern (fronds),
  root (turnip/onion with leaves), puff (cloud-like tree), eye (a giant single eyeball flower), mouth (flytrap
  with teeth+tongue), blob (wobbly translucent jelly), hand (leaves are little waving hands), sock (petals are
  socks), coat (three tiny plant heads stacked in a trench coat), neck (flower on a very long swaying neck),
  tooth (shrub of molars). Faces use INK.eye with look so eyes track the cursor. Idle sway with t.
- `DRAW.gerald(ctx, o)` the hero. o = { t, spit 0..1 (mouth open + cheeks puff), look {x,y}, hat (DATA.HATS id or
  'none'), mood: grump | happy | shock | sad | talk, blink 0..1, scale (default 1) }. Origin = head centre.
  Head ~70 px wide bean shape, green (#6bd36b-ish), angry slanted brows by default, two big googly eyes,
  two little leaves sprouting on top, tiny leaf arms that gesture. He is grumpy but lovable.
- `DRAW.hat(ctx, id, w)` hat for DATA.HATS ids (party, tophat, beanie, wig, pilot, lampshade, antenna, helmet
  (fishbowl, drawn around the head), sock, towel, shades (sunglasses, sits on the eyes: draw at y = +0.35w),
  cheese, pirate, headset, bag, crown (crown of mouse cursors), cone, fish, halo, propeller, gnome). Origin =
  top-centre of the head; w = head width. gerald() calls this itself.
- `DRAW.bean(ctx, gold, t, seed)` ~12 px bean with a tiny screaming face (o mouth). gold = shiny + sparkle.
- `DRAW.sock(ctx, kind 0-3, t, seed)` ~34 px falling sock, stripes, googly eyes on some kinds.
- `DRAW.bubble(ctx, r, t)` translucent soap bubble with a $ coin inside, highlight, r 14-30.
- `DRAW.coin(ctx, r)` gold coin with $.
- `DRAW.visitor(ctx, v, t)` v = a DATA.VISITORS entry (uses v.body, v.col, v.acc). ~50-70 px. Bodies:
  bird, bees, mailbox, gnome, cloud, kite, owl, paperplane, suitcase, moth, lamp, satellite, ufo, rock,
  sockghost, washer, lint, flare, comet, cow, cheese, serpent, fish, stapler, intern, cursor, spinner,
  eyewing. acc: tie | wig | undefined. Animated (flapping, bobbing, spinning) with t. Eyes look at cursor
  via `G.mouse` if available (guard: G may be undefined in previews).
- `DRAW.worm(ctx, o)` Wormsley: giant pink-brown worm in a bowler hat with a monocle, rising out of the ground.
  o = { t, size (body radius, default 40), mouth 0..1, rise 0..1 (how far out of the ground; origin = ground
  point where he emerges), mood: smug | happy | chew }.
- `DRAW.moonFace(ctx, r, o)` the Moon as a character: craters, sleepy smug face, o = { t, mood: smug | nervous |
  bye | sleep, look {x,y} }.
- `DRAW.portrait(ctx, key, size, t)` bust for a DATA.SPEAKERS key, fitted in a size x size box centred at
  origin: gerald, worm, moon, barbara (cloud), pigeon (wig), captain (plane with face), linda (moth), greg
  (satellite), queen (sock with crown), saturn (planet with towel), comet, sun (sunglasses), cow, serpent,
  margaret (office lady... make her a filing cabinet with glasses), stagehand (person in black with headset),
  gnome, plant, local (random weird creature seeded by G.S.zone or 0). 'narr' and 'you' draw nothing.

## world.js -> `WORLD` (backgrounds, the mountain, landmarks, overlays)
- `WORLD.sky(ctx, W, H, alt, t)` fill the whole canvas: sky gradient for the zone at altitude `alt` (slots,
  float, altitude at screen centre), blending into the next zone over the last ~6 slots before its threshold,
  stars by zone.stars, then 2-3 parallax decor layers for zone.decor that scroll vertically as `alt` changes
  (use alt * GAP * parallaxFactor for vertical offset; items wrap; seeded so they don't flicker). Decor sets
  (each must look distinct and weird, ~6-14 items on screen, partially transparent so they stay background):
  garden (distant hills, a house with eyes in the windows, a fence, sunflowers that turn), clouds (puffy clouds
  with sleepy faces, a cloud house with chimney), birds (birds in wigs on floating perches, gavels, scrolls),
  planes (planes with faces in windows, road signs in the sky, traffic cones), attic (floating boxes, old lamps,
  a rocking horse, a box labelled OLD MOONS), satellites (earth curve at bottom, satellites with faces, signal
  lines), moon (craters, distant earth), socks (nebula swirl + swirling socks), laundry (washing machines with
  galaxies in their portholes, Saturn rings), sun (huge warm glow, chairs, ticket numbers floating), dairy
  (cheese planets, milk swirls), map (parchment, dashed map borders, compass rose, inky sea serpent doodles),
  office (filing cabinets, UP arrows, coffee mugs, clipboards), backstage (cardboard texture, tape strips,
  price tag, stapled stars), wall (light grid, giant mouse cursor, window frames, a loading spinner),
  and procedural sets: doors, eyes, stairs, spirals, teeth, clocks, ducks, chairs, hands, jellies, keys, teacups.
  Use ZONES.get(k) for colours/decor and ECON.zoneOf/zoneAt for thresholds. Cache gradients per zone.
- `WORLD.ground(ctx, view, t)` the original garden ground at wy=0 (grass, dirt, a tiny house + garden gnome that
  stares at the stalk) and the compost mountain from wy=0 up to the mountain top: a wide mound centred at the
  stalk, one stratum band per G.S.strata entry (different soil colours, little worm tunnels, bones of old beans,
  and a tiny tombstone per stratum reading 'RIP <name>'), grass + a small flag on the summit. view = { W, H,
  cx (stalk screen x), toY(wy) -> screen y, gap }.
- `WORLD.landmarks(ctx, view, t)` things at fixed altitudes, drawn behind the stalk: a wooden signpost at each
  zone threshold up to the next unreached zone ('THE CLOUDS 1,200 ft' style, next one says 'NEXT:'), the big
  Moon near zone 6's threshold (use DRAW.moonFace; after G.S.flags.moonGone show an empty crater-shaped hole with
  a 'BACK IN 5 MIN' sign instead), Saturn near zone 8, the Sun's glow + door near zone 9. Only draw what is on screen.
- `WORLD.overlay(ctx, W, H, t)` subtle paper grain (pre-rendered noise pattern, cached) + soft vignette.

## audio.js -> `SFX` (Web Audio, all synthesized, no files)
- `SFX.init()` create the AudioContext; called from the first user click. Safe to call twice. Every other
  function must be a silent no-op before init.
- `SFX.setVolume(sfx 0..1, music 0..1)`.
- `SFX.play(name, opts)` names: spit (wet 'ptoo'), hit (opts.i plant index -> pitch on a pleasant scale; soft
  marimba/boop; throttle to ~14 per second total), pop (bubble), coin, sock (rubber squeak), grow (rising
  bloop), upgrade (quick arpeggio; opts.n count -> bigger), shop, quest (happy jingle), claim, zone (fanfare),
  compost (low rumble), gulp, chew, visitor (weird warble when one appears), reward, buff, click, error,
  blip (dialogue typewriter, opts.pitch Hz from DATA.SPEAKERS; vary slightly), stamp (big thunk), whoosh,
  golden (sparkle), poke (Gerald poked: squishy 'hnk'), tick.
- `SFX.music(zone)` crossfade to procedural background music for a ZONES.get(k) object using zone.mus =
  [rootMidi, scale, bpm]; scales: major, minor, dorian, lydian, mixo, penta, phryg, whole. Lo-fi, quirky,
  slightly wonky (occasional bent/detuned notes, kazoo-ish or toy-piano lead, soft pad, bass, light percussion),
  never harsh; low volume; deterministic per zone (seeded) with gentle variation so a loop isn't boring.
  Use a lookahead scheduler; must keep running cheaply for hours. Zone 6 (Moon) eerie + sparse; zone 14 tender.
- `SFX.setMusicOn(bool)`, `SFX.duck(on)` (lower music during cutscenes), `SFX.cue(name)` short musical stings:
  intro, compost, moon, finale.

## cutscene.js -> `CINE` (full-window cinematic overlay)
- `CINE.play(id, params, onDone)`; `CINE.active` (bool). Creates its own DOM: a fixed full-window overlay
  (z-index 50) with its own canvas, letterbox bars, a dialogue box (speaker name tag in the speaker's colour,
  portrait via DRAW.portrait on a small canvas, typewriter text with SFX.play('blip',{pitch}) every 2 chars),
  'click / space to continue' hint, and a Skip button. Click or Space/Enter: finish the line, then advance.
  Inject its own <style> tag (dark purple #1d0f2b panels, cream #fff3dc text, chunky 3px ink borders, fonts
  Chewy for names / Gaegu 22px bold for dialogue). Runs its own requestAnimationFrame loop and calls
  INK.setTime. Call SFX.duck(true) while active, false after. Speaker 'local' uses params.zone.whoName.
- Lines can also be choices: ['choice', ['Yes', 'Sure, why not', "I'm just a person"]] -> buttons; continue
  after any pick (store the pick on the scene so later lines can react if you want).
- Scenes (ids):
  - 'intro' (opening story, ~8 shots, animated, funny): a quiet garden of mild unease; a bean is dropped/planted
    (by the gnome? nobody saw); it sprouts into Gerald; his first word is 'No.'; night falls, the Moon rises and
    looks at Gerald; something passes between them; nobody knows what; Gerald writes a complaint (show the paper:
    'COMPLAINT #1: The Moon looked at me funny. Severity: EXTREME'); he must deliver it in person; the Moon is
    U.ft(ECON.zoneAt(6)) up (currently 12,200 ft; never hardcode it; scientists disagree, Gerald doesn't care); title card 'GERALD WANTS UP'.
  - 'compost' (first time, ~6 shots) params { mulch, ft, plants: [plant descriptors], top: plant name }:
    plants look up nervously; ground rumbles; Wormsley rises huge; 'I'm going to eat your plants'; a plant asks
    if it will hurt, 'No. It will be nutritious.'; plants slurped one by one (polite chewing); they become a
    mountain of mulch that rises under Gerald; Gerald: '...I'm higher. I'm HIGHER.'; summary '+X mulch, +Y ft'.
  - 'compostShort' same params, ~4 seconds, no dialogue except a final summary card, auto-advances.
  - 'zone' params { zone } : arrival for zone.k: title card (zone name + sub), then zone.arrive lines over a
    backdrop of WORLD.sky(ctx, W, H, zone.at + 2, t) with the resident drawn big (DRAW.portrait of zone.who) and
    Gerald (DRAW.gerald) on his stalk. Special handling: zone 6 (Moon): the Moon is the backdrop character,
    and on 'BYE!' it zooms away off the top of the screen. zone 14 (finale): 'The Fourth Wall' - Gerald looks
    straight at the player; lines (write them): Gerald notices you, asks if you are the manager (choice), files the
    complaint with you, asks you to approve it (choice: 'APPROVED.' / '...approved?'), giant STAMP animation +
    SFX.play('stamp'), Gerald realises he doesn't feel different, he just likes going up; narrator: 'And so
    Gerald kept growing. Not for the complaint. Not for the Moon. Just because up was there.'; card 'THE END
    (of the story). The sky, however, does not end.'
  - 'reward' params { title, lines: [strings], icon (emoji) } small celebratory card (relic found, hat found).
  onDone() is called exactly once when the scene ends or is skipped.

## Owned by the main agent (not you): state.js, quests.js, game.js, tutorial.js, ui.js, main.js, index.html,
css/style.css, tools/build.js. They call your APIs exactly as written above.
