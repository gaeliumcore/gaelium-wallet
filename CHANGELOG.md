# Gaelium Wallet - Changelog

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

## v1.0.0 (2026-06-15)

- Initial public release
