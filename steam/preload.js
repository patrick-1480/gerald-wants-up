// Gerald Wants Up — the only bridge between the game page and Electron/Steam (see main.js).
// The page gets window.steamBridge; it never touches Node or Steam directly.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('steamBridge', {
  info: () => ipcRenderer.sendSync('steam:info'),
  serverTime: () => ipcRenderer.sendSync('steam:time'),
  isSelftest: () => ipcRenderer.sendSync('app:selftest'),
  isBot: () => ipcRenderer.sendSync('app:bot'),
  bootSaves: () => ipcRenderer.sendSync('save:boot'),
  writeSave: json => ipcRenderer.invoke('save:write', json),
  writeSaveSync: json => ipcRenderer.sendSync('save:write-sync', json),   // used while closing, so nothing is lost
  wipeSave: () => ipcRenderer.sendSync('save:wipe'),
  unlock: id => ipcRenderer.invoke('ach:unlock', id),
  unlocked: ids => ipcRenderer.sendSync('ach:list', ids),
  overlay: which => ipcRenderer.invoke('steam:overlay', which),
  presence: text => ipcRenderer.invoke('steam:presence', text),
  fullscreen: on => ipcRenderer.invoke('win:fullscreen', on),
  isFullscreen: () => ipcRenderer.sendSync('win:isfull'),
  quit: () => ipcRenderer.invoke('app:quit'),
});
