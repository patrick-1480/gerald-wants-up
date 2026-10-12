// Gerald Wants Up — Steam desktop build (Electron main process).
// Opens the game window and owns the Steam connection (steamworks.js): the signed-in account, achievements,
// Steam Cloud saves, rich presence and the overlay. The game page reaches it through preload.js (window.steamBridge).
const { app, BrowserWindow, ipcMain, Menu, shell, screen } = require('electron');
const path = require('path'), fs = require('fs');
const pkg = require('./package.json');
const DEV = process.argv.includes('--dev') || !app.isPackaged;
const APP_ID = Number(process.env.STEAM_APP_ID) || pkg.steamAppId || 480;   // 480 = Valve's test app ("Spacewar") until you have your own
const CLOUD_FILE = 'gerald_save.json';
const SELFTEST = process.argv.includes('--selftest');   // npm run selftest: boots, screenshots, prints Steam status, quits
if (SELFTEST) app.setPath('userData', path.join(app.getPath('temp'), 'gerald-selftest'));   // never touches the real save

if (!app.requestSingleInstanceLock()) app.exit(0);     // two copies would fight over the save

/* ---------- Steam ---------- */
let steamworks = null, client = null, why = '';
try {
  steamworks = require('steamworks.js');
  // a shipped build has to be started by Steam: if someone runs the .exe directly, Steam relaunches it properly
  if (app.isPackaged && APP_ID !== 480 && steamworks.restartAppIfNecessary(APP_ID)) app.exit(0);
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
  if (typeof json !== 'string' || json.length > 5e6 || json[0] !== '{') return false;
  safe(() => { fs.writeFileSync(saveFile() + '.tmp', json); fs.renameSync(saveFile() + '.tmp', saveFile()); });
  if (cloudOn()) safe(() => client.cloud.writeFile(CLOUD_FILE, json));
  return true;
}
ipcMain.on('steam:info', e => { e.returnValue = steamInfo(); });
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
    fullscreen: deck || !!p.full, backgroundColor: '#1d0f2b', title: 'Gerald Wants Up', show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: DEV, spellcheck: false },
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
}
async function selftest() {
  const out = path.join(app.getPath('temp'), 'gerald-selftest'), wc = win.webContents, wait = ms => new Promise(r => setTimeout(r, ms));
  wc.on('console-message', (e, level, msg) => { if (level >= 2) console.log('[page]', msg); });
  await new Promise(r => wc.once('did-finish-load', r)); await wait(2500);
  const js = s => wc.executeJavaScript(s);
  console.log('[selftest] title', await js('JSON.stringify({ steam: STEAM.info, who: document.getElementById("steamWho").textContent, fonts: document.fonts.check("20px Chewy"), unlocked: Object.keys(STEAM.got).length })'));
  fs.writeFileSync(path.join(out, 'title.png'), (await wc.capturePage()).toPNG());
  await js('G.S.flags.intro = 1; G.S.flags.tut = 1; MAIN.start(); UI.closeModal(); UI.setTab("settings"); true'); await wait(2500);
  console.log('[selftest] game', await js('JSON.stringify({ started: G.started, ach: document.getElementById("stAchN").textContent, sub: document.getElementById("stSub").textContent })'));
  fs.writeFileSync(path.join(out, 'game.png'), (await wc.capturePage()).toPNG());
  console.log('[selftest] screenshots in', out);
  app.quit();
}
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
