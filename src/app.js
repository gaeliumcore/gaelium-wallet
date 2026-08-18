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
function agreedHeight(heights) {
  const counts = {};
  heights.forEach(function(h) { counts[h] = (counts[h] || 0) + 1; });
  let best = 0, bestCount = 0;
  Object.keys(counts).forEach(function(k) {
    const h = Number(k), c = counts[k];
    if (c > bestCount || (c === bestCount && h > best)) { best = h; bestCount = c; }
  });
  return best;
}

function updateSyncTarget(heights, localBlocks) {
  if (heights && heights.length) {
    const agreed = agreedHeight(heights);
    if (agreed > _syncTarget) {
      _syncTarget = agreed;
    } else if (agreed > 0 && agreed < _syncTarget && Math.max.apply(null, heights) <= agreed) {
      // Comes down only when no peer at all still claims the higher figure,
      // which is what a reorganisation looks like from here. Otherwise the
      // target never goes backwards.
      _syncTarget = agreed;
    }
  }
  // Our own chain having passed it is proof the target was too low.
  if (localBlocks > _syncTarget) _syncTarget = localBlocks;
  return _syncTarget;
}

// The counters keep the values of the last poll that succeeded. A failed poll
// leaves them on screen, so they have to be marked as not current rather than
// sitting next to a fresh message as though they had just been read.
const CHAIN_STALE_IDS = ['statBlocks', 'statHash', 'statPeers', 'statDiff', 'bottomBlock', 'bottomPeers', 'bottomHash'];
const WALLET_STALE_IDS = ['balanceAmount'];
function markStale(ids, stale) {
  ids.forEach(function(id) {
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
      markStale(CHAIN_STALE_IDS, true);
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
    var target = updateSyncTarget(d.peerHeights, d.blocks);
    // Until a peer has answered there is no announced height, so the old header
    // counter stands in. It lasts a second or two.
    var haveTarget = target > 0;
    var denom = haveTarget ? target : d.headers;
    // No peer has answered and our own chain is empty, so there is nothing to
    // measure against. Falling through here would divide by a header count of
    // zero, decide that nothing is left to do, and announce a wallet synced at
    // block zero, which is the worst thing this screen could say.
    var connecting = !haveTarget && d.connections === 0;
    var syncing = !connecting && denom > 0 && (denom - d.blocks) > 2;
    var headersComplete = d.headers >= denom - TARGET_TOLERANCE;
    // The wallet is asked again the moment this changes, in either direction.
    // Coming out of a sync is when the final balance appears and the note under
    // it has to go, and waiting a full minute for the next wallet poll to notice
    // would be the one delay nobody would forgive.
    var syncStateChanged = (syncing || connecting) !== _chainIsSyncing;
    _chainIsSyncing = syncing || connecting;
    if (connecting) _chainDelayMs = POLL_STARTUP_MS;
    else if (!syncing) _chainDelayMs = POLL_SYNCED_MS;
    else _chainDelayMs = headersComplete ? POLL_SYNCING_MS : POLL_HEADERS_MS;
    var blocksEl = document.getElementById('statBlocks');
    var rewardEl = document.getElementById('statReward');
    if (connecting) {
      blocksEl.textContent = d.blocks.toLocaleString();
      rewardEl.textContent = 'Connecting';
      document.getElementById('syncText').textContent = 'Connecting to the network';
      document.getElementById('bottomBlock').textContent = d.blocks.toLocaleString();
      document.getElementById('balanceAddress').textContent = 'Connecting to the Gaelium network...';
    } else if (syncing) {
      // One figure across both phases, so it only ever goes up. The headers are
      // worth the first few per cent and the blocks the rest. The wording says
      // which phase it is in, the number says how far along the whole thing is.
      var pct = headersComplete
        ? HEADER_PHASE_SHARE + (100 - HEADER_PHASE_SHARE) * (d.blocks / denom)
        : HEADER_PHASE_SHARE * (d.headers / denom);
      pct = Math.min(99.9, Math.max(0, pct)).toFixed(1);
      var counter = d.blocks.toLocaleString() + ' / ' + denom.toLocaleString();
      blocksEl.textContent = counter;
      rewardEl.innerHTML = '<div class="sync-progress-bar"><div class="sync-progress-fill" style="width:' + pct + '%"></div></div>';
      document.getElementById('bottomBlock').textContent = counter;
      if (!headersComplete) {
        document.getElementById('syncText').textContent = 'Headers ' + d.headers.toLocaleString() + ' / ' + denom.toLocaleString();
        document.getElementById('balanceAddress').textContent = 'Downloading block headers (' + pct + '%)...';
      } else {
        document.getElementById('syncText').textContent = 'Syncing ' + counter + ' (' + pct + '%)';
        document.getElementById('balanceAddress').textContent = 'Synchronizing with the Gaelium network (' + pct + '%)...';
      }
    } else {
      blocksEl.textContent = d.blocks.toLocaleString();
      rewardEl.textContent = 'Reward: 1,000 GAEL';
      document.getElementById('syncText').textContent = 'Synced at block ' + d.blocks;
      document.getElementById('bottomBlock').textContent = d.blocks;
      document.getElementById('balanceAddress').textContent = 'Connected to the Gaelium Core Network (GAEL)';
    }
    document.getElementById('statHash').textContent=formatHash(d.networkhashps);
    document.getElementById('statPeers').textContent=d.connections;
    document.getElementById('statDiff').textContent='Diff: '+parseFloat(d.difficulty).toFixed(4);
    document.getElementById('bottomPeers').textContent=d.connections;
    document.getElementById('bottomHash').textContent=formatHash(d.networkhashps);
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
      markStale(WALLET_STALE_IDS, true);
      if (!_daemonHasAnswered) _walletDelayMs = POLL_STARTUP_MS;
      return;
    }
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
