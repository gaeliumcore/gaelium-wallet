// Registry consistency check.
//
// Two records describe the embedded daemons: EMBEDDED.md, which people read,
// and EMBEDDED.json, which the build reads and enforces. Two records are worse
// than one as soon as they disagree, so this test asserts that they never do.
//
// It also checks that the build configuration points every target at the file
// the registry names, because a registry that is correct about a file nobody
// embeds protects nothing.
//
// Run: node test/embedded-daemon.js
// Exit code 0 if clean, 1 if anything is missing.

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'daemon', 'EMBEDDED.json'), 'utf8'))
const markdown = fs.readFileSync(path.join(ROOT, 'daemon', 'EMBEDDED.md'), 'utf8')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))

let failed = false
function fail (message) { failed = true; console.log('  FAIL   ' + message) }
function ok (message) { console.log('  ok     ' + message) }

// Rows look like: | Windows | `file` | `asset` | 4.6.1.1 | 13563904 | `sha` |
const rows = markdown.split('\n')
  .filter(line => /^\|/.test(line) && !/^\|\s*-/.test(line) && !/Platform/.test(line))
  .map(line => line.split('|').slice(1, -1).map(cell => cell.trim().replace(/^`|`$/g, '')))

const NAMES = { Windows: 'win32', macOS: 'darwin', Linux: 'linux' }

if (rows.length !== Object.keys(json.targets).length) {
  fail('EMBEDDED.md lists ' + rows.length + ' platforms, EMBEDDED.json lists ' +
    Object.keys(json.targets).length)
} else {
  ok('both records list the same number of platforms')
}

for (const row of rows) {
  const [platform, file, asset, , size, sha] = row
  const key = NAMES[platform]
  if (key == null) { fail('EMBEDDED.md names an unknown platform: ' + platform); continue }
  const entry = json.targets[key]
  if (entry == null) { fail('EMBEDDED.json has no entry for ' + platform); continue }

  if (entry.source !== 'daemon/' + file) {
    fail(platform + ': EMBEDDED.md says ' + file + ', EMBEDDED.json says ' + entry.source)
  } else if (entry.releaseAsset !== asset) {
    fail(platform + ': release asset differs, ' + asset + ' against ' + entry.releaseAsset)
  } else if (String(entry.size) !== size) {
    fail(platform + ': size differs, ' + size + ' against ' + entry.size)
  } else if (entry.sha256 !== sha) {
    fail(platform + ': sha256 differs')
  } else {
    ok(platform + ': both records agree on ' + file)
  }

  const target = pkg.build[key === 'win32' ? 'win' : key === 'darwin' ? 'mac' : 'linux']
  const resources = (target && target.extraResources) || []
  const match = resources.find(item => item && item.from === entry.source)
  if (match == null) {
    fail(platform + ': no build target embeds ' + entry.source)
  } else if (match.to !== entry.packagedPath) {
    fail(platform + ': the target packs it as ' + match.to + ', the registry says ' + entry.packagedPath)
  } else {
    ok(platform + ': the build target embeds it as ' + entry.packagedPath)
  }
}

const mac = json.targets.darwin
if (mac && pkg.build.mac.minimumSystemVersion !== mac.minimumSystemVersion) {
  fail('the macOS target declares ' + pkg.build.mac.minimumSystemVersion +
    ', the registry says ' + mac.minimumSystemVersion)
} else if (mac) {
  ok('the macOS target declares the floor the registry records')
}

console.log('')
console.log(failed ? '  RESULT : FAILED' : '  RESULT : OK')
process.exit(failed ? 1 : 0)
