// Gerald Wants Up — Steam desktop build (Electron main process).
// Opens the game window and owns the Steam connection (steamworks.js): the signed-in account, achievements,
// Steam Cloud saves, rich presence and the overlay. The game page reaches it through preload.js (window.steamBridge).
const { app, BrowserWindow, ipcMain, Menu, shell, screen } = require('electron');
const path = require('path'), fs = require('fs');
const pkg = require('./package.json');
const DEV = !app.isPackaged;          // developer tools only when running from source (npm start), never in release builds
const APP_ID = Number(process.env.STEAM_APP_ID) || pkg.steamAppId || 480;   // 480 = Valve's test app ("Spacewar") until you have your own
const CLOUD_FILE = 'gerald_save.json';
const SELFTEST = process.argv.includes('--selftest');   // npm run selftest: boots, screenshots, prints Steam status, quits
if (SELFTEST) app.setPath('userData', path.join(app.getPath('temp'), 'gerald-selftest'));   // never touches the real save
// developer copy only (never the release .exe): --profile=NAME uses a separate save, --bot=FILE plays by itself
const argOf = k => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3).replace(/^"|"$/g, '') : null; };
const PROFILE = !app.isPackaged && argOf('profile');
const BOT = !app.isPackaged && argOf('bot');
if (PROFILE) app.setPath('userData', path.join(app.getPath('appData'), 'Gerald Wants Up (' + PROFILE.replace(/[^\w -]/g, '') + ')'));

if (!app.requestSingleInstanceLock()) app.exit(0);     // two copies would fight over the save
// release builds refuse to start with debugging switches (they would let someone poke at the running game)
if (app.isPackaged && process.argv.some(a => /^--(remote-debugging|inspect|js-flags|remote-allow)/i.test(a))) app.exit(0);

/* ---------- Steam ---------- */
let steamworks = null, client = null, why = '';
try {
  steamworks = require('steamworks.js');
  // a shipped build has to be started by Steam: if someone runs the .exe directly, Steam relaunches it properly
  if (app.isPackaged && APP_ID !== 480 && steamworks.restartAppIfNecessary(APP_ID)) app.exit(0);
  if (BOT) throw new Error('bot mode: Steam stays off (no achievements, no cloud)');
  client = steamworks.init(APP_ID);
} catch (e) {
  client = null;
  why = /steam/i.test(String(e && e.message)) ? 'Steam is not running or you are not signed in' : String(e && e.message || e).split('\n')[0];
  console.warn('[steam] offline:', e && e.message);
}
if (client) steamworks.electronEnableSteamOverlay();     // must happen before the app is ready

const safe = (fn, dflt) => { try { return fn(); } catch (e) { return dflt; } };
const cloudOn = () => !SELFTEST && !!client && safe(() => client.cloud.isEnabledForAccount() && client.cloud.isEnabledForApp(), false);
function steamInfo() {
  if (!client) return { ok: false, why: why || 'Steam is not running' };
  return {
    ok: true, appId: APP_ID,
    name: safe(() => client.localplayer.getName(), 'Gardener'),
    steamId: safe(() => String(client.localplayer.getSteamId().steamId64), ''),
    cloud: cloudOn(),
    deck: safe(() => client.utils.isSteamRunningOnSteamDeck(), false),
  };
}

/* ---------- saves: a file copy next to Electron's own storage, plus Steam Cloud ---------- */
const saveFile = () => path.join(app.getPath('userData'), 'save.json');
function writeSave(json) {
  if (typeof json !== 'string' || json.length > 5e6 || !/^GWU4\./.test(json)) return false;   // sealed saves only
  safe(() => { fs.writeFileSync(saveFile() + '.tmp', json); fs.renameSync(saveFile() + '.tmp', saveFile()); });
  if (cloudOn()) safe(() => client.cloud.writeFile(CLOUD_FILE, json));
  return true;
}
ipcMain.on('steam:info', e => { e.returnValue = steamInfo(); });
// Steam's server clock (seconds since 1970): offline rewards use this, so changing the PC's date does nothing
ipcMain.on('steam:time', e => { e.returnValue = client ? safe(() => client.utils.getServerRealTime(), null) : null; });
ipcMain.on('app:selftest', e => { e.returnValue = SELFTEST; });
ipcMain.on('app:bot', e => { e.returnValue = !!BOT; });
ipcMain.on('save:boot', e => {
  e.returnValue = {
    file: safe(() => fs.readFileSync(saveFile(), 'utf8'), null),
    cloud: cloudOn() ? safe(() => (client.cloud.fileExists(CLOUD_FILE) ? client.cloud.readFile(CLOUD_FILE) : null), null) : null,
  };
});
ipcMain.handle('save:write', (e, json) => writeSave(json));
ipcMain.on('save:write-sync', (e, json) => { e.returnValue = writeSave(json); });
ipcMain.on('save:wipe', e => {
  safe(() => fs.unlinkSync(saveFile()));
  if (cloudOn()) safe(() => client.cloud.deleteFile(CLOUD_FILE));
  e.returnValue = true;
});

/* ---------- achievements, overlay, rich presence ---------- */
ipcMain.handle('ach:unlock', (e, id) => {
  if (!client || typeof id !== 'string' || !/^ACH_[A-Z0-9_]+$/.test(id)) return false;
  const ok = safe(() => client.achievement.activate(id), false);
  safe(() => client.stats.store());          // makes Steam show its popup and keep it
  return ok;
});
ipcMain.on('ach:list', (e, ids) => {
  e.returnValue = client && Array.isArray(ids) ? ids.filter(id => safe(() => client.achievement.isActivated(id), false)) : [];
});
ipcMain.handle('steam:overlay', (e, which) => { if (client) safe(() => client.overlay.activateDialog(which === 'achievements' ? 6 : 0)); });
ipcMain.handle('steam:presence', (e, text) => { if (client) safe(() => client.localplayer.setRichPresence('status', String(text).slice(0, 250))); });

/* ---------- window ---------- */
let win = null;
const prefsFile = () => path.join(app.getPath('userData'), 'window.json');
const prefs = () => safe(() => JSON.parse(fs.readFileSync(prefsFile(), 'utf8')), {});
const savePrefs = p => safe(() => fs.writeFileSync(prefsFile(), JSON.stringify(Object.assign(prefs(), p))));
ipcMain.handle('win:fullscreen', (e, on) => { if (win) { win.setFullScreen(!!on); savePrefs({ full: !!on }); } });
ipcMain.on('win:isfull', e => { e.returnValue = !!(win && win.isFullScreen()); });
ipcMain.handle('app:quit', () => app.quit());

function createWindow() {
  const wa = screen.getPrimaryDisplay().workAreaSize, p = prefs(), deck = !!(client && steamInfo().deck);
  win = new BrowserWindow({
    width: Math.min(1440, wa.width), height: Math.min(900, wa.height), minWidth: 900, minHeight: 560,
    fullscreen: !BOT && (deck || !!p.full), backgroundColor: '#1d0f2b', title: BOT ? 'Gerald Wants Up - BOT' : 'Gerald Wants Up', show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: DEV, spellcheck: false, backgroundThrottling: !BOT },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  // the game never navigates anywhere; any web link opens in the normal browser instead
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) e.preventDefault(); });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) { e.preventDefault(); win.setFullScreen(!win.isFullScreen()); savePrefs({ full: win.isFullScreen() }); }
    else if (DEV && input.key === 'F12') win.webContents.toggleDevTools();
  });
  win.on('closed', () => { win = null; });
  if (SELFTEST) selftest();
  if (BOT) {          // the bot plays through the page like a person: it reads the screen and clicks (see bot/bot.js)
    win.on('page-title-updated', e => e.preventDefault());
    win.webContents.on('did-finish-load', () => {
      let code = '';
      try { code = fs.readFileSync(BOT, 'utf8'); } catch (e) { console.error('[bot] cannot read', BOT, e.message); return; }
      win.webContents.executeJavaScript(code).catch(e => console.error('[bot] crashed:', e && e.message));
    });
    win.webContents.on('console-message', (e, level, msg) => { if (/^\[bot\]/.test(msg) || level >= 3) console.log(msg); });
    const test = +process.env.GWU_BOT_TEST || 0;        // developer check: run the bot N seconds, report, screenshot, quit
    if (test) setTimeout(async () => {
      const r = await win.webContents.executeJavaScript('JSON.stringify({ hud: document.getElementById("botHud").innerText, money: document.getElementById("hudMoney").textContent, goal: document.getElementById("objSub").textContent })').catch(e => e.message);
      console.log('[bot-test]', r);
      fs.writeFileSync(path.join(app.getPath('temp'), 'gerald-bot-test.png'), (await win.webContents.capturePage()).toPNG());
      app.quit();
    }, test * 1000);
  }
}
async function selftest() {
  const out = path.join(app.getPath('temp'), 'gerald-selftest'), wc = win.webContents, wait = ms => new Promise(r => setTimeout(r, ms));
  wc.on('console-message', (e, level, msg) => { if (level >= 2) console.log('[page]', msg); });
  await new Promise(r => wc.once('did-finish-load', r)); await wait(2500);
  const js = s => wc.executeJavaScript(s);
  console.log('[selftest] title', await js('const { STEAM, GUARD } = window.__gwu; JSON.stringify({ steam: STEAM.info, who: document.getElementById("steamWho").textContent, fonts: document.fonts.check("20px Chewy"), unlocked: Object.keys(STEAM.got).length, steamClock: GUARD.CLOCK.src() })'));
  fs.writeFileSync(path.join(out, 'title.png'), (await wc.capturePage()).toPNG());
  await js('{ const { G, MAIN, UI } = window.__gwu; G.S.flags.intro = 1; G.S.flags.tut = 1; MAIN.start(); setTimeout(() => { UI.closeModal(); UI.setTab("settings"); }, 800); true }'); await wait(3000);
  console.log('[selftest] game', await js('{ const { G, GUARD } = window.__gwu; JSON.stringify({ started: G.started, ach: document.getElementById("stAchN").textContent, sub: document.getElementById("stSub").textContent, clockSynced: !!GUARD.CLOCK.anchor, serverMinusPc: GUARD.CLOCK.anchor ? Math.round((GUARD.CLOCK.now() - Date.now()) / 1000) : null, sealed: (localStorage.getItem("gwu4") || "").slice(0, 5) }) }'));
  console.log('[selftest] page globals reachable:', await js('["G", "GAME", "STATE", "ECON", "GUARD"].filter(n => { try { return typeof eval(n) !== "undefined"; } catch (e) { return false; } }).join(",") || "none"'));
  fs.writeFileSync(path.join(out, 'game.png'), (await wc.capturePage()).toPNG());
  console.log('[selftest] screenshots in', out);
  app.quit();
}
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
