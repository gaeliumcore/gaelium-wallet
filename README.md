# Gaelium Wallet

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.1-orange.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)

> Gaelium (GAEL) desktop wallet — Windows, Linux, macOS.

## Overview

Official desktop wallet for Gaelium (GAEL) cryptocurrency.
Built with Electron, supports Windows, Linux and macOS.

## Features

- Send and receive GAEL
- Wallet encryption
- Transaction history
- Real-time blockchain sync
- Built-in daemon management

## Downloads

Latest release: [v1.0.1](https://github.com/gaeliumcore/Gaelium/releases/tag/v1.0.1)

| Platform | File |
|----------|------|
| Windows | Gaelium Wallet Setup 1.0.1.exe (installer) |
| Windows | Gaelium Wallet 1.0.1.exe (portable) |
| Linux | GaeliumWallet-1.0.1.AppImage |
| Linux | gaelium-wallet_1.0.1_amd64.deb |
| Linux | gaelium-wallet-1.0.1.x86_64.rpm |
| macOS | Gaelium Wallet-1.0.1.dmg |
| macOS | Gaelium Wallet-1.0.1-mac.zip |

## Build from source
```bash
npm install
npm start
```

Build for all platforms:
```bash
npx electron-builder --win
npx electron-builder --linux
npx electron-builder --mac
```

## Requirements

- Node.js 18+
- Gaelium daemon (gaeliumd) — included in releases

## Links

- 🌐 Website: https://gaelium.io
- 📦 Main repo: https://github.com/gaeliumcore/Gaelium
- 💬 Telegram: https://t.me/gaelium
- 𝕏 Twitter/X: https://twitter.com/gaeliumcore
- 💬 Discord: https://discord.gg/FWYEwnwu3p

## License

MIT License — see [LICENSE](LICENSE) for details.
