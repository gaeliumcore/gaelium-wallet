const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');

// The explorer address is built here and nowhere else. shell.openExternal hands
// a string to the operating system, which will honour schemes that have nothing
// to do with the web, so the renderer is never allowed to supply a URL. It sends
// a transaction id, this process checks it against the pattern below, and only
// then does it build the address from this fixed base.
const EXPLORER_BASE_URL = 'https://explorer.gaelium.io';
const TXID_PATTERN = /^[0-9a-fA-F]{64}$/;
const http = require('http');
const https = require('https');
const path = require('path');

// Force Electron to store its data inside the Gaelium datadir
const electronDataDir = process.platform === 'win32' ? path.join(require('os').homedir(), 'AppData', 'Roaming', 'Gaelium', 'electron') : path.join(require('os').homedir(), '.gaelium', 'electron');
app.setPath('userData', electronDataDir);
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');

// Capture exec path at startup before env can be tampered with
const SELF_EXEC_PATH = process.env.PORTABLE_EXECUTABLE_FILE || process.env.APPIMAGE || process.execPath;

// RPC Config
const RPC_PORT = 18080;
// The name every installation used before it was generated. Kept because a
// config that exists but names no user has to keep behaving as it did.
const DEFAULT_RPC_USER = 'gaelrpc';
let RPC_USER = null;

// Market prices. Fetched apart from the balance handler so a slow or
// unreachable CoinGecko never delays the wallet balance.
const MARKET_IDS = 'bitcoin,ethereum,monero,dogecoin,gaelium';
const MARKET_MIN_INTERVAL_MS = 60000;
let marketCache = null;        // { prices, fetchedAt }
let marketLastAttempt = 0;

// Deliberately not getDataDir, which creates the directory. Reading credentials
// must not have that side effect.
function getConfPath() {
  const dataDir = process.platform === 'win32' ? path.join(app.getPath('appData'), 'Gaelium') : path.join(require('os').homedir(), '.gaelium');
  return path.join(dataDir, 'gaelium.conf');
}

// Read the existing user from the config, or generate one for a fresh install.
// The config is the authority, exactly as it already is for the password. That
// is what makes this safe to change: an installation that already has a config
// keeps whatever name that config carries, so it can still reach a daemon that
// an earlier version started, both right now and at every later launch. Only a
// machine with no config at all ever sees a generated name.
function generateRpcUser() {
  return 'gaelrpc_' + require('crypto').randomBytes(12).toString('hex');
}
function generateRpcPassword() {
  return 'gaelwallet_' + require('crypto').randomBytes(16).toString('hex');
}

// Both reads require the start of a line. Without that anchor a commented out
// line such as #rpcpassword=old was picked up as though it were live, and the
// wallet then authenticated with a value the daemon had never seen.
const RPCUSER_VALUE = /^rpcuser=(.+)$/m;
const RPCPASSWORD_VALUE = /^rpcpassword=(.+)$/m;
// Presence of the key at all, empty value included. Used to decide whether a
// line has to be added, so that a line reading rpcuser= with nothing after it
// is left alone rather than joined by a second one. Config parsing keeps the
// first occurrence of a key, so adding a duplicate would not take effect and
// would leave the file harder to read than it was.
const RPCUSER_KEY = /^rpcuser=/m;
const RPCPASSWORD_KEY = /^rpcpassword=/m;

function getRpcUser() {
  const confPath = getConfPath();
  if (fs.existsSync(confPath)) {
    const conf = fs.readFileSync(confPath, 'utf8');
    const match = conf.match(RPCUSER_VALUE);
    if (match) return match[1].trim();
    // A config with no usable user line is left as it is. Answering with the
    // name this wallet has always assumed keeps that case exactly as it was.
    return DEFAULT_RPC_USER;
  }
  return generateRpcUser();
}

// Read existing password from config or generate once
function getRpcPassword() {
  const confPath = getConfPath();
  if (fs.existsSync(confPath)) {
    const conf = fs.readFileSync(confPath, 'utf8');
    const match = conf.match(RPCPASSWORD_VALUE);
    if (match) return match[1].trim();
  }
  return generateRpcPassword();
}

// Add a credential line that a config is missing. The wallet and the daemon read
// the same file, so a config carrying only one of the two leaves them unable to
// agree on what to use, and the wallet generated a value the daemon never saw.
//
// Only missing lines are added, at the end. Everything already in the file is
// carried over as one untouched string, so existing lines, comments, blank lines
// and ordering survive exactly as they were. The write goes to a neighbouring
// file and is renamed onto the target, so an interruption leaves the previous
// config rather than a truncated one.
function repairConfCredentials() {
  const confPath = getConfPath();
  if (!fs.existsSync(confPath)) return;
  const conf = fs.readFileSync(confPath, 'utf8');
  const additions = [];
  if (!RPCUSER_KEY.test(conf)) additions.push('rpcuser=' + generateRpcUser());
  if (!RPCPASSWORD_KEY.test(conf)) additions.push('rpcpassword=' + generateRpcPassword());
  if (additions.length === 0) return;
  // Match the line endings the file already uses, so a config written on
  // Windows does not end up with a mixture.
  const eol = conf.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
  // A file that does not end with a line break would otherwise have its last
  // line run into the first addition.
  const joiner = (conf.length === 0 || conf.endsWith('\n')) ? '' : eol;
  const tmpPath = confPath + '.tmp';
  fs.writeFileSync(tmpPath, conf + joiner + additions.join(eol) + eol);
  fs.renameSync(tmpPath, confPath);
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
    if (!RPC_USER) RPC_USER = getRpcUser();
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
    // Repaired before the values are read, so the wallet picks up whatever was
    // just added, and before the daemon is started a few lines further on, so
    // the daemon reads the same file in the same state.
    repairConfCredentials();
    RPC_USER = getRpcUser();
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

    // The window is created before the daemon is started, so a call can reach
    // here before ensureConfig has run. Resolving the user on the spot removes
    // that ordering from the picture.
    if (!RPC_USER) RPC_USER = getRpcUser();
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

// The window used to be destroyed the instant the close button was pressed, and
// only then was the daemon asked to stop. That left the application running with
// nothing on screen for as long as the daemon took to flush its databases, up to
// the thirty seconds the wait allows. Anyone who read that silence as a freeze
// and killed the process got exactly the corruption that wait exists to prevent.
//
// None of the stopping logic below changes. The order stays RPC stop, then
// SIGTERM, then SIGKILL after thirty seconds. What changes is that the window
// stays up and says what is happening until the daemon has gone.
let windowMayClose = false;
let shutdownInProgress = false;

// Five seconds past the thirty second ceiling stopDaemon works to. That ceiling
// resolves inside its own timer callback, so the normal path always finishes
// first and this bound never ends the wait in practice. It exists because the
// window must not depend on that staying true. A rejected promise left the
// window with no way to close and the application with no way to quit except
// being killed, which is the exact outcome this whole path exists to prevent.
//
// It closes the window and does nothing else. It sends no signal, so the daemon
// keeps every bit of the time stopDaemon gave it, and window-all-closed still
// waits on stopDaemon before the application quits.
const SHUTDOWN_WINDOW_CEILING_MS = 35000;

function notifyShutdownStarted() {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('shutdown-started');
    }
  } catch (e) {}
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
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.on('close', (e) => {
    // Set only once the wait is over, which is the single way out.
    if (windowMayClose) return;
    e.preventDefault();
    notifyShutdownStarted();
    // A second press while the first is still running falls out here, so it
    // cannot start a second stop or a second timer.
    if (shutdownInProgress) return;
    shutdownInProgress = true;

    let ceiling = null;
    let closed = false;
    const closeWindow = () => {
      if (closed) return;
      closed = true;
      if (ceiling) clearTimeout(ceiling);
      windowMayClose = true;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
    };
    ceiling = setTimeout(closeWindow, SHUTDOWN_WINDOW_CEILING_MS);
    // Both settlements close the window. A stop that failed is still a stop that
    // is over as far as the window is concerned, and leaving the rejection
    // unhandled was what kept the window open.
    stopDaemon().then(closeWindow, closeWindow);
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
      try { execFileSync('update-desktop-database', [appDir]); } catch(e) {}
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
    // Reached when the quit comes from the menu or the system rather than the
    // close button. The window is still up here, so it can be told too.
    notifyShutdownStarted();
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
// Two questions, asked apart, because one of them is slow and the other is not.
//
// Measured across seventy eight polls of a chain syncing from block zero, the
// chain calls never took more than 3.4 milliseconds while the wallet calls hit
// the ten second deadline on a third of them. Both used to travel in one batch,
// so a slow wallet blanked the block height, the peer count and the hash rate
// as well, and greyed the whole screen. The chain answers on its own now, and
// the wallet cannot drag it down.
//
// Within the chain question the same mistake was repeated one level down. One
// try surrounded all three calls, so whichever of them missed its deadline threw
// away the answers the other two had already given. In the field that was
// getpeerinfo: it timed out, the block height went with it, and the screen sat
// on preparing while the daemon was validating blocks.
//
// getblockchaininfo is the only call this screen cannot do without, so it is the
// only one whose failure loses the answer. It also goes first, which means it
// absorbs the wait on the lock the daemon holds while it processes headers, and
// the other two find it free. They keep their failures to themselves: a peer
// count that did not come back is a missing peer count, not a missing height.
// What one peer says the chain height is. startingheight is what it announced at
// the handshake and never changes after, right at the start of a session and
// stale later. synced_headers is the best header it has told us about and stays
// current, but reads minus one until the first one arrives. Neither is right on
// its own, so the larger of the two is taken.
function peerHeight(p) {
  const started = typeof p.startingheight === 'number' ? p.startingheight : -1;
  const synced = typeof p.synced_headers === 'number' ? p.synced_headers : -1;
  return Math.max(started, synced);
}

ipcMain.handle('rpc-chainstate', async () => {
  let info;
  try {
    info = await rpcCall('getblockchaininfo');
  } catch (e) {
    return { error: e.message || String(e) };
  }
  let networkhashps = null;
  try {
    const miningInfo = await rpcCall('getmininginfo');
    networkhashps = miningInfo.networkhashps;
  } catch (e) {}
  // Asked last and wanted only for its count. It is the heaviest of the three,
  // ten kilobytes for eleven peers, and it was measured at 9.6 seconds at worst
  // during a header download, so it is the one most likely to be missing.
  let connections = null;
  let peerHeights = [];
  try {
    const peers = await rpcCall('getpeerinfo');
    const list = Array.isArray(peers) ? peers : [];
    connections = list.length;
    // The heights the peers announce, passed on because they are already in
    // hand. This answer is fetched every poll for its count alone and the rest
    // of it was being thrown away, so carrying these costs no call and a
    // measured 0.0016 milliseconds. They are for display and nothing else: the
    // renderer decides no state, no transition and no denominator with them.
    peerHeights = list.map(peerHeight).filter(h => h > 0);
  } catch (e) {}
  return {
    blocks: info.blocks,
    headers: info.headers,
    difficulty: info.difficulty,
    connections: connections,
    networkhashps: networkhashps,
    peerHeights: peerHeights
  };
});

ipcMain.handle('rpc-walletstate', async () => {
  try {
    const walletInfo = await rpcCall('getwalletinfo');
    return {
      balance: walletInfo.balance,
      unconfirmed: walletInfo.unconfirmed_balance || 0,
      immature: walletInfo.immature_balance || 0
    };
  } catch (e) {
    return { error: e.message || String(e) };
  }
});

// Disk cache for market prices. Any failure here is swallowed: an absent or
// unreadable cache is not an outage, it just means no fallback this time.
function marketCachePath() {
  return path.join(app.getPath('userData'), 'market-cache.json');
}

function writeMarketCache(entry) {
  try {
    const dir = app.getPath('userData');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(marketCachePath(), JSON.stringify({ prices: entry.prices, fetchedAt: entry.fetchedAt }));
  } catch (e) {}
}

function readMarketCache() {
  try {
    const raw = fs.readFileSync(marketCachePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.prices) return { prices: parsed.prices, fetchedAt: parsed.fetchedAt || null };
  } catch (e) {}
  return null;
}

ipcMain.handle('get-market-prices', async () => {
  const now = Date.now();
  if (marketCache && (now - marketCache.fetchedAt) < MARKET_MIN_INTERVAL_MS) {
    return { prices: marketCache.prices, fetchedAt: marketCache.fetchedAt, stale: false };
  }
  if ((now - marketLastAttempt) < MARKET_MIN_INTERVAL_MS) {
    if (!marketCache) marketCache = readMarketCache();
    if (marketCache) {
      return { prices: marketCache.prices, fetchedAt: marketCache.fetchedAt, stale: true };
    }
    return { prices: null, fetchedAt: null, stale: true };
  }
  marketLastAttempt = now;
  const fetched = await new Promise((res) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; res(v); } };
    const req = https.request({
      hostname: 'api.coingecko.com',
      path: '/api/v3/simple/price?ids=' + MARKET_IDS + '&vs_currencies=usd,eur',
      headers: { 'User-Agent': 'GaeliumWallet/1.0' }
    }, (r) => {
      if (r.statusCode !== 200) { r.resume(); finish(null); return; }
      let b = '';
      r.on('data', c => b += c);
      r.on('end', () => { try { finish(JSON.parse(b)); } catch (e) { finish(null); } });
    });
    req.setTimeout(10000, () => { req.destroy(); finish(null); });
    req.on('error', () => finish(null));
    req.end();
  });
  if (fetched && fetched.bitcoin) {
    marketCache = { prices: fetched, fetchedAt: Date.now() };
    writeMarketCache(marketCache);
    return { prices: marketCache.prices, fetchedAt: marketCache.fetchedAt, stale: false };
  }
  if (!marketCache) marketCache = readMarketCache();
  if (marketCache) {
    return { prices: marketCache.prices, fetchedAt: marketCache.fetchedAt, stale: true };
  }
  return { prices: null, fetchedAt: null, stale: true };
});

// Listing bounds. The daemon builds the whole result in memory before it
// answers, so a large count is not just a slow query. These values were passed
// through untouched, which meant a string, a fraction, a negative number or a
// billion all reached the daemon as they came.
const DEFAULT_TX_COUNT = 10;
const MAX_TX_COUNT = 1000;
const MAX_TX_SKIP = 100000;

// Anything that is not a whole number at or above the floor becomes the
// fallback, and anything past the ceiling is pulled back to it. Nothing is ever
// forwarded as it arrived.
function boundListParam(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < min) return fallback;
  if (i > max) return max;
  return i;
}

ipcMain.handle('rpc-listtransactions', async (event, count, skip) => {
  try {
    const safeCount = boundListParam(count, DEFAULT_TX_COUNT, 1, MAX_TX_COUNT);
    const safeSkip = boundListParam(skip, 0, 0, MAX_TX_SKIP);
    return await rpcCall('listtransactions', ['*', safeCount, safeSkip]);
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

// Amounts are added in whole satoshis. A GAEL is 1e8 satoshis and both the
// amount and the fee arrive with at most eight decimals, so converting each to
// an integer number of satoshis is exact and avoids the binary floating point
// drift of adding the two decimal values directly.
function toSats(gael) {
  return Math.round(gael * 1e8);
}

function addAmounts(a, b) {
  return (toSats(a) + toSats(b)) / 1e8;
}

// Fee guards. On this chain the highest fee actually paid in the twenty most
// recent non coinbase transactions was 0.11913878 GAEL, for a spend of 77
// inputs. A fee above one GAEL is roughly eight times that, so no honest
// payment can reach it and it stops a runaway fee well before it costs
// anyone a balance.
const FEE_ABSOLUTE_CAP = 1;
// Above this share of the amount the payment is flagged, never blocked.
const FEE_WARNING_PERCENT = 10;
// Below this fee the share is not worth reporting. A base fee is a large
// share of a small payment through nobody's fault, and warning on those
// would teach people to ignore the warning.
const FEE_WARNING_FLOOR = 0.1;

function feeVerdict(fee, amount) {
  if (typeof fee !== 'number' || !isFinite(fee) || fee < 0) {
    return { refused: true, warn: false, percent: 0 };
  }
  if (fee > FEE_ABSOLUTE_CAP) {
    return { refused: true, warn: false, percent: 0 };
  }
  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    return { refused: false, warn: false, percent: 0 };
  }
  if (fee <= FEE_WARNING_FLOOR) {
    return { refused: false, warn: false, percent: 0 };
  }
  const percent = (fee / amount) * 100;
  return { refused: false, warn: percent >= FEE_WARNING_PERCENT, percent: percent };
}

// A spend the daemon has already priced, waiting for the user to confirm it.
// It stays in the main process: the renderer receives an opaque id and the
// figures to display, never the transaction hex, so it cannot broadcast
// anything that has not been priced first.
let pendingSendPlan = null;
const SEND_PLAN_TTL_MS = 5 * 60 * 1000;

function planIsUsable(plan, planId, now) {
  if (!plan) return false;
  if (typeof planId !== 'string' || planId.length === 0) return false;
  if (planId !== plan.planId) return false;
  if (now - plan.createdAt > SEND_PLAN_TTL_MS) return false;
  return true;
}

ipcMain.handle('rpc-preparesend', async (event, address, amount) => {
  // Any previous plan is void the moment a new one is asked for, and stays
  // void if this preparation fails.
  pendingSendPlan = null;
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

    // Step 3: Fund the transaction with changeAddress forced to source.
    // lockUnspents is left at its default of false, so pricing a payment does
    // not reserve any output and costs nothing to abandon.
    const funded = await rpcCall('fundrawtransaction', [rawTx, { changeAddress: changeAddress }]);

    const verdict = feeVerdict(funded.fee, amount);
    if (verdict.refused) {
      // No plan is stored, so the dialog cannot be reached for this payment.
      return { error: 'Network fee of ' + funded.fee.toFixed(8) + ' GAEL is abnormally high and the payment was refused. Nothing has been sent.' };
    }

    const planId = require('crypto').randomBytes(16).toString('hex');
    pendingSendPlan = {
      planId: planId,
      hex: funded.hex,
      fee: funded.fee,
      amount: amount,
      address: address,
      createdAt: Date.now()
    };

    return {
      planId: planId,
      fee: funded.fee,
      amount: amount,
      total: addAmounts(amount, funded.fee),
      address: address,
      warn: verdict.warn,
      warnPercent: verdict.warn ? Math.round(verdict.percent) : 0
    };
  } catch (e) {
    return { error: e.message || String(e) };
  }
});

ipcMain.handle('open-explorer-tx', async (event, txid) => {
  // Nothing is interpolated before this test passes. A value that is not a
  // string, or not exactly sixty four hexadecimal characters, opens nothing.
  if (typeof txid !== 'string' || !TXID_PATTERN.test(txid)) {
    return { error: 'Invalid transaction id' };
  }
  try {
    await shell.openExternal(EXPLORER_BASE_URL + '/tx/' + txid);
    return { ok: true };
  } catch (e) {
    return { error: e.message || String(e) };
  }
});

ipcMain.handle('open-explorer-address', async (event, address) => {
  if (typeof address !== 'string' || address.length === 0) {
    return { error: 'Invalid address' };
  }
  // The daemon is the only authority on the shape of a Gaelium address, so it
  // is asked rather than guessed at. If it cannot answer, nothing opens. There
  // is deliberately no local pattern to fall back on: a second rule written
  // here could disagree with the first and would be the weaker of the two.
  let verdict;
  try {
    verdict = await rpcCall('validateaddress', [address]);
  } catch (e) {
    return { error: e.message || String(e) };
  }
  if (!verdict || verdict.isvalid !== true) {
    return { error: 'Invalid address' };
  }
  try {
    // Escaped as well, even though a valid address is base58 and has nothing to
    // escape. It costs nothing and it means the daemon's answer is not the only
    // thing standing between the renderer and the string handed to the system.
    await shell.openExternal(EXPLORER_BASE_URL + '/address/' + encodeURIComponent(address));
    return { ok: true };
  } catch (e) {
    return { error: e.message || String(e) };
  }
});

ipcMain.handle('rpc-maxamount', async () => {
  // The largest amount the send path can actually prepare. The send path always
  // asks fundrawtransaction for a change output, so the maximum has to be the
  // one that leaves room for that output. Computing it on a spend-all with no
  // change, as this used to, produced a figure the send path then refused.
  //
  // Bounded at four fundrawtransaction calls whatever the size of the wallet,
  // because coin selection is the expensive part and a wallet can hold
  // thousands of outputs. Three are used in the normal case.
  try {
    const utxos = await rpcCall('listunspent', [0, 9999999]);
    if (!utxos || utxos.length === 0) {
      return { error: 'No funds available' };
    }
    const addrBalances = {};
    utxos.forEach(u => {
      addrBalances[u.address] = (addrBalances[u.address] || 0) + u.amount;
    });
    const destAddress = Object.keys(addrBalances).reduce((a, b) => addrBalances[a] > addrBalances[b] ? a : b);
    const totalSats = utxos.reduce((s, u) => s + toSats(u.amount), 0);
    const allInputs = utxos.map(u => ({ txid: u.txid, vout: u.vout }));

    // Call one. Fee of a spend of everything with no change output. Only used
    // to measure what a change output costs, by difference with call two.
    const rawNoChange = await rpcCall('createrawtransaction', [[], { [destAddress]: totalSats / 1e8 }]);
    const fundedNoChange = await rpcCall('fundrawtransaction', [rawNoChange, { subtractFeeFromOutputs: [0] }]);
    const feeNoChange = toSats(fundedNoChange.fee);

    // Call two. Fee of the same outputs with a change output added. The inputs
    // are pinned to every output the wallet holds, because asking for a smaller
    // amount lets the daemon select fewer inputs and quote a fee that does not
    // apply to a spend of everything. The probe amount is half the balance,
    // which is large enough to avoid dust and small enough to leave change. No
    // output size is assumed anywhere: the difference between the two fees is
    // what a change output costs on this wallet.
    const probeSats = Math.floor(totalSats / 2);
    const rawWithChange = await rpcCall('createrawtransaction', [allInputs, { [destAddress]: probeSats / 1e8 }]);
    const fundedWithChange = await rpcCall('fundrawtransaction', [rawWithChange, { changeAddress: destAddress }]);
    const feeWithChange = toSats(fundedWithChange.fee);

    // Call three. The candidate is the balance minus that fee. It is not
    // returned on trust: the normal send path is run on it, and only a figure
    // that path accepts is handed back.
    const candidate = totalSats - feeWithChange;
    const rawCheck = await rpcCall('createrawtransaction', [[], { [destAddress]: candidate / 1e8 }]);
    let verified = null;
    let amountSats = candidate;
    try {
      verified = await rpcCall('fundrawtransaction', [rawCheck, { changeAddress: destAddress }]);
    } catch (e) {
      // Call four. The estimate was short. Step back by the measured cost of a
      // change output and check that once more. If that fails too the daemon
      // error is what the caller gets: no amount is returned unverified.
      amountSats = candidate - (feeWithChange - feeNoChange);
      const rawRetry = await rpcCall('createrawtransaction', [[], { [destAddress]: amountSats / 1e8 }]);
      verified = await rpcCall('fundrawtransaction', [rawRetry, { changeAddress: destAddress }]);
    }

    return { maxAmount: amountSats / 1e8, fee: verified.fee };
  } catch (e) {
    return { error: e.message || String(e) };
  }
});

ipcMain.handle('rpc-confirmsend', async (event, planId) => {
  const plan = pendingSendPlan;
  if (!planIsUsable(plan, planId, Date.now())) {
    pendingSendPlan = null;
    return { error: 'No valid prepared transaction. Prepare the payment again.' };
  }
  // Taken out of the module before anything is awaited, so a second confirm
  // cannot find the same plan and broadcast the transaction twice. The plan is
  // gone whether the broadcast succeeds or fails.
  pendingSendPlan = null;
  try {
    // Step 4: Sign the transaction
    const signed = await rpcCall('signrawtransaction', [plan.hex]);
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
  const execPath = SELF_EXEC_PATH;
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
// Address metadata storage.
//
// The renderer hands over the whole contents of this file, so whatever it sends
// is what lands on disk. Nothing checked it before. A single bad value, from a
// bug or from anything that reached the renderer, was enough to leave the file
// unreadable and take the address ordering with it.
//
// Mainnet Gaelium addresses are base58check over version byte 38 for a public
// key hash and 122 for a script hash, which puts them at exactly 34 characters
// beginning with G or r. There is no bech32 form and this wallet has no testnet
// mode, so those two shapes are the whole set.
const ADDRESS_SHAPE = /^[Gr][123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{33}$/;
// Long enough for the names the field suggests, short enough that the file
// cannot be inflated through it.
const MAX_LABEL_LENGTH = 64;
// A desktop address book that outgrows this is a bug, not a use case.
const MAX_ADDRESS_ENTRIES = 1000;

// Returns a copy holding only what belongs in the file. Every entry is judged on
// its own, so one bad address costs itself and nothing else. Keys other than
// order and labels are not carried over, because nothing writes any.
function sanitizeAddressMeta(data) {
  const clean = { order: [], labels: {} };
  if (!data || typeof data !== 'object' || Array.isArray(data)) return clean;
  const seen = new Set();
  const order = Array.isArray(data.order) ? data.order : [];
  for (const entry of order) {
    if (typeof entry !== 'string' || !ADDRESS_SHAPE.test(entry)) continue;
    if (seen.has(entry)) continue;
    if (clean.order.length >= MAX_ADDRESS_ENTRIES) break;
    seen.add(entry);
    clean.order.push(entry);
  }
  const labels = (data.labels && typeof data.labels === 'object' && !Array.isArray(data.labels)) ? data.labels : {};
  let labelCount = 0;
  for (const addr of Object.keys(labels)) {
    if (!ADDRESS_SHAPE.test(addr)) continue;
    const label = labels[addr];
    if (typeof label !== 'string') continue;
    if (labelCount >= MAX_ADDRESS_ENTRIES) break;
    // Trimmed rather than dropped, so an over long name keeps the address
    // recognisable instead of losing its name altogether.
    clean.labels[addr] = label.slice(0, MAX_LABEL_LENGTH);
    labelCount++;
  }
  return clean;
}

ipcMain.handle('load-address-meta', async () => {
  try {
    const metaPath = path.join(getDataDir(), 'addresses.json');
    // Also cleaned on the way in, because the renderer sends back what it was
    // given and a file that predates this check would otherwise be written out
    // again untouched.
    if (fs.existsSync(metaPath)) return sanitizeAddressMeta(JSON.parse(fs.readFileSync(metaPath, 'utf8')));
    return { order: [], labels: {} };
  } catch(e) { return { order: [], labels: {} }; }
});
ipcMain.handle('save-address-meta', async (event, data) => {
  try {
    const metaPath = path.join(getDataDir(), 'addresses.json');
    const clean = sanitizeAddressMeta(data);
    // Written beside the target and renamed onto it. Rename replaces the file in
    // one step on both platforms, so an interrupted write leaves the previous
    // contents rather than half of the new ones.
    const tmpPath = metaPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(clean, null, 2));
    fs.renameSync(tmpPath, metaPath);
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
    const execPath = SELF_EXEC_PATH;
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
