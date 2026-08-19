// Preload of the confirmation window, and of nothing else.
//
// This window must never load preload.js. That file exposes the whole bridge,
// dumpPrivKey and prepareSend included, and handing it to the very window whose
// job is to guard those calls would undo the entire exercise.
//
// Two functions. One to receive what the main process decided to display, one to
// send back yes or no. No wallet, no daemon, no file system, no network.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('confirm', {
  onData: (cb) => ipcRenderer.on('confirm-data', (event, data) => { try { cb(data); } catch (e) {} }),
  answer: (approved) => ipcRenderer.send('confirm-answer', approved === true)
});
