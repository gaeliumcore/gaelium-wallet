// Renderer smoke test.
//
// node --check accepts a call to a function that does not exist, so a deletion
// in src/app.js can pass every syntax check and still ship a screen that does
// nothing. These checks ask the questions a parser does not.
//
// Run: node test/renderer-smoke.js
// Exit code 0 if clean, 1 if anything is missing.
//
// The checks, in order of how early they catch a mistake:
//   1. every name called in src/app.js is defined somewhere, or is a browser
//      global. This is the one that catches a deletion.
//   2. every element id the renderer reaches for exists, either declared in
//      src/index.html or built by the renderer itself. This catches a wiring
//      that leads nowhere after a rename or a removal.
//   3. src/app.js loads and polls in a simulated DOM without throwing, and no
//      reference error surfaces while it polls.
//   4. the confirmation window fills itself and acknowledges it, and its
//      bridge is named something window does not already carry.
//
// There is deliberately no list of expected function names to keep in step. A
// frozen inventory rots: it has to be edited by hand on every legitimate change,
// and a contributor who adds a function should not have to discover why the
// build refuses it. Every check above is derived from the code itself.

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'src', 'app.js');
const HTML = path.join(ROOT, 'src', 'index.html');

const src = fs.readFileSync(APP, 'utf8');
const html = fs.readFileSync(HTML, 'utf8');
let failed = false;
function fail(msg) { failed = true; console.log('  FAIL   ' + msg); }
function ok(msg) { console.log('  ok     ' + msg); }

// Strings and comments are blanked before looking for calls, so that colours
// written as rgba(...) inside a style string are not taken for functions. Every
// blanked region keeps its line breaks, otherwise a single mismatched quote
// swallows the rest of the file and the check silently inspects nothing.
const blank = m => m.replace(/[^\n]/g, ' ');
function stripped(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    // Regular expression literals, recognised by what can legally precede one.
    // Without this, the B of a word boundary followed by a group reads as a call
    // to a function named B.
    .replace(/([=(,:[!&|?{;]\s*)(\/(?![*\/])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^\/\\\n])+\/[gimsuy]*)/g,
      (m, p1, re) => p1 + blank(re))
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
    .replace(/'(?:\\.|[^'\\\n])*'/g, blank)
    .replace(/"(?:\\.|[^"\\\n])*"/g, blank)
    .replace(/`(?:\\.|[^`\\])*`/g, blank);
}

const GLOBALS = new Set(['window','document','navigator','console','setTimeout','setInterval',
  'clearTimeout','clearInterval','Date','Math','JSON','String','Number','Object','Array','Boolean',
  'isFinite','isNaN','parseFloat','parseInt','Error','Promise','Set','Map','WeakMap','RegExp','Symbol',
  'encodeURIComponent','decodeURIComponent','encodeURI','decodeURI','alert','confirm','prompt','fetch',
  'URL','Blob','Image','qrcode','requestAnimationFrame','structuredClone','BigInt']);
const KEYWORDS = new Set(['if','for','while','switch','catch','function','return','typeof','new','await',
  'else','do','try','delete','void','in','of','instanceof','yield','case','throw','var','let','const']);

// --- 1. every call resolves to something ---
const code = stripped(src);
const defined = new Set();
for (const m of code.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
for (const m of code.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
for (const m of code.matchAll(/(?:const|let|var)\s*\{([^}]*)\}/g))
  m[1].split(',').forEach(p => { const n = p.split(':').pop().trim(); if (n) defined.add(n); });
// parameters, so a callback called by its parameter name is not flagged
for (const m of code.matchAll(/(?:function\s*[A-Za-z_$\w$]*\s*)?\(([^)]*)\)\s*(?:=>|\{)/g))
  m[1].split(',').forEach(p => { const n = p.trim().split(/[=\s]/)[0]; if (/^[A-Za-z_$][\w$]*$/.test(n)) defined.add(n); });
for (const m of code.matchAll(/catch\s*\(\s*([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);

const called = new Map();
const lines = code.split('\n');
lines.forEach((line, i) => {
  for (const m of line.matchAll(/(?:^|[^.\w$?])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const n = m[1];
    if (KEYWORDS.has(n) || GLOBALS.has(n) || defined.has(n)) continue;
    if (!called.has(n)) called.set(n, i + 1);
  }
});
if (called.size) {
  fail('functions called but never defined in src/app.js:');
  for (const [n, l] of called) console.log('           ' + n + '   first call line ' + l);
} else {
  ok('every function called is defined');
}

// --- 2. every id the renderer reaches for actually exists ---
//
// An id is legitimate if src/index.html declares it, or if src/app.js builds it
// itself through innerHTML. Anything else is a wiring that leads nowhere: an
// element renamed in the page, or the code that used to create it removed.
//
// This is read from the raw source on purpose, not from the blanked copy used
// by check 1, because the id lives inside a string literal and blanking the
// strings would leave this check matching nothing and passing forever.
const pageIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
for (const m of src.matchAll(/id="([^"]+)"/g)) pageIds.add(m[1]);
for (const m of src.matchAll(/id=\\"([^\\"]+)\\"/g)) pageIds.add(m[1]);
const wanted = new Map();
src.split('\n').forEach((line, i) => {
  for (const m of line.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g))
    if (!pageIds.has(m[1]) && !wanted.has(m[1])) wanted.set(m[1], i + 1);
});
if (wanted.size) {
  fail('ids src/app.js reaches for that exist neither in the page nor in the renderer:');
  for (const [n, l] of wanted) console.log('           ' + n + '   line ' + l);
} else {
  ok('the ' + pageIds.size + ' known ids cover the ' + new Set([...src.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1])).size + ' the renderer asks for');
}

// --- 3. the file loads and polls without throwing ---
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const elements = {};
function el(id) {
  if (elements[id]) return elements[id];
  const e = { style: {}, dataset: {}, title: '', value: '', checked: false,
    textContent: '', innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    removeAttribute() {}, setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, focus() {}, click() {},
    querySelectorAll() { return []; }, querySelector() { return null; }, closest() { return null; },
    appendChild() {}, remove() {}, getContext() { return null; } };
  elements[id] = e; return e;
}
const rejections = [];
const box = {
  console: { log() {}, warn() {}, error() {} },
  document: {
    getElementById: id => (ids.has(id) ? el(id) : null),
    querySelectorAll: () => [], querySelector: () => null,
    createElement: () => el('__tmp__'), addEventListener() {}, body: el('__body__') },
  navigator: { clipboard: { writeText() {} } },
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  Date, Math, JSON, String, Number, Object, Array, Boolean, isFinite, isNaN,
  parseFloat, parseInt, Error, Promise, Set, Map, RegExp, encodeURIComponent, qrcode: () => null };
box.window = box;
// Every bridge preload exposes, answering the way the daemon does while it starts.
const preload = fs.readFileSync(path.join(ROOT, 'preload.js'), 'utf8');
box.window.gaelium = {};
for (const m of preload.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)) {
  box.window.gaelium[m[1]] = () => Promise.resolve({ error: 'Loading block index...' });
}
box.window.gaelium.onShutdownStarted = () => {};
box.window.gaelium.listTransactions = () => Promise.resolve([]);
box.window.gaelium.getMarketPrices = () => Promise.resolve(null);

const ctx = vm.createContext(box);
process.on('unhandledRejection', e => rejections.push(e && e.message ? e.message : String(e)));
let loaded = true;
try {
  vm.runInContext(src, ctx, { filename: 'src/app.js' });
} catch (e) {
  loaded = false;
  fail('src/app.js throws on load: ' + e.message);
}
if (loaded) ok('src/app.js loads without throwing');

// --- 4. the confirmation window actually fills itself ---
//
// Loading, focus and exceptions can all be satisfied by a window that stays
// blank, which is the failure the fallback exists to catch, so this check looks
// at what the window displays. It runs src/confirm.js against the ids src/confirm.html declares, hands
// it the payload the main process sends, and checks that the text lands and that
// the window acknowledges it.
(function confirmWindow() {
  const CH = path.join(ROOT, 'src', 'confirm.html');
  const CJ = path.join(ROOT, 'src', 'confirm.js');
  const CP = path.join(ROOT, 'src', 'confirm-preload.js');
  if (!fs.existsSync(CH) || !fs.existsSync(CJ) || !fs.existsSync(CP)) {
    fail('the confirmation window is incomplete'); return;
  }
  const chtml = fs.readFileSync(CH, 'utf8');
  const cjs = fs.readFileSync(CJ, 'utf8');
  const cpre = fs.readFileSync(CP, 'utf8');

  // The name the preload exposes must not already exist on window. Exposing on
  // top of a built in leaves the built in in place, the window script throws on
  // its first line, and nothing is wired. That is the bug this check exists for.
  const GLOBALS_WINDOW = new Set(['confirm','alert','prompt','open','close','print','focus','blur',
    'name','status','length','top','self','parent','frames','location','history','navigator',
    'document','screen','crypto','performance','localStorage','sessionStorage','fetch','postMessage']);
  const expose = cpre.match(/exposeInMainWorld\(\s*'([^']+)'/);
  if (!expose) fail('confirm-preload exposes nothing');
  else if (GLOBALS_WINDOW.has(expose[1])) fail("confirm-preload exposes '" + expose[1] + "', which window already carries");
  else ok("the window bridge is named '" + expose[1] + "', free of any collision");

  const declaredIds = new Set([...chtml.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const elements = {};
  let clicks = 0, keyListeners = 0, ack = false, answered = null, focusedId = null;
  function elem(id) {
    if (elements[id]) return elements[id];
    elements[id] = { _id: id, textContent: '', focus() { focusedId = id; }, addEventListener() { clicks++; } };
    return elements[id];
  }
  const bridgeName = expose ? expose[1] : 'gaeliumConfirm';
  let onDataCb = null;
  const windowStub = {};
  windowStub[bridgeName] = {
    onData: (cb) => { onDataCb = cb; },
    ready: () => { ack = true; },
    answer: (v) => { answered = v; }
  };
  const scope = {
    document: {
      getElementById: (id) => (declaredIds.has(id) ? elem(id) : null),
      addEventListener: () => { keyListeners++; }
    },
    window: windowStub
  };
  scope.window.document = scope.document;
  scope.window.window = scope.window;
  let boom = null;
  try { vm.runInNewContext(cjs, scope, { filename: 'src/confirm.js' }); }
  catch (e) { boom = e; }
  if (boom) { fail('src/confirm.js throws: ' + boom.message); return; }
  if (clicks < 2 || keyListeners < 1) fail('buttons or keyboard are not wired, clicks=' + clicks + ' keyboard=' + keyListeners);
  if (!onDataCb) { fail('src/confirm.js does not subscribe to the payload'); return; }

  // The payload the main process sends, same shape, same field names.
  onDataCb({
    title: 'Confirm payment',
    message: 'Send 12.50000000 GAEL to\nGKRZSWuxjBiGXxGT9HvY8JvvBbFpnKUG6u',
    detail: 'Network fee    0.00695508 GAEL',
    confirmLabel: 'Send 12.50000000 GAEL',
    cancelLabel: 'Cancel'
  });
  const missing = ['title', 'message', 'detail', 'ok', 'cancel']
    .filter(id => !elements[id] || !elements[id].textContent);
  if (missing.length) fail('the window stays blank on: ' + missing.join(', '));
  else if (!elements.message.textContent.includes('GKRZSWuxjBiGXxGT9HvY8JvvBbFpnKUG6u'))
    fail("the address is not written into the window");
  else if (!ack) fail('the window does not acknowledge, the fallback would fire on every send');
  else if (focusedId !== 'cancel') fail('initial focus is not on Cancel, it is on ' + focusedId);
  else ok('the confirmation window displays its content and acknowledges it');
})();

setTimeout(() => {
  const refs = rejections.filter(m => /is not defined|is not a function|of (null|undefined)/.test(m));
  if (refs.length) {
    fail('reference exceptions during polling (' + refs.length + '):');
    [...new Set(refs)].forEach(m => console.log('           ' + m));
  } else {
    ok('no reference exception during polling');
  }
  console.log();
  console.log(failed ? '  RESULT : FAIL' : '  RESULT : OK');
  process.exit(failed ? 1 : 0);
}, 300);
