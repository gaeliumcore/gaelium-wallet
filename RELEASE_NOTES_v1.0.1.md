# Gaelium Wallet v1.0.1

A stability and security release that fixes issues reported after the first
public version. The wallet application is updated. The embedded Gaelium Core
daemon is unchanged, with no consensus or protocol change.

## Fixes

- The status bar no longer overlaps the interface in a small window.
- Address history entries can be copied again with a single click.
- Importing a private key now always rescans from that key's creation date,
  so past transactions are recovered and balances stay correct.
- The transactions page is paginated, twenty entries per page, which loads
  quickly even on wallets with a long history.
- Startup shows clearer phases and a visible synchronization progress bar.
- The Security and Keys pages use the full width on wide screens.
- The wallet now waits for the daemon to fully exit before it closes, which
  prevents an unnecessary chain rescan on the next start.

## Security

This release includes security hardening. We recommend updating.

## Upgrading from v1.0.0

Your wallet, addresses and labels are preserved. The first launch after the
upgrade performs a one time chain repair, shown with a progress banner, after
which every later start is instant. On Windows the upgrade is transparent and
no longer shows the old data deletion prompt.

## Downloads

This archival release collects the v1.0.1 wallet for Windows, macOS and
Linux, the same packages served on gaelium.io. Verify any download against
the checksums published on gaelium.io.
