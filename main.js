const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const http = require('http');
const https = require('https');
const path = require('path');

// Force Electron to store its data inside the Gaelium datadir
const electronDataDir = process.platform === 'win32' ? path.join(require('os').homedir(), 'AppData', 'Roaming', 'Gaelium', 'electron') : path.join(require('os').homedir(), '.gaelium', 'electron');
app.setPath('userData', electronDataDir);
const fs = require('fs');
const { spawn } = require('child_process');

// RPC Config
const RPC_USER = 'gaelrpc';
const RPC_PORT = 18080;

// Read existing password from config or generate once
function getRpcPassword() {
  const dataDir = process.platform === 'win32' ? path.join(app.getPath('appData'), 'Gaelium') : path.join(require('os').homedir(), '.gaelium');
  const confPath = path.join(dataDir, 'gaelium.conf');
  if (fs.existsSync(confPath)) {
    const conf = fs.readFileSync(confPath, 'utf8');
    const match = conf.match(/rpcpassword=(.+)/);
    if (match) return match[1].trim();
  }
  return 'gaelwallet_' + require('crypto').randomBytes(16).toString('hex');
}
let RPC_PASS = null;

let daemonProcess = null;
let mainWindow = null;

// Get the daemon path
function getDaemonPath() {
  if (app.isPackaged) {
    const ext = process.platform === 'win32' ? '.exe' : '';
    return path.join(process.resourcesPath, 'daemon', 'gaeliumd' + ext);
  }
  const ext2 = process.platform === 'win32' ? '.exe' : '';
    return path.join(__dirname, 'daemon', 'gaeliumd' + ext2);
}

// Get or create data directory
function getDataDir() {
  const dataDir = process.platform === 'win32' ? path.join(app.getPath('appData'), 'Gaelium') : path.join(require('os').homedir(), '.gaelium');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

// Create gaelium.conf if needed
function ensureConfig() {
  const dataDir = getDataDir();
  const confPath = path.join(dataDir, 'gaelium.conf');
  
  if (!fs.existsSync(confPath)) {
    if (!RPC_PASS) RPC_PASS = getRpcPassword();
    const config = `rpcuser=${RPC_USER}
rpcpassword=${RPC_PASS}
server=1
listen=1
addnode=seed1.gaelium.io
addnode=seed2.gaelium.io
addnode=seed3.gaelium.io
`;
    fs.writeFileSync(confPath, config);
  } else {
    RPC_PASS = getRpcPassword();
  }
  return dataDir;
}

// Start the daemon
function startDaemon() {
  return new Promise((resolve) => {
    const dataDir = ensureConfig();
    const daemonPath = getDaemonPath();
    
    console.log('Starting daemon:', daemonPath);
    console.log('Data dir:', dataDir);
    
    daemonProcess = spawn(daemonPath, [
      `-datadir=${dataDir}`,
      `-rpcport=${RPC_PORT}`
    ], {
      detached: false,
      stdio: 'ignore'
    });

    daemonProcess.on('error', (err) => {
      console.error('Daemon error:', err);
    });

    daemonProcess.on('exit', (code) => {
      console.log('Daemon exited with code:', code);
      daemonProcess = null;
    });

    // Wait for RPC to be ready
    let attempts = 0;
    const checkRPC = setInterval(() => {
      attempts++;
      rpcCall('getblockchaininfo').then(() => {
        clearInterval(checkRPC);
        console.log('Daemon RPC ready after', attempts, 'attempts');
        resolve(true);
      }).catch(() => {
        if (attempts > 30) {
          clearInterval(checkRPC);
          console.error('Daemon RPC timeout');
          resolve(false);
        }
      });
    }, 500);
  });
}

// Stop the daemon gracefully and wait for it to fully exit
function stopDaemon() {
  return new Promise((resolve) => {
    if (!daemonProcess) { resolve(); return; }
    const dp = daemonProcess;
    if (dp.exitCode !== null) { daemonProcess = null; resolve(); return; }
    const timeout = setTimeout(() => {
      try { dp.kill('SIGKILL'); } catch(e) {}
      daemonProcess = null;
      resolve();
    }, 30000);
    dp.once('exit', () => {
      clearTimeout(timeout);
      daemonProcess = null;
      resolve();
    });
    rpcCall('stop').catch(() => {
      try { dp.kill(); } catch(e) {}
    });
  });
}

// RPC Call function
function rpcCall(method, params = []) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: '1.0',
      id: Date.now(),
      method: method,
      params: params
    });

    const options = {
      hostname: '127.0.0.1',
      port: RPC_PORT,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(RPC_USER + ':' + RPC_PASS).toString('base64')
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.error) reject(parsed.error);
          else resolve(parsed.result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.setTimeout(10000, () => { req.destroy(); reject(new Error('RPC timeout')); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0f1a',
    icon: path.join(__dirname, 'src/assets/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('src/index.html');
  // After encryption relaunch, navigate to security page
  const navArg = process.argv.find(a => a.startsWith('--navigate='));
  if (navArg) {
    const allowedPages = ['overview', 'send', 'receive', 'transactions', 'security', 'import'];
    const page = navArg.split('=')[1];
    if (allowedPages.includes(page)) {
      mainWindow.webContents.once('did-finish-load', () => {
        setTimeout(() => mainWindow.webContents.send('navigate-to', page), 1000);
      });
    }
  }

  // Enable right-click context menu for copy/paste
  mainWindow.webContents.on('context-menu', (event, params) => {
    const { Menu, MenuItem } = require('electron');
    const menu = new Menu();
    if (params.selectionText) {
      menu.append(new MenuItem({ label: 'Copy', role: 'copy' }));
    }
    if (params.isEditable) {
      menu.append(new MenuItem({ label: 'Paste', role: 'paste' }));
      menu.append(new MenuItem({ label: 'Cut', role: 'cut' }));
      menu.append(new MenuItem({ label: 'Select All', role: 'selectAll' }));
    }
    if (menu.items.length > 0) menu.popup();
  });
}

// App lifecycle
if (process.platform === 'linux') { app.commandLine.appendSwitch('disable-gpu'); }

// Install icon and create application menu entry on Linux first launch
if (process.platform === 'linux') {
  const os = require('os');
  const homeDir = os.homedir();
  const iconDir = path.join(homeDir, '.local', 'share', 'icons');
  const appDir = path.join(homeDir, '.local', 'share', 'applications');
  const iconDest = path.join(iconDir, 'gaelium.png');
  const desktopFile = path.join(appDir, 'gaelium-wallet.desktop');
  const appImagePath = process.env.APPIMAGE || process.execPath;

  // Install icon from AppImage resources
  if (!fs.existsSync(iconDest)) {
    try {
      fs.mkdirSync(iconDir, { recursive: true });
      // Try to find icon in resources
      const iconSrc = path.join(process.resourcesPath, '..', 'gaelium-wallet.png');
      const iconSrc2 = path.join(__dirname, 'src', 'assets', 'icon.png');
      if (fs.existsSync(iconSrc)) {
        fs.copyFileSync(iconSrc, iconDest);
      } else if (fs.existsSync(iconSrc2)) {
        fs.copyFileSync(iconSrc2, iconDest);
      }
    } catch(e) { console.log('Could not install icon:', e); }
  }

  // Create application menu entry
  if (!fs.existsSync(desktopFile)) {
    try {
      fs.mkdirSync(appDir, { recursive: true });
      const desktopEntry = `[Desktop Entry]
Name=Gaelium Wallet
Comment=Gaelium Cryptocurrency Wallet
Exec="${appImagePath}"
Icon=${iconDest}
Terminal=false
Type=Application
Categories=Utility;
StartupWMClass=gaelium-wallet
`;
      fs.writeFileSync(desktopFile, desktopEntry);
      fs.chmodSync(desktopFile, '755');
      // Update desktop database
      const { execSync } = require('child_process');
      try { execSync('update-desktop-database ' + appDir); } catch(e) {}
    } catch(e) { console.log('Could not create menu entry:', e); }
  }
}

app.whenReady().then(async () => {
  // Check for pending wallet restore
  const restoreDataDir = getDataDir();
  const pendingFile = path.join(restoreDataDir, 'restore-pending.txt');
  if (fs.existsSync(pendingFile)) {
    const restoreFrom = fs.readFileSync(pendingFile, 'utf8').trim();
    const walletDest = path.join(restoreDataDir, 'wallet.dat');
    // Kill our spawned daemon process only (not all gaeliumd instances)
    if (daemonProcess && daemonProcess.pid) {
      try { process.kill(daemonProcess.pid, 'SIGKILL'); } catch(e) {}
      daemonProcess = null;
    }
    // Remove BDB environment files so daemon accepts the new wallet
    try { fs.unlinkSync(path.join(restoreDataDir, '.lock')); } catch(e) {}
    try { fs.unlinkSync(path.join(restoreDataDir, 'db.log')); } catch(e) {}
    const dbDir = path.join(restoreDataDir, 'database');
    if (fs.existsSync(dbDir)) {
      try { fs.readdirSync(dbDir).forEach(f => fs.unlinkSync(path.join(dbDir, f))); fs.rmdirSync(dbDir); } catch(e) {}
    }
    try { fs.readdirSync(restoreDataDir).filter(f => f.startsWith('__db.')).forEach(f => fs.unlinkSync(path.join(restoreDataDir, f))); } catch(e) {}
    try { fs.readdirSync(restoreDataDir).filter(f => f.startsWith('wallet.dat.') && f.endsWith('.bak')).forEach(f => fs.unlinkSync(path.join(restoreDataDir, f))); } catch(e) {}
    // Copy the restored wallet
    try { fs.copyFileSync(restoreFrom, walletDest); } catch(e) {}
    // Remove flag
    try { fs.unlinkSync(pendingFile); } catch(e) {}
  }
  createWindow();
  await startDaemon();
});

app.on('window-all-closed', async () => {
  await stopDaemon();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async (event) => {
  if (daemonProcess) {
    event.preventDefault();
    await stopDaemon();
    app.quit();
  }
});

// Window controls
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

// RPC handlers
ipcMain.handle('rpc-getbalance', async () => {
  try {
    const balance = await rpcCall('getbalance');
    const unconfirmed = await rpcCall('getunconfirmedbalance');
    const info = await rpcCall('getblockchaininfo');
    const networkInfo = await rpcCall('getnetworkinfo');
    const miningInfo = await rpcCall('getmininginfo');
    const walletInfo = await rpcCall('getwalletinfo');

    let btcPrice = 0, ethPrice = 0, xmrPrice = 0, dogePrice = 0, solPrice = 0, btcEur = 0, ethEur = 0, xmrEur = 0, dogeEur = 0, solEur = 0;
    try {
      const prices = await new Promise((res) => {
        const req = https.request({hostname:'api.coingecko.com',path:'/api/v3/simple/price?ids=bitcoin,ethereum,monero,dogecoin,solana&vs_currencies=usd,eur',headers:{'User-Agent':'GaeliumWallet/1.0'}}, (r) => {
          let b=''; r.on('data',c=>b+=c); r.on('end',()=>{try{res(JSON.parse(b));}catch(e){res(null);}});
        }); req.on('error',()=>res(null)); req.end();
      });
      if(prices && prices.bitcoin) {
        btcPrice = prices.bitcoin.usd;
        ethPrice = prices.ethereum.usd;
        xmrPrice = prices.monero.usd;
        dogePrice = prices.dogecoin.usd;
        solPrice = prices.solana.usd;
        btcEur = prices.bitcoin.eur;
        ethEur = prices.ethereum.eur;
        xmrEur = prices.monero.eur;
        dogeEur = prices.dogecoin.eur;
        solEur = prices.solana.eur;
      }
    } catch(e) {}

    return {
      btcPrice, ethPrice, xmrPrice, dogePrice, solPrice, btcEur, ethEur, xmrEur, dogeEur, solEur,
      balance: balance,
      unconfirmed: unconfirmed,
      immature: walletInfo.immature_balance || 0,
      blocks: info.blocks,
      headers: info.headers,
      connections: networkInfo.connections,
      networkhashps: miningInfo.networkhashps,
      difficulty: miningInfo.difficulty
    };
  } catch (e) {
    return { error: e.message || String(e) };
  }
});

ipcMain.handle('rpc-listtransactions', async (event, count, skip) => {
  try {
    return await rpcCall('listtransactions', ['*', count || 10, skip || 0]);
  } catch (e) {
    return { error: e.message || String(e) };
  }
});

ipcMain.handle('rpc-getnewaddress', async (event, label) => {
  try {
    return await rpcCall('getnewaddress', [label || '']);
  } catch (e) {
    return { error: e.message || String(e) };
  }
});
ipcMain.handle('rpc-listreceivedbyaddress', async () => {
  try {
    return await rpcCall('listreceivedbyaddress', [0, true]);
  } catch (e) {
    return { error: e.message || String(e) };
  }
});

ipcMain.handle('rpc-sendtoaddress', async (event, address, amount) => {
  try {
    // Validate amount is a positive finite number
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      return { error: 'Invalid amount: must be a positive number' };
    }
    // Validate address is a non-empty string
    if (typeof address !== 'string' || address.trim().length === 0) {
      return { error: 'Invalid address: must be a non-empty string' };
    }
    // Step 1: Get unspent outputs to find the source address
    const utxos = await rpcCall('listunspent', [0, 9999999]);
    if (!utxos || utxos.length === 0) {
      return { error: 'No funds available' };
    }
    // Find the source address (address with the most funds)
    const addrBalances = {};
    utxos.forEach(u => {
      addrBalances[u.address] = (addrBalances[u.address] || 0) + u.amount;
    });
    let changeAddress = Object.keys(addrBalances).reduce((a, b) => addrBalances[a] > addrBalances[b] ? a : b);

    // Step 2: Create raw transaction (empty inputs, daemon will pick them)
    const rawTx = await rpcCall('createrawtransaction', [[], { [address]: amount }]);

    // Step 3: Fund the transaction with changeAddress forced to source
    const funded = await rpcCall('fundrawtransaction', [rawTx, { changeAddress: changeAddress }]);

    // Step 4: Sign the transaction
    const signed = await rpcCall('signrawtransaction', [funded.hex]);
    if (!signed.complete) {
      return { error: 'Transaction signing failed. Is your wallet locked?' };
    }

    // Step 5: Send the transaction
    const txid = await rpcCall('sendrawtransaction', [signed.hex]);
    return txid;
  } catch (e) {
    return { error: e.message || String(e) };
  }
});

ipcMain.handle('rpc-validateaddress', async (event, address) => {
  try {
    return await rpcCall('validateaddress', [address]);
  } catch (e) {
    return { error: e.message || String(e) };
  }
});

ipcMain.handle('rpc-encryptwallet', async (event, passphrase) => {
  try {
    await rpcCall('encryptwallet', [passphrase]);
  } catch (e) {
    // encryptwallet always errors because daemon shuts down - this is normal
  }
  // Wait for daemon to finish its shutdown (encryptwallet triggers auto-shutdown)
  if (daemonProcess) {
    await new Promise((resolve) => {
      const dp = daemonProcess;
      if (!dp || dp.exitCode !== null) { daemonProcess = null; resolve(); return; }
      const timeout = setTimeout(() => { try { dp.kill('SIGKILL'); } catch(e) {} resolve(); }, 30000);
      dp.once('exit', () => { clearTimeout(timeout); resolve(); });
    });
    daemonProcess = null;
  }
  // Relaunch: use original portable exe if available
  const execPath = process.env.PORTABLE_EXECUTABLE_FILE || process.env.APPIMAGE || process.execPath;
  const { spawn: spawnProc } = require('child_process');
  // Spawn detached so it survives our exit
  const child = spawnProc(execPath, ['--navigate=security'], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  // Give the new process time to start extracting before we exit
  await new Promise(r => setTimeout(r, 1500));
  app.exit(0);
  return { success: true };
});
ipcMain.handle('rpc-walletpassphrase', async (event, passphrase, timeout) => {
  try {
    return await rpcCall('walletpassphrase', [passphrase, timeout || 60]);
  } catch (e) {
    return { error: e.message || String(e) };
  }
});

ipcMain.handle('rpc-walletlock', async () => {
  try {
    return await rpcCall('walletlock', []);
  } catch (e) {
    return { error: e.message || String(e) };
  }
});
ipcMain.handle('rpc-getwalletinfo', async () => {
  try {
    return await rpcCall('getwalletinfo', []);
  } catch (e) {
    return { error: e.message || String(e) };
  }
});
ipcMain.handle('rpc-walletpassphrasechange', async (event, oldPass, newPass) => {
  try {
    return await rpcCall('walletpassphrasechange', [oldPass, newPass]);
  } catch (e) {
    return { error: e.message || String(e) };
  }
});

ipcMain.handle('rpc-importprivkey', async (event, privkey, label, rescan) => {
  try {
    return await rpcCall('importprivkey', [privkey, label || '', rescan !== false]);
  } catch (e) {
    return { error: e.message || String(e) };
  }
});
ipcMain.handle('rpc-dumpprivkey', async (event, address) => {
  try {
    return await rpcCall('dumpprivkey', [address]);
  } catch (e) {
    return { error: e.message || String(e) };
  }
});
ipcMain.handle('backup-wallet', async () => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Backup Wallet',
      defaultPath: 'wallet-backup.dat',
      filters: [{ name: 'Wallet Files', extensions: ['dat'] }]
    });
    if (result.canceled) return { canceled: true };
    // Use RPC backupwallet for a clean BerkeleyDB copy
    await rpcCall('backupwallet', [result.filePath]);
    return { success: true, path: result.filePath };
  } catch (e) {
    return { error: e.message || String(e) };
  }
});
// Address metadata storage
ipcMain.handle('load-address-meta', async () => {
  try {
    const metaPath = path.join(getDataDir(), 'addresses.json');
    if (fs.existsSync(metaPath)) return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    return {};
  } catch(e) { return {}; }
});
ipcMain.handle('save-address-meta', async (event, data) => {
  try {
    const metaPath = path.join(getDataDir(), 'addresses.json');
    fs.writeFileSync(metaPath, JSON.stringify(data, null, 2));
    return { success: true };
  } catch(e) { return { error: e.message }; }
});

ipcMain.handle('restore-wallet', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Wallet Backup',
      filters: [{ name: 'Wallet Files', extensions: ['dat'] }, { name: 'All Files', extensions: ['*'] }],
      properties: ['openFile']
    });
    if (result.canceled || !result.filePaths.length) return { cancelled: true };
    const selectedFile = result.filePaths[0];
    const dataDir = getDataDir();
    const walletPath = path.join(dataDir, 'wallet.dat');
    // Auto-backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const autoBackup = path.join(dataDir, 'wallet-pre-restore-' + timestamp + '.dat');
    if (fs.existsSync(walletPath)) {
      fs.copyFileSync(walletPath, autoBackup);
    }
    // Write flag file for next launch
    const pendingFile = path.join(dataDir, 'restore-pending.txt');
    fs.writeFileSync(pendingFile, selectedFile);
    // Stop daemon and set to null so before-quit doesnt block
    try { await rpcCall('stop'); } catch(e) {}
    if (daemonProcess) {
      await new Promise((resolve) => {
        const timeout = setTimeout(() => { try { daemonProcess.kill('SIGKILL'); } catch(e) {} resolve(); }, 30000);
        daemonProcess.once('exit', () => { clearTimeout(timeout); resolve(); });
      });
    }
    daemonProcess = null;
    // Relaunch: same method as encrypt (spawn + exit)
    const execPath = process.env.PORTABLE_EXECUTABLE_FILE || process.env.APPIMAGE || process.execPath;
    const { spawn: spawnProc } = require('child_process');
    const child = spawnProc(execPath, ['--navigate=security'], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    await new Promise(r => setTimeout(r, 1500));
    app.exit(0);
    return { success: true };
  } catch (e) {
    return { error: e.message || String(e) };
  }
});
