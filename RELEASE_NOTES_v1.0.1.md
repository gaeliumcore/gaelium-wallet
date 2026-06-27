# Gaelium Wallet v1.0.1 - Release Notes

**Release date:** [DATE TO BE FILLED ON PUSH DAY]
**Platforms:** Windows, Linux, macOS
**Compatibility:** Backward compatible with v1.0.0 wallet data (no migration needed, see Upgrade Notes below)

## Overview

v1.0.1 is a stability and security release focused on fixing user-reported issues from the v1.0.0 mainnet launch (June 15, 2026). This release addresses 7 functional/UX fixes (plus 1 reported issue investigated and confirmed as a non-bug), 3 security hardenings, and 2 critical installer bugs. The release also introduces a clean upgrade path from v1.0.0 with transparent installation and clear user feedback during the one-time post-upgrade chainstate rebuild.

The daemon code (Gaelium Core) remains at v1.0.0 - no consensus or protocol changes in this release. All fixes are in the wallet desktop application layer (Electron renderer + main process + NSIS installer script).

## What's New

### User Experience

- **W1** - Status bar no longer overlaps the wallet content when the window is resized to small dimensions.
- **W2** - Address History items can now be copied to clipboard with a single click. Previously, the click handlers were wired before DOM updates which broke the interaction.
- **W3** - Importing a private key now consistently triggers a wallet rescan from the key's creation date, ensuring all related historical transactions are correctly retrieved. The previous optional rescan checkbox was removed to prevent corrupted balance states.
- **W4** - Transactions page now uses server-side pagination (20 items per page) via RPC `listtransactions` skip parameter, dramatically improving load time for wallets with many transactions.
- **W5** - Clearer startup phases and visible sync progress indicator. The sync state is now detected via the headers vs blocks delta, with a visible progress bar showing percentage of blocks downloaded.
- **W6** - Security and Keys pages now use full available width with a multi-column layout on screens above 960 pixels wide, replacing the previous narrow single-column display.
- **W7** - Investigated a reported daemon connectivity issue ("wrong IPs"). No fix was required: full audit of the daemon source code and all distributed binaries confirmed they are clean (no residual Ravencoin DNS seeds, no Ravencoin fixed seeds in the binary arrays). The reported behavior matched standard Bitcoin Core semantics where `addnode=` adds a peer in addition to the DNS-discovered peers rather than replacing them. Operators wanting an isolated node should use `connect=` or set `dnsseed=0` and `dns=0` in `gaelium.conf`.
- **W8** - Wallet now waits for the daemon to fully exit before quitting. Previously, the daemon was terminated prematurely after a fixed 2-second timeout, leaving the chainstate database in an inconsistent state which caused a full chain rescan on next startup. This fix prevents that issue going forward (see Upgrade Notes for one-time impact on v1.0.0 upgrades).

### Security Hardening

- **C1** - Replaced `execSync` with `execFileSync` to prevent shell injection via maliciously crafted system usernames during Linux desktop entry creation.
- **M1** - Enabled `sandbox: true` in Electron BrowserWindow webPreferences for defense-in-depth against renderer-level exploits.
- **M4** - Captured the application executable path at startup before the runtime environment can be tampered with, preventing relaunch hijacking after wallet encryption or restore operations.
- **Cleanup** - Backup files (`*.bak_*`) are now excluded from the distributed packages via `.gitignore` and electron-builder configuration.

### Windows Installer (NSIS)

- **I1bis** - The `gaelium-wallet-updater` folder in `%LOCALAPPDATA%` is now properly removed during uninstall. This folder is created by the Electron auto-updater mechanism and previously remained on disk after uninstall, polluting the user's system.
- **I2** - Transparent upgrade from v1.0.0 to v1.0.1. The installer now deletes `UninstallString` registry values in both HKLM and HKCU before electron-builder reads them, which bypasses the v1.0.0 uninstaller entirely. This eliminates the legacy blockchain data deletion prompt that would otherwise appear during upgrade and could cause data loss if dismissed incorrectly.
- **Future-proofing** - The `${ifNot} ${isUpdated}` guard and `/SD IDNO` safety net on the blockchain prompt ensure that future v1.0.1 → v1.0.2+ upgrades will be completely silent and safe by default.

### Rebuild Banner (UX)

A new informational banner is displayed in the Overview page during the one-time chainstate rebuild that occurs when upgrading from v1.0.0. The banner includes a progress bar and remains visible throughout the rebuild process until the wallet catches up to the network tip. The banner uses `getwalletinfo.keypoololdest` to robustly distinguish between an upgrade context (banner shown) and a fresh install (banner not shown).

## Upgrade Notes

### Upgrading from v1.0.0 - One-time chainstate rebuild

When you launch v1.0.1 for the first time after upgrading from v1.0.0, your wallet will perform a one-time chainstate rebuild. During this rebuild, the block height starts at 0 and progressively increases as the wallet reprocesses the chain.

**This is expected and safe:**
- Your wallet keys, addresses, and labels are fully preserved.
- Your balance will reappear once the rebuild reaches the relevant blocks.
- The rebuild typically takes a few minutes for the current chain size.
- After this one-time rebuild, all subsequent restarts will be instant.

**Why this happens:** v1.0.0 had a daemon shutdown timing issue (now fixed by W8) which sometimes left the chainstate database in an inconsistent state. v1.0.1 detects this on first launch and automatically repairs it using Bitcoin Core's standard recovery procedure. From v1.0.1 onwards, shutdowns are clean and this rebuild will never happen again.

The wallet displays a clear banner during the rebuild so you know exactly what is happening. The banner disappears automatically once the rebuild completes.

### Fresh install - No special action needed

If you do not have v1.0.0 installed, install v1.0.1 as a fresh install. No banner will appear during the initial sync (which uses the normal sync progress indicator instead).

### Daemon (Gaelium Core) version

The standalone daemon binaries (`gaeliumd`, `gaelium-cli`) for miners and pool operators remain at v1.0.0. There are no consensus or protocol changes in this wallet release, so existing daemon installations do not need to be updated.

## Files

[TO BE FILLED ON PUSH DAY - populate with all platform binaries: Windows portable, Windows installer, Linux portable, Linux deb, Linux rpm, Linux AppImage, macOS dmg, macOS zip, and their SHA256 hashes]

**Windows binaries:**
- `Gaelium Wallet 1.0.1.exe` (portable, x64, 76 MB) - SHA256: `d33afb49d824767266fc4ae4b49ca2b1e797049fb4c419396091d4c5d736e3b0`
- `Gaelium Wallet Setup 1.0.1.exe` (installer, x64, 76 MB) - SHA256: `3a3a3dadda05d46cddcd8c9fddcdc367fc6dfae013d3121895b411d2697c52f0`

Note: Windows binaries are not code-signed in v1.0.1. Windows SmartScreen will display a warning during installation. Click "More info" then "Run anyway" to proceed. Code signing (DigiCert EV certificate) is planned for a future release.

## Verification

You can verify the integrity of the downloaded binaries by computing the SHA256 hash and comparing it to the values above.

On Windows (PowerShell):
```
Get-FileHash -Algorithm SHA256 ".\Gaelium Wallet 1.0.1.exe"
```

On Linux/macOS:
```
sha256sum "Gaelium Wallet 1.0.1.exe"
```

## Security

This release was reviewed in two internal security audit waves:
- **Audit Wave 1** identified 3 issues (C1, M1, M4), all fixed in this release.
- **Audit Wave 2** reviewed all post-audit-1 modifications (NSIS installer changes, rebuild banner code). No critical, high, medium, or low severity findings.

The audited surface includes: Electron main process, preload script, renderer (HTML/CSS/JS), and the NSIS installer script. The Gaelium Core daemon source code was previously audited and confirmed clean of legacy Ravencoin references.

## Known Limitations

- **Code signing:** Windows binaries are not yet code-signed. SmartScreen warning will appear on first install. Planned for a future release with DigiCert EV certificate.
- **Hardware wallet support:** Not implemented. Planned for v1.1 or later.
- **Auto-update mechanism:** Not active. Updates require manual download and reinstall via the installer or portable replacement.

## Acknowledgments

Thanks to the Gaelium community for testing the v1.0.0 release and reporting issues that led to this release. Special thanks to the early miners and pool operators (MiningCrypto.Online, the future partners, and the supportive community on Telegram, Discord, and Bitcointalk) for their patience and constructive feedback during the post-launch stabilization period.

## Links

- Website: https://gaelium.io
- Block explorer: https://explorer.gaelium.io
- Mining pool: https://pool.gaelium.io
- GitHub (wallet): https://github.com/gaeliumcore/gaelium-wallet
- GitHub (daemon): https://github.com/gaeliumcore/Gaelium
- Discord: https://discord.gg/FWYEwnwu3p
- Telegram: https://t.me/gaelium (announcements), https://t.me/gaeliumcommunity (chat)
- X / Twitter: https://x.com/gaeliumcore
- Bitcointalk: https://bitcointalk.org/index.php?topic=5585639.0

---

**The Gaelium Team**
