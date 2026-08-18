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
function showStartupNotice(show) {
  var el = document.getElementById('startupNotice');
  if (el) el.classList.toggle('visible', show);
}
// True from the first answer the daemon ever gives. After that the daemon is
// running, whatever a later poll says, so no message may claim it is starting.
let _daemonHasAnswered = false;

// The height the network says the chain is at. Every peer announces it in its
// version message, so it is known within seconds of the first connection, long
// before the local header counter has finished climbing. Using it as the
// denominator makes the percentage true from the first poll instead of after a
// minute, and removes the target that used to grow under it in steps of two
// thousand.
//
// verificationprogress cannot serve as a substitute. Gaelium ships chainTxData
// as three zeroes, which makes GuessVerificationProgress divide nChainTx by
// itself, so the value is exactly one from the genesis block onward. It was
// measured at one for the whole of a sync from block zero to block thirty
// thousand.
let _syncTarget = 0;
// Peer heights lag the tip by a block or two while one is being announced.
const TARGET_TOLERANCE = 4;
// Share of the progress figure the header phase is worth. Headers take about
// forty five seconds and blocks about twenty minutes on the same machine, so
// headers are a few per cent of the wait. Giving them five keeps the figure
// moving during those seconds without overstating what they buy, and it means
// one number that only ever goes up, rather than a bar that fills during the
// headers and empties again when the blocks start.
const HEADER_PHASE_SHARE = 5;

// Agreed height, not highest. A single peer that is desynchronised, or lying,
// must not be able to set the target on its own, so the value the most peers
// report wins and a tie goes to the higher one.
// The counters keep the values of the last poll that succeeded. A failed poll
// leaves them on screen, so they have to be marked as not current rather than
// sitting next to a fresh message as though they had just been read.
const STALE_IDS = ['statBlocks', 'statHash', 'statPeers', 'statDiff', 'bottomBlock', 'bottomPeers', 'bottomHash'];
function markCountersStale(stale) {
  STALE_IDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('stale', stale);
    if (stale) el.title = 'Last known value. The daemon did not answer the latest poll.';
    else el.removeAttribute('title');
  });
}

function getStartupPhase(errorMsg) {
  var m = String(errorMsg).toLowerCase();
  if (m.includes('loading wallet')) return 'Loading wallet...';
  if (m.includes('loading block')) return 'Loading block index...';
  if (m.includes('verifying')) return 'Verifying blocks...';
  if (m.includes('loading') || m.includes('rewinding') || m.includes('rescanning')) return 'Loading...';
  // A timed out call is not a daemon that failed to start. It is a daemon busy
  // enough that it did not answer within the deadline, which is what happens
  // for minutes on end while the block headers come in.
  if (m.includes('timeout')) return 'Gaelium Core is busy, waiting for it to answer...';
  // Only reachable before the daemon has ever answered.
  if (!_daemonHasAnswered) return 'Starting Gaelium Core...';
  return 'Waiting for Gaelium Core to answer...';
}
// setInterval fired every ten seconds whether or not the previous run had
// finished. The batch it drives is four sequential calls with a ten second
// deadline each, so it could take longer than the period and runs could pile up
// on a daemon that was already too busy to answer. This flag makes overlap
// impossible from any caller, not only from the scheduler.
let _dashboardInFlight = false;
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
let _pollDelayMs = POLL_STARTUP_MS;

// ---------------------------------------------------------------------------
// Sync display.
//
// One state, held in one variable, rather than five booleans that could
// contradict each other. Everything on the screen is a function of it.
//
//   STARTING     no chain answer yet
//   SYNCING      answered, and behind
//   SYNCED       answered, and up to date
//   STALLED      answered once, then stopped
//   UNREACHABLE  never answered at all
//
// The design deliberately does not try to detect the end of the header download.
// Nothing the daemon publishes says when that happens: verificationprogress is
// stuck at one on this chain, the peer heights come from a call that can fail,
// and a block count of zero is only true on a fast machine, measured at sixteen
// blocks by the fifth poll on a slower one. Instead the denominator is watched
// for stability, and every way of being wrong about it is made harmless.
const CHAIN_POLL_MS = {
  STARTING: 1500,
  // While the target is still moving. Both of the first two calls in the batch
  // wait during this phase, measured at ten and nine point six seconds at worst,
  // so the loop rearms five seconds after the previous run settles, not five
  // seconds after it started.
  SYNCING_UNSETTLED: 5000,
  // While it is not. Every call is under two milliseconds here, and the figure
  // moves two or three points between two polls, which is plainly visible.
  SYNCING_SETTLED: 15000,
  SYNCED: 10000,
  STALLED: 5000,
  UNREACHABLE: 5000
};
// The header count changes every few seconds while it downloads and only when a
// block is mined afterwards, once or twice a minute. Twelve seconds sits inside
// that gap. A slow link pausing longer than this between two batches makes the
// target look settled early, which is why the shown percentage is clamped: the
// worst case is a figure that pauses, never one that goes backwards.
const TARGET_SETTLE_MS = 12000;
// A header batch moves the count by two thousand. A block mined by the network
// during the sync moves it by one. Only the first kind counts as the target
// still arriving, otherwise every new block near the end of a sync throws the
// display back to the absolute figures for twelve seconds. That flapping was
// seen on the replay of a real run, at the point where the chain grew from
// 44300 to 44301.
const TARGET_STEP_TOLERANCE = 16;
// Neither figure moving for this long is not a sync, whatever else is true.
const NO_PROGRESS_MS = 90000;
// Measured: twenty two failures out of a hundred and four polls, every one of
// them on its own. Three in a row is not something an ordinary sync produces.
const CHAIN_MISS_LIMIT = 3;
const SYNCED_SLACK = 2;
const WALLET_POLL_SYNCING_MS = 60000;
const WALLET_POLL_SYNCED_MS = 10000;

let _chainState = 'STARTING';
let _chainStateSince = Date.now();
let _chainMisses = 0;
// Grows only. A denominator that can shrink is a percentage that can jump.
let _targetSeen = 0;
let _targetChangedAt = Date.now();
// When either figure last moved, whatever the state.
let _lastProgressAt = Date.now();
let _lastBlocks = -1;
// Highest percentage already shown. Never show less than this.
let _shownPct = 0;
let _chainBusy = false;
let _walletBusy = false;
let _walletMisses = 0;

function targetSettled() {
  return _targetSeen > 0 && (Date.now() - _targetChangedAt) >= TARGET_SETTLE_MS;
}
function enterChainState(next) {
  if (_chainState === next) return;
  _chainState = next;
  _chainStateSince = Date.now();
}
function secondsSince(t) { return Math.floor((Date.now() - t) / 1000); }
function setLine(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

// The only thing that moves while the wallet is waiting. It claims no progress,
// it says how long the wait has been, which is the question a still screen asks.
// One timer for the whole file, and it writes only in the states that need it.
function paintWaiting() {
  if (_chainState === 'STARTING') {
    if (secondsSince(_chainStateSince) * 1000 > SLOW_START_NOTICE_MS) {
      showStartupNotice(true);
      setLine('syncText', 'Starting, ' + secondsSince(_chainStateSince) + 's');
    }
    return;
  }
  if (_chainState === 'UNREACHABLE') {
    setLine('syncText', 'No answer, ' + secondsSince(_chainStateSince) + 's');
    return;
  }
  if (_chainState === 'STALLED') {
    setLine('syncText', 'No answer, ' + secondsSince(_chainStateSince) + 's');
    return;
  }
  if (_chainState === 'SYNCING' && (Date.now() - _lastProgressAt) > NO_PROGRESS_MS) {
    setLine('syncText', 'No progress, ' + secondsSince(_lastProgressAt) + 's');
  }
}

function onChainMiss(message) {
  _chainMisses++;
  if (_chainState === 'STARTING') {
    // The daemon refuses calls for about three seconds while it loads, and says
    // which step it is on. That message is the most useful thing there is here.
    setLine('syncText', getStartupPhase(message));
    setLine('balanceAddress', getStartupPhase(message));
    if (Date.now() - _chainStateSince > UNREACHABLE_AFTER_MS) {
      enterChainState('UNREACHABLE');
      setLine('balanceAddress', 'Unable to connect to Gaelium daemon. Please restart the wallet or check your firewall settings.');
    }
    return;
  }
  if (_chainState === 'UNREACHABLE') return;
  // Two misses in a row before the figures are called doubtful, three before
  // anything is said. One miss changes nothing at all.
  if (_chainMisses >= 2) markCountersStale(true);
  if (_chainMisses >= CHAIN_MISS_LIMIT && _chainState !== 'STALLED') {
    enterChainState('STALLED');
    setLine('balanceAddress', 'Gaelium Core has not answered for a while. Still trying.');
  }
}

function onChainAnswer(c) {
  _chainMisses = 0;
  _daemonHasAnswered = true;
  markCountersStale(false);
  showStartupNotice(false);

  var blocks = typeof c.blocks === 'number' ? c.blocks : 0;
  var headers = typeof c.headers === 'number' ? c.headers : 0;
  if (headers > _targetSeen) {
    var jump = headers - _targetSeen;
    _targetSeen = headers;
    if (jump > TARGET_STEP_TOLERANCE) _targetChangedAt = Date.now();
    _lastProgressAt = Date.now();
  }
  if (blocks !== _lastBlocks) { _lastBlocks = blocks; _lastProgressAt = Date.now(); }

  var behind = _targetSeen - blocks;
  enterChainState(behind > SYNCED_SLACK ? 'SYNCING' : 'SYNCED');

  var blocksEl = document.getElementById('statBlocks');
  var rewardEl = document.getElementById('statReward');
  var labelEl = document.getElementById('statBlocksLabel');

  if (_chainState === 'SYNCED') {
    _shownPct = 100;
    if (labelEl) labelEl.textContent = 'Block Height';
    if (blocksEl) blocksEl.textContent = blocks.toLocaleString();
    if (rewardEl) rewardEl.textContent = 'Reward: 1,000 GAEL';
    setLine('syncText', 'Synced at block ' + blocks);
    setLine('bottomBlock', String(blocks));
    setLine('balanceAddress', 'Connected to the Gaelium Core Network (GAEL)');
  } else if (!targetSettled()) {
    // The target is still climbing, so no fraction of it can mean anything. Two
    // absolute figures instead, both true and both rising, named so that nobody
    // takes one for the other.
    if (labelEl) labelEl.textContent = 'Downloading Chain';
    if (blocksEl) blocksEl.textContent = blocks.toLocaleString() + ' blocks verified';
    if (rewardEl) rewardEl.textContent = _targetSeen.toLocaleString() + ' headers received';
    setLine('syncText', _targetSeen.toLocaleString() + ' headers, ' + blocks.toLocaleString() + ' blocks');
    setLine('bottomBlock', blocks.toLocaleString() + ' / ' + _targetSeen.toLocaleString());
    setLine('balanceAddress', 'Downloading the chain from the network...');
  } else {
    var raw = _targetSeen > 0 ? (blocks / _targetSeen) * 100 : 0;
    // Clamped so it can never fall, whatever the target does afterwards.
    _shownPct = Math.max(_shownPct, Math.min(99.9, Math.max(0, raw)));
    var pct = _shownPct.toFixed(1);
    var counter = blocks.toLocaleString() + ' / ' + _targetSeen.toLocaleString();
    if (labelEl) labelEl.textContent = 'Block Height';
    if (blocksEl) blocksEl.textContent = counter;
    if (rewardEl) rewardEl.innerHTML = '<div class="sync-progress-bar"><div class="sync-progress-fill" style="width:' + pct + '%"></div></div>';
    setLine('syncText', 'Syncing ' + counter + ' (' + pct + '%)');
    setLine('bottomBlock', counter);
    setLine('balanceAddress', 'Synchronizing with the Gaelium network (' + pct + '%)...');
  }

  // A call that did not answer leaves its own tile alone rather than writing a
  // null over a figure that was right a moment ago.
  if (typeof c.networkhashps === 'number') {
    setLine('statHash', formatHash(c.networkhashps));
    setLine('bottomHash', formatHash(c.networkhashps));
  }
  if (typeof c.connections === 'number') {
    setLine('statPeers', String(c.connections));
    setLine('bottomPeers', String(c.connections));
  }
  if (typeof c.difficulty === 'number') {
    setLine('statDiff', 'Diff: ' + parseFloat(c.difficulty).toFixed(4));
  }
}

async function pollChain() {
  if (_chainBusy) return;
  _chainBusy = true;
  var wasSyncing = _chainState === 'SYNCING';
  try {
    const c = await window.gaelium.getChainState();
    if (c && c.error) onChainMiss(c.error);
    else if (c) onChainAnswer(c);
    else onChainMiss('empty answer');
  } catch (e) {
    onChainMiss(e && e.message ? e.message : String(e));
  } finally {
    _chainBusy = false;
  }
  // Coming out of a sync is when the final balance appears and the note under it
  // has to go, and the wallet is on a one minute period while syncing.
  if (wasSyncing && _chainState === 'SYNCED') pollWallet();
}

async function pollWallet() {
  if (_walletBusy) return;
  _walletBusy = true;
  try {
    const w = await window.gaelium.getWalletState();
    if (!w || w.error) { _walletMisses++; return; }
    _walletMisses = 0;
    document.getElementById('balanceAmount').innerHTML = formatAmount(w.balance) + '<span class="balance-currency"> GAEL</span>';
    let pp = [];
    if (w.unconfirmed > 0) pp.push('Pending: ' + formatAmount(w.unconfirmed) + ' GAEL');
    if (w.immature > 0) pp.push('Immature: ' + formatAmount(w.immature) + ' GAEL');
    // A wallet restored from a backup reads zero for the whole of the sync,
    // which is correct and alarming at the same time.
    if (_chainState === 'SYNCING' || _chainState === 'STARTING') pp.push('Not final until the sync completes');
    setLine('balancePending', pp.join(' | '));
    const txs = await window.gaelium.listTransactions(30);
    if (!txs.error && txs.length > 0) {
      lastTxList = filterChangeTx(txs.reverse().filter(tx => tx.txid !== '9280011d752efed0c25a1d8a3fbd5d9ba50b953cac65f994b9d95437c9be6cfe'));
      let h = '';
      lastTxList.slice(0, 8).forEach(tx => h += buildTxItem(tx));
      document.getElementById('txList').innerHTML = h;
    } else if (!txs.error) {
      document.getElementById('txList').innerHTML = '<div class="loading">No transactions yet</div>';
    }
  } catch (e) {
    _walletMisses++;
  } finally {
    _walletBusy = false;
  }
}

// Kept for the places that refresh after an action and want both at once.
async function updateDashboard() {
  await pollChain();
  await pollWallet();
}

// Schedules the next run only once the current one has settled, so the gap
// between two runs is a real gap and never an overlap.
// One loop for both polls, and the reason it is written this way is the bug that
// blanked the screen tonight. The previous version was a then with no catch, so
// a single exception anywhere in the body left nothing to rearm the timer and
// the wallet sat on its opening text until it was closed. Here the catch comes
// before the then, and the call itself is wrapped, so the next run is armed
// whatever happens, including a synchronous throw.
function loop(run, delay) {
  const tick = () => {
    let p;
    try { p = run(); } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).catch(() => {}).then(() => { setTimeout(tick, delay()); });
  };
  tick();
}

function chainDelay() {
  if (_chainState === 'SYNCING') {
    return targetSettled() ? CHAIN_POLL_MS.SYNCING_SETTLED : CHAIN_POLL_MS.SYNCING_UNSETTLED;
  }
  return CHAIN_POLL_MS[_chainState] || CHAIN_POLL_MS.SYNCED;
}
function walletDelay() {
  if (_chainState === 'STARTING') return CHAIN_POLL_MS.STARTING;
  return _chainState === 'SYNCED' ? WALLET_POLL_SYNCED_MS : WALLET_POLL_SYNCING_MS;
}

function scheduleDashboard() {
  loop(pollChain, chainDelay);
  loop(pollWallet, walletDelay);
  setInterval(paintWaiting, 1000);
}
// The address the Receive screen is showing. setReceiveAddress is the only
// writer, which is what keeps the highlighted address and the QR in step.
let selectedReceiveAddress = null;

// Labels belong to the daemon, not to addresses.json, which holds a labels map
// that nothing has ever written. They are kept here as a plain map, filled when
// the history is loaded, so that the label of the selected address can be read
// without waiting. An asynchronous lookup inside setReceiveAddress could answer
// after a later selection and leave a label from one address beside the QR code
// of another.
let addressLabels = {};

// Puts the label of the selected address above the QR code, or hides the line
// when there is none. The text is user supplied and is placed with textContent,
// never built into an HTML string.
function applySelectedAddressLabel() {
  const el = document.getElementById('receiveLabel');
  if (!el) return;
  const label = addressLabels[selectedReceiveAddress];
  if (typeof label === 'string' && label.length > 0) {
    el.textContent = label;
    el.style.display = 'block';
  } else {
    el.textContent = '';
    el.style.display = 'none';
  }
}

// Applies the current selection to whatever rows the history holds right now.
// Called both when the selection changes and when the list is rebuilt, because
// the two are loaded in parallel and either one can finish first.
function markSelectedAddressRow() {
  const container = document.getElementById('addressHistory');
  if (!container) return;
  container.querySelectorAll('[data-copy-addr]').forEach(el => {
    el.classList.toggle('selected', el.dataset.copyAddr === selectedReceiveAddress);
  });
}

// Single path for the receive address: whoever writes the text writes the QR.
function setReceiveAddress(addr) {
  selectedReceiveAddress = addr;
  document.getElementById('receiveAddress').textContent = addr;
  markSelectedAddressRow();
  applySelectedAddressLabel();
  var img = document.getElementById('receiveQr');
  if (!img) return;
  var url = qrDataUrl(addr, 512);
  if (url) { img.src = url; img.style.display = 'block'; }
  else { img.removeAttribute('src'); img.style.display = 'none'; }
}
async function loadReceiveAddress() {
  try {
    // Show last existing address, don't create a new one each time
    const addrs = await window.gaelium.listReceivedByAddress();
    if (addrs && Array.isArray(addrs) && addrs.length > 0) {
      // Take the last address (most recently created)
      const last = addrs[addrs.length - 1];
      setReceiveAddress(last.address);
    } else {
      // No addresses at all - create the first one
      const a = await window.gaelium.getNewAddress('default');
      if (!a.error) setReceiveAddress(a);
    }
  } catch(e) {}
}
function copyAddress() {
  if (!selectedReceiveAddress) return;
  navigator.clipboard.writeText(selectedReceiveAddress);
  const s=document.getElementById('receiveStatus');
  s.className='status-msg success'; s.textContent='Address copied!';
  setTimeout(()=>s.className='status-msg',3000);
}
async function generateNewAddress() {
  try {
    const label = document.getElementById('newAddrLabel').value.trim();
    const a = await window.gaelium.getNewAddress(label);
    if (!a.error) {
      setReceiveAddress(a);
      document.getElementById('newAddrLabel').value='';
      // Add to top of ordered list
      const meta = await window.gaelium.loadAddressMeta();
      const order = meta.order || [];
      if (!order.includes(a)) order.unshift(a);
      meta.order = order;
      await window.gaelium.saveAddressMeta(meta);
      const s=document.getElementById('receiveStatus');
      s.className='status-msg success'; s.textContent='New address generated!';
      setTimeout(()=>s.className='status-msg',3000);
      loadAddressHistory();
    }
  } catch(e) {}
}
async function loadAddressHistory() {
  try {
    const addrs = await window.gaelium.listReceivedByAddress();
    if (addrs.error || !Array.isArray(addrs)) return;
    // The one place that learns labels from the daemon, so the one place that
    // fills the map. Rebuilt rather than merged, so a label removed on the
    // daemon side stops being shown here.
    addressLabels = {};
    addrs.forEach(a => {
      const l = a.label || a.account;
      if (typeof l === 'string' && l.length > 0) addressLabels[a.address] = l;
    });
    const container = document.getElementById('addressHistory');
    if (addrs.length === 0) { container.innerHTML='<div style="color:var(--text-muted);font-size:13px;">No addresses yet.</div>'; return; }
    let html = '';
    addrs.reverse();
    addrs.forEach(a => {
      const label = a.label || a.account || '';
      const safeLabel = escapeHtml(label);
      const labelDisplay = label ? '<span style="color:var(--green-light);font-weight:600;">'+safeLabel+'</span> - ' : '';
      const addr = a.address;
      const safeAddr = escapeHtml(addr);
      const sa = addr.length>34 ? addr.substring(0,16)+'...'+addr.substring(addr.length-8) : addr;
      const safeSa = escapeHtml(sa);
      html += '<div class="addr-row" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;" data-copy-addr="'+safeAddr+'">';
      html += '<div style="flex:1;min-width:0;"><div style="font-size:13px;">'+labelDisplay+'<span style="font-family:JetBrains Mono,monospace;color:var(--text-secondary);font-size:12px;">'+safeSa+'</span></div>';
      html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;"><span class="copy-hint">Click to copy</span></div></div></div>';
    });
    container.innerHTML=html;
    container.querySelectorAll('[data-copy-addr]').forEach(el => {
      el.addEventListener('click', function() {
        // Selecting redraws the address and the QR together, then the copy
        // happens exactly as it did before.
        setReceiveAddress(this.dataset.copyAddr);
        navigator.clipboard.writeText(this.dataset.copyAddr);
        const hint = this.querySelector('span.copy-hint');
        if (hint) { hint.textContent='Copied!'; setTimeout(()=>hint.textContent='Click to copy',2000); }
      });
    });
    markSelectedAddressRow();
    applySelectedAddressLabel();
  } catch(e) { console.error('loadAddressHistory error:', e); }
}
async function importPrivateKey() {
      const key = document.getElementById('importKeyInput').value.trim();
      const label = document.getElementById('importKeyLabel').value.trim();
      const status = document.getElementById('importStatus');
      
      if (!key) {
        status.style.display = 'block';
        status.style.background = 'var(--red-soft)';
        status.style.color = 'var(--red)';
        status.textContent = 'Please enter a private key';
        return;
      }
      
      status.style.display = 'block';
      status.style.background = 'var(--green-soft)';
      status.style.color = 'var(--green-light)';
      status.textContent = 'Importing key and scanning blockchain... This may take a few minutes.';

      try {
        const result = await window.gaelium.importPrivKey(key, label, true);
        if (result && result.error) {
          status.style.background = 'var(--red-soft)';
          status.style.color = 'var(--red)';
          status.textContent = 'Error: ' + result.error;
        } else {
          status.style.background = 'var(--green-soft)';
          status.style.color = 'var(--green-light)';
          status.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Private key imported successfully!';
          document.getElementById('importKeyInput').value = '';
          document.getElementById('importKeyLabel').value = '';
          updateDashboard();
        }
      } catch(e) {
        status.style.background = 'var(--red-soft)';
        status.style.color = 'var(--red)';
        status.textContent = 'Error: ' + String(e);
      }
    }
// One path clears the exported private key, text and QR together, and every
// caller goes through it. A key that vanishes from the text but stays on screen
// as a picture would be worse than no QR at all: the screen would look cleaned
// when it is not.
function clearExportedKey(text) {
  var el = document.getElementById('exportedKeyValue');
  if (el) el.textContent = text;
  var img = document.getElementById('exportedKeyQr');
  if (img) { img.removeAttribute('src'); img.style.display = 'none'; }
}
async function exportPrivateKey() {
  const addr = document.getElementById('exportAddress').value.trim();
  const status = document.getElementById('exportResult');
  if (!addr) {
    status.style.display='block'; status.style.background='var(--red-soft)'; status.style.color='var(--red)';
    status.textContent='Please enter a Gaelium address.'; return;
  }
  status.style.display='block'; status.style.background='var(--green-soft)'; status.style.color='var(--green-light)';
  status.textContent='Retrieving private key...';
  try {
    const result = await window.gaelium.dumpPrivKey(addr);
    if (result && result.error) {
      status.style.background='var(--red-soft)'; status.style.color='var(--red)';
      if (result.error.includes('not known') || result.error.includes('not found')) {
        status.textContent='Error: This address is not in your wallet.';
      } else {
        status.textContent='Error: ' + result.error;
      }
    } else {
      status.style.background='rgba(240,180,41,0.1)'; status.style.color='var(--yellow)';
      status.innerHTML='<strong>Private Key:</strong><br><span id="exportedKeyValue" style="font-family:JetBrains Mono,monospace;word-break:break-all;font-size:12px;user-select:all;"></span><br><img id="exportedKeyQr" alt="QR code of the private key" style="display:none;width:180px;height:180px;image-rendering:pixelated;border-radius:8px;margin:12px 0;"><br><em style="font-size:11px;">Copy this key and store it safely. It will be cleared in 60 seconds.</em>';
      document.getElementById('exportedKeyValue').textContent=result;
      const keyQr=document.getElementById('exportedKeyQr');
      const keyQrUrl=qrDataUrl(result, 512);
      if (keyQr && keyQrUrl) { keyQr.src=keyQrUrl; keyQr.style.display='block'; }
      // Auto-clear private key from DOM after 60 seconds, text and QR together
      setTimeout(()=>{ clearExportedKey('[cleared]'); },60000);
    }
  } catch(e) {
    status.style.background='var(--red-soft)'; status.style.color='var(--red)';
    status.textContent='Error: ' + String(e);
  }
}

    
    var lastTxList = [];
    // Same shape the main process enforces. Checked here only to decide whether
    // to draw the button at all, so that a transaction without a usable id shows
    // no link rather than a link that leads nowhere. The check that matters is
    // the one in the main process.
    const TXID_SHAPE = /^[0-9a-fA-F]{64}$/;
    function showTxDetail(txid) {
      const tx = lastTxList.find(t=>t.txid===txid);
      if(!tx) return;
      let status = tx.category;
      if(tx.category==='generate') status='Mined (Confirmed)';
      if(tx.category==='immature') status='Immature (Pending Maturity)';
      if(tx.category==='send') status='Sent';
      if(tx.category==='receive') status='Received';
      let rows = '';
      rows+='<div class="tx-modal-row"><span class="tx-modal-label">Status</span><span class="tx-modal-value">'+escapeHtml(status)+'</span></div>';
      rows+='<div class="tx-modal-row"><span class="tx-modal-label">Amount</span><span class="tx-modal-value" style="color:'+(tx.amount>=0?'var(--green-light)':'var(--red)')+'">'+escapeHtml(formatAmount(tx.amount))+' GAEL</span></div>';
      if(tx.fee) rows+='<div class="tx-modal-row"><span class="tx-modal-label">Fee</span><span class="tx-modal-value">'+escapeHtml(tx.fee)+' GAEL</span></div>';
      const hasAddress = typeof tx.address === 'string' && tx.address.length > 0;
      // Clickable only when there is something to open. An absent address stays
      // plain text rather than becoming a link that leads nowhere.
      rows+='<div class="tx-modal-row"><span class="tx-modal-label">Address</span>'
        + (hasAddress
            ? '<span class="tx-modal-value tx-modal-link" role="link" tabindex="0" title="Open on the explorer" data-explorer-address="'+escapeHtml(tx.address)+'">'+escapeHtml(tx.address)+'</span>'
            : '<span class="tx-modal-value">N/A</span>')
        + '</div>';
      rows+='<div class="tx-modal-row"><span class="tx-modal-label">Transaction ID</span><span class="tx-modal-value" style="font-size:11px;">'+escapeHtml(tx.txid)+'</span></div>';
      rows+='<div class="tx-modal-row"><span class="tx-modal-label">Confirmations</span><span class="tx-modal-value">'+escapeHtml(tx.confirmations||0)+'</span></div>';
      if(tx.blockhash) rows+='<div class="tx-modal-row"><span class="tx-modal-label">Block Hash</span><span class="tx-modal-value" style="font-size:11px;">'+escapeHtml(tx.blockhash)+'</span></div>';
      if(tx.blockheight) rows+='<div class="tx-modal-row"><span class="tx-modal-label">Block Height</span><span class="tx-modal-value">'+escapeHtml(tx.blockheight)+'</span></div>';
      if(tx.time) rows+='<div class="tx-modal-row"><span class="tx-modal-label">Date</span><span class="tx-modal-value">'+escapeHtml(new Date(tx.time*1000).toLocaleString())+'</span></div>';
      if(TXID_SHAPE.test(tx.txid||'')) {
        rows+='<button type="button" class="explorer-btn" data-explorer-txid="'+escapeHtml(tx.txid)+'">View on explorer</button>';
      }
      // Outside the test above, because the address row can report a failure
      // even when the transaction id is not usable.
      rows+='<div class="status-msg" id="txExplorerStatus"></div>';
      document.getElementById('txModalBody').innerHTML=rows;
      document.getElementById('txModalTitle').textContent=status;
      document.getElementById('txModal').classList.add('active');
    }
    function closeTxModal() { document.getElementById('txModal').classList.remove('active'); }

    // Id of the payment the main process has priced and is holding. The
    // renderer never sees the transaction itself.
    var pendingPlanId = null;

    async function sendTransaction() {
  const addr=document.getElementById('sendAddress').value.trim();
  const amt=parseFloat(document.getElementById('sendAmount').value);
  const st=document.getElementById('sendStatus');
  const btn=document.getElementById('sendBtn');
  if (!addr||!amt||amt<=0) { st.className='status-msg error'; st.textContent='Enter valid address and amount'; return; }
  try {
    const v=await window.gaelium.validateAddress(addr);
    if (!v.isvalid) { st.className='status-msg error'; st.textContent='Invalid Gaelium address'; return; }
  } catch(e) { st.className='status-msg error'; st.textContent='Could not validate address'; return; }
  // Price the payment before showing anything. The dialog opens only once the
  // daemon has funded the transaction, so the fee on screen is the fee that
  // will be deducted, not an estimate.
  btn.disabled=true; btn.textContent='Preparing...';
  st.className='status-msg'; st.textContent='Preparing transaction...';
  var plan;
  try {
    plan=await window.gaelium.prepareSend(addr,amt);
  } catch(e) {
    btn.disabled=false; btn.textContent='Send Transaction';
    st.className='status-msg error'; st.textContent='Error: '+e.message; return;
  }
  btn.disabled=false; btn.textContent='Send Transaction';
  if (!plan || plan.error) {
    const errMsg = plan && plan.error ? (plan.error.message||plan.error) : 'Could not prepare the transaction';
    st.className='status-msg error'; st.textContent='Error: '+errMsg; return;
  }
  st.className='status-msg'; st.textContent='';
  pendingPlanId=plan.planId;
  document.getElementById('confirmAmount').textContent=plan.amount.toFixed(8) + ' GAEL';
  document.getElementById('confirmAddress').textContent=plan.address;
  document.getElementById('confirmFee').textContent=plan.fee.toFixed(8) + ' GAEL';
  document.getElementById('confirmTotal').textContent=plan.total.toFixed(8) + ' GAEL';
  const w=document.getElementById('confirmFeeWarning');
  if (plan.warn) {
    w.textContent='The network fee is '+plan.warnPercent+' percent of the amount you are sending. Check the amount before confirming.';
    w.style.display='block';
  } else {
    w.textContent=''; w.style.display='none';
  }
  document.getElementById('confirmModal').classList.add('active');
}
async function fillMaxAmount() {
  // The largest sendable amount is the whole balance minus the fee of the
  // transaction that spends it, and that fee depends on how many outputs the
  // spend consumes. Only the daemon knows, so it is asked rather than guessed.
  const st=document.getElementById('sendStatus');
  const btn=document.getElementById('btnFillMaxAmount');
  const previous=btn?btn.textContent:null;
  if (btn) { btn.disabled=true; btn.textContent='...'; }
  try {
    const r = await window.gaelium.maxAmount();
    if (!r || r.error) {
      const errMsg = r && r.error ? (r.error.message||r.error) : 'Could not compute the maximum amount';
      st.className='status-msg error'; st.textContent='Error: '+errMsg;
      return;
    }
    document.getElementById('sendAmount').value = r.maxAmount.toFixed(8);
    st.className='status-msg'; st.textContent='';
  } catch(e) {
    st.className='status-msg error'; st.textContent='Error: '+e.message;
  } finally {
    if (btn) { btn.disabled=false; btn.textContent=previous; }
  }
}
function cancelSend() {
  document.getElementById('confirmModal').classList.remove('active');
  // Nothing to undo on the daemon side: pricing a payment reserves no output.
  pendingPlanId=null;
}
async function confirmSend() {
  document.getElementById('confirmModal').classList.remove('active');
  const st=document.getElementById('sendStatus');
  const btn=document.getElementById('sendBtn');
  const planId=pendingPlanId;
  pendingPlanId=null;
  if (!planId) { st.className='status-msg error'; st.textContent='No prepared transaction. Start the payment again.'; return; }
  btn.disabled=true; btn.textContent='Sending...';
  try {
    const tx=await window.gaelium.confirmSend(planId);
    if (tx.error) { const errMsg = tx.error.message||tx.error; if (String(errMsg).includes('Insufficient') || String(errMsg).includes('Amount exceeds')) { st.className='status-msg error'; st.textContent='Insufficient funds: the balance does not cover this amount plus the network fee. Use Max to fill in the largest amount you can send.'; } else { st.className='status-msg error'; st.textContent='Error: '+errMsg; } }
    else {
      st.className='status-msg success'; st.textContent='Sent! TxID: '+tx.substring(0,24)+'...';
      document.getElementById('sendAddress').value='';
      document.getElementById('sendAmount').value='';
      updateDashboard();
    }
  } catch(e) { st.className='status-msg error'; st.textContent='Error: '+e.message; }
  btn.disabled=false; btn.textContent='Send Transaction';
}
var txPageSize = 20;
var txCurrentPage = 0;
async function loadAllTransactions(page) {
  if (typeof page === 'number') txCurrentPage = page;
  var pg = txCurrentPage;
  try {
    // Fetch one extra to know if there is a next page
    const txs = await window.gaelium.listTransactions(txPageSize + 1, pg * txPageSize);
    if (!txs.error && txs.length > 0) {
      var hasNext = txs.length > txPageSize;
      var pageTxs = txs.slice(0, txPageSize);
      lastTxList = filterChangeTx(pageTxs.reverse().filter(tx => tx.txid !== '9280011d752efed0c25a1d8a3fbd5d9ba50b953cac65f994b9d95437c9be6cfe'));
      var h = '';
      lastTxList.forEach(tx => h += buildTxItem(tx));
      document.getElementById('txListFull').innerHTML = h;
      renderTxPagination(pg, hasNext);
    } else if (!txs.error) {
      document.getElementById('txListFull').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:14px;">No transactions found.</div>';
      document.getElementById('txPagination').style.display = 'none';
    }
  } catch(e) {}
}
function renderTxPagination(page, hasNext) {
  var el = document.getElementById('txPagination');
  if (page === 0 && !hasNext) { el.style.display = 'none'; return; }
  var h = '';
  h += '<button class="page-btn" data-page="0"' + (page === 0 ? ' disabled' : '') + '>&laquo;</button>';
  h += '<button class="page-btn" data-page="' + (page - 1) + '"' + (page === 0 ? ' disabled' : '') + '>&lsaquo; Prev</button>';
  var start = Math.max(0, page - 2);
  var end = page + 2;
  for (var i = start; i <= end; i++) {
    if (i > page && !hasNext) break;
    h += '<button class="page-btn' + (i === page ? ' active' : '') + '" data-page="' + i + '">' + (i + 1) + '</button>';
  }
  h += '<button class="page-btn" data-page="' + (page + 1) + '"' + (!hasNext ? ' disabled' : '') + '>Next &rsaquo;</button>';
  h += '<span class="page-info">Page ' + (page + 1) + '</span>';
  el.innerHTML = h;
  el.style.display = 'flex';
}
// Event delegation for transaction clicks (avoids inline onclick with unsanitized txid)
document.addEventListener('click', function(e) {
  const txItem = e.target.closest('.tx-item[data-txid]');
  if (txItem) { showTxDetail(txItem.dataset.txid); return; }
  // The explorer button lives inside the modal, which is rebuilt on every open,
  // so it is reached by the same delegation rather than rewired each time. Only
  // the id travels to the main process, never an address.
  const explorerBtn = e.target.closest('[data-explorer-txid]');
  if (explorerBtn) { openTxOnExplorer(explorerBtn.dataset.explorerTxid); return; }
  const explorerAddr = e.target.closest('[data-explorer-address]');
  if (explorerAddr) openAddressOnExplorer(explorerAddr.dataset.explorerAddress);
});
// Keyboard equivalent, since the address row is a link rather than a button.
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const explorerAddr = e.target.closest && e.target.closest('[data-explorer-address]');
  if (!explorerAddr) return;
  e.preventDefault();
  openAddressOnExplorer(explorerAddr.dataset.explorerAddress);
});
async function openAddressOnExplorer(address) {
  const s = document.getElementById('txExplorerStatus');
  try {
    const r = await window.gaelium.openExplorerAddress(address);
    if (r && r.error) {
      if (s) { s.className='status-msg error'; s.textContent='Could not open the explorer: '+r.error; }
      return;
    }
    if (s) s.className='status-msg';
  } catch (err) {
    if (s) { s.className='status-msg error'; s.textContent='Could not open the explorer: '+String(err); }
  }
}
async function openTxOnExplorer(txid) {
  const s = document.getElementById('txExplorerStatus');
  try {
    const r = await window.gaelium.openExplorerTx(txid);
    if (r && r.error) {
      if (s) { s.className='status-msg error'; s.textContent='Could not open the explorer: '+r.error; }
      return;
    }
    if (s) s.className='status-msg';
  } catch (err) {
    if (s) { s.className='status-msg error'; s.textContent='Could not open the explorer: '+String(err); }
  }
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

scheduleDashboard();
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
