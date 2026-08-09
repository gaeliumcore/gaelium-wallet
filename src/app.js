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
  const exportedKey = document.getElementById('exportedKeyValue');
  if (exportedKey) exportedKey.textContent='';
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
  return symbol + n.toLocaleString(undefined, { maximumSignificantDigits: 4 });
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
let _startupAttempts = 0;
let _rebuildDetected = false;
let _rebuildDismissed = false;
let _initialHeadersChecked = false;
let _isPostUpgradeContext = false;
function getStartupPhase(errorMsg) {
  var m = String(errorMsg).toLowerCase();
  if (m.includes('loading wallet')) return 'Loading wallet...';
  if (m.includes('loading block')) return 'Loading block index...';
  if (m.includes('verifying')) return 'Verifying blocks...';
  if (m.includes('loading') || m.includes('rewinding') || m.includes('rescanning')) return 'Loading...';
  return 'Starting Gaelium Core...';
}
async function updateDashboard() {
  try {
    const d = await window.gaelium.getBalance();
    if (d.error) {
      _startupAttempts++;
      var phase = getStartupPhase(d.error);
      document.getElementById('syncText').textContent = phase;
      if (_startupAttempts < 30) {
        document.getElementById('balanceAddress').textContent = phase;
      } else {
        document.getElementById('balanceAddress').textContent = 'Unable to connect to Gaelium daemon. Please restart the wallet or check your firewall settings.';
      }
      return;
    }
    _startupAttempts = 0;
    if (!_initialHeadersChecked) {
      _initialHeadersChecked = true;
      try {
        var wi = await window.gaelium.getWalletInfo();
        if (wi && typeof wi.keypoololdest === 'number') {
          _isPostUpgradeContext = (Math.floor(Date.now() / 1000) - wi.keypoololdest) > 60;
        }
      } catch(e) {}
    }
    document.getElementById('balanceAmount').innerHTML=formatAmount(d.balance)+'<span class="balance-currency"> GAEL</span>';
    let pp=[];
    if (d.unconfirmed>0) pp.push('Pending: '+formatAmount(d.unconfirmed)+' GAEL');
    if (d.immature>0) pp.push('Immature: '+formatAmount(d.immature)+' GAEL');
    document.getElementById('balancePending').textContent=pp.join(' | ');
    var syncing = d.headers > 0 && (d.headers - d.blocks) > 2;
    var blocksEl = document.getElementById('statBlocks');
    var rewardEl = document.getElementById('statReward');
    if (syncing) {
      var pct = Math.min(99.9, ((d.blocks / d.headers) * 100)).toFixed(1);
      blocksEl.textContent = d.blocks.toLocaleString() + ' / ' + d.headers.toLocaleString();
      rewardEl.innerHTML = '<div class="sync-progress-bar"><div class="sync-progress-fill" style="width:' + pct + '%"></div></div>';
      document.getElementById('syncText').textContent = 'Syncing ' + d.blocks.toLocaleString() + ' / ' + d.headers.toLocaleString() + ' (' + pct + '%)';
      document.getElementById('bottomBlock').textContent = d.blocks.toLocaleString() + ' / ' + d.headers.toLocaleString();
      document.getElementById('balanceAddress').textContent = 'Synchronizing with the Gaelium network (' + pct + '%)...';
    } else {
      blocksEl.textContent = d.blocks.toLocaleString();
      rewardEl.textContent = 'Reward: 1,000 GAEL';
      document.getElementById('syncText').textContent = 'Synced \u2014 Block ' + d.blocks;
      document.getElementById('bottomBlock').textContent = d.blocks;
      document.getElementById('balanceAddress').textContent = 'Connected to the Gaelium Core Network (GAEL)';
    }
    // Rebuild post-upgrade detection: blocks starting from 0 but headers already at tip
    var rebuildBanner = document.getElementById('rebuildBanner');
    if (!_rebuildDismissed && _isPostUpgradeContext) {
      if (d.headers > 1000 && d.blocks < (d.headers - 5)) {
        if (_rebuildDetected || d.blocks < 100) {
          _rebuildDetected = true;
          rebuildBanner.classList.add('visible');
          var rbPct = Math.min(99, ((d.blocks / d.headers) * 100)).toFixed(1);
          document.getElementById('rebuildProgress').style.width = rbPct + '%';
        }
      } else if (_rebuildDetected) {
        _rebuildDismissed = true;
        rebuildBanner.classList.remove('visible');
      }
    }

    document.getElementById('statHash').textContent=formatHash(d.networkhashps);
    document.getElementById('statPeers').textContent=d.connections;
    document.getElementById('statDiff').textContent='Diff: '+parseFloat(d.difficulty).toFixed(4);
    document.getElementById('bottomPeers').textContent=d.connections;
    document.getElementById('bottomHash').textContent=formatHash(d.networkhashps);
    const txs = await window.gaelium.listTransactions(30);
    if (!txs.error && txs.length>0) {
      lastTxList=filterChangeTx(txs.reverse().filter(tx=>tx.txid!=='9280011d752efed0c25a1d8a3fbd5d9ba50b953cac65f994b9d95437c9be6cfe')); let h=''; lastTxList.slice(0,8).forEach(tx => h+=buildTxItem(tx));
      document.getElementById('txList').innerHTML=h;
    } else { document.getElementById('txList').innerHTML='<div class="loading">No transactions yet</div>'; }
  } catch(e) { document.getElementById('balanceAddress').textContent='Connecting to daemon...'; }
}
async function loadReceiveAddress() {
  try {
    // Show last existing address, don't create a new one each time
    const addrs = await window.gaelium.listReceivedByAddress();
    if (addrs && Array.isArray(addrs) && addrs.length > 0) {
      // Take the last address (most recently created)
      const last = addrs[addrs.length - 1];
      document.getElementById('receiveAddress').textContent = last.address;
    } else {
      // No addresses at all - create the first one
      const a = await window.gaelium.getNewAddress('default');
      if (!a.error) document.getElementById('receiveAddress').textContent = a;
    }
  } catch(e) {}
}
function copyAddress() {
  navigator.clipboard.writeText(document.getElementById('receiveAddress').textContent);
  const s=document.getElementById('receiveStatus');
  s.className='status-msg success'; s.textContent='Address copied!';
  setTimeout(()=>s.className='status-msg',3000);
}
async function generateNewAddress() {
  try {
    const label = document.getElementById('newAddrLabel').value.trim();
    const a = await window.gaelium.getNewAddress(label);
    if (!a.error) {
      document.getElementById('receiveAddress').textContent=a;
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
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;" data-copy-addr="'+safeAddr+'">';
      html += '<div style="flex:1;min-width:0;"><div style="font-size:13px;">'+labelDisplay+'<span style="font-family:JetBrains Mono,monospace;color:var(--text-secondary);font-size:12px;">'+safeSa+'</span></div>';
      html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;"><span class="copy-hint">Click to copy</span></div></div></div>';
    });
    container.innerHTML=html;
    container.querySelectorAll('[data-copy-addr]').forEach(el => {
      el.addEventListener('click', function() {
        navigator.clipboard.writeText(this.dataset.copyAddr);
        const hint = this.querySelector('span.copy-hint');
        if (hint) { hint.textContent='Copied!'; setTimeout(()=>hint.textContent='Click to copy',2000); }
      });
    });
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
      status.innerHTML='<strong>Private Key:</strong><br><span id="exportedKeyValue" style="font-family:JetBrains Mono,monospace;word-break:break-all;font-size:12px;user-select:all;"></span><br><br><em style="font-size:11px;">Copy this key and store it safely. It will be cleared in 60 seconds.</em>';
      document.getElementById('exportedKeyValue').textContent=result;
      // Auto-clear private key from DOM after 60 seconds
      setTimeout(()=>{ const el=document.getElementById('exportedKeyValue'); if(el) el.textContent='[cleared]'; },60000);
    }
  } catch(e) {
    status.style.background='var(--red-soft)'; status.style.color='var(--red)';
    status.textContent='Error: ' + String(e);
  }
}

    
    var lastTxList = [];
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
      rows+='<div class="tx-modal-row"><span class="tx-modal-label">Address</span><span class="tx-modal-value">'+escapeHtml(tx.address||'N/A')+'</span></div>';
      rows+='<div class="tx-modal-row"><span class="tx-modal-label">Transaction ID</span><span class="tx-modal-value" style="font-size:11px;">'+escapeHtml(tx.txid)+'</span></div>';
      rows+='<div class="tx-modal-row"><span class="tx-modal-label">Confirmations</span><span class="tx-modal-value">'+escapeHtml(tx.confirmations||0)+'</span></div>';
      if(tx.blockhash) rows+='<div class="tx-modal-row"><span class="tx-modal-label">Block Hash</span><span class="tx-modal-value" style="font-size:11px;">'+escapeHtml(tx.blockhash)+'</span></div>';
      if(tx.blockheight) rows+='<div class="tx-modal-row"><span class="tx-modal-label">Block Height</span><span class="tx-modal-value">'+escapeHtml(tx.blockheight)+'</span></div>';
      if(tx.time) rows+='<div class="tx-modal-row"><span class="tx-modal-label">Date</span><span class="tx-modal-value">'+escapeHtml(new Date(tx.time*1000).toLocaleString())+'</span></div>';
      document.getElementById('txModalBody').innerHTML=rows;
      document.getElementById('txModalTitle').textContent=status;
      document.getElementById('txModal').classList.add('active');
    }
    function closeTxModal() { document.getElementById('txModal').classList.remove('active'); }

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
  document.getElementById('confirmAmount').textContent=amt + ' GAEL';
  document.getElementById('confirmAddress').textContent=addr;
  document.getElementById('confirmFee').textContent='~0.003 GAEL';
  document.getElementById('confirmTotal').textContent=(amt + 0.003).toFixed(3) + ' GAEL';
  document.getElementById('confirmModal').classList.add('active');
}
async function fillMaxAmount() {
  try {
    const d = await window.gaelium.getBalance();
    if (!d.error && d.balance > 0) {
      const max = Math.max(0, d.balance - 0.01);
      document.getElementById('sendAmount').value = max.toFixed(8);
    }
  } catch(e) {}
}
function cancelSend() {
  document.getElementById('confirmModal').classList.remove('active');
}
async function confirmSend() {
  document.getElementById('confirmModal').classList.remove('active');
  const addr=document.getElementById('sendAddress').value.trim();
  const amt=parseFloat(document.getElementById('sendAmount').value);
  const st=document.getElementById('sendStatus');
  const btn=document.getElementById('sendBtn');
  btn.disabled=true; btn.textContent='Sending...';
  try {
    const tx=await window.gaelium.sendToAddress(addr,amt);
    if (tx.error) { const errMsg = tx.error.message||tx.error; if (String(errMsg).includes('Insufficient') || String(errMsg).includes('Amount exceeds')) { st.className='status-msg error'; st.textContent='Insufficient funds. Remember to account for the network fee (~0.003 GAEL).'; } else { st.className='status-msg error'; st.textContent='Error: '+errMsg; } }
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
  if (txItem) showTxDetail(txItem.dataset.txid);
});
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

updateDashboard();
setInterval(updateDashboard, 10000);
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
