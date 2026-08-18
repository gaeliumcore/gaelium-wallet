// HTML escaping to prevent XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Security functions
async function encryptWallet() {
  const p1 = document.getElementById('encryptPass1').value;
  const p2 = document.getElementById('encryptPass2').value;
  const status = document.getElementById('encryptStatus');
  if (!p1 || p1.length < 8) {
    status.style.display='block'; status.style.background='rgba(239,68,68,0.15)'; status.style.color='var(--red)';
    status.textContent='Passphrase must be at least 8 characters.'; return;
  }
  if (p1 !== p2) {
    status.style.display='block'; status.style.background='rgba(239,68,68,0.15)'; status.style.color='var(--red)';
    status.textContent='Passphrases do not match.'; return;
  }
  if (!confirm('WARNING: Encrypting your wallet is irreversible. If you lose your passphrase, you will PERMANENTLY lose access to your funds. Are you sure?')) return;
  status.style.display='block'; status.style.background='rgba(16,185,129,0.1)'; status.style.color='var(--green-light)';
  status.textContent='Encrypting wallet... The wallet will restart automatically, please wait.';
  document.getElementById('encryptPass1').value='';
  document.getElementById('encryptPass2').value='';
  // The wallet will automatically close and reopen after encryption
  const result = await window.gaelium.encryptWallet(p1);
  // If we get here, relaunch failed - show error
  if (result && result.error) {
    status.style.background='rgba(239,68,68,0.15)'; status.style.color='var(--red)';
    status.textContent='Error: ' + (result.error.message || result.error);
  }
}

async function restoreWallet() {
  const status = document.getElementById('restoreStatus');
  if (!confirm('Are you sure you want to restore a wallet from backup?\n\nYour current wallet will be automatically backed up before restoration. The wallet will restart after the process is complete.')) return;
  status.style.display='block'; status.style.background='rgba(16,185,129,0.1)'; status.style.color='var(--green-light)';
  status.textContent='Select your backup wallet file...';
  try {
    const result = await window.gaelium.restoreWallet();
    if (result.error) {
      status.style.background='rgba(239,68,68,0.15)'; status.style.color='var(--red)';
      status.textContent='Error: ' + result.error;
    } else if (result.cancelled) {
      status.style.display='none';
    }
  } catch(e) {
    status.style.background='rgba(239,68,68,0.15)'; status.style.color='var(--red)';
    status.textContent='Error: ' + e.message;
  }
}
async function changePassphrase() {
  const oldPass = document.getElementById('chgOldPass').value;
  const newPass1 = document.getElementById('chgNewPass1').value;
  const newPass2 = document.getElementById('chgNewPass2').value;
  const status = document.getElementById('changePassStatus');
  if (!oldPass) {
    status.style.display='block'; status.style.background='rgba(239,68,68,0.15)'; status.style.color='var(--red)';
    status.textContent='Please enter your current passphrase.'; return;
  }
  if (!newPass1 || newPass1.length < 8) {
    status.style.display='block'; status.style.background='rgba(239,68,68,0.15)'; status.style.color='var(--red)';
    status.textContent='New passphrase must be at least 8 characters.'; return;
  }
  if (newPass1 !== newPass2) {
    status.style.display='block'; status.style.background='rgba(239,68,68,0.15)'; status.style.color='var(--red)';
    status.textContent='New passphrases do not match.'; return;
  }
  status.style.display='block'; status.style.background='rgba(16,185,129,0.1)'; status.style.color='var(--green-light)';
  status.textContent='Changing passphrase...';
  const result = await window.gaelium.walletPassphraseChange(oldPass, newPass1);
  if (result && result.error) {
    status.style.background='rgba(239,68,68,0.15)'; status.style.color='var(--red)';
    const msg = result.error.message || result.error;
    if (msg.includes('incorrect') || msg.includes('passphrase')) {
      status.textContent='Error: Current passphrase is incorrect.';
    } else {
      status.textContent='Error: ' + msg;
    }
  } else {
    status.style.background='rgba(16,185,129,0.1)'; status.style.color='var(--green-light)';
    status.textContent='Passphrase changed successfully!';
    document.getElementById('chgOldPass').value='';
    document.getElementById('chgNewPass1').value='';
    document.getElementById('chgNewPass2').value='';
  }
}

async function unlockWallet() {
  const pass = document.getElementById('unlockPass').value;
  const timeout = parseInt(document.getElementById('unlockTimeout').value) || 300;
  const status = document.getElementById('unlockStatus');
  if (!pass) {
    status.style.display='block'; status.style.background='rgba(239,68,68,0.15)'; status.style.color='var(--red)';
    status.textContent='Please enter your passphrase.'; return;
  }
  const result = await window.gaelium.walletPassphrase(pass, timeout);
  status.style.display='block';
  if (result && result.error) {
    status.style.background='rgba(239,68,68,0.15)'; status.style.color='var(--red)';
    status.textContent='Error: ' + (result.error.message || result.error);
  } else {
    status.style.background='rgba(16,185,129,0.1)'; status.style.color='var(--green-light)';
    status.textContent='Wallet unlocked for ' + timeout + ' seconds.';
    document.getElementById('unlockPass').value='';
    updateSecurityPage();
  }
}

async function lockWallet() {
  // Before anything else: locking the wallet must take the exported key off the
  // screen, text and QR. Done before the await so it happens even if the daemon
  // is slow or the call fails. Re-exporting is a click; a key left on a screen
  // the user believes locked is not.
  clearExportedKey('');
  const status = document.getElementById('unlockStatus');
  const result = await window.gaelium.walletLock();
  status.style.display='block';
  if (result && result.error) {
    status.style.background='rgba(239,68,68,0.15)'; status.style.color='var(--red)';
    status.textContent='Error: ' + (result.error.message || result.error);
  } else {
    status.style.background='rgba(16,185,129,0.1)'; status.style.color='var(--green-light)';
    status.textContent='Wallet locked.';
    updateSecurityPage();
  }
}

async function backupWallet() {
  const status = document.getElementById('backupStatus');
  status.style.display='block'; status.style.background='var(--green-soft)'; status.style.color='var(--green-light)';
  status.textContent='Saving backup...';
  try {
    const result = await window.gaelium.backupWallet();
    if (result.canceled) {
      status.style.display='none';
    } else if (result.error) {
      status.style.background='var(--red-soft)'; status.style.color='var(--red)';
      status.textContent='Error: ' + result.error;
    } else {
      status.style.background='var(--green-soft)'; status.style.color='var(--green-light)';
      status.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Wallet backed up successfully!';
    }
  } catch(e) {
    status.style.background='var(--red-soft)'; status.style.color='var(--red)';
    status.textContent='Error: ' + String(e);
  }
}
async function updateSecurityPage() {
  try {
    const info = await window.gaelium.getWalletInfo();
    const el = document.getElementById('lockStatus');
    const isEncrypted = info && typeof info.unlocked_until !== 'undefined';
    // Show/hide sections based on encryption state
    document.getElementById('secEncrypt').style.display = isEncrypted ? 'none' : 'block';
    document.getElementById('secEncryptedGrid').style.display = isEncrypted ? 'grid' : 'none';
    if (el) {
      if (!isEncrypted) {
        el.innerHTML = '<span style="color:var(--yellow);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Wallet is NOT encrypted.</span> Use the form above to protect it with a passphrase.';
      } else if (info.unlocked_until === 0) {
        el.innerHTML = '<span style="color:var(--green-light);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> Wallet is encrypted and locked.</span>';
      } else {
        el.innerHTML = '<span style="color:var(--green-light);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg> Wallet is encrypted and unlocked.</span>';
      }
    }
  } catch(e) {}
}
// Keep old name for compatibility
async function updateLockStatus() { await updateSecurityPage(); }
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector('.nav-item[data-page="'+page+'"]').classList.add('active');
  // Clear sensitive data when navigating away from keys page
  clearExportedKey('');
  const exportResult = document.getElementById('exportResult');
  if (exportResult) exportResult.style.display='none';
  if (page === 'receive') { loadReceiveAddress(); loadAddressHistory(); }
  if (page === 'transactions') loadAllTransactions(0);
  if (page === 'security') updateLockStatus();
}
if (window.gaelium.onNavigateTo) { window.gaelium.onNavigateTo((page) => {
  // After relaunch, daemon may not be ready yet - retry navigation
  async function waitAndNavigate(p, retries) {
    navigateTo(p);
    if (p === 'security') {
      for (let i = 0; i < (retries || 15); i++) {
        const info = await window.gaelium.getWalletInfo();
        if (info && !info.error) { updateLockStatus(); return; }
        await new Promise(r => setTimeout(r, 1000));
      }
      updateLockStatus();
    }
  }
  waitAndNavigate(page, 15);
}); }
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.page));
});
function formatAmount(a) {
  let n = parseFloat(a); if (isNaN(n)) return '0.00';
  let p = n.toFixed(2).split('.');
  p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return p.join('.');
}
function formatPrice(n, symbol) {
  if (typeof n !== 'number' || !isFinite(n) || n <= 0) return '--';
  if (n >= 0.01) return symbol + n.toLocaleString();
  return symbol + n.toLocaleString(undefined, { maximumSignificantDigits: 5 });
}
// QR encoding. Parameters are those of the two mobile wallets so that the same
// address yields the same symbol everywhere: error correction Q, a one module
// quiet zone, UTF-8, black on opaque white. See wallet/android QrGenerator.kt
// and wallet/ios QRCodeGenerator.swift.
//
// The payload is encoded BARE, never wrapped in a gaelium: URI. Android puts a
// scanned payload straight into its field without stripping anything, so a
// prefixed QR would simply be refused there.
function qrDataUrl(payload, size) {
  if (typeof qrcode !== 'function') return '';
  if (!payload) return '';
  try {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    var qr = qrcode(0, 'Q');
    qr.addData(payload);
    qr.make();
    var count = qr.getModuleCount();
    var margin = 1;
    var total = count + margin * 2;
    var scale = Math.max(1, Math.floor((size || 512) / total));
    var edge = total * scale;
    var canvas = document.createElement('canvas');
    canvas.width = edge;
    canvas.height = edge;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, edge, edge);
    ctx.fillStyle = '#000000';
    for (var row = 0; row < count; row++) {
      for (var col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect((col + margin) * scale, (row + margin) * scale, scale, scale);
        }
      }
    }
    return canvas.toDataURL('image/png');
  } catch (e) {
    return '';
  }
}
function formatHash(h) {
  if (h >= 1e12) return (h/1e12).toFixed(2)+' TH/s';
  if (h >= 1e9) return (h/1e9).toFixed(2)+' GH/s';
  if (h >= 1e6) return (h/1e6).toFixed(2)+' MH/s';
  if (h >= 1e3) return (h/1e3).toFixed(2)+' KH/s';
  return h.toFixed(2)+' H/s';
}
function timeAgo(t) {
  let d = Math.floor(Date.now()/1000) - t;
  if (d < 60) return 'Just now';
  if (d < 3600) return Math.floor(d/60)+'m ago';
  if (d < 86400) return Math.floor(d/3600)+'h ago';
  return Math.floor(d/86400)+'d ago';
}
function filterChangeTx(txs) {
  // Group by txid
  const byTxid = {};
  txs.forEach(tx => {
    if (!byTxid[tx.txid]) byTxid[tx.txid] = [];
    byTxid[tx.txid].push(tx);
  });
  // For each txid with sends + receives, the receive addresses are change
  const changeAddrs = {};
  Object.keys(byTxid).forEach(txid => {
    const entries = byTxid[txid];
    const sends = entries.filter(e => e.category === 'send');
    const receives = entries.filter(e => e.category === 'receive');
    if (sends.length > 0 && receives.length > 0) {
      changeAddrs[txid] = new Set(receives.map(r => r.address));
    }
  });
  // Filter: hide change receives and send entries going to change addresses
  return txs.filter(tx => {
    if (!changeAddrs[tx.txid]) return true;
    if (tx.category === 'receive') return false;
    if (tx.category === 'send' && changeAddrs[tx.txid].has(tx.address)) return false;
    return true;
  });
}

function buildTxItem(tx) {
  let icon='↓', tc='receive', tl='Received', ac='positive';
  if (tx.category==='send') { icon='↑'; tc='send'; tl='Sent'; ac='negative'; }
  else if (tx.category==='generate') { icon='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="12" y1="6" x2="12" y2="18"/></svg>'; tc='generate'; tl='Mined - Block #'+escapeHtml(tx.blockheight||''); }
  else if (tx.category==='immature') { icon='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'; tc='immature'; tl='Immature - Block #'+escapeHtml(tx.blockheight||''); }
  let addr = tx.address||'Unknown';
  let sa = addr.length>34 ? addr.substring(0,16)+'...'+addr.substring(addr.length-8) : addr;
  let amt = tx.amount<0 ? formatAmount(tx.amount) : '+'+formatAmount(tx.amount);
  let safeTxid = escapeHtml(tx.txid);
  let safeSa = escapeHtml(sa);
  let safeTl = escapeHtml(tl);
  let safeAmt = escapeHtml(amt);
  let safeDate = tx.time ? escapeHtml(new Date(tx.time*1000).toLocaleString()) : 'pending';
  let safeConf = escapeHtml(tx.confirmations||0);
  return '<div class="tx-item" style="cursor:pointer" data-txid="'+safeTxid+'"><div class="tx-icon-wrap '+escapeHtml(tc)+'">'+icon+'</div><div class="tx-details"><div class="tx-type">'+safeTl+'</div><div class="tx-address">'+safeSa+'</div></div><div class="tx-right"><div class="tx-amount '+(tx.amount<0?'negative':'positive')+'">'+safeAmt+' GAEL</div><div class="tx-date">'+safeDate+'</div><span class="tx-conf">'+safeConf+' conf.</span></div></div>';
}
// Measured on a sync from block zero: twenty two polls out of seventy eight
// failed, and not one of them followed another. The longest run was one. Three
// in a row is therefore something an ordinary sync does not produce, which is
// what makes it safe to say nothing until then.
const FAILURE_NOTICE_AFTER = 3;
let _consecutiveFailures = 0;
// One missed poll does not make a figure stale. Measured on a chain syncing from
// block zero, getblockchaininfo timed out on twenty two polls out of a hundred
// and four and never twice in a row, so greying on the first miss made the
// counters blink through the whole of the header phase while nothing was wrong
// with any of the numbers on screen. Two in a row is already more than that run
// ever produced, and the message still waits for three.
const STALE_AFTER_MISSES = 2;
let _walletFailures = 0;
// Forty times the three seconds a normal start takes. This is measured in
// elapsed time rather than in attempts, because a count of attempts changes
// meaning whenever the polling period changes.
const UNREACHABLE_AFTER_MS = 120000;
// A start takes about three seconds on a fresh datadir, measured from the daemon
// log. Twenty seconds is more than six times that, late enough that a normal
// start never reaches it and early enough to answer someone wondering whether
// anything is happening at all.
const SLOW_START_NOTICE_MS = 20000;
const _walletStartedAt = Date.now();

// Shown only while the daemon has never answered, and taken down the moment it
// does. There is no path that leaves it up, because every successful poll hides
// it whether or not it was ever shown.
// During the preparing phase the peer count climbs for the first few seconds and
// then nothing on the screen moves at all for the remaining forty. An elapsed
// count is the one thing left that is both true and continuous. It claims no
// progress, it only says the wallet is still there and how long it has been
// waiting, which is the question someone watching a still screen is asking.
let _preparingSince = null;
let _preparingTimer = null;
// Preparing is the only state that carries no progress of its own, so it is the
// only one that could sit still without anyone noticing. Past this it gives way
// to whatever is known, a block count of zero against a header count if that is
// all there is, rather than staying mute.
//
// Three minutes is four times the forty five seconds a header phase took on a
// real machine, and it only ever fires when the block count has failed to move
// at all in that time, which the criterion above says cannot happen while the
// daemon is working. It is a floor under the screen, not a mechanism.
const PREPARING_CEILING_MS = 180000;
let _preparingStartedAt = null;
// Latched, so the screen does not swing back to mute three minutes later.
let _preparingExpired = false;
function drawPreparing() {
  var el = document.getElementById('syncText');
  if (!el || _preparingSince === null) return;
  el.textContent = 'Preparing, ' + Math.floor((Date.now() - _preparingSince) / 1000) + 's';
}
function setPreparing(on) {
  if (on) {
    if (_preparingSince === null) _preparingSince = Date.now();
    drawPreparing();
    if (_preparingTimer === null) _preparingTimer = setInterval(drawPreparing, 1000);
    return;
  }
  if (_preparingTimer !== null) { clearInterval(_preparingTimer); _preparingTimer = null; }
  _preparingSince = null;
}

function showStartupNotice(show) {
  var el = document.getElementById('startupNotice');
  if (el) el.classList.toggle('visible', show);
}
// True from the first answer the daemon ever gives. After that the daemon is
// running, whatever a later poll says, so no message may claim it is starting.
let _daemonHasAnswered = false;

// setInterval fired every ten seconds whether or not the previous run had
// finished, so runs could pile up on a daemon that was already too busy to
// answer. Each of the two polls now carries its own in flight flag, which makes
// overlap impossible from any caller and not only from its scheduler.
// Period while the chain is up to date.
const POLL_SYNCED_MS = 10000;
// Period while it is not. A syncing daemon has nothing new to report ten seconds
// later: the measured run advanced by sixteen blocks per poll for eight minutes
// while the headers came in. Polling three times less often removes two thirds
// of the load from the interval where every timeout was recorded, and costs
// nothing but a slower moving number.
const POLL_SYNCING_MS = 30000;
// Period while the daemon has never answered. A start takes about three seconds
// on a fresh datadir, and during those seconds the daemon answers every call
// immediately with the phase it is in, so asking often costs nothing and it is
// what turns a blank dashboard into a filled one within a second or two of the
// daemon being ready. At ten seconds a start that took three could leave the
// screen empty for seven more.
const POLL_STARTUP_MS = 1500;
// Period while the headers are still arriving. Thirty seconds there left the
// screen without a single moving figure for half a minute, on the phase a new
// user watches hardest and which lasts under a minute in total, so it read as a
// freeze. The four calls that remain never took more than 3.4 milliseconds
// across the whole measured run, the worst of the header phase included, so
// asking every five seconds there costs nothing worth counting.
const POLL_HEADERS_MS = 5000;
// Starts fast and stays fast until the first answer arrives.
let _chainDelayMs = POLL_STARTUP_MS;

// The wallet is asked apart and far less often while the chain is behind. Its
// figures cannot settle before the sync does, and it is the only part of the
// poll that was ever slow: it took the whole ten second deadline on a third of
// the measured polls while the chain calls stayed under four milliseconds. Once
// the chain is up to date it goes back to the same ten seconds as before, so
// nothing about a wallet in normal use changes.
const WALLET_SYNCING_MS = 60000;
const WALLET_SYNCED_MS = 10000;
let _walletDelayMs = POLL_STARTUP_MS;
// Written by the chain poll, read by the wallet poll. Neither waits on the
// other, they only share this one fact. It starts true so that a balance shown
// before the chain has said anything carries the warning rather than passing
// itself off as final.
let _chainIsSyncing = true;

let _chainInFlight = false;
async function updateChain() {
  if (_chainInFlight) return;
  _chainInFlight = true;
  try {
    const d = await window.gaelium.getChainState();
    if (d.error) {
      _consecutiveFailures++;
      if (_consecutiveFailures >= STALE_AFTER_MISSES) markStale(CHAIN_STALE_IDS, true);
      if (!_daemonHasAnswered) {
        var phase = getStartupPhase(d.error);
        var waited = Date.now() - _walletStartedAt;
        if (waited > SLOW_START_NOTICE_MS) showStartupNotice(true);
        document.getElementById('syncText').textContent = phase;
        document.getElementById('balanceAddress').textContent = waited > UNREACHABLE_AFTER_MS
          ? 'Unable to connect to Gaelium daemon. Please restart the wallet or check your firewall settings.'
          : phase;
        _chainDelayMs = POLL_STARTUP_MS;
      } else if (_consecutiveFailures >= FAILURE_NOTICE_AFTER) {
        document.getElementById('balanceAddress').textContent = 'Still waiting for Gaelium Core to answer...';
      }
      return;
    }
    _consecutiveFailures = 0;
    _daemonHasAnswered = true;
    markStale(CHAIN_STALE_IDS, false);
    showStartupNotice(false);
    // The daemon says where it is without being asked twice. While it downloads
    // headers the block count stays at zero, and the moment it starts validating
    // it moves. Both figures come from getblockchaininfo, the one call this
    // screen cannot do without and the one that always ends up answering, so
    // the phase no longer depends on anything a second call has to supply.
    //
    // A wallet that is already up to date has a block count from its first
    // answer, so it never sees the preparing state at all. That is the intended
    // behaviour: there is nothing to prepare and nothing to wait for.
    //
    // The one second or so at the very start where the count is legitimately
    // zero is the preparing state, which is exactly what it is for.
    var preparing = d.blocks === 0 && !_preparingExpired;
    if (preparing) {
      if (_preparingStartedAt === null) _preparingStartedAt = Date.now();
      if (Date.now() - _preparingStartedAt > PREPARING_CEILING_MS) {
        _preparingExpired = true;
        preparing = false;
      }
    } else {
      _preparingStartedAt = null;
    }
    // A daemon holding blocks it has no headers for is not a state this daemon
    // produces, headers always run ahead. Taking the larger of the two costs
    // nothing and means the denominator can never be smaller than the numerator.
    var denom = Math.max(d.headers, d.blocks);
    var syncing = !preparing && denom > 0 && (denom - d.blocks) > 2;
    // The wallet is asked again the moment this changes, in either direction.
    // Coming out of a sync is when the final balance appears and the note under
    // it has to go, and waiting a full minute for the next wallet poll to notice
    // would be the one delay nobody would forgive.
    var syncStateChanged = (syncing || preparing) !== _chainIsSyncing;
    _chainIsSyncing = syncing || preparing;
    if (preparing) _chainDelayMs = POLL_HEADERS_MS;
    else if (!syncing) _chainDelayMs = POLL_SYNCED_MS;
    else _chainDelayMs = POLL_SYNCING_MS;
    var blocksEl = document.getElementById('statBlocks');
    var rewardEl = document.getElementById('statReward');
    var blocksLabelEl = document.getElementById('statBlocksLabel');
    if (preparing) {
      // No number, no percentage, no bar. There is nothing yet that any of them
      // could honestly be built from. The peer count under the tile is real and
      // it climbs as the handshakes complete, and the hash rate and difficulty
      // tiles fill in beside it.
      if (blocksLabelEl) blocksLabelEl.textContent = 'Block Height';
      blocksEl.textContent = '--';
      rewardEl.textContent = d.connections === null ? 'Connecting'
        : (d.connections === 1 ? '1 peer connected' : d.connections + ' peers connected');
      setPreparing(true);
      document.getElementById('bottomBlock').textContent = '--';
      document.getElementById('balanceAddress').textContent = 'Connecting to the network and preparing to synchronize...';
    } else if (syncing) {
      setPreparing(false);
      // One scale, from zero to one hundred, filled once. The blocks are the
      // only thing being counted and the exact height is the denominator.
      var pct = Math.min(99.9, Math.max(0, (d.blocks / denom) * 100)).toFixed(1);
      var counter = d.blocks.toLocaleString() + ' / ' + denom.toLocaleString();
      if (blocksLabelEl) blocksLabelEl.textContent = 'Block Height';
      blocksEl.textContent = counter;
      rewardEl.innerHTML = '<div class="sync-progress-bar"><div class="sync-progress-fill" style="width:' + pct + '%"></div></div>';
      document.getElementById('bottomBlock').textContent = counter;
      document.getElementById('syncText').textContent = 'Syncing ' + counter + ' (' + pct + '%)';
      document.getElementById('balanceAddress').textContent = 'Synchronizing with the Gaelium network (' + pct + '%)...';
    } else {
      setPreparing(false);
      if (blocksLabelEl) blocksLabelEl.textContent = 'Block Height';
      blocksEl.textContent = d.blocks.toLocaleString();
      rewardEl.textContent = 'Reward: 1,000 GAEL';
      document.getElementById('syncText').textContent = 'Synced at block ' + d.blocks;
      document.getElementById('bottomBlock').textContent = d.blocks;
      document.getElementById('balanceAddress').textContent = 'Connected to the Gaelium Core Network (GAEL)';
    }
    // A call that did not answer leaves its own tile alone rather than writing
    // a null over a figure that was right a moment ago.
    if (d.networkhashps !== null && d.networkhashps !== undefined) {
      document.getElementById('statHash').textContent=formatHash(d.networkhashps);
      document.getElementById('bottomHash').textContent=formatHash(d.networkhashps);
    }
    if (d.connections !== null && d.connections !== undefined) {
      document.getElementById('statPeers').textContent=d.connections;
      document.getElementById('bottomPeers').textContent=d.connections;
    }
    document.getElementById('statDiff').textContent='Diff: '+parseFloat(d.difficulty).toFixed(4);
    if (syncStateChanged) updateWallet();
  } catch(e) {
    markStale(CHAIN_STALE_IDS, true);
  }
  finally { _chainInFlight = false; }
}

let _walletInFlight = false;
async function updateWallet() {
  if (_walletInFlight) return;
  _walletInFlight = true;
  try {
    const w = await window.gaelium.getWalletState();
    // A wallet that did not answer greys its own figure and touches nothing
    // else. The main line belongs to the chain poll and stays as it was.
    if (w.error) {
      _walletFailures++;
      // Same rule on this side. The wallet calls were the ones timing out in the
      // earlier measurement, and a balance that did not refresh once is not a
      // balance worth marking as doubtful.
      if (_walletFailures >= STALE_AFTER_MISSES) markStale(WALLET_STALE_IDS, true);
      if (!_daemonHasAnswered) _walletDelayMs = POLL_STARTUP_MS;
      return;
    }
    _walletFailures = 0;
    markStale(WALLET_STALE_IDS, false);
    _walletDelayMs = _chainIsSyncing ? WALLET_SYNCING_MS : WALLET_SYNCED_MS;
    document.getElementById('balanceAmount').innerHTML=formatAmount(w.balance)+'<span class="balance-currency"> GAEL</span>';
    let pp=[];
    if (w.unconfirmed>0) pp.push('Pending: '+formatAmount(w.unconfirmed)+' GAEL');
    if (w.immature>0) pp.push('Immature: '+formatAmount(w.immature)+' GAEL');
    // A wallet restored from a backup or from an imported key reads zero for the
    // whole of the sync, which is correct and alarming at the same time. Said
    // here rather than in a banner, next to the figure it is about.
    if (_chainIsSyncing) pp.push('Not final until the sync completes');
    document.getElementById('balancePending').textContent=pp.join(' | ');
    const txs = await window.gaelium.listTransactions(30);
    if (!txs.error && txs.length>0) {
      lastTxList=filterChangeTx(txs.reverse().filter(tx=>tx.txid!=='9280011d752efed0c25a1d8a3fbd5d9ba50b953cac65f994b9d95437c9be6cfe')); let h=''; lastTxList.slice(0,8).forEach(tx => h+=buildTxItem(tx));
      document.getElementById('txList').innerHTML=h;
    } else if (!txs.error) {
      document.getElementById('txList').innerHTML='<div class="loading">No transactions yet</div>';
    }
  } catch(e) {
    markStale(WALLET_STALE_IDS, true);
  }
  finally { _walletInFlight = false; }
}

// Two loops, each arming its own next run only once its own current one has
// settled. Neither ever waits on the other, and neither can overlap itself.
function scheduleChain() {
  updateChain().then(function() { setTimeout(scheduleChain, _chainDelayMs); });
}
function scheduleWallet() {
  updateWallet().then(function() { setTimeout(scheduleWallet, _walletDelayMs); });
}
// Kept for the places that refresh after an action and want both at once.
function updateDashboard() {
  updateChain();
  updateWallet();
}

var MARKET_IDS_MAP = {
  bitcoin: 'btc', ethereum: 'eth', monero: 'xmr',
  dogecoin: 'doge', gaelium: 'gael'
};

async function updateMarketPrices() {
  try {
    var r = await window.gaelium.getMarketPrices();
    var ageEl = document.getElementById('marketAge');
    if (!r || !r.prices) {
      for (var k in MARKET_IDS_MAP) {
        document.getElementById(MARKET_IDS_MAP[k] + 'Price').textContent = '--';
        var e = document.getElementById(MARKET_IDS_MAP[k] + 'PriceEur');
        if (e) e.textContent = '--';
      }
      if (ageEl) ageEl.textContent = '';
      return;
    }
    for (var id in MARKET_IDS_MAP) {
      var p = r.prices[id];
      var pre = MARKET_IDS_MAP[id];
      if (!p) continue;
      document.getElementById(pre + 'Price').textContent = formatPrice(p.usd, '$');
      var eur = document.getElementById(pre + 'PriceEur');
      if (eur) eur.textContent = formatPrice(p.eur, '\u20AC');
    }
    if (ageEl && !r.fetchedAt) ageEl.textContent = '';
    if (ageEl && r.fetchedAt) {
      var ageMin = Math.floor((Date.now() - r.fetchedAt) / 60000);
      ageEl.textContent = ageMin >= 15 ? 'as of ' + new Date(r.fetchedAt).toLocaleTimeString() : '';
    }
  } catch (e) {}
}

// Shown while the main process waits for the daemon to exit. The elapsed count
// is there so that a wait of twenty seconds reads as a wait rather than a freeze.
if (window.gaelium && window.gaelium.onShutdownStarted) {
  window.gaelium.onShutdownStarted(function() {
    var overlay = document.getElementById('shutdownOverlay');
    if (!overlay || overlay.classList.contains('visible')) return;
    overlay.classList.add('visible');
    var started = Date.now();
    setInterval(function() {
      var el = document.getElementById('shutdownElapsed');
      if (el) el.textContent = Math.floor((Date.now() - started) / 1000);
    }, 1000);
  });
}

scheduleChain();
scheduleWallet();
updateMarketPrices();
setInterval(updateMarketPrices, 300000);

// Event wiring, moved out of inline onclick attributes. Runs on DOMContentLoaded
// because the modals are declared after the script tag and do not exist yet when
// the body of this file executes.
document.addEventListener('DOMContentLoaded', function() {
  function on(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
    else console.warn('wiring: missing element', id);
  }

  // Window controls
  on('btnWindowMinimize', function() { window.gaelium.minimize(); });
  on('btnWindowMaximize', function() { window.gaelium.maximize(); });
  on('btnWindowClose', function() { window.gaelium.close(); });

  // Dashboard shortcuts
  on('btnNavSend', function() { navigateTo('send'); });
  on('btnNavReceive', function() { navigateTo('receive'); });

  // Send
  on('btnFillMaxAmount', function() { fillMaxAmount(); });
  on('sendBtn', function() { sendTransaction(); });

  // Receive
  on('btnCopyAddress', function() { copyAddress(); });
  on('btnGenerateNewAddress', function() { generateNewAddress(); });

  // Security
  on('btnImportPrivateKey', function() { importPrivateKey(); });
  on('btnExportPrivateKey', function() { exportPrivateKey(); });
  on('btnEncryptWallet', function() { encryptWallet(); });
  on('btnChangePassphrase', function() { changePassphrase(); });
  on('btnUnlockWallet', function() { unlockWallet(); });
  on('btnLockWallet', function() { lockWallet(); });
  on('btnBackupWallet', function() { backupWallet(); });
  on('btnRestoreWallet', function() { restoreWallet(); });

  // Transaction detail modal. The guard keeps a click inside the modal from
  // closing it: only a click on the overlay itself counts.
  on('txModal', function(e) { if (e.target === e.currentTarget) closeTxModal(); });
  on('btnTxModalClose', function() { closeTxModal(); });

  // Send confirmation modal
  on('btnConfirmModalClose', function() { cancelSend(); });
  on('btnCancelSend', function() { cancelSend(); });
  on('btnConfirmSend', function() { confirmSend(); });

  // Pagination is rebuilt by innerHTML on every render, so the listener sits on
  // the container instead of on the buttons.
  var pagination = document.getElementById('txPagination');
  if (pagination) {
    pagination.addEventListener('click', function(e) {
      var btn = e.target.closest('.page-btn');
      if (btn) loadAllTransactions(Number(btn.dataset.page));
    });
  }
});
