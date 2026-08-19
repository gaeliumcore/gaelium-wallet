// Preload of the confirmation window, and of nothing else.
//
// This window must never load preload.js. That file exposes the whole bridge,
// dumpPrivKey and prepareSend included, and handing it to the very window whose
// job is to guard those calls would undo the entire exercise.
//
// The name matters. A bridge exposed under a name window already carries, such
// as confirm, does not replace it. The native property wins, the first line of
// the window's script throws, and nothing is wired: the buttons are drawn and
// answer to nothing. The name below exists nowhere else.
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
