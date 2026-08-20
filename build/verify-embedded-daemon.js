// afterPack guard for the embedded daemon.
//
// electron-builder copies extraResources with a warning, not an error, when
// the source is missing. A package with no daemon at all therefore builds
// cleanly, exits zero, and only fails on the user machine, where nothing
// explains why the wallet never syncs. The same silence covers a binary of
// the wrong platform, which is how a Linux daemon can reach a macOS package.
//
// This hook runs after the resources have been copied and before any
// installer is produced, so it inspects what is actually in the packaged
// application rather than what the configuration asked for. It refuses:
//
//   1. a missing binary
//   2. a binary whose executable format does not match the target
//   3. a binary whose sha256 is not the one recorded in EMBEDDED.json
//   4. on macOS, a binary whose minimum system version is higher than the
//      one the package declares to the operating system
//
// It reads the magic bytes itself and computes the digest itself, so it
// behaves the same on every build host and needs nothing on the PATH.

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const REGISTRY = path.join(__dirname, '..', 'daemon', 'EMBEDDED.json')

// First bytes that identify an executable format. Mach-O is matched on the
// 64 bit little endian magic, which is the only one a macOS x86_64 build
// produces; a universal binary would start with the fat magic instead and is
// deliberately rejected here, since nothing in this project produces one.
const SIGNATURES = {
  'mach-o-x86-64': { magic: [0xcf, 0xfa, 0xed, 0xfe], label: 'Mach-O 64 bit' },
  pe: { magic: [0x4d, 0x5a], label: 'PE' },
  elf: { magic: [0x7f, 0x45, 0x4c, 0x46], label: 'ELF' }
}

function fail (message) {
  throw new Error('embedded daemon check failed: ' + message)
}

function describeMagic (buffer) {
  for (const [name, spec] of Object.entries(SIGNATURES)) {
    if (spec.magic.every((byte, i) => buffer[i] === byte)) return spec.label
  }
  if (buffer[0] === 0xca && buffer[1] === 0xfe) return 'Mach-O universal'
  return 'unknown, first bytes ' + [...buffer.slice(0, 4)].map(b => b.toString(16).padStart(2, '0')).join(' ')
}

// Reads the minimum system version out of a 64 bit little endian Mach-O.
// Returns null when the binary carries no such load command.
function machoMinimumSystemVersion (file) {
  const fd = fs.openSync(file, 'r')
  try {
    const header = Buffer.alloc(32)
    fs.readSync(fd, header, 0, 32, 0)
    if (header.readUInt32LE(0) !== 0xfeedfacf) return null
    const commandCount = header.readUInt32LE(16)
    let offset = 32
    for (let i = 0; i < commandCount; i++) {
      const head = Buffer.alloc(8)
      fs.readSync(fd, head, 0, 8, offset)
      const command = head.readUInt32LE(0)
      const size = head.readUInt32LE(4)
      if (size < 8) return null
      // LC_BUILD_VERSION carries the platform then the minimum version,
      // LC_VERSION_MIN_MACOSX carries the minimum version straight away.
      if (command === 0x32 || command === 0x24) {
        const body = Buffer.alloc(8)
        fs.readSync(fd, body, 0, 8, offset + 8)
        const raw = command === 0x32 ? body.readUInt32LE(4) : body.readUInt32LE(0)
        return (raw >> 16) + '.' + ((raw >> 8) & 0xff)
      }
      offset += size
    }
    return null
  } finally {
    fs.closeSync(fd)
  }
}

function compareVersions (left, right) {
  const a = String(left).split('.').map(Number)
  const b = String(right).split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0)
    if (d !== 0) return d < 0 ? -1 : 1
  }
  return 0
}

exports.default = async function verifyEmbeddedDaemon (context) {
  const platform = context.electronPlatformName
  const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'))
  const expected = registry.targets[platform]
  if (expected == null) fail('no entry for target ' + platform + ' in EMBEDDED.json')

  const resourcesDir = context.packager.getResourcesDir(context.appOutDir)
  const packaged = path.join(resourcesDir, ...expected.packagedPath.split('/'))

  if (!fs.existsSync(packaged)) {
    fail('the ' + platform + ' package contains no ' + expected.packagedPath + '. ' +
      'Expected the source ' + expected.source + ', which is the published asset ' +
      expected.releaseAsset + '. A missing source is only a warning to the packer, ' +
      'so the package would otherwise have shipped without a daemon.')
  }

  const contents = fs.readFileSync(packaged)
  const signature = SIGNATURES[expected.format]
  if (signature == null) fail('unknown format ' + expected.format + ' declared for ' + platform)
  if (!signature.magic.every((byte, i) => contents[i] === byte)) {
    fail('the daemon in the ' + platform + ' package is not ' + signature.label +
      '. Found ' + describeMagic(contents) + ' in ' + expected.packagedPath + '.')
  }

  if (contents.length !== expected.size) {
    fail('the daemon in the ' + platform + ' package is ' + contents.length +
      ' bytes, expected ' + expected.size + '.')
  }

  const digest = crypto.createHash('sha256').update(contents).digest('hex')
  if (digest !== expected.sha256) {
    fail('the daemon in the ' + platform + ' package is not the recorded build.\n' +
      '  expected ' + expected.sha256 + '  (' + expected.releaseAsset + ')\n' +
      '  found    ' + digest)
  }

  let note = ''
  if (platform === 'darwin') {
    const declared = context.packager.platformSpecificBuildOptions.minimumSystemVersion
    const actual = machoMinimumSystemVersion(packaged)
    if (actual == null) fail('the macOS daemon carries no minimum system version')
    if (declared == null) {
      fail('the macOS target declares no minimumSystemVersion, but its daemon requires ' +
        actual + '. Users below that version would install a wallet whose daemon cannot start.')
    }
    if (compareVersions(declared, actual) < 0) {
      fail('the macOS package declares macOS ' + declared + ' but its daemon requires ' +
        actual + '. Raise minimumSystemVersion or embed a daemon built for a lower floor.')
    }
    note = ', minimum system version ' + actual + ' within the declared ' + declared
  }

  console.log('  embedded daemon verified: ' + expected.releaseAsset +
    ' as ' + expected.packagedPath + ', ' + signature.label + ', ' +
    contents.length + ' bytes, sha256 ' + digest + note)
}
