# Gaelium Wallet v1.0.2

This release updates the embedded Gaelium Core daemon and reworks a large part
of the wallet. We recommend updating for security reasons.

Your wallet, keys, addresses and blockchain data are preserved. Install over
your current version, there is nothing to back up or restore first.

## Security

- The embedded daemon is now Gaelium Core v1.0.1, which carries the block
  header height check. The file shipped inside the wallet is the exact same
  binary published on gaelium.io, so you can verify it yourself.
- Every payment is now confirmed in a window that the wallet interface cannot
  draw or alter. What you approve is what gets broadcast.
- Revealing a private key now asks for confirmation the same way.
- The data directory and its configuration file are created with restricted
  permissions on Linux and macOS, and existing installations are corrected on
  first launch.
- The application can no longer be navigated away from its own interface.

## Fees

- The network fee shown before you confirm is now the real fee of the exact
  transaction that will be broadcast, down to the last satoshi. It is no longer
  an estimate.
- The Max button now fills in the largest amount you can actually send. The
  previous version left a small amount behind every time.
- Sending an unusually high fee is refused, and a disproportionate one is
  flagged before you confirm.

## Synchronizing

The first synchronization was confusing and looked like a failure. It has been
rebuilt.

- One progress figure, on one scale, from zero to a hundred, against a target
  that no longer moves.
- No more alarming messages while a healthy synchronization is running.
- Closing the wallet during synchronization now shows what is happening and
  waits for the daemon to write its databases before quitting.

## Wallet

- The market panel now shows the GAEL price, in USD and EUR.
- Receive: clicking an address in your history selects it, and the QR code and
  the label follow. The label of the selected address is shown above the QR.
- Transactions: a transaction and an address can be opened on the block
  explorer from the transaction details.
- Addresses, transaction ids and amounts can be selected with the cursor and
  copied again.

## Requirements

Windows 10 or later, or macOS 14 or later. The macOS floor is set by the
embedded daemon, which requires that version. The Linux build follows shortly.

## Verifying your download

```
Gaelium Wallet Setup 1.0.2.exe
2634971d9cc8d2353d45af6ab7bfb0d88681710ab9176121deaac93220d42b91

Gaelium Wallet 1.0.2.exe
f170bd46ee3e20ec89e397412c31557e6945be5200b71d82f979623c274ccbc7

Gaelium Wallet-1.0.2.dmg
b6e7a736491f00edcaddc45f8bc75c6d1082c72f4bfe9ff0c47126c12ce68798

Gaelium Wallet-1.0.2-mac.zip
29305d744efe6760e5debbdfcbe2e755021a376bbf1ced057cfc174e7ef8ee80
```
