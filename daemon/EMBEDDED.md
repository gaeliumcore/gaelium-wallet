# Embedded daemon binaries

The daemon binaries in this directory are not tracked by git. They are
published as release assets on the project website and downloaded from
there, so no daemon binary is carried in the repository and the shipped
daemon can be verified against a public checksum rather than against a
copy stored here. One binary file is tracked, the macOS application icon
under `build/`, because no published asset provides it.

Each file is named after the release asset it came from. The name states
the platform and the version, so no two build targets can designate the
same file and a change of daemon cannot happen without the build
configuration changing with it.

## Currently embedded

| Platform | File in `daemon/` | Release asset | Daemon version | Size in bytes | SHA256 |
|---|---|---|---|---|---|
| Windows | `gaeliumd-1.0.1.exe` | `gaeliumd-1.0.1.exe` | 4.6.1.1 | 13563904 | `82f044f5ab9673a47fdd24ecda7a5abccb2a70599efa35f8e0045d5897cf26da` |
| macOS | `gaeliumd-mac-1.0.1` | `gaeliumd-mac-1.0.1` | 4.6.1.1 | 15325104 | `c71c7a49aa3556fb5addfb96f23eeb2afd9cf3d9f2a244942f9a8766d75652be` |
| Linux | `gaeliumd-linux-1.0.1` | `gaeliumd-linux-1.0.1` | 4.6.1.1 | 18057944 | `01f5fa48fd39f13d3ad307c8818503c65a939040e95e7259b09039f295ffe010` |

Every target copies its own file to `daemon/gaeliumd` inside the package,
or to `daemon/gaeliumd.exe` on Windows. The application looks for that one
path at run time, so the name inside the package is the same everywhere
and only the source differs.

No `gaelium-cli` is embedded. The wallet talks to the daemon over RPC and
does not ship the command line client.

## What the table describes, and what it does not

The table above describes this repository. It states what the next build of
each platform will embed. It says nothing about packages that are already
published.

The daemon is also published on its own, as a release asset, and there it is
at 1.0.1 on all three platforms. That is the binary a node operator or a
miner downloads and runs, and it carries the block header height check.

A wallet package is a different matter, because it embeds whichever daemon
was in this directory on the day that package was built. A wallet published
before a daemon was replaced here therefore keeps the older one until it is
built again. At the time of writing, the Windows wallet 1.0.2 embeds the
1.0.1 daemon, while the Linux and macOS wallets 1.0.1 embed the 1.0.0 daemon
and will keep doing so until each is rebuilt.

## The macOS floor

The macOS daemon requires macOS 14. That is not a preference, it is what
the binary declares, and the packaged application declares the same value
so that a system too old refuses to launch it instead of opening a wallet
whose daemon can never start. The build reads the value out of the binary
and refuses to produce a package that promises more than the daemon can
deliver.

## Verifying

Every checksum above appears in the `SHA256SUMS` file on the downloads page
of the project website, under the release asset name given in the table.
Since each file here carries its published name, the whole directory can be
checked in one command against that list, with no table of equivalences in
between.

The daemon version column is the internal client version reported by the
binary. It is not the same numbering as the release asset name, and it is
not the same numbering as the wallet version.

## Keeping this file correct

`EMBEDDED.json` in this directory holds the same facts in a form the build
reads. The build fails if the binary it is about to ship does not match
that file, and a test fails if the two records disagree, so neither can
drift away from the other or from what is actually shipped.
