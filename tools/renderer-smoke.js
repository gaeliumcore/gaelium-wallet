// Renderer smoke test.
//
// Two commits on the eighteenth of August cut four hundred lines out of
// src/app.js between a pair of textual markers, taking the send path, the
// Receive screen and the explorer handlers with them. node --check saw nothing,
// because a call to a function that does not exist is valid JavaScript, and the
// result shipped. This is the check that would have caught it in a second.
//
// Run: node tools/renderer-smoke.js
// Exit code 0 if clean, 1 if anything is missing.
//
// Three checks, in order of how early they catch a mistake:
//   1. every name called in src/app.js is defined somewhere, or is a browser
//      global. This is the one that catches a deletion.
//   2. the top level function names match tools/renderer-functions.txt. Any
//      disappearance has to be declared by editing that file on purpose.
//   3. the file loads and its polling runs in a simulated DOM without throwing.

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'src', 'app.js');
const HTML = path.join(ROOT, 'src', 'index.html');
const REF = path.join(__dirname, 'renderer-functions.txt');

const src = fs.readFileSync(APP, 'utf8');
const html = fs.readFileSync(HTML, 'utf8');
let failed = false;
function fail(msg) { failed = true; console.log('  ECHEC  ' + msg); }
function ok(msg) { console.log('  ok     ' + msg); }

// Strings and comments are blanked before looking for calls, so that colours
// written as rgba(...) inside a style string are not taken for functions. Every
// blanked region keeps its line breaks, otherwise a single mismatched quote
// swallows the rest of the file and the check silently inspects nothing. That
// happened on the first draft of this tool: it collapsed seven hundred lines
// into nine and reported two problems out of twenty five.
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
  fail('fonctions appelees et jamais definies dans src/app.js :');
  for (const [n, l] of called) console.log('           ' + n + '   premier appel ligne ' + l);
} else {
  ok('toute fonction appelee est definie');
}

// --- 2. the inventory has not shrunk ---
const present = new Set();
for (const m of src.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) present.add(m[1]);
if (!fs.existsSync(REF)) {
  console.log('  note   ' + path.basename(REF) + ' absent, inventaire ecrit pour reference');
  fs.writeFileSync(REF, [...present].sort().join('\n') + '\n');
} else {
  const ref = new Set(fs.readFileSync(REF, 'utf8').split('\n').map(s => s.trim()).filter(Boolean));
  const perdues = [...ref].filter(n => !present.has(n)).sort();
  const nouvelles = [...present].filter(n => !ref.has(n)).sort();
  if (perdues.length) {
    fail('fonctions de la liste de reference absentes du fichier (' + perdues.length + ') :');
    perdues.forEach(n => console.log('           ' + n));
    console.log('           si la suppression est voulue, retirer le nom de ' + path.basename(REF));
  } else {
    ok('inventaire complet, ' + ref.size + ' fonctions attendues, toutes presentes');
  }
  if (nouvelles.length) ok('nouvelles fonctions non encore declarees : ' + nouvelles.join(', '));
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
const rejets = [];
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
process.on('unhandledRejection', e => rejets.push(e && e.message ? e.message : String(e)));
let charge = true;
try {
  vm.runInContext(src, ctx, { filename: 'src/app.js' });
} catch (e) {
  charge = false;
  fail('src/app.js leve au chargement : ' + e.message);
}
if (charge) ok('src/app.js se charge sans exception');

// --- 4. the confirmation window actually fills itself ---
//
// Six proved scenarios went by without catching a window that loaded, took the
// keyboard and stayed blank, because none of them looked at what it displays.
// This one runs src/confirm.js against the ids src/confirm.html declares, hands
// it the payload the main process sends, and checks that the text lands and that
// the window acknowledges it.
(function confirmWindow() {
  const CH = path.join(ROOT, 'src', 'confirm.html');
  const CJ = path.join(ROOT, 'src', 'confirm.js');
  const CP = path.join(ROOT, 'src', 'confirm-preload.js');
  if (!fs.existsSync(CH) || !fs.existsSync(CJ) || !fs.existsSync(CP)) {
    fail('la fenetre de confirmation est incomplete'); return;
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
  if (!expose) fail('confirm-preload n expose rien');
  else if (GLOBALS_WINDOW.has(expose[1])) fail("confirm-preload expose '" + expose[1] + "', qui existe deja sur window");
  else ok("le pont de la fenetre s appelle '" + expose[1] + "', libre de toute collision");

  const idsDeclares = new Set([...chtml.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const elements = {};
  let clics = 0, clavier = 0, ack = false, reponse = null, focusMis = null;
  function elem(id) {
    if (elements[id]) return elements[id];
    elements[id] = { _id: id, textContent: '', focus() { focusMis = id; }, addEventListener() { clics++; } };
    return elements[id];
  }
  const bridgeName = expose ? expose[1] : 'gaeliumConfirm';
  let onDataCb = null;
  const fenetre = {};
  fenetre[bridgeName] = {
    onData: (cb) => { onDataCb = cb; },
    ready: () => { ack = true; },
    answer: (v) => { reponse = v; }
  };
  const scope = {
    document: {
      getElementById: (id) => (idsDeclares.has(id) ? elem(id) : null),
      addEventListener: () => { clavier++; }
    },
    window: fenetre
  };
  scope.window.document = scope.document;
  scope.window.window = scope.window;
  let boom = null;
  try { vm.runInNewContext(cjs, scope, { filename: 'src/confirm.js' }); }
  catch (e) { boom = e; }
  if (boom) { fail('src/confirm.js leve : ' + boom.message); return; }
  if (clics < 2 || clavier < 1) fail('les boutons ou le clavier ne sont pas cables, clics=' + clics + ' clavier=' + clavier);
  if (!onDataCb) { fail('src/confirm.js ne s abonne pas au contenu'); return; }

  // The payload the main process sends, same shape, same field names.
  onDataCb({
    title: 'Confirm payment',
    message: 'Send 12.50000000 GAEL to\nGKRZSWuxjBiGXxGT9HvY8JvvBbFpnKUG6u',
    detail: 'Network fee    0.00695508 GAEL',
    confirmLabel: 'Send 12.50000000 GAEL',
    cancelLabel: 'Cancel'
  });
  const manquants = ['title', 'message', 'detail', 'ok', 'cancel']
    .filter(id => !elements[id] || !elements[id].textContent);
  if (manquants.length) fail('la fenetre reste vide sur : ' + manquants.join(', '));
  else if (!elements.message.textContent.includes('GKRZSWuxjBiGXxGT9HvY8JvvBbFpnKUG6u'))
    fail("l adresse n est pas ecrite dans la fenetre");
  else if (!ack) fail('la fenetre n accuse pas reception, le repli se declencherait a chaque envoi');
  else if (focusMis !== 'cancel') fail('le focus initial n est pas sur Annuler, il est sur ' + focusMis);
  else ok('la fenetre de confirmation affiche son contenu et en accuse reception');
})();

setTimeout(() => {
  const refs = rejets.filter(m => /is not defined|is not a function|of (null|undefined)/.test(m));
  if (refs.length) {
    fail('exceptions pendant le sondage (' + refs.length + ') :');
    [...new Set(refs)].forEach(m => console.log('           ' + m));
  } else {
    ok('aucune exception de reference pendant le sondage');
  }
  console.log();
  console.log(failed ? '  RESULTAT : ECHEC' : '  RESULTAT : OK');
  process.exit(failed ? 1 : 0);
}, 300);
