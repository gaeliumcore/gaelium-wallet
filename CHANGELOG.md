# Gaelium Wallet - Changelog

## v1.0.1 (in progress)

- [W1] Windows: fix status bar overlap in reduced window mode (sidebar-nav CSS overflow)
- [W2] Windows: fix Address History items not copyable (event handlers wired before DOM update)
- [W3] Windows: remove rescan checkbox, force rescan on all key imports (avoids corrupted balance state)
- [W4] Windows: add pagination to Transactions page (20 items per page, server-side via RPC skip)
- [W5] Windows: clearer startup phases + visible sync progress indicator (sync detection via headers-blocks delta, initialblockdownload unreliable on Gaelium)

## v1.0.0 (2026-06-15)

- Initial public release
