# Embedded daemon binaries

The daemon binaries in this directory are not tracked by git. They are
published as release assets on the project website and downloaded from
there, so the repository stays free of large binaries and the shipped
daemon can be verified against a public checksum rather than against a
copy stored here.

This file records which published binary is currently in place, so that
the contents of `daemon/` can be checked without running anything.

## Currently embedded

| Platform | File in `daemon/` | From release asset | Daemon version | Size in bytes | SHA256 |
|---|---|---|---|---|---|
| Windows | `gaeliumd.exe` | `gaeliumd-1.0.1.exe` | 4.6.1.1 | 13563904 | `82f044f5ab9673a47fdd24ecda7a5abccb2a70599efa35f8e0045d5897cf26da` |
| Linux | `gaeliumd` | `gaeliumd-linux-1.0.0` | 4.6.1.0 | 14844248 | `21abecb89c91191d8941cd8465214ae8a3ac0f21ed94fac808c6bdec1333e098` |

The Linux binary is still the 1.0.0 release and is out of date. It does
not contain the block header height check added in 1.0.1. Replacing it is
tracked separately.

There is no macOS binary in this directory. The macOS build target reads
the same `gaeliumd` path as the Linux target, so a macOS build requires a
macOS binary to be put in place first.

No `gaelium-cli` is embedded. The wallet talks to the daemon over RPC and
does not ship the command line client.

## Verifying

Both checksums above appear in the `SHA256SUMS` file on the downloads page
of the project website, under the release asset names given in the table.
Recomputing the SHA256 of a file in this directory and comparing it to that
published list is enough to confirm which build is embedded.

The daemon version column is the internal client version reported by the
binary. It is not the same numbering as the release asset name, and it is
not the same numbering as the wallet version.

## Keeping this file correct

Any replacement of a binary in this directory must update this file in the
same change. A binary swap leaves no trace in git history, so this file is
the only record of what is shipped.
