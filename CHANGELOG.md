# Gaelium Wallet - Changelog

## v1.0.2 (2026-08-19)

- Embedded daemon updated to Gaelium Core 1.0.1, which carries the block header height check. The file shipped inside the wallet is the same binary published as a release asset, so it can be verified against the public checksum.
- Every send is confirmed in a window that the wallet interface cannot draw or alter. What is approved is what gets broadcast.
- Revealing a private key asks for confirmation in the same way.
- The data directory and its configuration file are created with restricted permissions, and existing installations are corrected on first launch.
- The application can no longer be navigated away from its own interface.
- The network fee shown before confirmation is the real fee of the exact transaction that will be broadcast, down to the last satoshi, instead of an estimate.
- Max fills in the largest amount that can actually be sent. The previous version left a small amount behind every time.
- An unusually high fee is refused, and a disproportionate one is flagged before confirmation.
- First synchronization rebuilt: one progress figure, on one scale, against a target that no longer moves, and no alarming messages while a healthy synchronization runs.
- Closing the wallet during synchronization shows what is happening and waits for the daemon to write its databases before quitting.
- Market panel shows the GAEL price in USD and EUR.
- Receive: clicking an address in the history selects it, and the QR code and the label follow. The label of the selected address is shown above the QR.
- Transactions: a transaction and an address can be opened on the block explorer from the transaction details.
- Addresses, transaction ids and amounts can be selected with the cursor and copied again.
- The macOS build carries two fixes that apply to macOS only. The application quits when its last window closes, as it already did on the other platforms, instead of staying alive with no window and no way to reopen one. And after encrypting or restoring a wallet it starts itself again through the system launcher rather than from the executable inside the bundle, so it comes back as the same application and leaves no second entry in the Dock.

## v1.0.1 (2026-06-24)

- [W1] Windows: fix status bar overlap in reduced window mode (sidebar-nav CSS overflow)
- [W2] Windows: fix Address History items not copyable (event handlers wired before DOM update)
- [W3] Windows: remove rescan checkbox, force rescan on all key imports (avoids corrupted balance state)
- [W4] Windows: add pagination to Transactions page (20 items per page, server-side via RPC skip)
- [W5] Windows: clearer startup phases + visible sync progress indicator (sync detection via headers-blocks delta; progress percentage via blocks/headers ratio)
- [W6] Windows: Security and Keys pages use full width with multi-column layout on wide screens
- [W7] Investigated reported daemon "wrong IPs" connection issue: no fix needed. Daemon source code and all distributed binaries audited clean (no residual Ravencoin DNS seeds or fixed seeds). Behavior matches Bitcoin Core standard: addnode= adds peers in addition to DNS seeds; use connect= or dnsseed=0 for isolated node mode.
- [W8] Windows: wait for daemon to fully exit before quitting (fixes chain rescan on every restart)
- [C1] Security: replace execSync with execFileSync to prevent shell injection via crafted usernames (Linux desktop entry)
- [M1] Security: enable sandbox in Electron BrowserWindow webPreferences (defense-in-depth)
- [M4] Security: capture executable path at startup to prevent relaunch hijacking after encryption/restore
- [Cleanup] Exclude backup files (*.bak_*) from distributed packages via .gitignore and electron-builder config
- [I1bis] Installer Windows: remove gaelium-wallet-updater folder from %LOCALAPPDATA% during uninstall
- [I2] Installer Windows: transparent upgrade from v1.0.0 (delete legacy UninstallString registry values in HKLM+HKCU to bypass old uninstaller; isUpdated guard + /SD IDNO safety net for future upgrades)
- [UX] Rebuild banner displayed during one-time chainstate repair after upgrade from v1.0.0 (progress bar, auto-dismiss, keypoololdest-based detection)
- [Build] Scoped extraResources per platform in package.json to avoid embedding foreign-platform daemon binaries in each bundle (reduces Windows installer by ~10 MB; Linux and Mac builds benefit natively)

## v1.0.0 (2026-06-15)

- Initial public release
