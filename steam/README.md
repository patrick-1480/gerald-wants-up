# Gerald Wants Up — Steam version

A desktop (Electron) copy of the web game with Steam built in:

- **Your Steam account is linked automatically.** Start the game while signed in to Steam and the title screen says
  "Playing as *your name* on Steam"; Settings shows your name, Steam ID and cloud status. (Steam games don't have a
  separate "link account" step: the game uses whoever is signed in to the Steam app.)
- **26 achievements** (`app/js/steam.js` → `STEAM.ACH`), with icons in `art/achievements/`.
- **Steam Cloud saves**: the save is uploaded every 2 minutes and when you quit, and on start the newest copy wins
  (this PC, the backup file, or the cloud from another PC).
- **Rich presence** ("Gerald is at 12,200 ft (THE MOON)" on your friends list), **Steam overlay** (Shift+Tab),
  **fullscreen** (F11 or Alt+Enter, remembered), a **Quit** button, fonts bundled so it works offline.
- Starts fullscreen on Steam Deck.
- Without Steam running it still plays, saving on the PC only.

## Folders

| Path | What |
|---|---|
| `app/` | the game: a clone of `../src` plus the Steam-only files `js/steam.js`, `css/steam.css`, `fonts/` |
| `main.js` | Electron main process: window, Steam connection (steamworks.js), saves, achievements |
| `preload.js` | the bridge the game page uses (`window.steamBridge`) |
| `tools/sync.js` | re-clones `../src` into `app/` (Steam-only files are kept) |
| `tools/art.html` | app icon + achievement icons, drawn by the game's code (`npm run art` to save them) |
| `build/icon.png` | app icon used for the .exe |
| `steampipe/app_build.vdf` | upload script for Steam |
| `dist/win-unpacked/` | the built game (made by `npm run dist`, not in git) |

## Commands (run them in this `steam` folder)

```powershell
npm install        # once
npm start          # play it as a desktop app (uses Steam test app 480 until you have your own App ID)
npm run selftest   # boots it hidden, prints the Steam status, saves screenshots to %TEMP%\gerald-selftest
npm run sync       # after changing the web game in ../src: copy the changes in here
npm run dist       # build the Windows game folder: dist\win-unpacked\Gerald Wants Up.exe
npm run art        # open http://127.0.0.1:8790 and press "Save all" to re-make the icons
```

Gameplay changes go in `../src` (the web version), then `npm run sync`. Steam-only changes go in
`app/js/steam.js`, `app/css/steam.css`, `main.js` or `preload.js`.

## Putting it on Steam

1. **Steamworks account**: sign up at partner.steamgames.com (identity, tax and bank forms), pay the $100 Steam Direct
   fee for the game. You get an **App ID** and a Windows **depot ID**.
2. **Your App ID**: set `"steamAppId"` in `package.json` (it's 480, Valve's test app, until then). Shipped builds
   relaunch through Steam if someone opens the .exe directly.
3. **Achievements**: Steamworks → *Stats & Achievements* → *Achievements*. Add one for each row below (API name must
   match exactly), upload `art/achievements/<api name>.png` as the achieved icon and `<api name>_locked.png` as the
   unachieved icon, then **Publish** the changes.
4. **Steam Cloud**: Steamworks → *Application* → *Steam Cloud*: byte quota per user **1048576** (1 MB), number of
   files **4**. Publish. (The game uses the Steam Cloud API, so no Auto-Cloud paths are needed.)
5. **Launch option**: Steamworks → *Installation* → *General*: executable `Gerald Wants Up.exe`, OS Windows.
6. **Build and upload**: `npm run dist`, put your App ID and depot ID into `steampipe/app_build.vdf`, then run the
   `steamcmd` line written at the top of that file. Set the build live in Steamworks → *SteamPipe* → *Builds*.
7. **Store page**: capsule images, 5+ screenshots, a trailer, description, tags. Make the page public as
   "Coming Soon" at least two weeks before launch, and submit the build and the store page for review.

| API name | Name | How to get it |
|---|---|---|
| ACH_FIRST_SPROUT | Sprout | Grow your second plant |
| ACH_RUDE | Rude | Poke Gerald 100 times |
| ACH_CLOUDS | Head in the Clouds | Reach the Cloud Suburbs |
| ACH_PARLIAMENT | Order! Order! | Reach the Bird Parliament |
| ACH_ATTIC | Up in the Attic | Reach the Sky's Attic |
| ACH_MOON | Complaint Filed | Reach THE MOON |
| ACH_LAUNDROMAT | Spin Cycle | Reach the Cosmic Laundromat |
| ACH_SUN | Please Take a Number | Reach the Sun's Waiting Room |
| ACH_FOURTH_WALL | Hello? | Reach the Fourth Wall |
| ACH_ENDLESS | Off Script | Climb past the Fourth Wall into the endless layers |
| ACH_LAYER_10 | Still Going | Reach Layer 10 |
| ACH_COMPOST | Feed the Worm | Compost for the first time |
| ACH_COMPOST_10 | Mountain Maker | Compost 10 times |
| ACH_COMPOST_50 | Mt. Compost | Compost 50 times |
| ACH_SOCKS_100 | Sock Catcher | Catch 100 falling socks |
| ACH_SOCKS_1000 | Sock Hoarder | Catch 1,000 falling socks |
| ACH_BUTLER | At Your Service | Hire the Sock Butler |
| ACH_VISITORS | Weird Guests | Click 25 weird visitors |
| ACH_GOLDEN | Golden Child | Get 1,000 golden beans |
| ACH_QUESTS | Errand Bean | Finish 25 quests |
| ACH_UPGRADES | Fertiliser Enthusiast | Buy 1,000 plant upgrades |
| ACH_PLANTS_50 | Tall Order | Have 50 plants on the stalk at once |
| ACH_MILLION | Bean Millionaire | Earn $1,000,000 in total |
| ACH_GOOGOL | Googol Gardener | Earn a googol dollars ($1e100) in total |
| ACH_HATS | Hat Trick | Collect 10 hats for Gerald |
| ACH_RELICS | Collector | Find 10 relics |

Adding an achievement: add a row to `STEAM.ACH` in `app/js/steam.js` and to the `ACH` list in `tools/art.html`, make
its icons with `npm run art`, and add it in Steamworks.
