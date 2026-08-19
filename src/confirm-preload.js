// Preload of the confirmation window, and of nothing else.
//
// This window must never load preload.js. That file exposes the whole bridge,
// dumpPrivKey and prepareSend included, and handing it to the very window whose
// job is to guard those calls would undo the entire exercise.
//
// The name matters. The first version of this file used 'confirm', which is
// already a method of window in every browser. Exposing on top of it left
// window.confirm as the native function, so the first line of the window's
// script threw, nothing was wired, and the user faced a window with two blank
// buttons that answered to nothing. The name below exists nowhere else.
//
// Three functions. Receive what the main process decided to display, tell it the
// display actually happened, and send back yes or no. No wallet, no daemon, no
// file system, no network.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('gaeliumConfirm', {
  onData: (cb) => ipcRenderer.on('confirm-data', (event, data) => { try { cb(data); } catch (e) {} }),
  ready: () => ipcRenderer.send('confirm-ready'),
  answer: (approved) => ipcRenderer.send('confirm-answer', approved === true)
});
