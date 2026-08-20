# Embedded daemon binaries

The daemon binaries in this directory are not tracked by git. They are
published as release assets on the project website and downloaded from
there, so the repository stays free of large binaries and the shipped
daemon can be verified against a public checksum rather than against a
copy stored here.

Each file is named after the release asset it came from. The name states
the platform and the version, so no two build targets can designate the
same file and a change of daemon cannot happen without the build
configuration changing with it.

## Currently embedded

| Platform | File in `daemon/` | Release asset | Daemon version | Size in bytes | SHA256 |
|---|---|---|---|---|---|
| Windows | `gaeliumd-1.0.1.exe` | `gaeliumd-1.0.1.exe` | 4.6.1.1 | 13563904 | `82f044f5ab9673a47fdd24ecda7a5abccb2a70599efa35f8e0045d5897cf26da` |
| macOS | `gaeliumd-mac-1.0.1` | `gaeliumd-mac-1.0.1` | 4.6.1.1 | 15325104 | `c71c7a49aa3556fb5addfb96f23eeb2afd9cf3d9f2a244942f9a8766d75652be` |
| Linux | `gaeliumd-linux-1.0.0` | `gaeliumd-linux-1.0.0` | 4.6.1.0 | 14844248 | `21abecb89c91191d8941cd8465214ae8a3ac0f21ed94fac808c6bdec1333e098` |

Every target copies its own file to `daemon/gaeliumd` inside the package,
or to `daemon/gaeliumd.exe` on Windows. The application looks for that one
path at run time, so the name inside the package is the same everywhere
and only the source differs.

The Linux binary is still the 1.0.0 release and is out of date. It does
not contain the block header height check added in 1.0.1. Replacing it is
tracked separately.

No `gaelium-cli` is embedded. The wallet talks to the daemon over RPC and
does not ship the command line client.

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
